import SwiftUI

/// Every page of the order, swipeable: the text in the customer's handwriting and each diagram exactly as it was on
/// their notes, in the same order. Page breaks are an estimate; the team does the final layout.
struct PagedPreview: View {
    let text: String
    let glyphs: GlyphSet?
    let ink: Ink
    let ruled: Bool
    let lineSpacing: Double
    let marginMm: Double
    let headingStyle: HeadingStyle
    let pageMm: (w: Double, h: Double)
    /// The cropped picture for a `[[diagram:<id>]]` line, if there is one.
    let diagramImage: (String) -> UIImage?

    @State private var current = 0
    @ScaledMetric(relativeTo: .body) private var pageWidth: CGFloat = 270

    enum Segment: Hashable {
        case text(String, rows: Int)
        case diagram(String, rows: Int)
    }

    private var pitchMm: Double { 7.2 * lineSpacing }
    private var rowsPerPage: Int { max(6, Int((pageMm.h - 30) / pitchMm)) }

    /// Splits the order into pages: text lines wrap by an average character width, and a diagram takes
    /// a third of a page (or more if it's tall), never split across pages.
    var pages: [[Segment]] {
        let charsPerLine = max(10, Int((pageMm.w - marginMm * 2) / 2.3))
        let diagramRows = max(4, rowsPerPage / 3)
        var pages: [[Segment]] = [[]]
        var used = 0
        var chunk: [String] = []
        var chunkRows = 0

        func flushText() {
            guard !chunk.isEmpty else { return }
            pages[pages.count - 1].append(.text(chunk.joined(separator: "\n"), rows: chunkRows))
            chunk = []
            chunkRows = 0
        }
        func newPage() {
            flushText()
            pages.append([])
            used = 0
        }

        for raw in text.components(separatedBy: "\n") {
            let line = raw.trimmingCharacters(in: .whitespaces)
            if let id = line.wholeMatch(of: #/\[\[diagram:([\w-]+)\]\]/#)?.output.1 {
                if used + diagramRows > rowsPerPage && used > 0 { newPage() }
                flushText()
                pages[pages.count - 1].append(.diagram(String(id), rows: diagramRows))
                used += diagramRows
                continue
            }
            let rows = max(1, Int((Double(line.count) / Double(charsPerLine)).rounded(.up)))
            if used + rows > rowsPerPage && used > 0 { newPage() }
            chunk.append(raw)
            chunkRows += rows
            used += rows
        }
        flushText()
        return pages.filter { !$0.isEmpty }.isEmpty ? [[]] : pages.filter { !$0.isEmpty }
    }

    var body: some View {
        let pages = self.pages
        let height = pageWidth * CGFloat(pageMm.h / pageMm.w)
        VStack(spacing: 8) {
            TabView(selection: $current) {
                ForEach(Array(pages.enumerated()), id: \.offset) { i, segments in
                    page(segments)
                        .frame(width: pageWidth, height: height)
                        .background(Theme.paper)
                        .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: 6, style: .continuous).strokeBorder(Theme.ink, lineWidth: 1.5))
                        .padding(.vertical, 4)
                        .tag(i)
                        .accessibilityElement(children: .ignore)
                        .accessibilityLabel("Page \(i + 1) of \(pages.count)")
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            .frame(height: height + 8)
            Text("Page \(min(current, pages.count - 1) + 1) of \(pages.count) · swipe to see every page")
                .font(.caption.weight(.heavy))
                .foregroundStyle(.secondary)
                .monospacedDigit()
        }
        .frame(maxWidth: .infinity)
        .onChange(of: pages.count) { _, n in if current >= n { current = max(0, n - 1) } }
    }

    private func page(_ segments: [Segment]) -> some View {
        let mm = pageWidth / CGFloat(pageMm.w)
        let row = CGFloat(pitchMm) * mm
        return VStack(alignment: .leading, spacing: 0) {
            ForEach(Array(segments.enumerated()), id: \.offset) { _, segment in
                switch segment {
                case let .text(t, rows):
                    HandwritingPage(text: t, glyphs: glyphs, ink: ink, ruled: ruled, lineSpacing: lineSpacing,
                                    margin: marginMm / pageMm.w, headingStyle: headingStyle, pageWidthMm: pageMm.w)
                        .frame(height: row * (CGFloat(rows) + 1))
                case let .diagram(id, rows):
                    Group {
                        if let image = diagramImage(id) {
                            Image(uiImage: image)
                                .resizable()
                                .interpolation(.high)
                                .scaledToFit()
                        } else {
                            Label("Diagram", systemImage: "scribble.variable")
                                .font(.caption.weight(.bold))
                                .foregroundStyle(.secondary)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: row * CGFloat(rows))
                    .padding(.horizontal, CGFloat(marginMm) * mm)
                }
            }
            Spacer(minLength: 0)
        }
    }
}
