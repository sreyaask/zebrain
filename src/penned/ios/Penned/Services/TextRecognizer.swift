import PDFKit
import UIKit
import Vision

/// A diagram cut out of a page. Uploaded as `diagram-<id>.png`; the text holds `[[diagram:<id>]]` where it goes,
/// and the admin portal traces it into pen strokes.
struct ExtractedDiagram: Identifiable {
    let id: String
    let png: Data
}

/// Everything read from the customer's pages, in reading order.
struct Extraction {
    var text: String = ""
    var pages: Int = 0
    var diagrams: [ExtractedDiagram] = []

    mutating func append(_ other: Extraction) {
        let t = other.text.trimmingCharacters(in: .whitespacesAndNewlines)
        if !t.isEmpty { text += (text.isEmpty ? "" : "\n\n") + t }
        pages += other.pages
        diagrams += other.diagrams
    }
}

/// Reads notes from photos and PDFs on the device: the text (headings and paragraphs kept) plus any diagrams.
enum TextRecognizer {
    /// Longest edge pages are rendered at for reading.
    private static let renderEdge: CGFloat = 2000

    // MARK: Public

    static func read(image: UIImage) async -> Extraction {
        guard let page = upright(image) else { return Extraction(pages: 1) }
        var out = analyse(page, lines: ocrLines(page))
        out.pages = 1
        return out
    }

    /// Digital PDFs use their text layer (with positions); scanned PDFs are rendered on white and read with Vision.
    static func read(pdf data: Data) async -> Extraction {
        guard let doc = PDFDocument(data: data) else { return Extraction() }
        var all = Extraction()
        for i in 0..<doc.pageCount {
            guard let page = doc.page(at: i), let image = render(page) else { continue }
            var lines: [TextLine] = []
            let layer = page.string?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            if layer.count > 40, page.rotation % 360 == 0 {
                lines = layerLines(page)
            }
            if lines.isEmpty { lines = ocrLines(image) }
            var one = analyse(image, lines: lines)
            one.pages = 1
            all.append(one)
        }
        all.pages = doc.pageCount
        return all
    }

    // MARK: Rendering

    /// Draws the image upright on an opaque white page (transparent pixels read as black otherwise), at most `renderEdge` px.
    private static func upright(_ image: UIImage) -> CGImage? {
        let scale = min(1, renderEdge / max(image.size.width, image.size.height))
        let size = CGSize(width: (image.size.width * scale).rounded(), height: (image.size.height * scale).rounded())
        guard size.width >= 1, size.height >= 1 else { return nil }
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = true
        return UIGraphicsImageRenderer(size: size, format: format).image { ctx in
            UIColor.white.setFill()
            ctx.fill(CGRect(origin: .zero, size: size))
            image.draw(in: CGRect(origin: .zero, size: size))
        }.cgImage
    }

    /// PDF page thumbnails have a transparent background, which Vision reads as black. Composite onto white.
    private static func render(_ page: PDFPage) -> CGImage? {
        let thumb = page.thumbnail(of: CGSize(width: renderEdge, height: renderEdge), for: .mediaBox)
        return upright(thumb)
    }

    // MARK: Text lines

    /// One line of text and where it sits, normalised 0…1 with the origin at the top-left.
    struct TextLine {
        var text: String
        var rect: CGRect
    }

    private static func ocrLines(_ image: CGImage) -> [TextLine] {
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = true
        request.recognitionLanguages = ["en-IN", "en-US"]
        do {
            try VNImageRequestHandler(cgImage: image, orientation: .up).perform([request])
        } catch {
            return []
        }
        let found: [TextLine] = (request.results ?? []).compactMap { obs in
            guard let s = obs.topCandidates(1).first?.string, !s.trimmingCharacters(in: .whitespaces).isEmpty else { return nil }
            let b = obs.boundingBox
            return TextLine(text: s, rect: CGRect(x: b.minX, y: 1 - b.maxY, width: b.width, height: b.height))
        }
        return mergeRows(found)
    }

    private static func layerLines(_ page: PDFPage) -> [TextLine] {
        let box = page.bounds(for: .mediaBox)
        guard box.width > 0, box.height > 0, let all = page.selection(for: box) else { return [] }
        let found: [TextLine] = all.selectionsByLine().compactMap { sel in
            guard let s = sel.string?.trimmingCharacters(in: .whitespacesAndNewlines), !s.isEmpty else { return nil }
            let b = sel.bounds(for: page)
            return TextLine(
                text: s,
                rect: CGRect(x: (b.minX - box.minX) / box.width, y: 1 - (b.maxY - box.minY) / box.height,
                             width: b.width / box.width, height: b.height / box.height)
            )
        }
        return mergeRows(found)
    }

