import SwiftUI

/// A notebook page with text written in the customer's handwriting.
/// With an approved glyph set it draws their real pen strokes (the same data the plotter uses);
/// before that it falls back to a handwriting-style system font.
struct HandwritingPage: View {
    let text: String
    var glyphs: GlyphSet?
    var ink: Ink = .blue
    var ruled = true
    var lineSpacing: Double = 1.3
    /// Left margin as a fraction of the width.
    var margin: Double = 0.12
    var headingStyle: HeadingStyle = .underline
    /// When set, draws to true scale for a page this many millimetres wide: 2.6 mm x-height and
    /// 7.2 mm × spacing line pitch, the same numbers the plotter engine uses.
    var pageWidthMm: Double?
    @ScaledMetric(relativeTo: .body) private var baseXHeight: CGFloat = 8

    private let tracking: CGFloat = 0.22
    private let space: CGFloat = 0.75

    var body: some View {
        Canvas { ctx, size in
            let mm: CGFloat? = pageWidthMm.map { size.width / CGFloat($0) }
            let xh: CGFloat = mm.map { 2.6 * $0 } ?? baseXHeight
            let spacing = CGFloat(lineSpacing)
            let pitch: CGFloat = mm.map { 7.2 * spacing * $0 } ?? xh * 3.4 * spacing
            // Nothing to draw until the view has a real size (avoids an endless ruling loop).
            guard size.width > 20, size.height > 10, pitch > 1, xh > 0.5 else { return }
            let left: CGFloat = max(12, size.width * CGFloat(margin))
            let right: CGFloat = size.width - max(10, size.width * 0.06)
            let inkColor = Theme.ink(ink)

            if ruled {
                var y = pitch * 1.4
                while y < size.height {
                    ctx.stroke(Path { $0.move(to: CGPoint(x: 0, y: y)); $0.addLine(to: CGPoint(x: size.width, y: y)) },
                               with: .color(Theme.rule), lineWidth: 0.6)
                    y += pitch
                }
                ctx.stroke(Path { $0.move(to: CGPoint(x: left - 6, y: 0)); $0.addLine(to: CGPoint(x: left - 6, y: size.height)) },
                           with: .color(Theme.marginRule), lineWidth: 0.6)
            }

            var row = 0
            var sampleCounter = 0
            for raw in text.components(separatedBy: "\n") {
                let heading = raw.hasPrefix("# ")
                let scale: CGFloat = heading && headingStyle == .larger ? 1.3 : 1
                let words = (heading ? String(raw.dropFirst(2)) : raw).split(separator: " ").map(String.init)
                for line in wrap(words, width: right - left, xh: xh * scale) {
                    let baseline = pitch * 1.4 + CGFloat(row) * pitch - 1.5
                    if baseline > size.height - 2 { return }
                    let end = draw(line, in: &ctx, x: left, baseline: baseline, xh: xh * scale, ink: inkColor, counter: &sampleCounter)
                    if heading && headingStyle == .underline {
                        ctx.stroke(Path { $0.move(to: CGPoint(x: left, y: baseline + 2.5)); $0.addLine(to: CGPoint(x: end, y: baseline + 2.5)) },
                                   with: .color(inkColor), lineWidth: max(0.8, xh / 9))
                    }
                    row += 1
                }
                if words.isEmpty { row += 1 }
            }
        }
        .accessibilityElement()
        .accessibilityLabel("Handwritten: \(text.replacingOccurrences(of: "# ", with: ""))")
    }

    // MARK: Layout

    private func advance(_ ch: Character, xh: CGFloat) -> CGFloat {
        if ch == " " { return space * xh }
        if let glyphs, let g = glyphs.glyphs[String(ch)]?.first { return (g.width + tracking) * xh }
        return 1.05 * xh // fallback font is roughly this wide per character
    }

    private func wrap(_ words: [String], width: CGFloat, xh: CGFloat) -> [String] {
        var lines: [String] = []
        var current = ""
        var w: CGFloat = 0
        for word in words {
            let ww = word.reduce(0) { $0 + advance($1, xh: xh) }
            let sp = current.isEmpty ? 0 : space * xh
            if !current.isEmpty && w + sp + ww > width {
                lines.append(current)
                current = word
                w = ww
            } else {
                current += current.isEmpty ? word : " " + word
                w += sp + ww
            }
        }
        if !current.isEmpty { lines.append(current) }
        return lines
    }

    /// Draws one line and returns the x where it ended.
    private func draw(_ line: String, in ctx: inout GraphicsContext, x startX: CGFloat, baseline: CGFloat, xh: CGFloat, ink: Color, counter: inout Int) -> CGFloat {
        guard let glyphs else {
            let font = Font.custom("BradleyHandITCTT-Bold", size: xh * 2.3)
            let resolved = ctx.resolve(Text(line).font(font).foregroundColor(ink))
            let size = resolved.measure(in: CGSize(width: 10_000, height: 200))
            ctx.draw(resolved, at: CGPoint(x: startX, y: baseline + xh * 0.45), anchor: .bottomLeading)
            return startX + size.width
        }
        var x = startX
        let style = StrokeStyle(lineWidth: max(0.9, xh / 8), lineCap: .round, lineJoin: .round)
        for ch in line {
            if ch == " " { x += space * xh; continue }
            guard let samples = glyphs.glyphs[String(ch)], !samples.isEmpty else { x += 0.6 * xh; continue }
            // Rotate through the samples so repeated letters look naturally different.
            let g = samples[counter % samples.count]
            counter += 1
            var path = Path()
            for stroke in g.strokes where stroke.count > 1 {
                path.move(to: CGPoint(x: x + stroke[0].x * xh, y: baseline - stroke[0].y * xh))
                for p in stroke.dropFirst() { path.addLine(to: CGPoint(x: x + p.x * xh, y: baseline - p.y * xh)) }
            }
            ctx.stroke(path, with: .color(ink), style: style)
            x += (g.width + tracking) * xh
        }
        return x
    }
}
