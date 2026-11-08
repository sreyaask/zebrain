import SwiftUI

struct RootView: View {
    @Environment(AppModel.self) private var model

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
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Theme.paper.ignoresSafeArea())
                case .signedOut:
                    SignInView()
                case .signedIn:
                    MainTabs()
                }
            }
        }
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
    var body: some View {
        NavigationStack {
            List {
                if case let .signedIn(_, email) = model.auth, let email {
                    LabeledContent("Signed in as", value: email)
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
