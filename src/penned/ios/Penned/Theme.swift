import SwiftUI

/// Brand tokens (see design-system/penned/MASTER.md). Everything adapts to dark mode.
enum Theme {
    static let accent = Color("AccentColor")

    /// Light, dark and Increase Contrast variants (HIG: every custom colour needs all three).
    private static func dynamic(light: UIColor, dark: UIColor, lightHC: UIColor? = nil, darkHC: UIColor? = nil) -> Color {
        Color(uiColor: UIColor { t in
            let high = t.accessibilityContrast == .high
            if t.userInterfaceStyle == .dark { return high ? (darkHC ?? dark) : dark }
            return high ? (lightHC ?? light) : light
        })
    }

    /// Warm off-white page, like the website.
    static let paper = dynamic(light: UIColor(red: 0.980, green: 0.976, blue: 0.965, alpha: 1), dark: .systemBackground)
    /// Cards and sheets of paper.
    static let surface = dynamic(light: .white, dark: .secondarySystemBackground)
    /// 1-pt hairlines around cards.
    static let line = dynamic(light: UIColor(red: 0.902, green: 0.890, blue: 0.863, alpha: 1), dark: .separator,
                              lightHC: UIColor(white: 0.45, alpha: 1), darkHC: UIColor(white: 0.6, alpha: 1))
    /// Notebook ruling and its red margin line.
    static let rule = dynamic(light: UIColor(red: 0.796, green: 0.835, blue: 0.910, alpha: 1), dark: UIColor(white: 1, alpha: 0.12),
                              lightHC: UIColor(red: 0.55, green: 0.62, blue: 0.78, alpha: 1), darkHC: UIColor(white: 1, alpha: 0.3))
    static let marginRule = dynamic(light: UIColor(red: 0.910, green: 0.639, blue: 0.639, alpha: 1), dark: UIColor(red: 0.6, green: 0.3, blue: 0.3, alpha: 1))

    /// Pen colours. In dark mode they lighten so handwriting stays readable.
    static let inkBlue = dynamic(light: UIColor(red: 0.133, green: 0.251, blue: 0.604, alpha: 1), dark: UIColor(red: 0.553, green: 0.663, blue: 0.957, alpha: 1),
                                 lightHC: UIColor(red: 0.08, green: 0.16, blue: 0.45, alpha: 1), darkHC: UIColor(red: 0.72, green: 0.80, blue: 1, alpha: 1))
    static let inkBlack = dynamic(light: UIColor(white: 0.1, alpha: 1), dark: UIColor(white: 0.92, alpha: 1),
                                  lightHC: .black, darkHC: .white)
    static func ink(_ ink: Ink) -> Color { ink == .blue ? inkBlue : inkBlack }
}

// MARK: - Card

struct CardStyle: ViewModifier {
    var padding: CGFloat = 16
    func body(content: Content) -> some View {
        content
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(Theme.line, lineWidth: 1))
    }
}

extension View {
    func card(padding: CGFloat = 16) -> some View { modifier(CardStyle(padding: padding)) }

    /// Paper background for scrolling screens and forms.
    func paperBackground() -> some View {
        scrollContentBackground(.hidden).background(Theme.paper.ignoresSafeArea())
    }
}

// MARK: - Small pieces

/// "Penned" in Apple's New York serif, matching the website's serif wordmark.
struct Wordmark: View {
    var body: some View {
        Text("Penned")
            .font(.system(.largeTitle, design: .serif, weight: .medium))
            .accessibilityAddTraits(.isHeader)
    }
}

struct SectionLabel: View {
    let text: String
    init(_ text: String) { self.text = text }
    var body: some View {
        Text(text)
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(.secondary)
            .accessibilityAddTraits(.isHeader)
    }
}

extension OrderStatus {
    var symbol: String {
        switch self {
        case .received: "tray"
        case .writing: "pencil.line"
        case .qualityCheck: "checklist"
        case .outForDelivery: "scooter"
        case .delivered: "checkmark.circle"
        case .cancelled: "xmark.circle"
        }
    }
}

/// Status chip: a symbol plus text, in neutral colours (the tint is reserved for things you can tap).
struct StatusChip: View {
    let status: OrderStatus
    var label: String?
    var body: some View {
        Label(label ?? status.label, systemImage: status.symbol)
            .font(.caption.weight(.medium))
            .foregroundStyle(status == .cancelled ? .secondary : .primary)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(.quaternary.opacity(0.6), in: Capsule())
    }
}

/// Lays children out horizontally, or vertically at accessibility text sizes (HIG: reflow, don't truncate).
struct AdaptiveStack<Content: View>: View {
    @Environment(\.dynamicTypeSize) private var typeSize
    var spacing: CGFloat = 12
    @ViewBuilder var content: () -> Content
    var body: some View {
        if typeSize.isAccessibilitySize {
            VStack(alignment: .leading, spacing: spacing, content: content)
        } else {
            HStack(spacing: spacing, content: content)
        }
    }
}

extension Order {
    /// 0…1 for progress bars: writing progress counts for most of the journey.
    var journey: Double {
        switch status {
        case .received: 0.08
        case .writing: 0.12 + 0.63 * Double(pagesWritten) / Double(max(billableUnits, 1))
        case .qualityCheck: 0.82
        case .outForDelivery: 0.93
        case .delivered: 1
        case .cancelled: 0
        }
    }

    var headline: String {
        switch status {
        case .received: paymentStatus == "paid" ? "Assigning a writer" : "Waiting for payment"
        case .writing: "Writing page \(pagesWritten) of \(billableUnits)"
        case .qualityCheck: "Checking every page"
        case .outForDelivery: eta.map { "Arriving in \($0)" } ?? "Out for delivery"
        case .delivered: "Delivered"
        case .cancelled: "Cancelled"
        }
    }
}
