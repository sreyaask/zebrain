import Foundation

/// Mirrors public.price_order_v3 in the database (the server price is the one charged; this shows it before ordering). Notes: pages × ₹12, plus ₹55 for a new long notebook. Sheets for your own notebook: pages only.
/// Cards: ₹15 each. Delivery ₹49, free above ₹500.
struct Quote {
    static let pagePrice = 12
    static let cardPrice = 15
    static let notebookPrice = 55

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

/// Pages on a standard page size with Penned's house layout (equal margins).
func estimatePages(text: String, size: PageSize, marginMm: Double, lineSpacing: Double) -> Int {
    estimatePages(text: text, widthMm: size.mm.w, heightMm: size.mm.h, marginLeftMm: marginMm, marginRightMm: marginMm,
                  linePitchMm: 7.2 * lineSpacing)
}

/// Pages the plotter will write for this text. Same calculation as estimatePagesOn() in lib/pricing.ts (tested against
/// the plotter's layout in tests/engine.test.mts): first line two line-spaces down, 12 mm at the bottom, word wrapping at
/// 2.3 mm a character, two leading spaces = 6 mm indent, wrapped lines of "Q1." / "(a)" / "-" hang under the text,
/// text runs on across pages, and a diagram (about a third of a page) starts a new page when it doesn't fit.
func estimatePages(text: String, widthMm: Double, heightMm: Double, marginLeftMm: Double, marginRightMm: Double, linePitchMm: Double) -> Int {
    let charMm = 2.3, spaceMm = 1.95, indentMm = 6.0
    var body = text.replacingOccurrences(of: "\r\n", with: "\n")
    while let last = body.last, last.isWhitespace { body.removeLast() }
    while body.first == "\n" { body.removeFirst() }
    guard !body.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return 0 }
    let pitch = max(3, linePitchMm)
    let usable = max(20, widthMm - marginLeftMm - marginRightMm)
    let perPage = max(1, Int(((heightMm - pitch * 2 - 12) / pitch).rounded(.down)) + 1)
    var pages = 1, row = 0
    func lines(_ n: Int) {
        for _ in 0..<n {
            if row >= perPage { pages += 1; row = 0 }
            row += 1
        }
    }
    func block(_ n: Int) {
        if row > 0 && row + n > perPage { pages += 1; row = 0 }
        row += n
    }
    for raw in body.components(separatedBy: "\n") {
        let trimmed = raw.trimmingCharacters(in: .whitespaces)
        if trimmed.wholeMatch(of: #/\[\[diagram:[\w-]+\]\]/#) != nil {
            block(max(2, Int((Double(perPage) / 3).rounded())))
            continue
        }
        let heading = raw.hasPrefix("# ")
        let content = heading ? String(raw.dropFirst(2)) : raw
        let words = content.split(whereSeparator: { $0 == " " || $0 == "\t" }).map(String.init)
        guard let firstWord = words.first else { lines(1); continue }
        let lead = heading ? 0 : raw.prefix(while: { $0 == " " }).count
        let first = min(Double(lead / 2) * indentMm, usable / 2)
        let marker = firstWord.wholeMatch(of: #/(?i)(Q?\d+[.)]|\(?[a-z]{1,3}\)|[a-z][.)]|[-•*–])/#) != nil
        let hang = marker && words.count > 1 ? min(Double(firstWord.count) * charMm + spaceMm, usable / 3) : 0
        var indent = first, width = 0.0, count = 1, empty = true
        for word in words {
            var w = Double(word.count) * charMm
            while w > usable - indent { count += 1; indent = first + hang; w -= usable - indent; empty = true; width = 0 }
            if !empty && width + spaceMm + w > usable - indent { count += 1; indent = first + hang; width = 0; empty = true }
            width += (empty ? 0 : spaceMm) + w
            empty = false
        }
        lines(count)
    }
    return pages
}

func rupees(_ n: Int) -> String {
    let f = NumberFormatter()
    f.numberStyle = .decimal
    f.locale = Locale(identifier: "en_IN")
    return "₹" + (f.string(from: NSNumber(value: n)) ?? "\(n)")
}
