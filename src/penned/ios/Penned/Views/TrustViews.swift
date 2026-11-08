import SwiftUI

// Trust, the quick-commerce way: say exactly what you pay, what we promise, who can see your files,
// and how to reach a person. Only real promises go here; no ratings or user counts we can't back up.

/// What Penned promises on every order. One list so the app says the same thing everywhere.
enum Guarantee: CaseIterable, Identifiable {
    case finalPrice, rewrite, realPen, checked, privateFiles, tracking
    var id: Self { self }

    var symbol: String {
        switch self {
        case .finalPrice: "indianrupeesign.circle"
        case .rewrite: "arrow.uturn.backward.circle"
        case .realPen: "pencil.tip"
        case .checked: "checkmark.seal"
        case .privateFiles: "lock"
        case .tracking: "location.circle"
        }
    }
    /// Short, for chips.
    var short: String {
        switch self {
        case .finalPrice: "No hidden charges"
        case .rewrite: "Free rewrite"
        case .realPen: "Real pen"
        case .checked: "Checked by hand"
        case .privateFiles: "Private files"
        case .tracking: "Live tracking"
        }
    }
    var title: String {
        switch self {
        case .finalPrice: "The price you see is the price you pay"
        case .rewrite: "Free rewrite"
        case .realPen: "A real pen, real paper"
        case .checked: "Every page checked"
        case .privateFiles: "Your files stay private"
        case .tracking: "Live tracking"
        }
    }
    var detail: String {
        switch self {
        case .finalPrice: "Pages, notebook and delivery are shown before you pay. Nothing is added later."
        case .rewrite: "Not happy with a page? We rewrite it free within 24 hours of delivery."
        case .realPen: "Written by a pen machine in your handwriting, never printed."
        case .checked: "A person checks every page before it leaves us."
        case .privateFiles: "Only you and the Penned team can open your pages and notes."
        case .tracking: "Follow your order page by page, right up to your door."
        }
    }
}

/// A row of small promise chips, e.g. under the home header and above the pay button.
struct TrustStrip: View {
    var items: [Guarantee] = [.finalPrice, .rewrite, .checked, .privateFiles]
    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(items) { g in
                    Label(g.short, systemImage: g.symbol)
                        .font(.caption.weight(.heavy))
                        .foregroundStyle(Theme.ink)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 7)
                        .background(Theme.surface, in: Capsule())
                        .overlay(Capsule().strokeBorder(Theme.ink, lineWidth: 1.5))
                }
            }
            .padding(.vertical, 2)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Our promises: " + items.map(\.short).joined(separator: ", "))
    }
}

/// A full promise row with its explanation.
struct GuaranteeRow: View {
    let guarantee: Guarantee
    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: guarantee.symbol)
                .font(.title3.weight(.bold))
                .frame(width: 32)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(guarantee.title).font(.subheadline.weight(.heavy))
                Text(guarantee.detail).font(.footnote).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Bill

struct BillLine: Identifiable {
    let id = UUID()
    let symbol: String
    let label: String
    var note: String?
    let amount: Int
    /// Shown as "FREE" with the usual price struck through, when there is one.
    var freeInsteadOf: Int?
}

/// "Bill details": every line of the price, the grand total, and what was free.
struct BillCard: View {
    let lines: [BillLine]
    let total: Int
    var footnote: String?

