import Foundation
import Observation
import Supabase

/// App-wide state and every call to Supabase.
@MainActor
@Observable
final class AppModel {
    let client = SupabaseClient(supabaseURL: Config.supabaseURL, supabaseKey: Config.supabaseKey)

    enum AuthState { case loading, signedOut, signedIn(userID: UUID, email: String?) }
    var auth: AuthState = .loading
    var orders: [Order] = []
    var styles: [HandwritingProfile] = []
    var addresses: [SavedAddress] = []
    /// Orders the customer has already rated (so Home stops asking).
    var ratedOrderIDs: Set<UUID> = []
    /// A banner that drops in when something changes, e.g. "Out for delivery".
    var toast: Toast?
    /// The unfinished order saved on this phone, if any.
    var draft: OrderDraft? = DraftStore.load()?.draft
    @ObservationIgnored private var pollTask: Task<Void, Never>?
    var lastError: String?
    /// False until the first load finishes, so screens show loading instead of a misleading empty state.
    var hasLoaded = false

    var userID: UUID? { if case let .signedIn(id, _) = auth { id } else { nil } }

    func start() async {
        print("[Penned] 3. Checking for a saved login")
        // Decide straight away from the saved session, so the app never waits on a blank screen.
        if let session = client.auth.currentSession {
            auth = .signedIn(userID: session.user.id, email: session.user.email)
            print("[Penned] 4. Saved login found: showing Home")
        } else {
            auth = .signedOut
            print("[Penned] 4. No saved login: showing Sign in")
        }
        for await (event, session) in client.auth.authStateChanges {
            print("[Penned] auth event: \(event)")
            if let session {
                auth = .signedIn(userID: session.user.id, email: session.user.email)
                await refresh()
            } else {
                auth = .signedOut
                hasLoaded = false
                orders = []
                styles = []
                addresses = []
                ratedOrderIDs = []
                pollTask?.cancel()
                pollTask = nil
            }
        }
    }

    // MARK: Auth (email + password, handled by Supabase; turn off "Confirm email" in Supabase so no emails are sent)

    func signIn(email: String, password: String) async throws {
        try await client.auth.signIn(email: email, password: password)
    }

    func signUp(email: String, password: String) async throws {
        let response = try await client.auth.signUp(email: email, password: password)
        if response.session == nil { throw AppError.confirmEmailOn }
    }

    /// Turns Supabase auth errors into something a customer can act on.
    nonisolated static func authMessage(_ error: Error) -> String {
        if let appError = error as? AppError, case .confirmEmailOn = appError { return appError.errorDescription ?? "" }
        let text = String(describing: error).lowercased() + " " + error.localizedDescription.lowercased()
        // With password sign-in, Supabase only sends email when "Confirm email" is on, so an email limit means that setting.
        if text.contains("over_email_send_rate_limit") || text.contains("email rate limit") { return AppError.confirmEmailOn.errorDescription ?? "" }
        if text.contains("invalid_credentials") || text.contains("invalid login credentials") { return "Email or password is wrong." }
        if text.contains("user_already_exists") || text.contains("already registered") { return "An account with this email already exists. Log in instead." }
        if text.contains("weak_password") || text.contains("password should") { return "Use a password of at least 8 characters." }
        if text.contains("email_not_confirmed") || text.contains("not confirmed") { return AppError.confirmEmailOn.errorDescription ?? "" }
        if text.contains("email_address_invalid") || text.contains("email address") { return "That email address doesn't look right." }
        if text.contains("rate limit") || text.contains("429") { return "Too many attempts. Please wait a minute and try again." }
        if text.contains("offline") || text.contains("network") || text.contains("internet") { return "You're offline. Check your connection and try again." }
        return "Something went wrong. Please try again."
    }

    func signOut() async {
        try? await client.auth.signOut()
    }

    // MARK: Data

    func refresh() async {
        do {
            async let o: [Order] = client.from("orders").select().order("created_at", ascending: false).execute().value
            async let s: [HandwritingProfile] = client.from("handwriting_profiles").select().order("created_at", ascending: false).execute().value
            let before = Dictionary(orders.map { ($0.id, $0.status) }, uniquingKeysWith: { a, _ in a })
            (orders, styles) = try await (o, s)
            announceChanges(since: before)
            let rated: [RatedRow] = (try? await client.from("order_feedback").select("order_id").execute().value) ?? []
            ratedOrderIDs = Set(rated.map(\.orderId))
            addresses = (try? await client.from("addresses").select("id, label, line1, area, pincode, landmark, receiver_name, receiver_phone")
                .order("created_at", ascending: false).execute().value) ?? []
            lastError = nil
            hasLoaded = true
            print("[Penned] loaded \(orders.count) orders, \(styles.count) handwriting styles")
            keepLiveIfNeeded()
        } catch {
            print("[Penned] ERROR loading data: \(error)")
            lastError = "Couldn't load your data. Pull to try again."
            hasLoaded = true
        }
    }

    // MARK: Live updates

