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
            (orders, styles) = try await (o, s)
            lastError = nil
            hasLoaded = true
            print("[Penned] loaded \(orders.count) orders, \(styles.count) handwriting styles")
        } catch {
            print("[Penned] ERROR loading data: \(error)")
            lastError = "Couldn't load your data. Pull to try again."
            hasLoaded = true
        }
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

    /// The customer's rating for an order, if they gave one.
    func feedback(for order: Order) async -> OrderFeedback? {
        let rows: [OrderFeedback]? = try? await client.from("order_feedback").select("order_id, rating, comment").eq("order_id", value: order.id).limit(1).execute().value
        return rows?.first
    }

    /// Saves a rating. The database only allows it once, for the customer's own delivered order.
    func rate(_ order: Order, rating: Int, comment: String) async throws {
        let c = comment.trimmingCharacters(in: .whitespacesAndNewlines)
        try await client.from("order_feedback").insert(OrderFeedback(orderId: order.id, rating: rating, comment: c.isEmpty ? nil : String(c.prefix(1000)))).execute()
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
