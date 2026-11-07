import PhotosUI
import SwiftUI

struct HandwritingView: View {
    @Environment(AppModel.self) private var model
    @State private var adding = false

    var body: some View {
        NavigationStack {
            List {
                if model.styles.isEmpty {
                    ContentUnavailableView {
                        Label("Set up your handwriting", systemImage: "pencil.and.scribble")
                    } description: {
                        Text("Write three short lines on paper and scan them. We'll learn your letters, so every order looks like you wrote it.")
                    } actions: {
                        Button("Scan my handwriting") { adding = true }.buttonStyle(.borderedProminent)
                    }
                    .listRowBackground(Color.clear)
                }
                ForEach(model.styles) { style in
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            Text(style.name).font(.headline)
                            Spacer()
                            Text(style.statusLabel)
                                .font(.caption.weight(.medium))
                                .foregroundStyle(style.status == "ready" ? .green : style.status == "needs_rescan" ? .red : .secondary)
                        }
                        if let glyphs = style.glyphSet, style.status == "ready" {
                            GlyphLine(text: "The quick brown fox", glyphs: glyphs, ink: Theme.ink(style.ink))
                        } else if style.status == "needs_rescan" {
                            Text(style.reviewNote ?? "Please scan the sheet again.").font(.subheadline).foregroundStyle(.secondary)
                        } else {
                            Text("We're checking every letter. This usually takes under an hour.").font(.subheadline).foregroundStyle(.secondary)
                        }
                    }
                    .padding(.vertical, 4)
                }
            }
            .navigationTitle("Handwriting")
            .refreshable { await model.refresh() }
            .toolbar { Button { adding = true } label: { Label("Add a style", systemImage: "plus") } }
            .sheet(isPresented: $adding) { AddStyleView() }
        }
    }
}

/// The sample sheet must match lib/engine/sheet.ts on the web exactly.
let sampleSheet = [
    "The quick brown fox jumps over the lazy dog.",
    "THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG",
    "0123456789 , . ? ! ( ) + − = %",
]

struct AddStyleView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var ink: Ink = .blue
    @State private var name = "My handwriting – Blue Ink"
    @State private var image: UIImage?
    @State private var scanning = false
    @State private var photo: PhotosPickerItem?
    @State private var uploading = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    ForEach(sampleSheet, id: \.self) { Text($0).font(.body.monospaced()).textSelection(.enabled) }
                } header: {
                    Text("Write these lines on plain paper")
                } footer: {
                    Text("Write each line on its own line, three times over. Keep letters separate, not joined. Use the pen you want us to write with.")
                }

                Section("Photo") {
                    if let image {
                        Image(uiImage: image).resizable().scaledToFit().frame(maxHeight: 260)
                            .accessibilityLabel("Your scanned sheet")
                    }
                    if DocumentScanner.isAvailable {
                        Button(image == nil ? "Scan the sheet" : "Scan again") { scanning = true }
                    }
                    PhotosPicker(image == nil ? "Choose a photo" : "Choose a different photo", selection: $photo, matching: .images)
                }

                Section("Details") {
                    Picker("Ink", selection: $ink) { ForEach(Ink.allCases) { Text($0.label).tag($0) } }
                        .pickerStyle(.segmented)
                        .onChange(of: ink) { _, v in name = "My handwriting – \(v.label) Ink" }
                    TextField("Name", text: $name)
                }

                if let error { Section { Text(error).foregroundStyle(.red) } }
            }
            .navigationTitle("New handwriting style")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    if uploading { ProgressView() } else {
                        Button("Upload") { Task { await upload() } }.disabled(image == nil || name.trimmingCharacters(in: .whitespaces).isEmpty)
                    }
                }
            }
            .fullScreenCover(isPresented: $scanning) {
                DocumentScanner(onFinish: { pages in image = pages.first; scanning = false }, onCancel: { scanning = false })
                    .ignoresSafeArea()
            }
            .onChange(of: photo) { _, item in
                Task {
                    if let data = try? await item?.loadTransferable(type: Data.self), let ui = UIImage(data: data) { image = ui }
                }
            }
        }
    }

    private func upload() async {
        guard let jpeg = image?.jpegForUpload() else { return }
        uploading = true; defer { uploading = false }
        do {
            try await model.uploadHandwriting(jpeg: jpeg, name: name.trimmingCharacters(in: .whitespaces), ink: ink)
            dismiss()
        } catch {
            self.error = "Upload failed. Check your connection and try again."
        }
    }
}
