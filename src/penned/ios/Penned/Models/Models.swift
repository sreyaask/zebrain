import Foundation
import CoreGraphics

enum Ink: String, Codable, CaseIterable, Identifiable {
    case blue, black
    var id: String { rawValue }
    var label: String { rawValue.capitalized }
}

enum PaperID: String, Codable, CaseIterable, Identifiable {
    case plainNotebook = "plain-notebook"
    case ruledNotebook = "ruled-notebook"
    case looseA4 = "loose-a4"
    case premiumCard = "premium-card"
    var id: String { rawValue }

    var name: String {
        switch self {
        case .plainNotebook: "Long plain notebook"
        case .ruledNotebook: "Long ruled notebook"
        case .looseA4: "Loose A4 sheets"
        case .premiumCard: "Premium card (A6)"
        }
    }
    var detail: String {
        switch self {
        case .plainNotebook: "New long notebook, 17.5 × 27.5 cm, unruled."
        case .ruledNotebook: "New long notebook, 17.5 × 27.5 cm, ruled with a margin."
        case .looseA4: "80 gsm sheets for letters."
        case .premiumCard: "300 gsm card with envelope."
        }
    }
    var pageSize: PageSize {
        switch self {
        case .plainNotebook, .ruledNotebook: .long
        case .looseA4: .a4
        case .premiumCard: .a6
        }
    }
    var isCard: Bool { self == .premiumCard }
}

enum PageSize: String, Codable, CaseIterable, Identifiable {
    case long, b5, a4, a5, a6
    var id: String { rawValue }
    var label: String {
        switch self {
        case .long: "Long notebook"
        case .b5: "Notebook (B5)"
        case .a4: "A4"
        case .a5: "A5"
        case .a6: "Card (A6)"
        }
    }
    var mm: (w: Double, h: Double) {
        switch self {
        case .long: (175, 275)
        case .b5: (176, 250)
        case .a4: (210, 297)
        case .a5: (148, 210)
        case .a6: (105, 148)
        }
    }
}

enum HeadingStyle: String, Codable, CaseIterable, Identifiable {
    case underline, larger, plain
    var id: String { rawValue }
    var label: String { self == .underline ? "Underlined" : rawValue.capitalized }
}

enum OrderStatus: String, Codable {
    case received, writing
    case qualityCheck = "quality_check"
    case outForDelivery = "out_for_delivery"
    case delivered, cancelled

    var label: String {
        switch self {
        case .received: "Received"
        case .writing: "Writing"
        case .qualityCheck: "Quality check"
        case .outForDelivery: "Out for delivery"
        case .delivered: "Delivered"
        case .cancelled: "Cancelled"
        }
    }
    static let flow: [OrderStatus] = [.received, .writing, .qualityCheck, .outForDelivery, .delivered]
}

enum TimeSlot: String, Codable, CaseIterable, Identifiable {
    case within3h = "within-3h"
    case evening = "6-8pm"
    case lateEvening = "8-10pm"
    case tomorrowMorning = "tomorrow-9-11am"
    var id: String { rawValue }
    var label: String {
        switch self {
        case .within3h: "Within 3 hrs"
        case .evening: "6–8 PM"
        case .lateEvening: "8–10 PM"
        case .tomorrowMorning: "Tomorrow 9–11 AM"
        }
    }
}

let deliveryAreas = ["Gachibowli", "Kondapur", "Madhapur", "Hitech City", "Kukatpally",
                     "Banjara Hills", "Jubilee Hills", "Ameerpet", "Secunderabad", "LB Nagar"]

// MARK: - Rows

struct Order: Codable, Identifiable, Hashable {
    let id: UUID
    let code: String
    let title: String
    let status: OrderStatus
    var paymentStatus: String
    let paper: PaperID
    let ink: Ink
    let copies: Int
    let pageCount: Int
    let billableUnits: Int
    let unitPrice: Int
    let writingAmount: Int
    let deliveryAmount: Int
    let total: Int
    let addressLine1: String
    let area: String
    let pincode: String
    let timeSlot: TimeSlot
    let pagesWritten: Int
    let riderName: String?
    let eta: String?
    let createdAt: Date
    /// Optional so older rows (before notebook pricing) still decode.
    let notebookSource: NotebookSource?
    let notebookAmount: Int?
    let deliveredAt: Date?
    // Used to pre-fill "Order again".
    let receiverName: String?
    let receiverPhone: String?
    let landmark: String?
    let deliveryNote: String?
    let notebookBarcode: String?
    let notebookSpec: NotebookSpec?

