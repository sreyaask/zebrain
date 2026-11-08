import SwiftUI

// Patterns people already know from the apps they use every day, done in Penned's own look:
// story circles to explain things, and a star rating after delivery.

// MARK: - Stories

struct Story: Identifiable {
    struct Slide {
        let symbol: String
        let title: String
        let body: String
        var sample: String?
    }
    let id: String
    let title: String
    let symbol: String
    let slides: [Slide]

    static let all: [Story] = [
        Story(id: "how", title: "How it works", symbol: "sparkles", slides: [
            Slide(symbol: "doc.viewfinder", title: "Scan your notes", body: "Photos, PDFs or the camera. Text and diagrams are read on your phone."),
            Slide(symbol: "book.closed", title: "Pick a notebook", body: "Ruled or plain, or we continue in your own notebook."),
            Slide(symbol: "pencil.tip", title: "We write it with a real pen", body: "In your handwriting, page by page. Never printed.",
                  sample: "Laws of Motion\nForce = mass × acceleration"),
            Slide(symbol: "scooter", title: "Delivered in 2–3 hours", body: "Follow every page live, right up to your door."),
        ]),
        Story(id: "price", title: "Prices", symbol: "indianrupeesign", slides: [
            Slide(symbol: "indianrupeesign.circle", title: "\(rupees(Quote.pagePrice)) a page",
                  body: "A new notebook is \(rupees(Quote.notebookPrice)). Your own notebook is free. Delivery \(rupees(49)), free above \(rupees(500))."),
            Slide(symbol: "checkmark.seal", title: "No hidden charges", body: "You see the full bill before you pay. Nothing is added later."),
        ]),
        Story(id: "own", title: "Your notebook", symbol: "barcode.viewfinder", slides: [
            Slide(symbol: "barcode.viewfinder", title: "Scan its barcode", body: "We know many notebooks already. If not, measure it once with a ruler."),
            Slide(symbol: "arrow.left.arrow.right", title: "We pick it up and bring it back", body: "Our rider collects it, we continue after your last page, and return it with your order."),
        ]),
        Story(id: "promise", title: "Our promise", symbol: "hand.thumbsup", slides: [
            Slide(symbol: "arrow.uturn.backward.circle", title: "Free rewrite", body: "Not happy with a page? We rewrite it free within 24 hours."),
            Slide(symbol: "lock", title: "Private", body: "Only you and the Penned team can see your notes."),
        ]),
    ]
}

/// A row of story circles. New ones have a green ring; seen ones go grey.
struct StoryRow: View {
    @AppStorage("seenStories") private var seen = ""
    @State private var open: Story?

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(alignment: .top, spacing: 16) {
                ForEach(Story.all) { story in
                    let isNew = !seen.split(separator: ",").contains(Substring(story.id))
                    Button {
                        Sounds.shared.play(.tap)
                        open = story
                    } label: {
                        VStack(spacing: 6) {
                            Image(systemName: story.symbol)
                                .font(.title2.weight(.bold))
                                .foregroundStyle(Theme.ink)
                                .frame(width: 62, height: 62)
                                .background(Theme.surface, in: Circle())
                                .padding(4)
                                .overlay(Circle().strokeBorder(isNew ? Theme.success : Theme.line, lineWidth: 3))
                            Text(story.title)
                                .font(.caption.weight(.bold))
                                .foregroundStyle(Theme.ink)
                                .lineLimit(1)
                        }
                        .frame(width: 76)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(story.title + (isNew ? ", new" : ""))
                }
            }
            .padding(.horizontal, 16)
        }
        .fullScreenCover(item: $open) { story in
            StoryViewer(startAt: Story.all.firstIndex { $0.id == story.id } ?? 0) { id in
                if !seen.split(separator: ",").contains(Substring(id)) { seen += (seen.isEmpty ? "" : ",") + id }
            }
        }
    }
}

/// Full-screen stories: tap right for next, left for back, swipe down to close. Slides move on by themselves.
struct StoryViewer: View {
    @State var storyIndex: Int
    @State private var slideIndex = 0
    @State private var progress: CGFloat = 0
    let onSeen: (String) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var drag: CGFloat = 0

    init(startAt: Int, onSeen: @escaping (String) -> Void) {
        _storyIndex = State(initialValue: startAt)
        self.onSeen = onSeen
    }

