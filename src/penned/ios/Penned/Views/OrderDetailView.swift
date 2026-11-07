import SwiftUI

struct OrderDetailView: View {
    @Environment(AppModel.self) private var model
    @State var order: Order
    @State private var events: [OrderEvent] = []
    @State private var error: String?
    @State private var paying = false

    var body: some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: 6) {
                    Text(order.code).font(.caption.monospaced()).foregroundStyle(.secondary)
                    Text(order.title.isEmpty ? "Untitled order" : order.title).font(.title2.weight(.semibold))
                    Text("\(order.quantityLabel) · \(order.paper.name) · \(order.ink.label) ink").foregroundStyle(.secondary)
                    if let headline { Text(headline).font(.headline).padding(.top, 6) }
                }
            }

            if order.paymentStatus != "paid" && order.status != .cancelled {
                Section {
                    Button {
                        Task { await pay() }
                    } label: {
                        HStack { Text("Pay \(rupees(order.total))"); if paying { Spacer(); ProgressView() } }
                    }
                    .disabled(paying)
                } footer: {
                    Text("Demo checkout. No real payment is made.")
                }
            }

            Section("Progress") {
                ForEach(OrderStatus.flow, id: \.self) { step in
                    TimelineRow(step: step, order: order, event: events.last { $0.status == step })
                }
            }

            if let rider = order.riderName, order.status == .outForDelivery {
                Section("Your rider") {
                    LabeledContent(rider, value: order.eta.map { "ETA \($0)" } ?? "")
                }
            }

            Section("Price") {
                LabeledContent("Writing · \(order.billableUnits) × \(rupees(order.unitPrice))", value: rupees(order.writingAmount))
                LabeledContent("Delivery", value: order.deliveryAmount == 0 ? "Free" : rupees(order.deliveryAmount))
                LabeledContent("Total", value: rupees(order.total)).font(.body.weight(.semibold))
            }

            Section("Deliver to") {
                Text("\(order.addressLine1), \(order.area), Hyderabad \(order.pincode)")
                Text(order.timeSlot.label).foregroundStyle(.secondary)
            }

            if order.status == .delivered {
                Section { Text("Not happy with a page? We rewrite it free within 24 hours of delivery.").foregroundStyle(.secondary) }
            }
            if let error { Section { Text(error).foregroundStyle(.red) } }
        }
        .navigationTitle(order.code)
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await reload() }
        .task {
            // Poll while the order is moving; the admin portal updates status in real time.
            while !Task.isCancelled {
                await reload()
                if order.status == .delivered || order.status == .cancelled { break }
                try? await Task.sleep(for: .seconds(20))
            }
        }
    }

    private var headline: String? {
        switch order.status {
        case .writing: "Writing page \(order.pagesWritten) of \(order.billableUnits)"
        case .outForDelivery: order.eta.map { "Arriving in \($0)" } ?? "Out for delivery"
        case .delivered: "Delivered"
        case .cancelled: "Cancelled"
        default: nil
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

private struct TimelineRow: View {
    let step: OrderStatus
    let order: Order
    let event: OrderEvent?

    var state: Int {
        guard let current = OrderStatus.flow.firstIndex(of: order.status), let mine = OrderStatus.flow.firstIndex(of: step) else { return 0 }
        return mine < current ? 2 : mine == current ? (order.status == .delivered ? 2 : 1) : 0
    }

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Image(systemName: state == 2 ? "checkmark.circle.fill" : state == 1 ? "circle.inset.filled" : "circle")
                .foregroundStyle(state == 0 ? Color.secondary : Theme.accent)
                .accessibilityHidden(true)
            VStack(alignment: .leading) {
                Text(step.label).foregroundStyle(state == 0 ? .secondary : .primary)
                if step == .writing && state == 1 {
                    ProgressView(value: Double(order.pagesWritten), total: Double(max(order.billableUnits, 1)))
                }
            }
            Spacer()
            if let event { Text(event.createdAt, style: .time).font(.caption).foregroundStyle(.secondary) }
        }
        .accessibilityElement(children: .combine)
        .accessibilityValue(state == 2 ? "done" : state == 1 ? "in progress" : "pending")
    }
}
