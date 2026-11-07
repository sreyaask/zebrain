import SwiftUI

enum Theme {
    static let accent = Color("AccentColor")
    /// Pen colours. In dark mode they lighten so handwriting stays readable on a dark background.
    static let inkBlue = Color(uiColor: UIColor { $0.userInterfaceStyle == .dark
        ? UIColor(red: 0.553, green: 0.663, blue: 0.957, alpha: 1)
        : UIColor(red: 0.133, green: 0.251, blue: 0.604, alpha: 1) })
    static let inkBlack = Color(uiColor: UIColor { $0.userInterfaceStyle == .dark ? UIColor(white: 0.92, alpha: 1) : UIColor(white: 0.1, alpha: 1) })
    static func ink(_ ink: Ink) -> Color { ink == .blue ? inkBlue : inkBlack }
}

/// Status chip used in lists and the tracking screen. Text, not colour alone, carries the meaning.
struct StatusChip: View {
    let status: OrderStatus
    var label: String?
    var body: some View {
        Text(label ?? status.label)
            .font(.caption.weight(.medium))
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .foregroundStyle(status == .delivered ? Color.green : status == .cancelled ? .secondary : Theme.accent)
            .background(.quaternary.opacity(0.6), in: Capsule())
    }
}
