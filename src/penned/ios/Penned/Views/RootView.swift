import SwiftUI

struct RootView: View {
    @Environment(AppModel.self) private var model
    @State private var slow = false

    var body: some View {
        Group {
            if !Config.isConfigured {
                ContentUnavailableView("Not connected", systemImage: "wrench.and.screwdriver",
                                       description: Text("Add your Supabase URL and publishable key in Config.swift."))
            } else {
                switch model.auth {
                case .loading:
                    VStack(spacing: 16) {
                        Wordmark()
                        ProgressView()
                        if slow {
                            Text("Still connecting. Check your internet connection.")
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                                .multilineTextAlignment(.center)
                            Button("Try again") { Task { await model.start() } }
                                .buttonStyle(.pennedSecondary)
                        }
                    }
                    .padding()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Theme.paper.ignoresSafeArea())
                    .task {
                        try? await Task.sleep(for: .seconds(6))
                        slow = true
                    }
                case .signedOut:
                    SignInView().onAppear { print("[Penned] 5. Sign in screen on screen") }
                case .signedIn:
                    MainTabs().onAppear { print("[Penned] 5. Home on screen") }
                }
            }
        }
        .onAppear { print("[Penned] 2. First screen created") }
    }
}

struct MainTabs: View {
    enum Tab: Hashable { case home, orders, handwriting, account }
    @State private var tab: Tab = .home

    var body: some View {
        TabView(selection: $tab) {
            HomeView(tab: $tab).tabItem { Label("Home", systemImage: "house") }.tag(Tab.home)
            OrdersView().tabItem { Label("Orders", systemImage: "doc.text") }.tag(Tab.orders)
            HandwritingView().tabItem { Label("Handwriting", systemImage: "pencil.and.scribble") }.tag(Tab.handwriting)
            AccountView().tabItem { Label("Account", systemImage: "person") }.tag(Tab.account)
        }
    }
}

struct AccountView: View {
    @Environment(AppModel.self) private var model
    @AppStorage(Sounds.settingKey) private var soundEffects = true
    var body: some View {
        NavigationStack {
            List {
                if case let .signedIn(_, email) = model.auth, let email {
                    LabeledContent("Signed in as", value: email)
                }
                Section {
                    Toggle("Sound effects", isOn: $soundEffects)
                        .onChange(of: soundEffects) { _, on in if on { Sounds.shared.play(.tap) } }
                } footer: {
                    Text("Short sounds for taps, steps and finished orders. They follow your phone's silent switch.")
                }
                Section("Help") {
                    Text("Free rewrite of any page within 24 hours of delivery.")
                    Text("We deliver in Gachibowli, Kondapur, Madhapur, Hitech City, Kukatpally, Banjara Hills, Jubilee Hills, Ameerpet, Secunderabad and LB Nagar.")
                }
                .font(.subheadline)
                .foregroundStyle(.secondary)
                Section {
                    Button("Sign out", role: .destructive) { Task { await model.signOut() } }
                }
            }
            .paperBackground()
            .navigationTitle("Account")
        }
    }
}
