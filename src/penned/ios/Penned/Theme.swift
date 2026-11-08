import SwiftUI

/// Penned's app design system: black and white, rounded, thick borders, bold type.
/// Every colour adapts: in dark mode black and white swap, so borders stay crisp.
enum Theme {
    /// Interactive tint: black (white in dark mode). Matches Assets/AccentColor.
    static let accent = Color("AccentColor")

    private static func dynamic(light: UIColor, dark: UIColor, lightHC: UIColor? = nil, darkHC: UIColor? = nil) -> Color {
        Color(uiColor: UIColor { t in
            let high = t.accessibilityContrast == .high
            if t.userInterfaceStyle == .dark { return high ? (darkHC ?? dark) : dark }
            return high ? (lightHC ?? light) : light
        })
    }

    /// Text, borders and filled buttons.
    static let ink = dynamic(light: UIColor(white: 0.04, alpha: 1), dark: .white)
    /// White (black in dark mode): text on filled buttons, handwriting paper.
    static let paper = dynamic(light: .white, dark: .black)
    /// Screen background: a cool light grey so white cards stand out, like a quick-commerce app.
    static let canvas = dynamic(light: UIColor(red: 0.953, green: 0.957, blue: 0.965, alpha: 1), dark: .black,
                                lightHC: UIColor(white: 0.9, alpha: 1))
    /// The one colour besides black and white: money and success (FREE, savings, paid, delivered, confirm).
    static let success = dynamic(light: UIColor(red: 0.047, green: 0.514, blue: 0.122, alpha: 1), dark: UIColor(red: 0.29, green: 0.84, blue: 0.42, alpha: 1),
                                 lightHC: UIColor(red: 0.02, green: 0.38, blue: 0.08, alpha: 1), darkHC: UIColor(red: 0.5, green: 0.95, blue: 0.6, alpha: 1))
    /// Pale green behind savings and confirmations.
    static let successFill = dynamic(light: UIColor(red: 0.906, green: 0.965, blue: 0.914, alpha: 1), dark: UIColor(red: 0.06, green: 0.2, blue: 0.09, alpha: 1))
    /// Cards and sheets.
    static let surface = dynamic(light: .white, dark: UIColor(white: 0.07, alpha: 1))
    /// Quiet fills: chips, input fields, tile backgrounds.
    static let fill = dynamic(light: UIColor(white: 0.955, alpha: 1), dark: UIColor(white: 0.14, alpha: 1), lightHC: UIColor(white: 0.9, alpha: 1))
    /// Hairlines inside cards (the outer border is always `ink`).
    static let line = dynamic(light: UIColor(white: 0.86, alpha: 1), dark: UIColor(white: 0.25, alpha: 1), lightHC: UIColor(white: 0.45, alpha: 1), darkHC: UIColor(white: 0.6, alpha: 1))
    /// Notebook ruling and its margin line (the paper the pen writes on).
    static let rule = dynamic(light: UIColor(red: 0.796, green: 0.835, blue: 0.910, alpha: 1), dark: UIColor(white: 1, alpha: 0.14),
                              lightHC: UIColor(red: 0.55, green: 0.62, blue: 0.78, alpha: 1), darkHC: UIColor(white: 1, alpha: 0.3))
    static let marginRule = dynamic(light: UIColor(red: 0.910, green: 0.639, blue: 0.639, alpha: 1), dark: UIColor(red: 0.6, green: 0.3, blue: 0.3, alpha: 1))

    /// Pen colours for handwriting previews. These stay coloured: they show the ink the customer picked.
    static let inkBlue = dynamic(light: UIColor(red: 0.133, green: 0.251, blue: 0.604, alpha: 1), dark: UIColor(red: 0.553, green: 0.663, blue: 0.957, alpha: 1),
                                 lightHC: UIColor(red: 0.08, green: 0.16, blue: 0.45, alpha: 1), darkHC: UIColor(red: 0.72, green: 0.80, blue: 1, alpha: 1))
    static let inkBlack = dynamic(light: UIColor(white: 0.1, alpha: 1), dark: UIColor(white: 0.92, alpha: 1), lightHC: .black, darkHC: .white)
    static func ink(_ ink: Ink) -> Color { ink == .blue ? inkBlue : inkBlack }

    static let radius: CGFloat = 18
    static let border: CGFloat = 2
    /// Depth of the solid "lifted" shadow under cards and tiles.
    static let lift: CGFloat = 4
}

// MARK: - Cards

/// White card, thick black border, rounded, sitting on a solid black offset shadow.
struct CardStyle: ViewModifier {
    var padding: CGFloat = 16
    var lifted = true
    var fill: Color = Theme.surface