    enum CodingKeys: String, CodingKey {
        case id, code, title, status, paper, ink, copies, total, area, pincode, eta
        case notebookSource = "notebook_source"
        case notebookAmount = "notebook_amount"
        case deliveredAt = "delivered_at"
        case receiverName = "receiver_name"
        case receiverPhone = "receiver_phone"
        case landmark
        case deliveryNote = "delivery_note"
        case notebookBarcode = "notebook_barcode"
        case notebookSpec = "notebook_spec"
        case paymentStatus = "payment_status"
        case pageCount = "page_count"
        case billableUnits = "billable_units"
        case unitPrice = "unit_price"
        case writingAmount = "writing_amount"
        case deliveryAmount = "delivery_amount"
        case addressLine1 = "address_line1"
        case timeSlot = "time_slot"
        case pagesWritten = "pages_written"
        case riderName = "rider_name"
        case createdAt = "created_at"
    }

    var quantityLabel: String { paper.isCard ? "\(copies) cards" : "\(pageCount) pages" }

    /// Which flow this order came from, for "Order again".
    var kindGuess: OrderKind {
        if paper == .premiumCard || paper == .looseA4 { return .letters }
        return title.hasPrefix("Missed notes") ? .missedNotes : .completeNotes
    }
}

struct OrderEvent: Codable, Identifiable, Hashable {
    let id: Int
    let status: OrderStatus
    let note: String?
    let createdAt: Date
    enum CodingKeys: String, CodingKey { case id, status, note; case createdAt = "created_at" }
}

struct HandwritingProfile: Codable, Identifiable, Hashable {
    let id: UUID
    let name: String
    let ink: Ink
    let status: String // uploaded | processing | ready | needs_rescan
    let reviewNote: String?
    let glyphSet: GlyphSet?
    let createdAt: Date
    enum CodingKeys: String, CodingKey {
        case id, name, ink, status
        case reviewNote = "review_note"
        case glyphSet = "glyph_set"
        case createdAt = "created_at"
    }

    var statusLabel: String {
        switch status {
        case "ready": "Ready"
        case "needs_rescan": "Rescan needed"
        default: "In review"
        }
    }
}

/// Matches lib/engine/types.ts on the web. Units are x-heights, y up, origin on the baseline.
struct GlyphSet: Codable, Hashable {
    // CGFloat so the drawing code can use these values directly (decodes from JSON numbers like Double).
    struct Point: Codable, Hashable { let x: CGFloat; let y: CGFloat }
    struct Glyph: Codable, Hashable {
        let char: String
        let strokes: [[Point]]
        let width: CGFloat
    }
    let glyphs: [String: [Glyph]]
}

// MARK: - Notebooks

/// `new`: a new long notebook from us (₹55). `own`: ruled A4 sheets in the customer's notebook format, to cut and stick in (no charge, no pickup).
enum NotebookSource: String, Codable {
    case new, own
}

/// A notebook's page and ruling, in millimetres. Stored on the order so the sheets we send match the customer's notebook.
struct NotebookSpec: Codable, Hashable {
    var name: String?
    var widthMm: Double
    var heightMm: Double
    var linePitchMm: Double?
    var marginMm: Double?
    var ruled: Bool
    var pages: Int?

    enum CodingKeys: String, CodingKey {
        case name, ruled, pages
        case widthMm = "width_mm"
        case heightMm = "height_mm"
        case linePitchMm = "line_pitch_mm"
        case marginMm = "margin_mm"
    }

    /// Plausible measurements, matching the database checks.
    var isValid: Bool {
        (50...400).contains(widthMm) && (50...500).contains(heightMm)
            && (!ruled || (linePitchMm.map { (3...20).contains($0) } ?? false))
            && (marginMm.map { (0...60).contains($0) && widthMm - $0 >= 40 } ?? true)
    }
}

extension NotebookSpec {
    /// Lenient: a spec with missing fields (e.g. typed in by hand on the server) decodes as invalid instead of
    /// failing the whole order list.
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        name = try? c.decodeIfPresent(String.self, forKey: .name)
        widthMm = (try? c.decodeIfPresent(Double.self, forKey: .widthMm)) ?? 0
        heightMm = (try? c.decodeIfPresent(Double.self, forKey: .heightMm)) ?? 0
        linePitchMm = try? c.decodeIfPresent(Double.self, forKey: .linePitchMm)
        marginMm = try? c.decodeIfPresent(Double.self, forKey: .marginMm)
        ruled = (try? c.decodeIfPresent(Bool.self, forKey: .ruled)) ?? true
        pages = try? c.decodeIfPresent(Int.self, forKey: .pages)
    }
}

/// A row of public.notebook_catalog: notebooks we already know by barcode.
struct CatalogNotebook: Decodable {
    let barcode: String
    let name: String
    let widthMm: Double
    let heightMm: Double
    let linePitchMm: Double?
    let marginMm: Double?
    let ruled: Bool
    let pages: Int?

    enum CodingKeys: String, CodingKey {
        case barcode, name, ruled, pages
        case widthMm = "width_mm"
        case heightMm = "height_mm"
        case linePitchMm = "line_pitch_mm"
        case marginMm = "margin_mm"
    }