    /// Vision can split one line into pieces; join pieces that share a row, left to right.
    private static func mergeRows(_ lines: [TextLine]) -> [TextLine] {
        let sorted = lines.sorted { $0.rect.midY < $1.rect.midY }
        var rows: [[TextLine]] = []
        for l in sorted {
            if let last = rows.last?.last, abs(last.rect.midY - l.rect.midY) < min(last.rect.height, l.rect.height) * 0.5 {
                rows[rows.count - 1].append(l)
            } else {
                rows.append([l])
            }
        }
        return rows.map { row in
            let r = row.sorted { $0.rect.minX < $1.rect.minX }
            return TextLine(text: r.map(\.text).joined(separator: " "), rect: r.dropFirst().reduce(r[0].rect) { $0.union($1.rect) })
        }
    }

    // MARK: Diagrams and reading order

    private enum Item {
        case line(TextLine)
        case diagram(id: String, top: CGFloat, bottom: CGFloat)
        var top: CGFloat {
            switch self {
            case let .line(l): l.rect.minY
            case let .diagram(_, top, _): top
            }
        }
    }

    /// Finds ink that isn't text (drawings, graphs, figures), crops it, and writes the page in reading order.
    private static func analyse(_ image: CGImage, lines: [TextLine]) -> Extraction {
        let bands = diagramBands(image, lines: lines)
        var out = Extraction()
        var items: [Item] = []
        var kept = lines
        for band in bands {
            // Labels inside a diagram are part of the drawing, not the text.
            kept.removeAll { band.contains(CGPoint(x: $0.rect.midX, y: $0.rect.midY)) }
            guard let png = crop(image, band) else { continue }
            let id = String(UUID().uuidString.lowercased().replacingOccurrences(of: "-", with: "").prefix(10))
            out.diagrams.append(ExtractedDiagram(id: id, png: png))
            items.append(.diagram(id: id, top: band.minY, bottom: band.maxY))
        }
        items += kept.map { Item.line($0) }
        items.sort { $0.top < $1.top }
        out.text = compose(items, lineHeight: median(kept.map(\.rect.height)) ?? 0.02)
        return out
    }

    /// Paragraphs from vertical gaps, headings from noticeably taller short lines.
    private static func compose(_ items: [Item], lineHeight h: CGFloat) -> String {
        var blocks: [String] = []
        var para = ""
        var prevBottom: CGFloat?
        func flush() {
            let p = para.trimmingCharacters(in: .whitespaces)
            if !p.isEmpty { blocks.append(p) }
            para = ""
        }
        for item in items {
            switch item {
            case let .diagram(id, _, bottom):
                flush()
                blocks.append("[[diagram:\(id)]]")
                prevBottom = bottom
            case let .line(l):
                let text = l.text.trimmingCharacters(in: .whitespaces)
                let isHeading = l.rect.height > h * 1.35 && text.count <= 60 && !text.hasSuffix(".")
                let gap = prevBottom.map { l.rect.minY - $0 } ?? 0
                if isHeading {
                    flush()
                    blocks.append("# " + text)
                } else {
                    if gap > h * 0.9 { flush() }
                    if para.hasSuffix("-") { para.removeLast(); para += text } else { para += (para.isEmpty ? "" : " ") + text }
                    // A short line ending a sentence usually ends a paragraph or list item.
                    if l.rect.maxX < 0.6 && (text.hasSuffix(".") || text.hasSuffix(":")) { flush() }
                }
                prevBottom = l.rect.maxY
            }
        }
        flush()
        return blocks.joined(separator: "\n")
    }