    func body(content: Content) -> some View {
        let shape = RoundedRectangle(cornerRadius: Theme.radius, style: .continuous)
        content
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(fill, in: shape)
            .overlay(shape.strokeBorder(Theme.ink, lineWidth: Theme.border))
            .background(shape.fill(Theme.ink).offset(y: lifted ? Theme.lift : 0))
            .padding(.bottom, lifted ? Theme.lift : 0)
    }
}

extension View {
    func card(padding: CGFloat = 16, lifted: Bool = true, fill: Color = Theme.surface) -> some View {
        modifier(CardStyle(padding: padding, lifted: lifted, fill: fill))
    }

    /// Page background for scrolling screens and forms.
    func paperBackground() -> some View {
        scrollContentBackground(.hidden).background(Theme.canvas.ignoresSafeArea())
    }
}

// MARK: - Buttons

/// Solid black, bold, rounded. One per screen.
struct PennedPrimaryButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline.weight(.heavy))
            .foregroundStyle(Theme.paper)
            .tint(Theme.paper)
            .padding(.horizontal, 20)
            .frame(minHeight: 54)
            .background(Theme.ink, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .opacity(isEnabled ? 1 : 0.35)
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

/// White with a thick black border.
struct PennedSecondaryButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled
    func makeBody(configuration: Configuration) -> some View {
        let shape = RoundedRectangle(cornerRadius: 16, style: .continuous)
        configuration.label
            .font(.headline.weight(.bold))
            .foregroundStyle(Theme.ink)
            .padding(.horizontal, 18)
            .frame(minHeight: 54)
            .background(configuration.isPressed ? Theme.fill : Theme.surface, in: shape)
            .overlay(shape.strokeBorder(Theme.ink, lineWidth: Theme.border))
            .opacity(isEnabled ? 1 : 0.35)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

/// Solid green: only for the step that commits money (Place order, Pay).
struct PennedConfirmButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline.weight(.heavy))
            .foregroundStyle(.white)
            .tint(.white)
            .padding(.horizontal, 20)
            .frame(minHeight: 54)
            .background(Theme.success, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .opacity(isEnabled ? 1 : 0.4)
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

extension ButtonStyle where Self == PennedConfirmButtonStyle {
    static var pennedConfirm: PennedConfirmButtonStyle { PennedConfirmButtonStyle() }
}

extension ButtonStyle where Self == PennedPrimaryButtonStyle {
    static var pennedPrimary: PennedPrimaryButtonStyle { PennedPrimaryButtonStyle() }
}

extension ButtonStyle where Self == PennedSecondaryButtonStyle {
    static var pennedSecondary: PennedSecondaryButtonStyle { PennedSecondaryButtonStyle() }
}

// MARK: - Small pieces

/// "Penned" in Apple's New York serif, bold.
struct Wordmark: View {
    var body: some View {
        Text("Penned")
            .font(.system(.largeTitle, design: .serif, weight: .bold))
            .accessibilityAddTraits(.isHeader)
    }
}

/// Bold section heading, like "What do you need?".
struct SectionLabel: View {
    let text: String
    init(_ text: String) { self.text = text }
    var body: some View {
        Text(text)
            .font(.title3.weight(.heavy))
            .foregroundStyle(Theme.ink)
            .accessibilityAddTraits(.isHeader)
    }
}

/// A small bold tag, e.g. a price on a tile.
struct PillTag: View {
    let text: String
    var inverted = false
    var body: some View {
        Text(text)
            .font(.caption.weight(.heavy))
            .foregroundStyle(inverted ? Theme.paper : Theme.ink)
            .padding(.horizontal, 9)
            .padding(.vertical, 4)
            .background(inverted ? Theme.ink : Theme.fill, in: Capsule())
            .overlay(Capsule().strokeBorder(Theme.ink, lineWidth: inverted ? 0 : 1.5))
    }
}

extension OrderStatus {
    var symbol: String {
        switch self {
        case .received: "tray"
        case .writing: "pencil.line"
        case .qualityCheck: "checklist"
        case .outForDelivery: "scooter"
        case .delivered: "checkmark.circle.fill"
        case .cancelled: "xmark.circle"
        }
    }
}

/// A small pulsing dot that says "this is happening right now".
struct LiveDot: View {
    var color: Color = Theme.success
    @State private var pulse = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    var body: some View {
        ZStack {
            Circle().fill(color.opacity(0.35))
                .frame(width: 16, height: 16)
                .scaleEffect(pulse ? 1 : 0.45)
                .opacity(pulse ? 0 : 1)
            Circle().fill(color).frame(width: 8, height: 8)
        }
        .frame(width: 16, height: 16)
        .onAppear {
            guard !reduceMotion else { return }
            withAnimation(.easeOut(duration: 1.4).repeatForever(autoreverses: false)) { pulse = true }
        }
        .accessibilityHidden(true)
    }
}

/// Grey placeholder blocks with a soft shimmer while content loads (feels faster than a spinner).
struct Skeleton: View {
    var height: CGFloat = 14
    var width: CGFloat? = nil
    @State private var phase: CGFloat = -1
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    var body: some View {
        RoundedRectangle(cornerRadius: 6, style: .continuous)
            .fill(Theme.fill)
            .overlay {
                GeometryReader { geo in
                    LinearGradient(colors: [.clear, Theme.surface.opacity(0.7), .clear], startPoint: .leading, endPoint: .trailing)
                        .frame(width: geo.size.width * 0.6)
                        .offset(x: phase * geo.size.width)
                }
                .clipped()
            }
            .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
            .frame(width: width, height: height)
            .onAppear {
                guard !reduceMotion else { return }
                withAnimation(.linear(duration: 1.2).repeatForever(autoreverses: false)) { phase = 1.4 }
            }
            .accessibilityHidden(true)
    }
}

/// A card-shaped loading placeholder.
struct SkeletonCard: View {
    var lines = 3
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Skeleton(height: 18, width: 140)
            ForEach(0..<lines, id: \.self) { i in Skeleton(height: 12, width: i == lines - 1 ? 180 : nil) }
        }
        .card()
        .accessibilityElement()
        .accessibilityLabel("Loading")
    }
}

