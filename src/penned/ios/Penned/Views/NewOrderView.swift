import PhotosUI
import SwiftUI
import UniformTypeIdentifiers

/// Five steps, same as the website: Content → Layout → Paper → Delivery → Review & pay.
struct NewOrderView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss

    enum Step: Int, CaseIterable { case content, layout, paper, delivery, review
        var title: String { ["What to write", "Layout", "Paper", "Delivery", "Review & pay"][rawValue] }
    }

    @State private var step: Step = .content
    // Content
    @State private var title = ""
    @State private var files: [ScannedFile] = []
    @State private var text = ""
    @State private var reading = false
    @State private var scanning = false
    @State private var photos: [PhotosPickerItem] = []
    @State private var importingPDF = false
    @State private var styleID: UUID?
    // Layout
    @State private var ink: Ink = .blue
    @State private var pageSize: PageSize = .b5
    @State private var margin: Double = 18
    @State private var spacing: Double = 1.3
    @State private var heading: HeadingStyle = .underline
    // Paper
    @State private var paper: PaperID = .ruledNotebook
    @State private var copies = 25
    // Delivery
    @State private var receiver = ""
    @State private var phone = ""
    @State private var address = ""
    @State private var area = "Kondapur"
    @State private var pincode = ""
    @State private var landmark = ""
    @State private var slot: TimeSlot = .within3h
    // Submit
    @State private var placing = false
    @State private var placed: Order?
    @State private var error: String?

    private var pages: Int { estimatePages(text: text, size: pageSize, marginMm: margin, lineSpacing: spacing) }
    private var quote: Quote { Quote(paper: paper, units: paper.isCard ? copies : pages) }
    private var readyStyles: [HandwritingProfile] { model.styles.filter { $0.status == "ready" } }

    var body: some View {
        NavigationStack {
            Group {
                if let placed { done(placed) } else { form }
            }
            .navigationTitle(placed == nil ? step.title : "Order placed")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button(placed == nil ? "Cancel" : "Close") { dismiss() } }
            }
            .fullScreenCover(isPresented: $scanning) {
                DocumentScanner(onFinish: { imgs in scanning = false; Task { await addImages(imgs) } }, onCancel: { scanning = false })
                    .ignoresSafeArea()
            }
            .fileImporter(isPresented: $importingPDF, allowedContentTypes: [.pdf], allowsMultipleSelection: true) { result in
                if case let .success(urls) = result { Task { await addPDFs(urls) } }
            }
            .onChange(of: photos) { _, items in
                Task {
                    var imgs: [UIImage] = []
                    for item in items { if let d = try? await item.loadTransferable(type: Data.self), let ui = UIImage(data: d) { imgs.append(ui) } }
                    photos = []
                    await addImages(imgs)
                }
            }
            .onAppear { styleID = styleID ?? readyStyles.first?.id }
        }
    }

    // MARK: Form

    private var form: some View {
        Form {
            Section {
                ProgressView(value: Double(step.rawValue + 1), total: Double(Step.allCases.count)) {
                    Text("Step \(step.rawValue + 1) of \(Step.allCases.count)").font(.caption)
                }
            }
            switch step {
            case .content: contentStep
            case .layout: layoutStep
            case .paper: paperStep
            case .delivery: deliveryStep
            case .review: reviewStep
            }
            if let error { Section { Text(error).foregroundStyle(.red) } }
            Section {
                HStack {
                    if step != .content { Button("Back") { go(-1) } }
                    Spacer()
                    if step == .review {
                        Button { Task { await place() } } label: {
                            HStack { if placing { ProgressView() }; Text("Place order · \(rupees(quote.total))").bold() }
                        }
                        .disabled(placing)
                    } else {
                        Button("Continue") { go(1) }.bold()
                    }
                }
            } footer: {
                if step != .review, quote.total > 0 { Text("\(rupees(quote.total)) · \(quote.billableUnits) \(paper.isCard ? "cards" : "pages")") }
            }
        }
    }

    @ViewBuilder private var contentStep: some View {
        Section {
            TextField("Order name (optional)", text: $title)
        }
        Section {
            if DocumentScanner.isAvailable { Button("Scan pages", systemImage: "doc.viewfinder") { scanning = true } }
            PhotosPicker(selection: $photos, maxSelectionCount: 40, matching: .images) { Label("Choose photos", systemImage: "photo.on.rectangle") }
            Button("Import PDF", systemImage: "doc.richtext") { importingPDF = true }
            ForEach(files) { f in
                LabeledContent(f.name, value: "\(f.pages) \(f.pages == 1 ? "page" : "pages")")
            }
            .onDelete { files.remove(atOffsets: $0) }
            if reading { HStack { ProgressView(); Text("Reading text from your pages") } }
        } header: {
            Text("Pages to copy")
        } footer: {
            Text("Text is read on your phone, so you can check it below.")
        }
        Section {
            TextEditor(text: $text).frame(minHeight: 180).font(.body)
        } header: {
            Text("Text to write")
        } footer: {
            Text("Start a line with # to make it a heading. About \(pages) \(pages == 1 ? "page" : "pages").")
        }
        Section("Handwriting") {
            if readyStyles.isEmpty {
                Text("Your handwriting style isn't ready yet. You can still order; we'll write once it's approved.").foregroundStyle(.secondary)
            } else {
                Picker("Style", selection: $styleID) {
                    ForEach(readyStyles) { Text($0.name).tag(Optional($0.id)) }
                }
            }
        }
    }

    @ViewBuilder private var layoutStep: some View {
        Section("Ink") {
            Picker("Ink", selection: $ink) { ForEach(Ink.allCases) { Text($0.label).tag($0) } }.pickerStyle(.segmented)
        }
        Section {
            VStack(alignment: .leading) {
                LabeledContent("Margins", value: "\(Int(margin)) mm")
                Slider(value: $margin, in: 10...30, step: 1) { Text("Margins") }
            }
            VStack(alignment: .leading) {
                LabeledContent("Line spacing", value: String(format: "%.1f×", spacing))
                Slider(value: $spacing, in: 1...2, step: 0.1) { Text("Line spacing") }
            }
            Picker("Headings", selection: $heading) { ForEach(HeadingStyle.allCases) { Text($0.label).tag($0) } }
            Picker("Page size", selection: $pageSize) { ForEach(PageSize.allCases) { Text($0.label).tag($0) } }
        }
        if let style = readyStyles.first(where: { $0.id == styleID }), let glyphs = style.glyphSet {
            Section("Preview in your handwriting") {
                GlyphLine(text: String(text.split(separator: "\n").first?.prefix(28) ?? "Your handwriting"), glyphs: glyphs, ink: Theme.ink(ink))
            }
        }
    }

    @ViewBuilder private var paperStep: some View {
        Section {
            ForEach(PaperID.allCases) { p in
                Button {
                    paper = p
                    pageSize = p.pageSize
                } label: {
                    HStack(alignment: .top) {
                        Image(systemName: paper == p ? "largecircle.fill.circle" : "circle").foregroundStyle(Theme.accent)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(p.name).foregroundStyle(.primary)
                            Text(p.detail).font(.subheadline).foregroundStyle(.secondary)
                        }
                        Spacer()
                        Text(p.isCard ? "₹15/card" : "₹9/page").foregroundStyle(.secondary)
                    }
                }
                .accessibilityAddTraits(paper == p ? .isSelected : [])
            }
        }
        if paper.isCard {
            Section { Stepper("\(copies) cards", value: $copies, in: 1...500) }
        } else if quote.minimumApplied {
            Section { Text("Notebooks have a 30-page minimum, so you'll be charged for 30 pages.").foregroundStyle(.secondary) }
        }
    }

    @ViewBuilder private var deliveryStep: some View {
        Section("Address") {
            TextField("Flat, house no., building", text: $address).textContentType(.streetAddressLine1)
            Picker("Area", selection: $area) { ForEach(deliveryAreas, id: \.self) { Text($0) } }
            TextField("Pincode", text: $pincode).keyboardType(.numberPad).textContentType(.postalCode)
            TextField("Landmark (optional)", text: $landmark)
        }
        Section("Receiver") {
            TextField("Name", text: $receiver).textContentType(.name)
            TextField("Mobile number", text: $phone).keyboardType(.phonePad).textContentType(.telephoneNumber)
        }
        Section("Delivery time") {
            Picker("Time", selection: $slot) { ForEach(TimeSlot.allCases) { Text($0.label).tag($0) } }.pickerStyle(.inline).labelsHidden()
        }
    }

    @ViewBuilder private var reviewStep: some View {
        Section("Order") {
            LabeledContent("Content", value: files.isEmpty ? "Typed text" : "\(files.count) files")
            LabeledContent("Paper", value: paper.name)
            LabeledContent("Layout", value: "\(ink.label) ink · \(Int(margin)) mm · \(String(format: "%.1f×", spacing))")
            LabeledContent("Deliver", value: "\(area) · \(slot.label)")
        }
        Section("Price") {
            LabeledContent("Writing · \(quote.billableUnits) × \(rupees(quote.unitPrice))", value: rupees(quote.writing))
            LabeledContent("Paper and ink", value: "Included")
            LabeledContent("Delivery", value: quote.delivery == 0 ? "Free" : rupees(quote.delivery))
            LabeledContent("Total", value: rupees(quote.total)).bold()
        }
    }

    private func done(_ order: Order) -> some View {
        ContentUnavailableView {
            Label("Order \(order.code) placed", systemImage: "checkmark.circle")
        } description: {
            Text(order.paymentStatus == "paid" ? "\(rupees(order.total)) paid. You can follow every page in Orders." : "Saved. Open it in Orders to pay and follow progress.")
        } actions: {
            Button("Done") { dismiss() }.buttonStyle(.borderedProminent)
        }
    }

    // MARK: Actions

    private func go(_ delta: Int) {
        error = validate()
        if delta > 0, error != nil { return }
        error = nil
        step = Step(rawValue: step.rawValue + delta) ?? step
    }

    private func validate() -> String? {
        switch step {
        case .content:
            return text.trimmingCharacters(in: .whitespacesAndNewlines).count < 10 ? "Add the pages or type the text you'd like written." : nil
        case .delivery:
            let digits = phone.filter(\.isNumber).suffix(10)
            if receiver.trimmingCharacters(in: .whitespaces).isEmpty { return "Enter the receiver's name." }
            if digits.count != 10 || !"6789".contains(digits.first!) { return "Enter a 10-digit Indian mobile number." }
            if address.trimmingCharacters(in: .whitespaces).count < 5 { return "Enter a flat or house number and building." }
            if pincode.count != 6 || !pincode.hasPrefix("5") { return "Enter a 6-digit Hyderabad pincode." }
            return nil
        default: return nil
        }
    }

    private func addImages(_ images: [UIImage]) async {
        guard !images.isEmpty else { return }
        reading = true; defer { reading = false }
        for img in images {
            guard let jpeg = img.jpegForUpload() else { continue }
            files.append(ScannedFile(data: jpeg, kind: "image", pages: 1, name: "Page \(files.count + 1)"))
            if let t = try? await TextRecognizer.text(from: img), !t.isEmpty {
                text += (text.isEmpty ? "" : "\n") + TextRecognizer.tidy(t)
            }
        }
    }

    private func addPDFs(_ urls: [URL]) async {
        reading = true; defer { reading = false }
        for url in urls {
            let ok = url.startAccessingSecurityScopedResource()
            defer { if ok { url.stopAccessingSecurityScopedResource() } }
            guard let data = try? Data(contentsOf: url) else { continue }
            let (t, n) = (try? await TextRecognizer.text(fromPDF: data)) ?? ("", 1)
            files.append(ScannedFile(data: data, kind: "pdf", pages: max(1, n), name: url.lastPathComponent))
            if !t.isEmpty { text += (text.isEmpty ? "" : "\n") + t }
        }
    }

    private func place() async {
        placing = true; defer { placing = false }
        let draft = NewOrder(
            title: title.trimmingCharacters(in: .whitespaces),
            sourceMode: files.isEmpty ? "text" : "files",
            sourceText: text,
            paper: paper, ink: ink, pageSize: pageSize, marginMm: margin, lineSpacing: spacing, headingStyle: heading,
            copies: paper.isCard ? copies : 1,
            pageCount: pages,
            handwritingProfileId: styleID,
            receiverName: receiver.trimmingCharacters(in: .whitespaces),
            receiverPhone: String(phone.filter(\.isNumber).suffix(10)),
            addressLine1: address.trimmingCharacters(in: .whitespaces),
            area: area, pincode: pincode,
            landmark: landmark.isEmpty ? nil : landmark,
            timeSlot: slot)
        do {
            var order = try await model.place(draft, files: files)
            try await model.demoPay(order)
            order = try await model.order(id: order.id)
            placed = order
        } catch {
            self.error = "Couldn't place the order. Check your connection and try again."
        }
    }
}
