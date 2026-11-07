import Foundation

/// Mirrors public.price_order() in the database. The server price is the one charged;
/// this is only for showing the total before the order is placed.
struct Quote {
    let billableUnits: Int
    let unitPrice: Int
    let writing: Int
    let delivery: Int
    var total: Int { writing + delivery }
    let minimumApplied: Bool

    init(paper: PaperID, units: Int) {
        let u = max(0, units)
        let isNotebook = paper == .plainNotebook || paper == .ruledNotebook
        billableUnits = isNotebook ? max(30, u) : u
        minimumApplied = isNotebook && u > 0 && u < 30
        unitPrice = paper == .premiumCard ? 15 : 9
        writing = billableUnits * unitPrice
        delivery = (writing == 0 || writing > 500) ? 0 : 49
    }
}

/// Same estimate as estimatePages() in lib/pricing.ts.
func estimatePages(text: String, size: PageSize, marginMm: Double, lineSpacing: Double) -> Int {
    let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return 0 }
    let lineHeight = 7.2 * lineSpacing
    let charsPerLine = max(10, Int((size.mm.w - marginMm * 2) / 2.3))
    let linesPerPage = max(4, Int((size.mm.h - 30) / lineHeight))
    let lines = trimmed.components(separatedBy: "\n").reduce(0) { $0 + max(1, Int(ceil(Double($1.count) / Double(charsPerLine)))) }
    return max(1, Int(ceil(Double(lines) / Double(linesPerPage))))
}

func rupees(_ n: Int) -> String {
    let f = NumberFormatter()
    f.numberStyle = .decimal
    f.locale = Locale(identifier: "en_IN")
    return "₹" + (f.string(from: NSNumber(value: n)) ?? "\(n)")
}
