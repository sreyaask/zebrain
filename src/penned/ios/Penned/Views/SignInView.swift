import SwiftUI

struct SignInView: View {
    @Environment(AppModel.self) private var model
    @State private var email = ""
    @State private var code = ""
    @State private var codeSent = false
    @State private var busy = false
    @State private var error: String?
    @FocusState private var focused: Bool

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text("Your handwriting.\nWritten for you.")
                        .font(.largeTitle.weight(.semibold))
                        .listRowBackground(Color.clear)
                        .padding(.vertical, 8)
                }
                if !codeSent {
                    Section {
                        TextField("Email", text: $email)
                            .textContentType(.emailAddress)
                            .keyboardType(.emailAddress)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .focused($focused)
                    } footer: {
                        Text("We'll email you a 6-digit code. No password needed.")
                    }
                    Button {
                        Task { await send() }
                    } label: {
                        HStack { Text("Send code"); if busy { Spacer(); ProgressView() } }
                    }
                    .disabled(busy || !email.contains("@"))
                } else {
                    Section {
                        TextField("6-digit code", text: $code)
                            .textContentType(.oneTimeCode)
                            .keyboardType(.numberPad)
                            .font(.title3.monospacedDigit())
                            .focused($focused)
                            .onChange(of: code) { _, v in code = String(v.filter(\.isNumber).prefix(6)) }
                    } footer: {
                        Text("Sent to \(email).")
                    }
                    Button {
                        Task { await verify() }
                    } label: {
                        HStack { Text("Verify and sign in"); if busy { Spacer(); ProgressView() } }
                    }
                    .disabled(busy || code.count != 6)
                    Button("Use a different email") { codeSent = false; code = ""; error = nil }
                        .foregroundStyle(.secondary)
                }
                if let error {
                    Section { Text(error).foregroundStyle(.red) }
                }
            }
            .onAppear { focused = true }
        }
    }

    private func send() async {
        busy = true; defer { busy = false }
        do {
            try await model.sendCode(email: email.trimmingCharacters(in: .whitespaces).lowercased())
            error = nil
            codeSent = true
        } catch {
            self.error = AppModel.authMessage(error)
        }
    }

    private func verify() async {
        busy = true; defer { busy = false }
        do {
            try await model.verify(email: email.trimmingCharacters(in: .whitespaces).lowercased(), code: code)
        } catch {
            self.error = AppModel.authMessage(error)
        }
    }
}
