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

/// One photo (or PDF page) the customer added, with what Gemini read from it.
struct NotePagePreview: Identifiable {
    let id = UUID()
    /// The upload this page came from (removing the upload removes its preview).
    let fileID: UUID
    /// "Page 2", "Physics.pdf · page 3".
    let label: String
    let original: UIImage?
    /// This page on its own, formatted (used until the whole notebook has been drawn).
    var formatted: [String]
    /// Gemini's reading of this page; empty when it was read on the phone.
    var read: [ReadPage] = []
    /// What was read from this page.
    let text: String
}

/// One slide in the preview: a written page, a photo, or (for a page read on the phone) its text.
struct PreviewSlide: Identifiable {
    let id: String
    let title: String
    var svg: String? = nil
    var image: UIImage? = nil
    var text: String? = nil
}

/// "What we'll write": the notebook pages exactly as the pen will write them, all photos flowing on from one another (or,
/// before those are drawn, each photo's own pages); pages read on the phone are shown as text. "Your photo": the photos.
func previewSlides(written: [String], photos: [NotePagePreview], showOriginal: Bool) -> [PreviewSlide] {
    if showOriginal {
        return photos.map { p in
            p.original.map { PreviewSlide(id: "\(p.id)", title: p.label, image: $0) }
                ?? PreviewSlide(id: "\(p.id)", title: p.label, text: p.text)
        }
    }
    let phoneRead = photos.filter { $0.read.isEmpty }.map {
        PreviewSlide(id: "\($0.id)-text", title: "\($0.label) · read on the phone", text: $0.text)
    }
    if !written.isEmpty {
        return written.enumerated().map { i, svg in
            PreviewSlide(id: "w\(i)", title: "Notebook page \(i + 1) of \(written.count)", svg: svg)
        } + phoneRead
    }
    return photos.flatMap { p -> [PreviewSlide] in
        if p.formatted.isEmpty { return [PreviewSlide(id: "\(p.id)-text", title: "\(p.label) · read on the phone", text: p.text)] }
        return p.formatted.enumerated().map { i, svg in PreviewSlide(id: "\(p.id)-\(i)", title: p.label, svg: svg) }
    }
}

/// Swipe through the preview: what we'll write, or the customer's own photos.
struct NotePagesCarousel: View {
    let written: [String]
    let photos: [NotePagePreview]
    @Binding var current: Int
    @Binding var showOriginal: Bool

    var body: some View {
        let slides = previewSlides(written: written, photos: photos, showOriginal: showOriginal)
        VStack(spacing: 8) {
            Picker("Show", selection: $showOriginal) {
                Text("What we'll write").tag(false)
                Text("Your photos").tag(true)
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
                    .accessibilityLabel("\(i + 1) of \(slides.count), \(slide.title)")
                }
            }
            .tabViewStyle(.page(indexDisplayMode: slides.count > 1 ? .always : .never))
            .indexViewStyle(.page(backgroundDisplayMode: .always))
            .onChange(of: slides.count) { _, n in if current >= n { current = max(0, n - 1) } }
            .onChange(of: showOriginal) { _, _ in current = 0 }
        }
    }

    @ViewBuilder private func slideView(_ slide: PreviewSlide) -> some View {
        if let image = slide.image {
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
                    Text((slide.text ?? "").isEmpty ? "No text found on this page." : slide.text!)
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
    let written: [String]
    let photos: [NotePagePreview]
    @Binding var current: Int
    @Binding var showOriginal: Bool
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            VStack(spacing: 12) {
                NotePagesCarousel(written: written, photos: photos, current: $current, showOriginal: $showOriginal)
                Text("Drawn at your notebook's real size: the same lines, margins and words per line the pen will write. Diagrams are drawn by the pen too.")
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
