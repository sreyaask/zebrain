import Foundation

/// Mirrors public.price_order_v2() in the database. The server price is the one charged;
/// this is only for showing the total before the order is placed.
/// Notes: pages × ₹11, plus ₹120 when we supply the notebook. Cards: ₹15 each. Delivery ₹49, free above ₹500.
struct Quote {
    static let pagePrice = 11
    static let cardPrice = 15
    static let notebookPrice = 120

    let billableUnits: Int
    let unitPrice: Int
    let writing: Int
    let notebook: Int
    let delivery: Int
    var total: Int { writing + notebook + delivery }

    init(paper: PaperID, units: Int, notebookSource: NotebookSource = .new) {
        let u = max(0, units)
        let isNotebook = paper == .plainNotebook || paper == .ruledNotebook
        billableUnits = u
        unitPrice = paper == .premiumCard ? Quote.cardPrice : Quote.pagePrice
        writing = u * unitPrice
        notebook = isNotebook && notebookSource == .new && u > 0 ? Quote.notebookPrice : 0
        let subtotal = writing + notebook
        delivery = (subtotal == 0 || subtotal > 500) ? 0 : 49
    }
}

/// Same estimate as estimatePages() in lib/pricing.ts.
func estimatePages(text: String, size: PageSize, marginMm: Double, lineSpacing: Double) -> Int {
    estimatePages(text: text, widthMm: size.mm.w, heightMm: size.mm.h, marginMm: marginMm, linePitchMm: 7.2 * lineSpacing)
}

/// Page estimate for any page size. A diagram takes about a third of a page.
func estimatePages(text: String, widthMm: Double, heightMm: Double, marginMm: Double, linePitchMm: Double) -> Int {
    let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return 0 }
    let charsPerLine = max(10, Int((widthMm - marginMm * 2) / 2.3))
    let linesPerPage = max(4, Int((heightMm - 30) / max(3, linePitchMm)))
    let lines = trimmed.components(separatedBy: "\n").reduce(0) { total, line in
        if line.hasPrefix("[[diagram:") { return total + max(3, linesPerPage / 3) }
        return total + max(1, Int(ceil(Double(line.count) / Double(charsPerLine))))
    }
    return max(1, Int(ceil(Double(lines) / Double(linesPerPage))))
}

func rupees(_ n: Int) -> String {
    let f = NumberFormatter()
    f.numberStyle = .decimal
    f.locale = Locale(identifier: "en_IN")
    return "₹" + (f.string(from: NSNumber(value: n)) ?? "\(n)")
}
