import SwiftUI

/// The app's front door, quick-commerce style: the delivery promise up top, what you can order as big
/// tiles, and a floating pill that tracks the order being written right now.
struct HomeView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dynamicTypeSize) private var typeSize
    @Binding var tab: MainTabs.Tab
    @State private var newKind: OrderKind?
    @State private var addingStyle = false
    @State private var showingHelp = false
    @ScaledMetric(relativeTo: .body) private var sampleHeight: CGFloat = 88

    private var active: [Order] { model.orders.filter { $0.status != .delivered && $0.status != .cancelled } }
    private var readyStyle: HandwritingProfile? { model.styles.first { $0.status == "ready" } }
    private var pendingStyle: HandwritingProfile? { model.styles.first { $0.status != "ready" } }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    header
                    VStack(alignment: .leading, spacing: 28) {
                        StoryRow()
                            .padding(.horizontal, -16)
                        TrustStrip()
                            .padding(.horizontal, -16)
                            .contentMargins(.horizontal, 16, for: .scrollContent)
                        if let error = model.lastError {
                            Label(error, systemImage: "wifi.exclamationmark")
                                .font(.footnote.weight(.semibold))
                                .foregroundStyle(.red)
                        }
                        if model.hasLoaded {
                            handwritingCard
                        } else {
                            SkeletonCard(lines: 2)
                        }
                        VStack(alignment: .leading, spacing: 14) {
                            SectionLabel("Order something")
                            tiles
                        }
                        promises
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 20)
                    .padding(.bottom, active.isEmpty ? 24 : 96)
                }
            }
            .paperBackground()
            .toolbar(.hidden, for: .navigationBar)
            .refreshable { await model.refresh() }
            .safeAreaInset(edge: .bottom) {
                if let order = active.first {
                    NavigationLink(value: order) { TrackPill(order: order, more: active.count - 1) }
                        .buttonStyle(.plain)
                        .simultaneousGesture(TapGesture().onEnded { Sounds.shared.play(.tap) })
                        .padding(.horizontal, 16)
                        .padding(.bottom, 8)
                }
            }
            .navigationDestination(for: Order.self) { OrderDetailView(order: $0) }
            .sheet(item: $newKind) { NewOrderView(kind: $0) }
            .sheet(isPresented: $addingStyle) { AddStyleView() }
            .sheet(isPresented: $showingHelp) { HelpCenterView() }
        }
    }

    // MARK: Header: the delivery promise

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .firstTextBaseline) {
                Text("Delivery in")
                    .font(.subheadline.weight(.bold))
                    .opacity(0.8)
                Spacer()
                Text("Penned")
                    .font(.system(.headline, design: .serif, weight: .bold))
            }
            Text("2–3 hours")
                .font(.system(.largeTitle, design: .rounded, weight: .black))
            Label(model.orders.first.map { "Delivering to \($0.area), Hyderabad" } ?? "Hyderabad · Kondapur, Madhapur, Gachibowli & more",
                  systemImage: "mappin.and.ellipse")
                .font(.footnote.weight(.semibold))
                .opacity(0.8)
                .lineLimit(1)
                .padding(.top, 2)
        }
        .foregroundStyle(Theme.paper)
        .padding(.horizontal, 20)
        .padding(.top, 12)
        .padding(.bottom, 22)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            UnevenRoundedRectangle(bottomLeadingRadius: 28, bottomTrailingRadius: 28, style: .continuous)
                .fill(Theme.ink)
                .ignoresSafeArea(edges: .top)
        )
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Delivery in 2 to 3 hours across Hyderabad")
    }

    // MARK: Handwriting

    @ViewBuilder private var handwritingCard: some View {
        if let style = readyStyle, let glyphs = style.glyphSet {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text("Your handwriting").font(.headline.weight(.heavy))
                    Spacer()
                    PillTag(text: "Ready", inverted: true)
                }
                HandwritingPage(text: "Revision notes, Chapter 4.\nReady when you are.", glyphs: glyphs, ink: style.ink, ruled: true, lineSpacing: 1.05, margin: 0.06)
                    .frame(height: sampleHeight)
                    .background(Theme.paper, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
            }
            .card()
            .onTapGesture { tab = .handwriting }
            .accessibilityAddTraits(.isButton)
        } else if let pending = pendingStyle {
            HStack(alignment: .top, spacing: 14) {
                Image(systemName: pending.status == "needs_rescan" ? "arrow.clockwise" : "clock.fill")
                    .font(.title2.weight(.bold))
                    .frame(width: 44, height: 44)
                    .background(Theme.fill, in: Circle())
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 3) {
                    Text(pending.status == "needs_rescan" ? "Rescan your handwriting" : "Checking your handwriting")
                        .font(.headline.weight(.heavy))
                    Text(pending.status == "needs_rescan" ? (pending.reviewNote ?? "The photo was hard to read.") : "Usually under an hour. You can order now.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }
            .card()
            .onTapGesture { tab = .handwriting }
            .accessibilityElement(children: .combine)
            .accessibilityAddTraits(.isButton)
        } else {
            VStack(alignment: .leading, spacing: 12) {
                PillTag(text: "Step 1", inverted: true)
                Text("Teach us your handwriting")
                    .font(.title3.weight(.black))
                Text("Write three short lines, scan them once, and every order is written in your own hand.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                Button { addingStyle = true } label: {
                    Label("Scan my handwriting", systemImage: "doc.viewfinder").frame(maxWidth: .infinity)
                }
                .buttonStyle(.pennedPrimary)
            }
            .card()
        }
    }

    // MARK: Tiles

    private var tiles: some View {
        LazyVGrid(columns: typeSize.isAccessibilitySize ? [GridItem(.flexible())] : [GridItem(.flexible(), spacing: 14), GridItem(.flexible())], spacing: 14) {
            ActionTile(title: "Complete notes", subtitle: "Your notes as a neat notebook", price: "₹11 / page", symbol: OrderKind.completeNotes.symbol) { Sounds.shared.play(.tap); newKind = .completeNotes }
            ActionTile(title: "Missed notes", subtitle: "Catch up on lessons you missed", price: "₹11 / page", symbol: OrderKind.missedNotes.symbol) { Sounds.shared.play(.tap); newKind = .missedNotes }
            ActionTile(title: "Letters & cards", subtitle: "Thank-yous, letters, invites", price: "₹15 / card", symbol: OrderKind.letters.symbol) { Sounds.shared.play(.tap); newKind = .letters }
            ActionTile(
                title: "Your handwriting",
                subtitle: readyStyle != nil ? "Personalised and ready" : "Set it up once",
                price: readyStyle != nil ? "Ready" : "Free",
                symbol: "pencil.and.scribble"
            ) {
                Sounds.shared.play(.tap)
                tab = .handwriting
            }
        }
    }

    // MARK: Promises

    private var promises: some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionLabel("Why Penned")
            VStack(spacing: 0) {
                ForEach(Array(Guarantee.allCases.enumerated()), id: \.element) { i, g in
                    if i > 0 { Divider().overlay(Theme.line) }
                    GuaranteeRow(guarantee: g)
                }
            }
            .card(padding: 0)
            Button { showingHelp = true } label: {
                Label("Questions? See how Penned works", systemImage: "questionmark.circle").frame(maxWidth: .infinity)
            }
            .buttonStyle(.pennedSecondary)
        }
    }
}

