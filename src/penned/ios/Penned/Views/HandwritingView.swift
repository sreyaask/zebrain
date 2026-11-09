import PhotosUI
import SwiftUI

struct HandwritingView: View {
    @Environment(AppModel.self) private var model
    @State private var adding = false
    @ScaledMetric(relativeTo: .body) private var sheetHeight: CGFloat = 150

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    if !model.hasLoaded {
                        SkeletonCard()
                            .frame(maxWidth: .infinity, minHeight: 200)
                    } else if model.styles.isEmpty {
                        VStack(alignment: .leading, spacing: 20) {
                            HandwritingPage(text: sampleSheet.joined(separator: "\n"), ink: .blue, lineSpacing: 1.1, margin: 0.08)
                                .frame(height: sheetHeight)
                                .clipShape(RoundedRectangle(cornerRadius: Theme.radius - Theme.border, style: .continuous))
                                .card(padding: 0)
                            VStack(alignment: .leading, spacing: 6) {
                                Text("Teach us your handwriting").font(.title3.weight(.black))
                                Text("Write three short lines on paper and scan them. We learn every letter, so each order looks like you wrote it.")
                                    .font(.callout)
                                    .foregroundStyle(.secondary)
                            }
                            Button { adding = true } label: {
                                Label("Scan my handwriting", systemImage: "doc.viewfinder").frame(maxWidth: .infinity)
                            }
                            .buttonStyle(.pennedPrimary)
                        }
                    } else {
                        ForEach(model.styles) { StyleCard(style: $0) }
                        Button { adding = true } label: {
                            Label("Add another style", systemImage: "plus").frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.pennedSecondary)
                    }
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 8)
            }
            .paperBackground()
            .navigationTitle("Handwriting")
            .refreshable { await model.refresh() }
            .sheet(isPresented: $adding) { AddStyleView() }
        }
    }
}

/// One handwriting style: its name, review status, and a page written with the real glyphs once approved.
private struct StyleCard: View {
    let style: HandwritingProfile
    @ScaledMetric(relativeTo: .body) private var sampleHeight: CGFloat = 112

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .firstTextBaseline) {
                Text(style.name).font(.headline.weight(.heavy))
                Spacer()
                Text(style.statusLabel)
                    .font(.caption.weight(.medium))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .foregroundStyle(style.status == "ready" ? Theme.success : style.status == "needs_rescan" ? Color.red : Theme.ink)
                    .background(style.status == "ready" ? Theme.successFill : Theme.fill, in: Capsule())
            }
            if let glyphs = style.glyphSet, style.status == "ready" {
                HandwritingPage(text: "The quick brown fox jumps over the lazy dog.\nThank you for everything.", glyphs: glyphs, ink: style.ink, lineSpacing: 1.1)
                    .frame(height: sampleHeight)
                    .background(Theme.paper, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
            } else if style.status == "needs_rescan" {
                Label(style.reviewNote ?? "Please scan the sheet again.", systemImage: "arrow.clockwise")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            } else {
                Label("We're checking every letter. This usually takes under an hour.", systemImage: "clock")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
        .card()
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
            .paperBackground()
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
            Sounds.shared.play(.scribble)
            dismiss()
        } catch {
            self.error = "Upload failed. Check your connection and try again."
            Sounds.shared.play(.error)
        }
    }
}