    private var saved: Int { lines.compactMap { $0.amount == 0 ? $0.freeInsteadOf : nil }.reduce(0, +) }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Bill details").font(.headline.weight(.heavy))
            ForEach(lines) { line in
                HStack(alignment: .firstTextBaseline, spacing: 10) {
                    Image(systemName: line.symbol)
                        .font(.footnote.weight(.bold))
                        .frame(width: 20)
                        .accessibilityHidden(true)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(line.label).font(.subheadline)
                        if let note = line.note { Text(note).font(.caption).foregroundStyle(.secondary) }
                    }
                    Spacer(minLength: 8)
                    if line.amount == 0 {
                        if let was = line.freeInsteadOf {
                            Text(rupees(was)).strikethrough().font(.caption.monospacedDigit()).foregroundStyle(.secondary)
                        }
                        Text("FREE").font(.subheadline.weight(.heavy))
                    } else {
                        Text(rupees(line.amount)).font(.subheadline.monospacedDigit())
                    }
                }
                .accessibilityElement(children: .combine)
            }
            Rectangle().fill(Theme.ink).frame(height: 1.5)
            HStack {
                Text("Grand total").font(.headline.weight(.black))
                Spacer()
                Text(rupees(total)).font(.headline.weight(.black).monospacedDigit())
            }
            .accessibilityElement(children: .combine)
            if saved > 0 {
                Label("You save \(rupees(saved)) on this order", systemImage: "tag.fill")
                    .font(.footnote.weight(.heavy))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Theme.fill, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
            }
            if let footnote {
                Text(footnote).font(.caption).foregroundStyle(.secondary)
            }
        }
        .card()
    }
}

extension Quote {
    /// Bill lines for an order before it's placed.
    func billLines(isNotes: Bool, ownNotebook: Bool, unitName: String) -> [BillLine] {
        var lines = [BillLine(symbol: "pencil.line", label: "Handwriting", note: "\(billableUnits) \(unitName) × \(rupees(unitPrice))", amount: writing)]
        if isNotes {
            lines.append(ownNotebook
                ? BillLine(symbol: "book.closed", label: "Notebook", note: "We write in yours", amount: 0, freeInsteadOf: Quote.notebookPrice)
                : BillLine(symbol: "book.closed", label: "Notebook", note: "New, included in the order", amount: notebook))
        }
        lines.append(BillLine(symbol: "scooter", label: "Delivery", note: "Free above \(rupees(500))",
                              amount: delivery, freeInsteadOf: delivery == 0 && writing > 0 ? 49 : nil))
        return lines
    }
}

extension Order {
    /// Bill lines from the server's own price.
    var billLines: [BillLine] {
        var lines = [BillLine(symbol: "pencil.line", label: "Handwriting",
                              note: "\(billableUnits) \(paper.isCard ? "cards" : "pages") × \(rupees(unitPrice))", amount: writingAmount)]
        let own = notebookSource == .own
        // Older orders (before notebook pricing) included the paper, so show the line only when it applies.
        if (paper == .plainNotebook || paper == .ruledNotebook) && (own || (notebookAmount ?? 0) > 0) {
            lines.append(BillLine(symbol: "book.closed", label: "Notebook", note: own ? "We write in yours" : "New, included in the order",
                                  amount: notebookAmount ?? 0, freeInsteadOf: own ? Quote.notebookPrice : nil))
        }
        lines.append(BillLine(symbol: "scooter", label: "Delivery", amount: deliveryAmount, freeInsteadOf: deliveryAmount == 0 ? 49 : nil))
        return lines
    }

    /// Plain-text receipt to share or save.
    var receipt: String {
        let date = createdAt.formatted(date: .abbreviated, time: .shortened)
        var rows = ["Penned receipt", "Order \(code) · \(date)"]
        if !title.isEmpty { rows.append(title) }
        rows.append("")
        for line in billLines {
            rows.append("\(line.label)\(line.note.map { " (\($0))" } ?? ""): \(line.amount == 0 ? "Free" : rupees(line.amount))")
        }
        rows += ["Total: \(rupees(total))", "Payment: \(paymentStatus == "paid" ? "Paid" : "Not paid yet")",
                 "Deliver to: \(addressLine1), \(area), Hyderabad \(pincode)"]
        return rows.joined(separator: "\n")
    }
}

// MARK: - Help and support