    var spec: NotebookSpec {
        NotebookSpec(name: name, widthMm: widthMm, heightMm: heightMm, linePitchMm: linePitchMm, marginMm: marginMm, ruled: ruled, pages: pages)
    }
}

// MARK: - Inserts

struct NewOrder: Encodable {
    /// Made on the phone so a retry reuses the same order instead of creating a second one.
    var id = UUID()
    var title: String
    var sourceMode: String
    var sourceText: String
    var paper: PaperID
    var ink: Ink
    var pageSize: PageSize
    var marginMm: Double
    var lineSpacing: Double
    var headingStyle: HeadingStyle
    var copies: Int
    var pageCount: Int
    var handwritingProfileId: UUID?
    var receiverName: String
    var receiverPhone: String
    var addressLine1: String
    var area: String
    var pincode: String
    var landmark: String?
    var timeSlot: TimeSlot
    var notebookSource: NotebookSource = .new
    var notebookBarcode: String?
    var notebookSpec: NotebookSpec?
    var deliveryNote: String?

    enum CodingKeys: String, CodingKey {
        case id, title, paper, ink, copies, area, pincode, landmark
        case notebookSource = "notebook_source"
        case notebookBarcode = "notebook_barcode"
        case notebookSpec = "notebook_spec"
        case sourceMode = "source_mode"
        case sourceText = "source_text"
        case pageSize = "page_size"
        case marginMm = "margin_mm"
        case lineSpacing = "line_spacing"
        case headingStyle = "heading_style"
        case pageCount = "page_count"
        case handwritingProfileId = "handwriting_profile_id"
        case receiverName = "receiver_name"
        case receiverPhone = "receiver_phone"
        case addressLine1 = "address_line1"
        case timeSlot = "time_slot"
        case deliveryNote = "delivery_note"
    }
}

/// A saved delivery address (public.addresses).
struct SavedAddress: Codable, Identifiable, Hashable {
    var id: UUID?
    var label: String
    var line1: String
    var area: String
    var pincode: String
    var landmark: String?
    var receiverName: String?
    var receiverPhone: String?

    enum CodingKeys: String, CodingKey {
        case id, label, line1, area, pincode, landmark
        case receiverName = "receiver_name"
        case receiverPhone = "receiver_phone"
    }

    var symbol: String {
        switch label.lowercased() {
        case "home": "house.fill"
        case "hostel": "bed.double.fill"
        case "work": "briefcase.fill"
        default: "mappin.circle.fill"
        }
    }
}

/// A customer's rating of a delivered order (public.order_feedback).
struct OrderFeedback: Codable, Hashable {
    let orderId: UUID
    let rating: Int
    let comment: String?
    enum CodingKeys: String, CodingKey { case rating, comment; case orderId = "order_id" }
}

struct NewOrderFile: Encodable {
    let orderId: UUID
    let path: String
    let kind: String
    let pages: Int
    enum CodingKeys: String, CodingKey { case path, kind, pages; case orderId = "order_id" }
}

struct NewHandwriting: Encodable {
    let name: String
    let ink: Ink
    let scanPath: String
    enum CodingKeys: String, CodingKey { case name, ink; case scanPath = "scan_path" }
}

// MARK: - What the customer is ordering

/// The three things the app offers, each with its own order flow.
enum OrderKind: String, Identifiable, CaseIterable {
    case completeNotes, missedNotes, letters
    var id: String { rawValue }

    var title: String {
        switch self {
        case .completeNotes: "Complete notes"
        case .missedNotes: "Missed notes"
        case .letters: "Letters & cards"
        }
    }
    var subtitle: String {
        switch self {
        case .completeNotes: "Your own notes as a neat notebook, indexed for revision"
        case .missedNotes: "A clean copy of lessons missed for illness or travel"
        case .letters: "Thank-you notes, letters and cards, by hand"
        }
    }
    var symbol: String {
        switch self {
        case .completeNotes: "book.closed"
        case .missedNotes: "calendar.badge.clock"
        case .letters: "envelope"
        }
    }
}

/// Card and letter paper for Letters & cards.
enum CardPaper: String, CaseIterable, Identifiable {
    case ivory, kraft, cotton, letter
    var id: String { rawValue }
    var name: String {
        switch self {
        case .ivory: "Ivory card"
        case .kraft: "Kraft card"
        case .cotton: "Deckled cotton card"
        case .letter: "A4 letter paper"
        }
    }
    var detail: String {
        switch self {
        case .ivory: "Smooth 300 gsm card with envelope"
        case .kraft: "Warm recycled card with envelope"
        case .cotton: "Thick card with soft torn edges"
        case .letter: "Cream sheets for longer letters"
        }
    }
    var paper: PaperID { self == .letter ? .looseA4 : .premiumCard }
    var size: PageSize { self == .letter ? .a4 : .a6 }
}

