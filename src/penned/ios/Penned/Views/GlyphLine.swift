import SwiftUI

/// Draws a short line of text using the customer's own glyph strokes (from the admin-approved style).
struct GlyphLine: View {
    let text: String
    let glyphs: GlyphSet
    var ink: Color = Theme.inkBlue
    var xHeight: CGFloat = 14

    var body: some View {
        Canvas { ctx, size in
            var x: CGFloat = 2
            let baseline = size.height * 0.68
            for ch in text {
                if ch == " " { x += xHeight * 0.75; continue }
                guard let g = glyphs.glyphs[String(ch)]?.first else { x += xHeight * 0.6; continue }
                var path = Path()
                for stroke in g.strokes where stroke.count > 1 {
                    path.move(to: CGPoint(x: x + stroke[0].x * xHeight, y: baseline - stroke[0].y * xHeight))
                    for p in stroke.dropFirst() { path.addLine(to: CGPoint(x: x + p.x * xHeight, y: baseline - p.y * xHeight)) }
                }
                ctx.stroke(path, with: .color(ink), style: StrokeStyle(lineWidth: max(1, xHeight / 11), lineCap: .round, lineJoin: .round))
                x += (g.width + 0.22) * xHeight
            }
        }
        .frame(height: xHeight * 3)
        .accessibilityLabel(text)
    }
}
