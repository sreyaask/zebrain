import Foundation

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
        case .plainNotebook: "Plain notebook"
        case .ruledNotebook: "Ruled notebook"
        case .looseA4: "Loose A4 sheets"
        case .premiumCard: "Premium card (A6)"
        }
    }
    var detail: String {
        switch self {
        case .plainNotebook: "100 pages, unruled. 30-page minimum."
        case .ruledNotebook: "100 pages, ruled with margin. 30-page minimum."
        case .looseA4: "80 gsm sheets for letters and assignments."
        case .premiumCard: "300 gsm card with envelope."
        }
    }
    var pageSize: PageSize {
        switch self {
        case .plainNotebook, .ruledNotebook: .b5
        case .looseA4: .a4
        case .premiumCard: .a6
        }
    }
    var isCard: Bool { self == .premiumCard }
}

enum PageSize: String, Codable, CaseIterable, Identifiable {
    case b5, a4, a5, a6
    var id: String { rawValue }
    var label: String {
        switch self {
        case .b5: "Notebook (B5)"
        case .a4: "A4"
        case .a5: "A5"
        case .a6: "Card (A6)"
        }
    }
    var mm: (w: Double, h: Double) {
        switch self {
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
    let paymentStatus: String
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

    enum CodingKeys: String, CodingKey {
        case id, code, title, status, paper, ink, copies, total, area, pincode, eta
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
    struct Point: Codable, Hashable { let x: Double; let y: Double }
    struct Glyph: Codable, Hashable {
        let char: String
        let strokes: [[Point]]
        let width: Double
    }
    let glyphs: [String: [Glyph]]
}

// MARK: - Inserts

struct NewOrder: Encodable {
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

    enum CodingKeys: String, CodingKey {
        case title, paper, ink, copies, area, pincode, landmark
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
    }
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
