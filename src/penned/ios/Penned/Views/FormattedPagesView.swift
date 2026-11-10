import SwiftUI
import WebKit

/// Shows an SVG drawing (Gemini's formatted pages and diagram drawings). SwiftUI can't draw SVG itself, so this uses
/// a small non-interactive web view with no network access and no JavaScript.
struct SVGView: UIViewRepresentable {
    let svg: String

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.defaultWebpagePreferences.allowsContentJavaScript = false
        let view = WKWebView(frame: .zero, configuration: config)
        view.isOpaque = false
        view.backgroundColor = .clear
        view.scrollView.isScrollEnabled = false
        view.isUserInteractionEnabled = false
        return view
    }

    func updateUIView(_ view: WKWebView, context: Context) {
        guard context.coordinator.loaded != svg else { return }
        context.coordinator.loaded = svg
        let html = """
        <!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
        <style>html,body{margin:0;height:100%;background:transparent}svg{width:100%;height:100%;display:block}</style>
        </head><body>\(svg)</body></html>
        """
        view.loadHTMLString(html, baseURL: nil)
    }

    func makeCoordinator() -> Coordinator { Coordinator() }
    final class Coordinator { var loaded: String? }
}

/// Width ÷ height of an SVG page from its viewBox (formatted pages follow the shape of the photographed page).
func svgAspect(_ svg: String) -> CGFloat {
    if let m = svg.firstMatch(of: #/viewBox\s*=\s*"\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/#),
       let w = Double(m.1), let h = Double(m.2), w > 0, h > 0 {
        return CGFloat(w / h)
    }
    return 1000.0 / 1414.0
}

/// Swipeable formatted pages, one page at a time.
struct FormattedPagesCarousel: View {
    let pages: [String]
    @Binding var current: Int

    var body: some View {
        TabView(selection: $current) {
            ForEach(Array(pages.enumerated()), id: \.offset) { i, svg in
                SVGView(svg: svg)
                    .aspectRatio(svgAspect(svg), contentMode: .fit)
                    .background(Color.white)
                    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 8, style: .continuous).strokeBorder(Theme.ink, lineWidth: 1.5))
                    .padding(.horizontal, 16)
                    .padding(.bottom, 28) // room for the page dots
                    .tag(i)
                    .accessibilityLabel("Formatted page \(i + 1) of \(pages.count)")
            }
        }
        .tabViewStyle(.page(indexDisplayMode: pages.count > 1 ? .always : .never))
        .indexViewStyle(.page(backgroundDisplayMode: .always))
        .onChange(of: pages.count) { _, n in if current >= n { current = max(0, n - 1) } }
    }
}

/// Every page as Gemini formatted it: exact text in order, with its redrawn diagrams. Swipe between pages.
struct FormattedPagesView: View {
    let pages: [String]
    @Environment(\.dismiss) private var dismiss
    @State private var current = 0

    var body: some View {
        NavigationStack {
            VStack(spacing: 12) {
                FormattedPagesCarousel(pages: pages, current: $current)
                Text("Page \(current + 1) of \(pages.count) · swipe for more")
                    .font(.caption.weight(.heavy))
                    .foregroundStyle(.secondary)
                    .monospacedDigit()
                Text("This is exactly what Gemini read. We write the same text in your handwriting, with the diagrams drawn by the pen.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 24)
                    .padding(.bottom, 8)
            }
            .paperBackground()
            .navigationTitle("Formatted pages")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
        }
    }
}
