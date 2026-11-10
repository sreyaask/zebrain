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

/// One page the customer added, with what Gemini made of it.
struct NotePagePreview: Identifiable {
    let id = UUID()
    /// The upload this page came from (removing the upload removes its preview).
    let fileID: UUID
    /// "Photo 2", "Physics.pdf · page 3".
    let label: String
    let original: UIImage?
    /// Formatted pages for this photo (usually one; long pages continue onto a second).
    let formatted: [String]
    /// What was read from this page, for pages without a formatted version (read on the phone).
    let text: String
}

/// Everything shown in the preview, one slide per formatted page, in order.
struct PreviewSlide: Identifiable {
    let id: String
    let page: NotePagePreview
    let svg: String?
    let title: String
}

func previewSlides(_ pages: [NotePagePreview]) -> [PreviewSlide] {
    pages.flatMap { p -> [PreviewSlide] in
        if p.formatted.isEmpty { return [PreviewSlide(id: "\(p.id)", page: p, svg: nil, title: p.label)] }
        return p.formatted.enumerated().map { i, svg in
            PreviewSlide(id: "\(p.id)-\(i)", page: p, svg: svg,
                         title: p.formatted.count > 1 ? "\(p.label) · part \(i + 1) of \(p.formatted.count)" : p.label)
        }
    }
}

/// Swipe through every page: what we'll write, or the customer's own photo of it, side by side in order.
struct NotePagesCarousel: View {
    let pages: [NotePagePreview]
    @Binding var current: Int
    @Binding var showOriginal: Bool

    var body: some View {
        let slides = previewSlides(pages)
        VStack(spacing: 8) {
            Picker("Show", selection: $showOriginal) {
                Text("What we'll write").tag(false)
                Text("Your photo").tag(true)
            }
            .pickerStyle(.segmented)
            .padding(.horizontal, 16)
            TabView(selection: $current) {
                ForEach(Array(slides.enumerated()), id: \.element.id) { i, slide in
                    VStack(spacing: 6) {
                        Text(slide.title)
                            .font(.caption.weight(.heavy))
                            .foregroundStyle(.secondary)
                        slideView(slide)
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                    }
                    .padding(.horizontal, 16)
                    .padding(.bottom, 30) // room for the page dots
                    .tag(i)
                    .accessibilityElement(children: .contain)
                    .accessibilityLabel("Page \(i + 1) of \(slides.count), \(slide.title)")
                }
            }
            .tabViewStyle(.page(indexDisplayMode: slides.count > 1 ? .always : .never))
            .indexViewStyle(.page(backgroundDisplayMode: .always))
            .onChange(of: slides.count) { _, n in if current >= n { current = max(0, n - 1) } }
        }
    }

    @ViewBuilder private func slideView(_ slide: PreviewSlide) -> some View {
        if showOriginal, let image = slide.page.original {
            framed(Image(uiImage: image).resizable().scaledToFit(), aspect: image.size.width / max(image.size.height, 1))
        } else if let svg = slide.svg {
            framed(SVGView(svg: svg), aspect: svgAspect(svg))
        } else {
            // Read on the phone: no formatted page, so show the text that will be written.
            ScrollView {
                VStack(alignment: .leading, spacing: 10) {
                    Label("Read on the phone, not by Gemini. Check this text.", systemImage: "exclamationmark.triangle")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(.secondary)
                    Text(slide.page.text.isEmpty ? "No text found on this page." : slide.page.text)
                        .font(.body)
                        .foregroundStyle(Theme.ink)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .padding(14)
            }
            .background(Color.white)
            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 8, style: .continuous).strokeBorder(Theme.ink, lineWidth: 1.5))
        }
    }

    private func framed(_ content: some View, aspect: CGFloat) -> some View {
        content
            .aspectRatio(aspect, contentMode: .fit)
            .background(Color.white)
            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 8, style: .continuous).strokeBorder(Theme.ink, lineWidth: 1.5))
    }
}

/// The same preview, full screen.
struct FormattedPagesView: View {
    let pages: [NotePagePreview]
    @Binding var current: Int
    @Binding var showOriginal: Bool
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            VStack(spacing: 12) {
                NotePagesCarousel(pages: pages, current: $current, showOriginal: $showOriginal)
                Text("This is exactly what Gemini read from each photo. We write the same text in your handwriting, with the diagrams drawn by the pen.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 24)
                    .padding(.bottom, 8)
            }
            .paperBackground()
            .navigationTitle("Preview")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
        }
    }
}
