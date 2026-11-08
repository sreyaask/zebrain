import SwiftUI

struct OrdersView: View {
    @Environment(AppModel.self) private var model
    @State private var newKind: OrderKind?

    var active: [Order] { model.orders.filter { $0.status != .delivered && $0.status != .cancelled } }
    var past: [Order] { model.orders.filter { $0.status == .delivered || $0.status == .cancelled } }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    if let error = model.lastError {
                        Label(error, systemImage: "wifi.exclamationmark")
                            .font(.footnote)
                            .foregroundStyle(.red)
                    }

                    if !model.hasLoaded {
                        ProgressView("Loading your orders")
                            .frame(maxWidth: .infinity, minHeight: 200)
                    } else if model.orders.isEmpty {
                        EmptyOrders { newKind = .completeNotes }
                    } else {
                        if !active.isEmpty {
                            VStack(alignment: .leading, spacing: 12) {
                                SectionLabel("In progress")
                                ForEach(active) { order in
                                    NavigationLink(value: order) { ActiveOrderCard(order: order) }
                                        .buttonStyle(.plain)
                                }
                            }
                        }

                        Menu {
                            ForEach(OrderKind.allCases) { k in
                                Button(k.title, systemImage: k.symbol) { newKind = k }
                            }
                        } label: {
                            Label("New order", systemImage: "plus").frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.borderedProminent)
                        .controlSize(.large)

                        if !past.isEmpty {
                            VStack(alignment: .leading, spacing: 12) {
                                SectionLabel("Past orders")
                                VStack(spacing: 0) {
                                    ForEach(Array(past.enumerated()), id: \.element.id) { i, order in
                                        if i > 0 { Divider().padding(.leading, 16) }
                                        NavigationLink(value: order) { PastOrderRow(order: order) }
                                            .buttonStyle(.plain)
                                    }
                                }
                                .card(padding: 0)
                            }
                        }
                    }
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 8)
            }
            .paperBackground()
            .navigationTitle("Orders")
            .navigationDestination(for: Order.self) { OrderDetailView(order: $0) }
            .refreshable { await model.refresh() }
            .toolbar {
                Menu {
                    ForEach(OrderKind.allCases) { k in
                        Button(k.title, systemImage: k.symbol) { newKind = k }
                    }
                } label: {
                    Label("New order", systemImage: "plus")
                }
            }
            .sheet(item: $newKind) { NewOrderView(kind: $0) }
        }
    }
}

/// The order that's being written right now: big, live and easy to read at a glance.
struct ActiveOrderCard: View {
    let order: Order

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            AdaptiveStack {
                Text(order.code).font(.caption.monospaced()).foregroundStyle(.secondary)
                Spacer(minLength: 0)
                StatusChip(status: order.status)
            }
            VStack(alignment: .leading, spacing: 4) {
                Text(order.title.isEmpty ? "Untitled order" : order.title)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                Text(order.headline)
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(.primary)
            }
            ProgressView(value: order.journey)
                .tint(Theme.accent)
                .accessibilityLabel("Order progress")
            HStack {
                Text("\(order.quantityLabel) · \(order.paper.name)")
                Spacer()
                Image(systemName: "chevron.right").font(.footnote.weight(.semibold)).foregroundStyle(.tertiary).accessibilityHidden(true)
            }
            .font(.footnote)
            .foregroundStyle(.secondary)
        }
        .card()
        .contentShape(Rectangle())
    }
}

struct PastOrderRow: View {
    let order: Order

    var body: some View {
        AdaptiveStack {
            VStack(alignment: .leading, spacing: 3) {
                Text(order.title.isEmpty ? "Untitled order" : order.title)
                    .font(.body)
                    .foregroundStyle(.primary)
                Text("\(order.code) · \(order.quantityLabel) · \(order.status.label)")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            Spacer(minLength: 0)
            Text(rupees(order.total)).font(.subheadline.monospacedDigit()).foregroundStyle(.secondary)
            Image(systemName: "chevron.right").font(.footnote.weight(.semibold)).foregroundStyle(.tertiary).accessibilityHidden(true)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .contentShape(Rectangle())
    }
}

private struct EmptyOrders: View {
    let start: () -> Void
    @ScaledMetric(relativeTo: .body) private var pageHeight: CGFloat = 160

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            HandwritingPage(text: "# Physics Ch. 4\nNewton's Second Law: the rate of change of momentum is proportional to the applied force.", ink: .blue, lineSpacing: 1.15)
                .frame(height: pageHeight)
                .card(padding: 0)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            VStack(alignment: .leading, spacing: 6) {
                Text("No orders yet").font(.title3.weight(.semibold))
                Text("Scan the pages you need written. We'll write them in your handwriting with a real pen and deliver them in 2–3 hours.")
                    .font(.callout)
                    .foregroundStyle(.secondary)
            }
            Button(action: start) {
                Label("Start an order", systemImage: "plus").frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
        }
        .padding(.top, 8)
    }
}