/// A tiny drawing of the notebook you'll get: ruled with a margin, plain, or your own (with a barcode).
struct NotebookThumb: View {
    enum Kind { case ruled, plain, own }
    let kind: Kind
    var body: some View {
        Canvas { ctx, size in
            let r = CGRect(origin: .zero, size: size).insetBy(dx: 1.5, dy: 1.5)
            let page = Path(roundedRect: r, cornerRadius: 4)
            ctx.fill(page, with: .color(Theme.paper))
            if kind != .plain {
                var y = r.minY + r.height * 0.22
                while y < r.maxY - 3 {
                    ctx.stroke(Path { $0.move(to: CGPoint(x: r.minX + 2, y: y)); $0.addLine(to: CGPoint(x: r.maxX - 2, y: y)) }, with: .color(Theme.rule), lineWidth: 1)
                    y += r.height * 0.12
                }
                ctx.stroke(Path { $0.move(to: CGPoint(x: r.minX + r.width * 0.24, y: r.minY + 2)); $0.addLine(to: CGPoint(x: r.minX + r.width * 0.24, y: r.maxY - 2)) },
                           with: .color(Theme.marginRule), lineWidth: 1)
            }
            if kind == .own {
                // Barcode on the back cover.
                let bars: [CGFloat] = [1, 2, 1, 1, 3, 1, 2, 1, 1, 2]
                var x = r.minX + r.width * 0.32
                let h = r.height * 0.22, top = r.maxY - h - 4
                for (i, w) in bars.enumerated() where x + w < r.maxX - 3 {
                    if i % 2 == 0 { ctx.fill(Path(CGRect(x: x, y: top, width: w, height: h)), with: .color(Theme.ink)) }
                    x += w + 1
                }
            }
            ctx.stroke(page, with: .color(Theme.ink), lineWidth: 1.5)
        }
        .frame(width: 40, height: 50)
        .accessibilityHidden(true)
    }
}

/// Status chip: symbol plus text. In progress is solid black; done is outlined; cancelled is quiet.
struct StatusChip: View {
    let status: OrderStatus
    var label: String?
    var body: some View {
        let active = status != .delivered && status != .cancelled
        let done = status == .delivered
        Label(label ?? status.label, systemImage: status.symbol)
            .font(.caption.weight(.heavy))
            .foregroundStyle(active ? Theme.paper : (done ? Theme.success : Color.secondary))
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(active ? Theme.ink : (done ? Theme.successFill : Theme.surface), in: Capsule())
            .overlay(Capsule().strokeBorder(done ? Theme.success : Theme.ink, lineWidth: active ? 0 : 1.5))
    }
}

/// Lays children out horizontally, or vertically at accessibility text sizes (reflow, don't truncate).
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

/// Thick, rounded progress bar.
struct BoldProgress: View {
    let value: Double
    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule().fill(Theme.fill)
                Capsule().fill(Theme.ink).frame(width: max(10, geo.size.width * min(1, max(0, value))))
            }
        }
        .frame(height: 10)
        .overlay(Capsule().strokeBorder(Theme.ink, lineWidth: 1.5))
        .accessibilityElement()
        .accessibilityLabel("Progress")
        .accessibilityValue("\(Int(value * 100)) percent")
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