/// A big, bordered tile for one thing you can order.
private struct ActionTile: View {
    let title: String
    let subtitle: String
    let price: String
    let symbol: String
    let action: () -> Void
    @ScaledMetric(relativeTo: .body) private var minHeight: CGFloat = 150

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 8) {
                HStack(alignment: .top) {
                    Image(systemName: symbol)
                        .font(.title2.weight(.bold))
                        .frame(width: 46, height: 46)
                        .background(Theme.fill, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(Theme.ink, lineWidth: 1.5))
                        .accessibilityHidden(true)
                    Spacer(minLength: 4)
                    PillTag(text: price)
                }
                Spacer(minLength: 6)
                Text(title)
                    .font(.headline.weight(.heavy))
                    .foregroundStyle(Theme.ink)
                Text(subtitle)
                    .font(.footnote.weight(.medium))
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, minHeight: minHeight, alignment: .topLeading)
            .card(padding: 14)
            .contentShape(Rectangle())
        }
        .buttonStyle(TilePressStyle())
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isButton)
    }
}

/// Pressing a tile pushes it down onto its shadow, like a physical button.
private struct TilePressStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .offset(y: configuration.isPressed ? 3 : 0)
            .animation(.easeOut(duration: 0.1), value: configuration.isPressed)
    }
}

/// Floating black pill for the order being written: the quick-commerce "track your order" bar.
struct TrackPill: View {
    let order: Order
    var more: Int = 0

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: order.status.symbol)
                .font(.headline.weight(.bold))
                .frame(width: 40, height: 40)
                .background(Theme.paper.opacity(0.15), in: Circle())
                .overlay(alignment: .topTrailing) { LiveDot().offset(x: 3, y: -3) }
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(order.headline).font(.subheadline.weight(.heavy)).lineLimit(1)
                Text(more > 0 ? "\(order.code) · \(more) more in progress" : order.code)
                    .font(.caption.weight(.semibold))
                    .opacity(0.75)
            }
            Spacer(minLength: 8)
            HStack(spacing: 4) {
                Text("Track").font(.subheadline.weight(.heavy))
                Image(systemName: "chevron.right").font(.caption.weight(.heavy))
            }
            .accessibilityHidden(true)
        }
        .foregroundStyle(Theme.paper)
        .padding(.leading, 10)
        .padding(.trailing, 18)
        .padding(.vertical, 10)
        .background(Theme.ink, in: Capsule())
        .shadow(color: .black.opacity(0.25), radius: 12, y: 6)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(order.headline), \(order.code). Track order")
        .accessibilityAddTraits(.isButton)
    }
}
