import Foundation

/// Supabase connection. The publishable (anon) key is safe to ship in the app:
/// every table is protected by row-level security on the server.
/// Fill these in from Supabase → Project settings → API.
enum Config {
    static let supabaseURL = URL(string: "https://YOUR-PROJECT.supabase.co")!
    static let supabaseKey = "YOUR-PUBLISHABLE-KEY"

    static var isConfigured: Bool { !supabaseKey.hasPrefix("YOUR-") }
}
