import SwiftUI

@main
struct PennedApp: App {
    @State private var model = AppModel()

    init() {
        print("[Penned] 1. App launched. Supabase configured: \(Config.isConfigured)")
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(model)
                .tint(Theme.accent)
                .fontDesign(.rounded)
                .task { await model.start() }
        }
    }
}
