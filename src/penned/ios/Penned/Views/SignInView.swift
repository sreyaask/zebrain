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

    enum Field { case email, password }

    private var canSubmit: Bool { email.contains("@") && password.count >= 8 && !busy }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text("Your handwriting.\nWritten for you.")
                        .font(.largeTitle.weight(.semibold))
                        .listRowBackground(Color.clear)
                        .padding(.vertical, 8)
                }
                Section {
                    TextField("Email", text: $email)
                        .textContentType(.username)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .focused($field, equals: .email)
                        .submitLabel(.next)
                        .onSubmit { field = .password }
                    SecureField("Password", text: $password)
                        .textContentType(creating ? .newPassword : .password)
                        .focused($field, equals: .password)
                        .submitLabel(.go)
                        .onSubmit { if canSubmit { Task { await submit() } } }
                } footer: {
                    Text(creating ? "At least 8 characters." : "Use the email and password you signed up with.")
                }
                Section {
                    Button {
                        Task { await submit() }
                    } label: {
                        HStack {
                            Text(creating ? "Create account" : "Log in").bold()
                            if busy { Spacer(); ProgressView() }
                        }
                    }
                    .disabled(!canSubmit)
                    Button(creating ? "I already have an account" : "Create an account") {
                        creating.toggle()
                        error = nil
                    }
                    .foregroundStyle(.secondary)
                }
                if let error {
                    Section { Text(error).foregroundStyle(.red) }
                }
            }
            .onAppear { field = .email }
        }
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