    var activeOrders: [Order] { orders.filter { $0.status != .delivered && $0.status != .cancelled } }

    /// While an order is moving, check every 20 seconds so Home, Orders and the banner stay current.
    private func keepLiveIfNeeded() {
        guard pollTask == nil, !activeOrders.isEmpty else { return }
        pollTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(20))
                guard let self, !Task.isCancelled else { return }
                if self.activeOrders.isEmpty { break }
                await self.refresh()
            }
            self?.pollTask = nil
        }
    }

    /// Shows a banner for the newest status change (not on the first load).
    private func announceChanges(since before: [UUID: OrderStatus]) {
        guard !before.isEmpty else { return }
        guard let changed = orders.first(where: { before[$0.id] != nil && before[$0.id] != $0.status }) else { return }
        let detail: String
        switch changed.status {
        case .writing: detail = "Your pages are being written now."
        case .qualityCheck: detail = "Every page is being checked."
        case .outForDelivery: detail = changed.riderName.map { "\($0) is on the way." } ?? "Your order is on the way."
        case .delivered: detail = "Hope you like it. Tap to rate."
        case .cancelled: detail = "Tap to see what happened."
        case .received: detail = "We've got your order."
        }
        show(Toast(symbol: changed.status.symbol, title: "\(changed.code): \(changed.status.label)", detail: detail, orderID: changed.id))
        Sounds.shared.play(changed.status == .delivered ? .success : .step)
    }

    func show(_ t: Toast) {
        toast = t
        Task { [weak self] in
            try? await Task.sleep(for: .seconds(5))
            if self?.toast?.id == t.id { self?.toast = nil }
        }
    }

    // MARK: Drafts

    func saveDraft(_ d: OrderDraft, files: [ScannedFile]) {
        DraftStore.save(d, files: files)
        draft = d
    }

    func clearDraft() {
        DraftStore.clear()
        draft = nil
    }

    func events(for order: Order) async throws -> [OrderEvent] {
        try await client.from("order_events").select().eq("order_id", value: order.id).order("created_at").execute().value
    }

    func order(id: UUID) async throws -> Order {
        try await client.from("orders").select().eq("id", value: id).single().execute().value
    }

    // MARK: Handwriting

    func uploadHandwriting(jpeg: Data, name: String, ink: Ink) async throws {
        guard let uid = userID else { throw AppError.signedOut }
        let path = "\(uid.uuidString.lowercased())/\(UUID().uuidString.lowercased()).jpg"
        try await client.storage.from("handwriting").upload(path, data: jpeg, options: FileOptions(contentType: "image/jpeg"))
        try await client.from("handwriting_profiles").insert(NewHandwriting(name: name, ink: ink, scanPath: path)).execute()
        await refresh()
    }

    // MARK: Orders

    /// Inserts the order (the server sets the code and price), then uploads the pages.
    func place(_ draft: NewOrder, files: [ScannedFile]) async throws -> Order {
        guard let uid = userID else { throw AppError.signedOut }
        let order: Order = try await client.from("orders").insert(draft).select().single().execute().value
        for (i, file) in files.enumerated() {
            // Diagrams keep their names (diagram-<id>.png): the text refers to them by id.
            let name = file.uploadName ?? "\(i + 1).\(file.kind == "pdf" ? "pdf" : "jpg")"
            let path = "\(uid.uuidString.lowercased())/\(order.id.uuidString.lowercased())/\(name)"
            let type = file.kind == "pdf" ? "application/pdf" : (name.hasSuffix(".png") ? "image/png" : "image/jpeg")
            try await client.storage.from("uploads").upload(path, data: file.data, options: FileOptions(contentType: type))
            try await client.from("order_files").insert(NewOrderFile(orderId: order.id, path: path, kind: file.kind, pages: file.pages)).execute()
        }
        return order
    }

    // MARK: Addresses

    func save(address: SavedAddress) async {
        // One address per label: saving "Home" again replaces the old Home.
        if let old = addresses.first(where: { $0.label.caseInsensitiveCompare(address.label) == .orderedSame }), let id = old.id {
            _ = try? await client.from("addresses").delete().eq("id", value: id).execute()
        }
        if let saved: SavedAddress = try? await client.from("addresses").insert(address)
            .select("id, label, line1, area, pincode, landmark, receiver_name, receiver_phone").single().execute().value {
            addresses.removeAll { $0.label.caseInsensitiveCompare(address.label) == .orderedSame }
            addresses.insert(saved, at: 0)
        }
    }

    func delete(address: SavedAddress) async {
        guard let id = address.id else { return }
        do {
            try await client.from("addresses").delete().eq("id", value: id).execute()
            addresses.removeAll { $0.id == id }
        } catch {
            lastError = "Couldn't remove that address. Try again."
        }
    }

    /// The customer's rating for an order, if they gave one.
    func feedback(for order: Order) async -> OrderFeedback? {
        let rows: [OrderFeedback]? = try? await client.from("order_feedback").select("order_id, rating, comment").eq("order_id", value: order.id).limit(1).execute().value
        return rows?.first
    }

    /// Saves a rating. The database only allows it once, for the customer's own delivered order.
    func rate(_ order: Order, rating: Int, comment: String) async throws {
        let c = comment.trimmingCharacters(in: .whitespacesAndNewlines)
        try await client.from("order_feedback").insert(OrderFeedback(orderId: order.id, rating: rating, comment: c.isEmpty ? nil : String(c.prefix(1000)))).execute()
        ratedOrderIDs.insert(order.id)
    }

    /// Looks a notebook up by its barcode. nil when we don't know it yet.
    func notebook(barcode: String) async -> CatalogNotebook? {
        let rows: [CatalogNotebook]? = try? await client.from("notebook_catalog").select().eq("barcode", value: barcode).limit(1).execute().value
        return rows?.first
    }

    /// Demo payment. Replace with a payment gateway (and its webhook) before launch.
    func demoPay(_ order: Order) async throws {
        try await client.rpc("demo_mark_paid", params: ["p_order_id": order.id.uuidString]).execute()
        await refresh()
    }
}

