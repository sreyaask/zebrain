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
                    ProgressView().controlSize(.large)
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
    var body: some View {
        TabView {
            OrdersView().tabItem { Label("Orders", systemImage: "doc.text") }
            HandwritingView().tabItem { Label("Handwriting", systemImage: "pencil.and.scribble") }
            AccountView().tabItem { Label("Account", systemImage: "person") }
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
