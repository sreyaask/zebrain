import Foundation

/// Supabase connection. The publishable (anon) key is safe to ship in the app:
/// every table is protected by row-level security on the server.
/// Fill these in from Supabase → Project settings → API.
enum Config {
    static let supabaseURL = URL(string: "https://tgwnrfrnutkdifzgsran.supabase.co")!
    static let supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRnd25yZnJudXRrZGlmemdzcmFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQwNDQ3NzEsImV4cCI6MjEwOTYyMDc3MX0.7Nig4jnGgkhjTpGRWnG9zUM-scJjQDlJ8owvNuz4xNo"

    /// Customer support. Leave a value empty to hide that option in the app.
    /// WhatsApp: country code + number, digits only, e.g. "919848012345".
    static let supportWhatsApp = ""
    static let supportPhone = ""
    static let supportEmail = ""

    /// AI reading of notes (text + diagrams) through the `extract-notes` Supabase function. Off: pages are read on the
    /// phone. To turn on: deploy the function, set its ANTHROPIC_API_KEY secret, set app_settings.ai_extraction to true,
    /// then set this to true. If the server says it's off, the app quietly falls back to reading on the phone.
    static let aiReading = true

    static var isConfigured: Bool { !supabaseKey.hasPrefix("YOUR-") }
}