    private let seconds: Double = 5
    private var story: Story { Story.all[storyIndex] }
    private var slide: Story.Slide { story.slides[min(slideIndex, story.slides.count - 1)] }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            VStack(alignment: .leading, spacing: 0) {
                // Progress bars, one per slide.
                HStack(spacing: 4) {
                    ForEach(0..<story.slides.count, id: \.self) { i in
                        GeometryReader { geo in
                            Capsule().fill(.white.opacity(0.3))
                                .overlay(alignment: .leading) {
                                    Capsule().fill(.white)
                                        .frame(width: geo.size.width * (i < slideIndex ? 1 : i == slideIndex ? progress : 0))
                                }
                        }
                        .frame(height: 3)
                    }
                }
                .padding(.top, 8)
                HStack {
                    Image(systemName: story.symbol).font(.subheadline.weight(.bold))
                    Text(story.title).font(.subheadline.weight(.heavy))
                    Spacer()
                    Button { dismiss() } label: {
                        Image(systemName: "xmark").font(.headline.weight(.bold)).frame(width: 44, height: 44)
                    }
                    .accessibilityLabel("Close")
                }
                .foregroundStyle(.white)
                .padding(.top, 6)

                Spacer()
                VStack(alignment: .leading, spacing: 18) {
                    Image(systemName: slide.symbol)
                        .font(.system(size: 44, weight: .bold))
                        .foregroundStyle(.black)
                        .frame(width: 96, height: 96)
                        .background(.white, in: Circle())
                        .accessibilityHidden(true)
                    Text(slide.title).font(.largeTitle.weight(.black)).foregroundStyle(.white)
                    Text(slide.body).font(.title3.weight(.semibold)).foregroundStyle(.white.opacity(0.8))
                    if let sample = slide.sample {
                        HandwritingPage(text: sample, ink: .blue, lineSpacing: 1.2)
                            .frame(height: 120)
                            .background(.white, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                            .environment(\.colorScheme, .light)
                    }
                }
                .id("\(storyIndex)-\(slideIndex)")
                .transition(.opacity)
                Spacer()
                Text("Tap to continue").font(.footnote.weight(.semibold)).foregroundStyle(.white.opacity(0.6))
                    .frame(maxWidth: .infinity)
                    .padding(.bottom, 8)
            }
            .padding(.horizontal, 20)
            .offset(y: max(0, drag))
        }
        .contentShape(Rectangle())
        .onTapGesture { location in
            // Left third goes back, the rest goes forward.
            if location.x < UIScreen.main.bounds.width / 3 { back() } else { next() }
        }
        .gesture(DragGesture().onChanged { drag = $0.translation.height }.onEnded { v in
            if v.translation.height > 120 { dismiss() } else { withAnimation(.spring) { drag = 0 } }
        })
        .task(id: "\(storyIndex)-\(slideIndex)") {
            onSeen(story.id)
            progress = 0
            withAnimation(.linear(duration: seconds)) { progress = 1 }
            try? await Task.sleep(for: .seconds(seconds))
            if !Task.isCancelled { next() }
        }
        .accessibilityAction(named: "Next") { next() }
        .accessibilityAction(named: "Back") { back() }
        .statusBarHidden()
    }

    private func next() {
        withAnimation(.easeOut(duration: 0.2)) {
            if slideIndex < story.slides.count - 1 {
                slideIndex += 1
            } else if storyIndex < Story.all.count - 1 {
                storyIndex += 1
                slideIndex = 0
            } else {
                dismiss()
            }
        }
    }

    private func back() {
        withAnimation(.easeOut(duration: 0.2)) {
            if slideIndex > 0 {
                slideIndex -= 1
            } else if storyIndex > 0 {
                storyIndex -= 1
                slideIndex = Story.all[storyIndex].slides.count - 1
            } else {
                progress = 0
            }
        }
    }
}

// MARK: - Rate your order

/// Star rating after delivery, like food delivery apps. Saved to public.order_feedback (once per order).
struct RateOrderCard: View {
    @Environment(AppModel.self) private var model
    let order: Order
    @State private var existing: OrderFeedback?
    @State private var loaded = false
    @State private var rating = 0
    @State private var comment = ""
    @State private var sending = false
    @State private var error: String?

    private let words = ["", "Not good", "Could be better", "Okay", "Good", "Loved it"]

    var body: some View {
        Group {
            if !loaded {
                SkeletonCard(lines: 1)
            } else if let existing {
                HStack(spacing: 12) {
                    Image(systemName: "checkmark.circle.fill").font(.title2).foregroundStyle(Theme.success).accessibilityHidden(true)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Thanks for rating").font(.headline.weight(.heavy))
                        Stars(value: existing.rating).font(.subheadline)
                    }
                }
                .card()
            } else {
                VStack(alignment: .leading, spacing: 12) {
                    Text("How was your order?").font(.headline.weight(.heavy))
                    HStack(spacing: 6) {
                        ForEach(1...5, id: \.self) { i in
                            Button {
                                rating = i
                                Sounds.shared.play(.tap)
                            } label: {
                                Image(systemName: i <= rating ? "star.fill" : "star")
                                    .font(.title.weight(.bold))
                                    .foregroundStyle(Theme.ink)
                                    .frame(width: 48, height: 48)
                                    .contentShape(Rectangle())
                                    .symbolEffect(.bounce, value: rating == i)
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("\(i) \(i == 1 ? "star" : "stars")")
                            .accessibilityAddTraits(i == rating ? .isSelected : [])
                        }
                    }
                    if rating > 0 {
                        Text(words[rating]).font(.subheadline.weight(.bold))
                        TextField(rating >= 4 ? "What did you like? (optional)" : "What should we fix? (optional)", text: $comment, axis: .vertical)
                            .lineLimit(2...5)
                            .padding(12)
                            .background(Theme.fill, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                        if rating <= 3 {
                            Text("A page not right? Our free rewrite covers it for 24 hours after delivery.").font(.footnote).foregroundStyle(.secondary)
                        }
                        Button {
                            Task { await send() }
                        } label: {
                            Group { if sending { ProgressView() } else { Text("Submit rating") } }.frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.pennedPrimary)
                        .disabled(sending)
                    }
                    if let error { Text(error).font(.footnote).foregroundStyle(.red) }
                }
                .card()
                .animation(.easeOut(duration: 0.2), value: rating)
            }
        }
        .task {
            existing = await model.feedback(for: order)
            loaded = true
        }
    }

    private func send() async {
        sending = true
        defer { sending = false }
        do {
            try await model.rate(order, rating: rating, comment: comment)
            existing = OrderFeedback(orderId: order.id, rating: rating, comment: comment)
            error = nil
            Sounds.shared.play(.success)
        } catch {
            self.error = "Couldn't send your rating. Try again."
            Sounds.shared.play(.error)
        }
    }
}

private struct Stars: View {
    let value: Int
    var body: some View {
        HStack(spacing: 2) {
            ForEach(1...5, id: \.self) { i in Image(systemName: i <= value ? "star.fill" : "star") }
        }
        .accessibilityElement()
        .accessibilityLabel("\(value) out of 5 stars")
    }
}
