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
                    .background(Theme.canvas.ignoresSafeArea())
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
    enum Tab: Hashable { case home, orders, scan, handwriting, account }
    @State private var tab: Tab = .home
    @State private var lastTab: Tab = .home
    @State private var scanning = false

    var body: some View {
        TabView(selection: $tab) {
            HomeView(tab: $tab).tabItem { Label("Home", systemImage: "house") }.tag(Tab.home)
            OrdersView().tabItem { Label("Orders", systemImage: "doc.text") }.tag(Tab.orders)
            // The middle tab works like a camera "+" button: it opens the scanner and you stay where you were.
            Color.clear.tabItem { Label("Scan", systemImage: "plus.viewfinder") }.tag(Tab.scan)
            HandwritingView().tabItem { Label("Handwriting", systemImage: "pencil.and.scribble") }.tag(Tab.handwriting)
            AccountView().tabItem { Label("Account", systemImage: "person") }.tag(Tab.account)
        }
        .onChange(of: tab) { old, new in
            if new == .scan {
                tab = old == .scan ? lastTab : old
                Sounds.shared.play(.tap)
                scanning = true
            } else {
                lastTab = new
            }
        }
        .sheet(isPresented: $scanning) { NewOrderView(kind: .completeNotes, startWithScanner: true) }
    }
}

struct AccountView: View {
    @Environment(AppModel.self) private var model
    @AppStorage(Sounds.settingKey) private var soundEffects = true
    @State private var showingHelp = false
    var body: some View {
        NavigationStack {
            List {
                if case let .signedIn(_, email) = model.auth, let email {
                    LabeledContent("Signed in as", value: email)
                }
                Section {
                    NavigationLink { SavedAddressesView() } label: {
                        LabeledContent { Text("\(model.addresses.count)") } label: { Label("Saved addresses", systemImage: "mappin.and.ellipse") }
                    }
                }
                Section {
                    Toggle("Sound effects", isOn: $soundEffects)
                        .onChange(of: soundEffects) { _, on in if on { Sounds.shared.play(.tap) } }
                } footer: {
                    Text("Short sounds for taps, steps and finished orders. They follow your phone's silent switch.")
                }
                Section {
                    Button { showingHelp = true } label: { Label("Help and questions", systemImage: "questionmark.circle") }
                    if let url = Support.whatsApp(about: nil) { Link(destination: url) { Label("Chat with us on WhatsApp", systemImage: "message") } }
                    if let url = Support.phone { Link(destination: url) { Label("Call us", systemImage: "phone") } }
                    if let url = Support.email(about: nil) { Link(destination: url) { Label("Email us", systemImage: "envelope") } }
                } header: {
                    Text("Help")
                } footer: {
                    Text("Free rewrite of any page within 24 hours of delivery. Your files are private to you and the Penned team.")
                }
                Section {
                    Button("Sign out", role: .destructive) { Task { await model.signOut() } }
                }
            }
            .paperBackground()
            .navigationTitle("Account")
            .sheet(isPresented: $showingHelp) { HelpCenterView() }
        }
    }
}

/// Saved addresses: swipe to remove. New ones are saved from the delivery step.
struct SavedAddressesView: View {
    @Environment(AppModel.self) private var model
    var body: some View {
        List {
            if model.addresses.isEmpty {
                ContentUnavailableView("No saved addresses", systemImage: "mappin.slash",
                                       description: Text("Addresses you deliver to are saved here, so next time it's one tap."))
                    .listRowBackground(Color.clear)
            }
            ForEach(model.addresses) { a in
                HStack(alignment: .top, spacing: 12) {
                    Image(systemName: a.symbol).font(.title3.weight(.bold)).frame(width: 28).accessibilityHidden(true)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(a.label).font(.headline.weight(.heavy))
                        Text("\(a.line1), \(a.area), Hyderabad \(a.pincode)").font(.subheadline).foregroundStyle(.secondary)
                        if let n = a.receiverName { Text(n).font(.footnote).foregroundStyle(.secondary) }
                    }
                }
                .swipeActions {
                    Button("Remove", systemImage: "trash", role: .destructive) { Task { await model.delete(address: a) } }
                }
            }
        }
        .paperBackground()
        .navigationTitle("Saved addresses")
    }
}
