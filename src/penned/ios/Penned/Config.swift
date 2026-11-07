import Foundation

/// Supabase connection. The publishable (anon) key is safe to ship in the app:
/// every table is protected by row-level security on the server.
/// Fill these in from Supabase → Project settings → API.
enum Config {
    static let supabaseURL = URL(string: "https://tgwnrfrnutkdifzgsran.supabase.co")!
    static let supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRnd25yZnJudXRrZGlmemdzcmFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQwNDQ3NzEsImV4cCI6MjEwOTYyMDc3MX0.7Nig4jnGgkhjTpGRWnG9zUM-scJjQDlJ8owvNuz4xNo"

    static var isConfigured: Bool { !supabaseKey.hasPrefix("YOUR-") }
}