    /// Horizontal bands (normalised, top-left origin) holding ink that no text line explains.
    private static func diagramBands(_ image: CGImage, lines: [TextLine]) -> [CGRect] {
        let w = 400
        let h = max(1, Int((CGFloat(image.height) / CGFloat(image.width) * CGFloat(w)).rounded()))
        var px = [UInt8](repeating: 255, count: w * h)
        let drawn: Bool = px.withUnsafeMutableBytes { buf in
            guard let ctx = CGContext(data: buf.baseAddress, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w,
                                      space: CGColorSpaceCreateDeviceGray(), bitmapInfo: CGImageAlphaInfo.none.rawValue) else { return false }
            ctx.interpolationQuality = .medium
            ctx.draw(image, in: CGRect(x: 0, y: 0, width: w, height: h))
            return true
        }
        guard drawn else { return [] }

        // Ink threshold relative to the paper (photos of paper are grey, not white).
        let mean = px.reduce(0) { $0 + Int($1) } / px.count
        let threshold = UInt8(max(60, min(170, mean - 60)))
        var ink = [Bool](repeating: false, count: w * h)
        let edgeX = Int(Double(w) * 0.03), edgeY = Int(Double(h) * 0.02)
        for y in edgeY..<max(edgeY, h - edgeY) {
            for x in edgeX..<max(edgeX, w - edgeX) where px[y * w + x] < threshold { ink[y * w + x] = true }
        }
        // Mask out text (with room for underlines and descenders).
        for l in lines {
            let pad = l.rect.height * 0.45
            let x0 = max(0, Int((l.rect.minX - 0.01) * CGFloat(w))), x1 = min(w, Int(ceil((l.rect.maxX + 0.01) * CGFloat(w))))
            let y0 = max(0, Int((l.rect.minY - pad * 0.6) * CGFloat(h))), y1 = min(h, Int(ceil((l.rect.maxY + pad) * CGFloat(h))))
            guard x0 < x1, y0 < y1 else { continue }
            for y in y0..<y1 { for x in x0..<x1 { ink[y * w + x] = false } }
        }

        // Rows with leftover ink, grouped into bands across small gaps.
        let rowInk = (0..<h).map { y in (0..<w).reduce(0) { $0 + (ink[y * w + $1] ? 1 : 0) } }
        let maxGap = max(3, Int(Double(h) * 0.02))
        var bands: [(Int, Int)] = []
        var start: Int?, last = -1000
        for y in 0..<h where rowInk[y] >= 2 {
            if let s = start, y - last > maxGap { bands.append((s, last)); start = y }
            if start == nil { start = y }
            last = y
        }
        if let s = start { bands.append((s, last)) }

        return bands.compactMap { band -> CGRect? in
            let (y0, y1) = band
            let bandH = y1 - y0 + 1
            guard Double(bandH) >= Double(h) * 0.05 else { return nil }
            var minX = w, maxX = -1, total = 0
            for y in y0...y1 {
                for x in 0..<w where ink[y * w + x] {
                    minX = min(minX, x); maxX = max(maxX, x); total += 1
                }
            }
            guard maxX >= minX, Double(maxX - minX) >= Double(w) * 0.1, Double(total) >= Double(w * h) * 0.0015 else { return nil }
            let pad = 0.015
            return CGRect(x: Double(minX) / Double(w) - pad, y: Double(y0) / Double(h) - pad,
                          width: Double(maxX - minX + 1) / Double(w) + pad * 2, height: Double(bandH) / Double(h) + pad * 2)
                .intersection(CGRect(x: 0, y: 0, width: 1, height: 1))
        }
    }

    private static func crop(_ image: CGImage, _ rect: CGRect) -> Data? {
        let r = CGRect(x: rect.minX * CGFloat(image.width), y: rect.minY * CGFloat(image.height),
                       width: rect.width * CGFloat(image.width), height: rect.height * CGFloat(image.height)).integral
        guard let cut = image.cropping(to: r) else { return nil }
        let scale = min(1, 1600 / CGFloat(max(cut.width, cut.height)))
        let size = CGSize(width: (CGFloat(cut.width) * scale).rounded(), height: (CGFloat(cut.height) * scale).rounded())
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = true
        return UIGraphicsImageRenderer(size: size, format: format).pngData { ctx in
            UIColor.white.setFill()
            ctx.fill(CGRect(origin: .zero, size: size))
            UIImage(cgImage: cut).draw(in: CGRect(origin: .zero, size: size))
        }
    }

    private static func median(_ xs: [CGFloat]) -> CGFloat? {
        guard !xs.isEmpty else { return nil }
        return xs.sorted()[xs.count / 2]
    }
}

extension UIImage {
    /// Downscale so uploads stay small but readable.
    func jpegForUpload(maxEdge: CGFloat = 2400) -> Data? {
        let scale = min(1, maxEdge / max(size.width, size.height))
        let target = CGSize(width: size.width * scale, height: size.height * scale)
        let resized = UIGraphicsImageRenderer(size: target).image { _ in draw(in: CGRect(origin: .zero, size: target)) }
        return resized.jpegData(compressionQuality: 0.85)
    }
}
