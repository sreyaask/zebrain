import SwiftUI

struct OrdersView: View {
    @Environment(AppModel.self) private var model
    @State private var showNew = false

    var active: [Order] { model.orders.filter { $0.status != .delivered && $0.status != .cancelled } }
    var past: [Order] { model.orders.filter { $0.status == .delivered || $0.status == .cancelled } }

    var body: some View {
        NavigationStack {
            List {
                if let error = model.lastError {
                    Text(error).foregroundStyle(.red)
                }
                if model.orders.isEmpty {
                    ContentUnavailableView {
                        Label("No orders yet", systemImage: "doc.text")
                    } description: {
                        Text("Scan the pages you need written, and we'll deliver them in your handwriting in 2–3 hours.")
                    } actions: {
                        Button("Start an order") { showNew = true }.buttonStyle(.borderedProminent)
                    }
                    .listRowBackground(Color.clear)
                }
                if !active.isEmpty {
                    Section("In progress") { ForEach(active) { OrderRow(order: $0) } }
                }
                if !past.isEmpty {
                    Section("Past") { ForEach(past) { OrderRow(order: $0) } }
                }
            }
            .navigationTitle("Orders")
            .navigationDestination(for: Order.self) { OrderDetailView(order: $0) }
            .refreshable { await model.refresh() }
            .toolbar {
                Button { showNew = true } label: { Label("New order", systemImage: "plus") }
            }
            .sheet(isPresented: $showNew) { NewOrderView() }
        }
    }
}

struct OrderRow: View {
    let order: Order
    var body: some View {
        NavigationLink(value: order) {
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(order.code).font(.caption.monospaced()).foregroundStyle(.secondary)
                    Spacer()
                    StatusChip(status: order.status, label: order.status == .writing ? "Writing \(order.pagesWritten)/\(order.billableUnits)" : nil)
                }
                Text(order.title.isEmpty ? "Untitled order" : order.title).font(.body.weight(.medium))
                Text("\(order.quantityLabel) · \(order.paper.name) · \(rupees(order.total))")
                    .font(.subheadline).foregroundStyle(.secondary)
            }
            .padding(.vertical, 2)
        }
    }
}
