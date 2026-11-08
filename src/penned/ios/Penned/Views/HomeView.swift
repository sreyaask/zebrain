import SwiftUI

/// The app's front door: what's in progress, and the four things you can do.
struct HomeView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dynamicTypeSize) private var typeSize
    @Binding var tab: MainTabs.Tab
    @State private var newKind: OrderKind?
    @State private var addingStyle = false
    @ScaledMetric(relativeTo: .body) private var sampleHeight: CGFloat = 96

    private var active: [Order] { model.orders.filter { $0.status != .delivered && $0.status != .cancelled } }
    private var readyStyle: HandwritingProfile? { model.styles.first { $0.status == "ready" } }
    private var pendingStyle: HandwritingProfile? { model.styles.first { $0.status != "ready" } }

    private var greeting: String {
        let h = Calendar.current.component(.hour, from: .now)
        return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    VStack(alignment: .leading, spacing: 6) {
                        Wordmark()
                        Text("\(greeting). Handwritten notes, ready to study from.")
                            .font(.callout)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.top, 8)

                    if let error = model.lastError {
                        Label(error, systemImage: "wifi.exclamationmark").font(.footnote).foregroundStyle(.red)
                    }

                    if model.hasLoaded {
                        handwritingCard
                    } else {
                        ProgressView().frame(maxWidth: .infinity, minHeight: 80)
                    }

                    if !active.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            SectionLabel("In progress")
                            ForEach(active.prefix(2)) { order in
                                NavigationLink(value: order) { ActiveOrderCard(order: order) }
                                    .buttonStyle(.plain)
                            }
                        }
                    }

                    VStack(alignment: .leading, spacing: 12) {
                        SectionLabel("What do you need?")
                        LazyVGrid(columns: typeSize.isAccessibilitySize ? [GridItem(.flexible())] : [GridItem(.flexible(), spacing: 12), GridItem(.flexible())], spacing: 12) {
                            ActionTile(title: OrderKind.completeNotes.title, subtitle: OrderKind.completeNotes.subtitle, symbol: OrderKind.completeNotes.symbol) { newKind = .completeNotes }
                            ActionTile(title: OrderKind.missedNotes.title, subtitle: OrderKind.missedNotes.subtitle, symbol: OrderKind.missedNotes.symbol) { newKind = .missedNotes }
                            ActionTile(
                                title: "Your handwriting",
                                subtitle: readyStyle != nil ? "Personalised and ready for every order" : "Teach us your handwriting once",
                                symbol: "pencil.and.scribble"
                            ) { tab = .handwriting }
                            ActionTile(title: OrderKind.letters.title, subtitle: OrderKind.letters.subtitle, symbol: OrderKind.letters.symbol) { newKind = .letters }
                        }
                    }

                    Text("Written with a real pen and delivered across Hyderabad in 2–3 hours. Free rewrite of any page within 24 hours.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 24)
            }
            .paperBackground()
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: Order.self) { OrderDetailView(order: $0) }
            .refreshable { await model.refresh() }
            .sheet(item: $newKind) { NewOrderView(kind: $0) }
            .sheet(isPresented: $addingStyle) { AddStyleView() }
        }
    }

    /// Your handwriting at a glance: set it up, see it in review, or see a line written with it.
    @ViewBuilder private var handwritingCard: some View {
        if let style = readyStyle, let glyphs = style.glyphSet {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    SectionLabel("Your handwriting")
                    Spacer()
                    Text(style.name).font(.caption).foregroundStyle(.secondary)
                }
                HandwritingPage(text: "Revision notes, Chapter 4.\nReady when you are.", glyphs: glyphs, ink: style.ink, ruled: true, lineSpacing: 1.05, margin: 0.06)
                    .frame(height: sampleHeight)
            }
            .card()
        } else if let pending = pendingStyle {
            Label {
                VStack(alignment: .leading, spacing: 2) {
                    Text(pending.status == "needs_rescan" ? "Please rescan your handwriting" : "We're checking your handwriting").font(.headline)
                    Text(pending.status == "needs_rescan" ? (pending.reviewNote ?? "The photo was hard to read.") : "Usually under an hour. You can order now.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            } icon: {
                Image(systemName: pending.status == "needs_rescan" ? "arrow.clockwise" : "clock").foregroundStyle(.secondary)
            }
            .card()
            .onTapGesture { tab = .handwriting }
            .accessibilityAddTraits(.isButton)
        } else {
            VStack(alignment: .leading, spacing: 12) {
                Text("Start with your handwriting").font(.headline)
                Text("Write three short lines and scan them. Every order is then written in your own hand.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                Button { addingStyle = true } label: {
                    Label("Scan my handwriting", systemImage: "doc.viewfinder").frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
            }
            .card()
        }
    }
}

/// A large, tappable tile for one thing you can do.
private struct ActionTile: View {
    let title: String
    let subtitle: String
    let symbol: String
    let action: () -> Void
    @ScaledMetric(relativeTo: .body) private var minHeight: CGFloat = 136

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 10) {
                Image(systemName: symbol)
                    .font(.title2)
                    .foregroundStyle(Theme.accent)
                    .accessibilityHidden(true)
                Spacer(minLength: 0)
                Text(title)
                    .font(.headline)
                    .foregroundStyle(.primary)
                Text(subtitle)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, minHeight: minHeight, alignment: .topLeading)
            .card()
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isButton)
    }
}