enum AppError: LocalizedError {
    case signedOut
    case confirmEmailOn
    var errorDescription: String? {
        switch self {
        case .signedOut: "Please sign in again."
        case .confirmEmailOn: "This account isn't confirmed yet. In Supabase, turn off \"Confirm email\" (Authentication → Sign In / Providers → Email)."
        }
    }
}

/// A page the customer added to an order.
struct ScannedFile: Identifiable {
    let id = UUID()
    let data: Data
    let kind: String // "image" | "pdf"
    let pages: Int
    let name: String
    /// Fixed upload file name, e.g. "diagram-<id>.png". nil = numbered by position.
    var uploadName: String? = nil
    /// Diagrams are uploaded for tracing but not listed as pages.
    var isDiagram: Bool { uploadName?.hasPrefix("diagram-") ?? false }
}

private struct RatedRow: Decodable {
    let orderId: UUID
    enum CodingKeys: String, CodingKey { case orderId = "order_id" }
}

/// A short message that drops in from the top. Tapping it opens the order.
struct Toast: Identifiable, Equatable {
    let id = UUID()
    let symbol: String
    let title: String
    let detail: String
    var orderID: UUID?
}

/// An unfinished order, kept on this phone only (like a message draft).
struct OrderDraft: Codable, Equatable {
    struct File: Codable, Equatable {
        let stored: String
        let kind: String
        let pages: Int
        let name: String
        let uploadName: String?
    }
    var kind: String
    var savedAt = Date()
    var title = ""
    var text = ""
    var subject = ""
    var lessonsMissed = ""
    var forChild = false
    var notebook = "ruled"
    var barcode = ""
    var ownWidth: Double?
    var ownHeight: Double?
    var ownPitch: Double?
    var ownMargin: Double?
    var ownRuled = true
    var pageOverride: Int?
    var cardStyle = "ivory"
    var message = ""
    var recipients = ""
    var files: [File] = []

    var orderKind: OrderKind { OrderKind(rawValue: kind) ?? .completeNotes }
    var summary: String {
        let pages = files.filter { $0.uploadName == nil }.count
        switch orderKind {
        case .letters: return recipients.isEmpty ? "Card draft" : "Cards for \(recipients.split(separator: "\n").count)"
        default: return pages > 0 ? "\(pages) \(pages == 1 ? "file" : "files") added" : (text.isEmpty ? "Just started" : "Text added")
        }
    }
}

/// Saves one draft (JSON plus its files) in Application Support.
enum DraftStore {
    private static var folder: URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        return base.appendingPathComponent("Draft", isDirectory: true)
    }

    static func save(_ draft: OrderDraft, files: [ScannedFile]) {
        clear()
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        var d = draft
        d.files = files.enumerated().compactMap { i, f in
            let name = "\(i).bin"
            guard (try? f.data.write(to: folder.appendingPathComponent(name), options: .completeFileProtection)) != nil else { return nil }
            return .init(stored: name, kind: f.kind, pages: f.pages, name: f.name, uploadName: f.uploadName)
        }
        if let json = try? JSONEncoder().encode(d) {
            try? json.write(to: folder.appendingPathComponent("draft.json"), options: .completeFileProtection)
        }
    }

    static func load() -> (draft: OrderDraft, files: [ScannedFile])? {
        guard let json = try? Data(contentsOf: folder.appendingPathComponent("draft.json")),
              let d = try? JSONDecoder().decode(OrderDraft.self, from: json) else { return nil }
        let files: [ScannedFile] = d.files.compactMap { f in
            guard let data = try? Data(contentsOf: folder.appendingPathComponent(f.stored)) else { return nil }
            return ScannedFile(data: data, kind: f.kind, pages: f.pages, name: f.name, uploadName: f.uploadName)
        }
        return (d, files)
    }

    static func clear() {
        try? FileManager.default.removeItem(at: folder)
    }
}
