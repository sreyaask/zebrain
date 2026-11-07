import SwiftUI

@main
struct PennedApp: App {
    @State private var model = AppModel()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(model)
                .tint(Theme.accent)
                .task { await model.start() }
        }
    }
}
