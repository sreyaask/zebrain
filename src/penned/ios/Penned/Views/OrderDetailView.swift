import SwiftUI

struct OrderDetailView: View {
    @Environment(AppModel.self) private var model
    @State var order: Order
    @State private var events: [OrderEvent] = []
    @State private var error: String?
    @State private var paying = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                // Header
                VStack(alignment: .leading, spacing: 4) {
                    Text(order.code).font(.caption.monospaced()).foregroundStyle(.secondary)
                    Text(order.title.isEmpty ? "Untitled order" : order.title)
                        .font(.title2.weight(.semibold))
                    Text("\(order.quantityLabel) · \(order.paper.name) · \(order.ink.label) ink")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .padding(.bottom, 4)

                // Status and timeline
                VStack(alignment: .leading, spacing: 16) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(order.headline).font(.title3.weight(.semibold))
                        if order.status != .cancelled {
                            ProgressView(value: order.journey).tint(Theme.accent)
                                .accessibilityLabel("Order progress")
                        }
                    }
                    Divider()
                    Timeline(order: order, events: events)
                }
                .card()

                if order.paymentStatus != "paid" && order.status != .cancelled {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("Payment pending").font(.headline)
                        Text("Writing starts as soon as the order is paid.").font(.subheadline).foregroundStyle(.secondary)
                        Button {
                            Task { await pay() }
                        } label: {
                            Group { if paying { ProgressView() } else { Text("Pay \(rupees(order.total))") } }
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.borderedProminent)
                        .controlSize(.large)
                        .disabled(paying)
                        Text("Demo checkout. No real payment is made.").font(.caption).foregroundStyle(.secondary)
                    }
                    .card()
                }

                if let rider = order.riderName, order.status == .outForDelivery {
                    HStack(spacing: 12) {
                        Text(String(rider.prefix(1)))
                            .font(.headline)
                            .frame(width: 44, height: 44)
                            .background(Theme.paper, in: Circle())
                            .overlay(Circle().strokeBorder(Theme.line))
                            .accessibilityHidden(true)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(rider).font(.headline)
                            Text(order.eta.map { "Arriving in \($0)" } ?? "On the way").font(.subheadline).foregroundStyle(.secondary)
                        }
                    }
                    .card()
                }

                VStack(alignment: .leading, spacing: 10) {
                    PriceRow(label: "Writing · \(order.billableUnits) × \(rupees(order.unitPrice))", value: rupees(order.writingAmount))
                    PriceRow(label: "Paper and ink", value: "Included")
                    PriceRow(label: "Delivery", value: order.deliveryAmount == 0 ? "Free" : rupees(order.deliveryAmount))
                    Divider()
                    PriceRow(label: "Total", value: rupees(order.total), emphasized: true)
                }
                .card()

                VStack(alignment: .leading, spacing: 4) {
                    SectionLabel("Deliver to")
                    Text("\(order.addressLine1), \(order.area), Hyderabad \(order.pincode)")
                    Text(order.timeSlot.label).font(.subheadline).foregroundStyle(.secondary)
                }
                .card()

                if order.status == .delivered {
                    Text("Not happy with a page? We rewrite it free within 24 hours of delivery.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                if let error {
                    Label(error, systemImage: "exclamationmark.circle").font(.footnote).foregroundStyle(.red)
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 8)
        }
        .paperBackground()
        .navigationTitle(order.code)
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await reload() }
        .sensoryFeedback(.success, trigger: order.paymentStatus)
        .task {
            // Refresh while the order is moving; the admin portal updates it in real time.
            while !Task.isCancelled {
                await reload()
                if order.status == .delivered || order.status == .cancelled { break }
                try? await Task.sleep(for: .seconds(20))
            }
        }
    }

    private func reload() async {
        do {
            async let o = model.order(id: order.id)
            async let e = model.events(for: order)
            (order, events) = try await (o, e)
            error = nil
        } catch {
            self.error = "Couldn't refresh. Pull down to try again."
        }
    }

    private func pay() async {
        paying = true; defer { paying = false }
        do { try await model.demoPay(order); await reload() } catch { self.error = "Payment didn't go through. Try again." }
    }
}

private struct PriceRow: View {
    let label: String
    let value: String
    var emphasized = false
    var body: some View {
        HStack {
            Text(label).foregroundStyle(emphasized ? .primary : .secondary)
            Spacer()
            Text(value).monospacedDigit()
        }
        .font(emphasized ? .headline : .subheadline)
    }
}

/// Received → Writing → Quality check → Out for delivery → Delivered, with times from the order's events.
private struct Timeline: View {
    let order: Order
    let events: [OrderEvent]
    @ScaledMetric(relativeTo: .subheadline) private var dot: CGFloat = 18

    private func state(_ step: OrderStatus) -> Int {
        guard let current = OrderStatus.flow.firstIndex(of: order.status), let mine = OrderStatus.flow.firstIndex(of: step) else { return 0 }
        if mine < current || order.status == .delivered { return 2 }
        return mine == current ? 1 : 0
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(Array(OrderStatus.flow.enumerated()), id: \.element) { i, step in
                let s = state(step)
                HStack(alignment: .top, spacing: 12) {
                    VStack(spacing: 0) {
                        ZStack {
                            Circle()
                                .fill(s == 2 ? Color.primary : Theme.surface)
                                .overlay(Circle().strokeBorder(s == 0 ? Theme.line : Color.primary, lineWidth: 1.5))
                            if s == 2 {
                                Image(systemName: "checkmark").font(.caption2.weight(.bold)).foregroundStyle(Theme.surface)
                            } else if s == 1 {
                                Circle().fill(Color.primary).frame(width: dot * 0.4, height: dot * 0.4)
                            }
                        }
                        .frame(width: dot, height: dot)
                        .accessibilityHidden(true)
                        if i < OrderStatus.flow.count - 1 {
                            Rectangle().fill(s == 2 ? Color.primary : Theme.line).frame(width: 1.5).frame(minHeight: 26)
                        }
                    }
                    HStack(alignment: .firstTextBaseline) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(step.label)
                                .font(.subheadline.weight(s == 0 ? .regular : .semibold))
                                .foregroundStyle(s == 0 ? .secondary : .primary)
                            if s == 1, step == .writing {
                                Text("Page \(order.pagesWritten) of \(order.billableUnits)").font(.footnote).foregroundStyle(.secondary)
                            }
                        }
                        Spacer()
                        if let e = events.last(where: { $0.status == step }) {
                            Text(e.createdAt, style: .time).font(.footnote.monospacedDigit()).foregroundStyle(.secondary)
                        }
                    }
                    .padding(.bottom, i < OrderStatus.flow.count - 1 ? 14 : 0)
                }
                .accessibilityElement(children: .combine)
                .accessibilityValue(s == 2 ? "done" : s == 1 ? "in progress" : "pending")
            }
        }
    }
}
