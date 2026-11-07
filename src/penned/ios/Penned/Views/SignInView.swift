import SwiftUI

/// Email and password sign-in, handled entirely by Supabase.
struct SignInView: View {
    @Environment(AppModel.self) private var model
    @State private var creating = false
    @State private var email = ""
    @State private var password = ""
    @State private var busy = false
    @State private var error: String?
    @FocusState private var field: Field?
    @ScaledMetric(relativeTo: .body) private var cardHeight: CGFloat = 118

    enum Field { case email, password }

    private var canSubmit: Bool { email.contains("@") && password.count >= 8 && !busy }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                VStack(alignment: .leading, spacing: 6) {
                    Wordmark()
                    Text("Notes, letters and cards, written with a real pen in your handwriting. Delivered in Hyderabad in 2–3 hours.")
                        .font(.callout)
                        .foregroundStyle(.secondary)
                }
                .padding(.top, 32)

                HandwritingPage(text: "Your handwriting.\nWritten for you.", ink: .blue, lineSpacing: 1.2)
                    .frame(height: cardHeight)
                    .card(padding: 0)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

                VStack(alignment: .leading, spacing: 16) {
                    Text(creating ? "Create your account" : "Log in")
                        .font(.title2.weight(.semibold))
                    LabeledField(label: "Email") {
                        TextField("you@example.com", text: $email)
                            .textContentType(.username)
                            .keyboardType(.emailAddress)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .focused($field, equals: .email)
                            .submitLabel(.next)
                            .onSubmit { field = .password }
                    }
                    LabeledField(label: "Password", hint: creating ? "At least 8 characters." : nil) {
                        SecureField(creating ? "Choose a password" : "Your password", text: $password)
                            .textContentType(creating ? .newPassword : .password)
                            .focused($field, equals: .password)
                            .submitLabel(.go)
                            .onSubmit { if canSubmit { Task { await submit() } } }
                    }
                    if let error {
                        Label(error, systemImage: "exclamationmark.circle")
                            .font(.footnote)
                            .foregroundStyle(.red)
                    }
                    Button {
                        Task { await submit() }
                    } label: {
                        Group {
                            if busy { ProgressView() } else { Text(creating ? "Create account" : "Log in") }
                        }
                        .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                    .disabled(!canSubmit)

                    Button {
                        creating.toggle()
                        error = nil
                    } label: {
                        Text(creating ? "I already have an account" : "New to Penned? Create an account")
                            .frame(maxWidth: .infinity)
                    }
                    .font(.subheadline)
                }
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 32)
        }
        .scrollDismissesKeyboard(.interactively)
        .paperBackground()
        .sensoryFeedback(.error, trigger: error)
    }

    private func submit() async {
        busy = true; defer { busy = false }
        let e = email.trimmingCharacters(in: .whitespaces).lowercased()
        do {
            if creating { try await model.signUp(email: e, password: password) }
            else { try await model.signIn(email: e, password: password) }
            error = nil
        } catch {
            self.error = AppModel.authMessage(error)
        }
    }
}

/// A visible label above a text field, on a card-style background.
struct LabeledField<Field: View>: View {
    let label: String
    var hint: String?
    @ViewBuilder var field: () -> Field

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).font(.subheadline.weight(.medium))
            field()
                .padding(.horizontal, 14)
                .frame(minHeight: 48)
                .background(Theme.surface, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(Theme.line, lineWidth: 1))
            if let hint { Text(hint).font(.footnote).foregroundStyle(.secondary) }
        }
    }
}