/// Ways to reach a person. Each appears only when it's set in Config.
enum Support {
    static func whatsApp(about order: Order?) -> URL? {
        guard !Config.supportWhatsApp.isEmpty else { return nil }
        let text = order.map { "Hi Penned, I need help with order \($0.code)." } ?? "Hi Penned, I need some help."
        var c = URLComponents(string: "https://wa.me/\(Config.supportWhatsApp)")
        c?.queryItems = [URLQueryItem(name: "text", value: text)]
        return c?.url
    }
    static var phone: URL? { Config.supportPhone.isEmpty ? nil : URL(string: "tel:\(Config.supportPhone.filter { $0.isNumber || $0 == "+" })") }
    static func email(about order: Order?) -> URL? {
        guard !Config.supportEmail.isEmpty else { return nil }
        var c = URLComponents()
        c.scheme = "mailto"
        c.path = Config.supportEmail
        c.queryItems = [URLQueryItem(name: "subject", value: order.map { "Help with order \($0.code)" } ?? "Help with Penned")]
        return c.url
    }
    static var any: Bool { !Config.supportWhatsApp.isEmpty || !Config.supportPhone.isEmpty || !Config.supportEmail.isEmpty }
}

/// Contact buttons: WhatsApp, call, email (whichever are set).
struct ContactButtons: View {
    var order: Order?
    var body: some View {
        VStack(spacing: 10) {
            if let url = Support.whatsApp(about: order) {
                Link(destination: url) { Label("Chat on WhatsApp", systemImage: "message.fill").frame(maxWidth: .infinity) }
                    .buttonStyle(.pennedPrimary)
            }
            AdaptiveStack(spacing: 10) {
                if let url = Support.phone {
                    Link(destination: url) { Label("Call us", systemImage: "phone.fill").frame(maxWidth: .infinity) }
                        .buttonStyle(.pennedSecondary)
                }
                if let url = Support.email(about: order) {
                    Link(destination: url) { Label("Email", systemImage: "envelope.fill").frame(maxWidth: .infinity) }
                        .buttonStyle(.pennedSecondary)
                }
            }
        }
    }
}

/// "Need help?" card for an order.
struct OrderHelpCard: View {
    let order: Order
    @State private var showingHelp = false
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 12) {
                Image(systemName: "questionmark.bubble.fill").font(.title2.weight(.bold)).accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Need help with this order?").font(.headline.weight(.heavy))
                    Text(Support.any ? "A real person replies. Mention \(order.code)." : "Answers to common questions.")
                        .font(.footnote).foregroundStyle(.secondary)
                }
            }
            ContactButtons(order: order)
            Button("Questions and answers") { showingHelp = true }
                .buttonStyle(.pennedSecondary)
                .frame(maxWidth: .infinity)
        }
        .card()
        .sheet(isPresented: $showingHelp) { HelpCenterView(order: order) }
    }
}

/// Questions people ask before trusting a new service with their notes.
struct HelpCenterView: View {
    var order: Order?
    @Environment(\.dismiss) private var dismiss

    private static let faqs: [(String, String)] = [
        ("How does it work?", "You send your notes from your phone. We write them in your handwriting with a real pen, a person checks every page, and our rider brings them to you, usually in 2–3 hours."),
        ("What will I pay?", "\(rupees(Quote.pagePrice)) a page, plus \(rupees(Quote.notebookPrice)) if we supply a new notebook. Writing in your own notebook adds nothing. Delivery is \(rupees(49)), free above \(rupees(500)). The bill is shown before you pay, and that is the total."),
        ("What if a page isn't right?", "Tell us within 24 hours of delivery and we rewrite that page free."),
        ("Who can see my notes?", "Only you and the Penned team. Your files are stored privately and are used only to write your order."),
        ("How do you write in my own notebook?", "Our rider collects your notebook, we continue after your last written page using its measurements, and the rider brings it back with the order."),
        ("Where do you deliver?", deliveryAreas.joined(separator: ", ") + ", in Hyderabad."),
        ("Can I track my order?", "Yes. Orders shows each step live, including the page being written and when the rider is on the way."),
    ]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    if Support.any {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Talk to us").font(.title3.weight(.heavy))
                            ContactButtons(order: order)
                        }
                    }
                    VStack(alignment: .leading, spacing: 0) {
                        ForEach(Array(Self.faqs.enumerated()), id: \.offset) { i, faq in
                            if i > 0 { Divider().overlay(Theme.line) }
                            DisclosureGroup {
                                Text(faq.1).font(.subheadline).foregroundStyle(.secondary)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .padding(.top, 6)
                            } label: {
                                Text(faq.0).font(.subheadline.weight(.heavy)).foregroundStyle(Theme.ink)
                            }
                            .tint(Theme.ink)
                            .padding(.horizontal, 16)
                            .padding(.vertical, 14)
                        }
                    }
                    .card(padding: 0)
                    VStack(alignment: .leading, spacing: 0) {
                        ForEach(Array(Guarantee.allCases.enumerated()), id: \.element) { i, g in
                            if i > 0 { Divider().overlay(Theme.line) }
                            GuaranteeRow(guarantee: g)
                        }
                    }
                    .card(padding: 0)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
            }
            .paperBackground()
            .navigationTitle("Help")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
        }
    }
}

