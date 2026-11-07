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

    var userID: UUID? { if case let .signedIn(id, _) = auth { id } else { nil } }

    func start() async {
        for await (_, session) in client.auth.authStateChanges {
            if let session {
                auth = .signedIn(userID: session.user.id, email: session.user.email)
                await refresh()
            } else {
                auth = .signedOut
                orders = []
                styles = []
            }
        }
    }

    // MARK: Auth (email one-time code; enable {{ .Token }} in the Supabase email template)

    func sendCode(email: String) async throws {
        try await client.auth.signInWithOTP(email: email, shouldCreateUser: true)
    }

    /// Turns Supabase auth errors into something a customer can act on.
    nonisolated static func authMessage(_ error: Error) -> String {
        let text = String(describing: error).lowercased() + " " + error.localizedDescription.lowercased()
        if text.contains("rate_limit") || text.contains("rate limit") || text.contains("429") {
            return "Too many codes have been requested. Please wait a while and try again."
        }
        if text.contains("otp_expired") || text.contains("expired") {
            return "That code doesn't match or has expired."
        }
        if text.contains("email_address_invalid") || text.contains("email address") {
            return "We can't send email to this address. Check it, or try another email."
        }
        if text.contains("not_authorized") || text.contains("not authorized") {
            return "Email sign-in isn't open to this address yet."
        }
        if text.contains("offline") || text.contains("network") || text.contains("internet") {
            return "You're offline. Check your connection and try again."
        }
        return "Something went wrong. Please try again."
    }

    func verify(email: String, code: String) async throws {
        try await client.auth.verifyOTP(email: email, token: code, type: .email)
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
        } catch {
            lastError = "Couldn't load your data. Pull to try again."
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
            let path = "\(uid.uuidString.lowercased())/\(order.id.uuidString.lowercased())/\(i + 1).\(file.kind == "pdf" ? "pdf" : "jpg")"
            try await client.storage.from("uploads").upload(path, data: file.data, options: FileOptions(contentType: file.kind == "pdf" ? "application/pdf" : "image/jpeg"))
            try await client.from("order_files").insert(NewOrderFile(orderId: order.id, path: path, kind: file.kind, pages: file.pages)).execute()
        }
        return order
    }

    /// Demo payment. Replace with a payment gateway (and its webhook) before launch.
    func demoPay(_ order: Order) async throws {
        try await client.rpc("demo_mark_paid", params: ["p_order_id": order.id.uuidString]).execute()
        await refresh()
    }
}

enum AppError: LocalizedError {
    case signedOut
    var errorDescription: String? { "Please sign in again." }
}

/// A page the customer added to an order.
struct ScannedFile: Identifiable {
    let id = UUID()
    let data: Data
    let kind: String // "image" | "pdf"
    let pages: Int
    let name: String
}
