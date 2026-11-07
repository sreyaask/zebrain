import SwiftUI

enum Theme {
    static let accent = Color("AccentColor")
    static let paper = Color(uiColor: UIColor { $0.userInterfaceStyle == .dark ? UIColor(white: 0.08, alpha: 1) : UIColor(red: 0.98, green: 0.976, blue: 0.965, alpha: 1) })
    static let inkBlue = Color(red: 0.133, green: 0.251, blue: 0.604)
    static let inkBlack = Color(red: 0.1, green: 0.1, blue: 0.1)
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