// MARK: - Order placed

/// The confirmation screen: what was ordered, what was paid, and exactly what happens next.
struct OrderPlacedView: View {
    let order: Order
    let ownNotebook: Bool
    let onDone: () -> Void
    @State private var appeared = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var steps: [(String, String, String)] {
        var s: [(String, String, String)] = []
        if ownNotebook { s.append(("scooter", "We collect your notebook", "Our rider picks it up from \(order.area).")) }
        s += [
            ("pencil.line", "Written in your handwriting", "With a real pen, page by page. You'll see each page in Orders."),
            ("checkmark.seal", "Checked by a person", "Every page, before it leaves us."),
            ("house", "Delivered to your door", "\(order.timeSlot.label) · \(order.area)"),
        ]
        return s
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                VStack(spacing: 12) {
                    Image(systemName: "checkmark")
                        .font(.system(size: 40, weight: .black))
                        .foregroundStyle(Theme.paper)
                        .frame(width: 88, height: 88)
                        .background(Theme.ink, in: Circle())
                        .scaleEffect(appeared || reduceMotion ? 1 : 0.6)
                        .opacity(appeared || reduceMotion ? 1 : 0)
                        .accessibilityHidden(true)
                    Text("Order placed").font(.largeTitle.weight(.black))
                    Text(order.paymentStatus == "paid" ? "\(rupees(order.total)) paid · \(order.code)" : "Saved · \(order.code) · payment pending")
                        .font(.subheadline.weight(.semibold).monospacedDigit())
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity)
                .padding(.top, 24)

                VStack(alignment: .leading, spacing: 14) {
                    Text("What happens next").font(.headline.weight(.heavy))
                    ForEach(Array(steps.enumerated()), id: \.offset) { i, step in
                        HStack(alignment: .top, spacing: 12) {
                            Text("\(i + 1)")
                                .font(.caption.weight(.black))
                                .foregroundStyle(Theme.paper)
                                .frame(width: 24, height: 24)
                                .background(Theme.ink, in: Circle())
                                .accessibilityHidden(true)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(step.1).font(.subheadline.weight(.heavy))
                                Text(step.2).font(.footnote).foregroundStyle(.secondary)
                            }
                        }
                        .accessibilityElement(children: .combine)
                    }
                }
                .card()

                VStack(alignment: .leading, spacing: 0) {
                    GuaranteeRow(guarantee: .rewrite)
                    Divider().overlay(Theme.line)
                    GuaranteeRow(guarantee: .privateFiles)
                }
                .card(padding: 0)

                Button(action: onDone) { Text("Track my order").frame(maxWidth: .infinity) }
                    .buttonStyle(.pennedPrimary)
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 24)
        }
        .paperBackground()
        .onAppear { withAnimation(.spring(duration: 0.45, bounce: 0.35)) { appeared = true } }
    }
}
