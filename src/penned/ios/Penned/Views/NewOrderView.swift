import PhotosUI
import SwiftUI
import UniformTypeIdentifiers

/// One order flow, shaped by what the customer is ordering:
/// - Complete notes / Missed notes: Notes → Layout → Paper → Delivery → Review & pay
/// - Letters & cards:              Card → Message → Delivery → Review & pay
struct NewOrderView: View {
    let kind: OrderKind

    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss

    enum Step { case content, layout, paper, card, message, delivery, review }

    private var steps: [Step] {
        kind == .letters ? [.card, .message, .delivery, .review] : [.content, .layout, .paper, .delivery, .review]
    }
    @State private var stepIndex = 0
    private var step: Step { steps[min(stepIndex, steps.count - 1)] }

    // Notes
    @State private var title = ""
    @State private var files: [ScannedFile] = []
    @State private var text = ""
    @State private var reading = false
    @State private var scanning = false
    @State private var photos: [PhotosPickerItem] = []
    @State private var importingPDF = false
    @State private var styleID: UUID?
    @State private var contentsList = true
    // Missed notes
    enum MissedFor: String, CaseIterable, Identifiable { case me = "Me", child = "My child"; var id: String { rawValue } }
    @State private var missedFor: MissedFor = .me
    @State private var subject = ""
    @State private var lessonsMissed = ""
    // Letters & cards
    @State private var cardStyle: CardStyle = .ivory
    @State private var message = ""
    @State private var recipients = ""
    // Layout
    @State private var ink: Ink = .blue
    @State private var pageSize: PageSize = .b5
    @State private var margin: Double = 18
    @State private var spacing: Double = 1.3
    @State private var heading: HeadingStyle = .underline
    // Paper (notes)
    @State private var paper: PaperID = .ruledNotebook
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
    @State private var confirmDiscard = false

    // MARK: Derived

    private var isNotes: Bool { kind != .letters }
    private var readyStyles: [HandwritingProfile] { model.styles.filter { $0.status == "ready" } }
    private var glyphs: GlyphSet? { readyStyles.first(where: { $0.id == styleID })?.glyphSet }

    private var recipientNames: [String] {
        recipients.components(separatedBy: "\n")
            .map { $0.components(separatedBy: " — ").first?.components(separatedBy: " - ").first?.trimmingCharacters(in: .whitespaces) ?? "" }
            .filter { !$0.isEmpty }
    }

    private var pages: Int { estimatePages(text: text, size: pageSize, marginMm: margin, lineSpacing: spacing) }

    /// Charged by the server (public.price_order); shown here before placing.
    private var quote: Quote {
        isNotes ? Quote(paper: paper, units: pages) : Quote(paper: cardStyle.paper, units: recipientNames.count)
    }

    /// True once the customer has put something in that would be lost by closing.
    private var hasWork: Bool {
        placed == nil && (!files.isEmpty || !text.isEmpty || !message.isEmpty || !recipients.isEmpty || !subject.isEmpty || stepIndex > 0)
    }

    private var notesPreview: String {
        let t = text.trimmingCharacters(in: .whitespacesAndNewlines)
        let body = t.isEmpty ? "# Laws of Motion\nNewton's Second Law: the rate of change of momentum of a body is directly proportional to the applied force.\n# Gravitation\nEvery mass attracts every other mass." : String(t.prefix(600))
        return contentsList ? withContents(body) : body
    }

    private var cardPreview: String {
        let m = message.trimmingCharacters(in: .whitespacesAndNewlines)
        let first = recipientNames.first ?? "Amma"
        return (m.isEmpty ? "Dear {name},\nThank you for everything this year. See you soon.\nWith love" : m).replacingOccurrences(of: "{name}", with: first)
    }

    private var orderTitle: String {
        let typed = title.trimmingCharacters(in: .whitespaces)
        let t: String
        switch kind {
        case .completeNotes:
            t = typed.isEmpty ? "Complete notes, \(pages) \(pages == 1 ? "page" : "pages")" : typed
        case .missedNotes:
            let base = typed.isEmpty ? "Missed notes: \(subject.trimmingCharacters(in: .whitespaces))" : typed
            let when = lessonsMissed.trimmingCharacters(in: .whitespaces)
            t = base + (when.isEmpty ? "" : " (\(when))") + (missedFor == .child ? " · for my child" : "")
        case .letters:
            t = typed.isEmpty ? "\(cardStyle.name) ×\(recipientNames.count)" : typed
        }
        return String(t.prefix(120))
    }

    private var orderText: String {
        if isNotes { return contentsList ? withContents(text) : text }
        let list = recipients.components(separatedBy: "\n").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
        return "\(message.trimmingCharacters(in: .whitespacesAndNewlines))\n\n# \(cardStyle.name), \(list.count) recipients\n\(list.joined(separator: "\n"))"
    }

    // MARK: Body

    var body: some View {
        NavigationStack {
            Group {
                if let placed { done(placed) } else { form }
            }
            .navigationTitle(placed == nil ? kind.title : "Order placed")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(placed == nil ? "Cancel" : "Close") { if hasWork { confirmDiscard = true } else { dismiss() } }
                        .confirmationDialog("Discard this order?", isPresented: $confirmDiscard, titleVisibility: .visible) {
                            Button("Discard order", role: .destructive) { dismiss() }
                            Button("Keep editing", role: .cancel) {}
                        } message: {
                            Text("What you've added will be lost.")
                        }
                }
            }
            .interactiveDismissDisabled(hasWork)
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
                    for item in items {
                        if let d = try? await item.loadTransferable(type: Data.self), let ui = UIImage(data: d) { imgs.append(ui) }
                    }
                    photos = []
                    await addImages(imgs)
                }
            }
            .onAppear {
                styleID = styleID ?? readyStyles.first?.id
                if kind == .letters {
                    ink = .black
                    pageSize = cardStyle.size
                }
            }
            .sensoryFeedback(.success, trigger: placed?.id)
            .sensoryFeedback(.error, trigger: error)
        }
    }

    private var form: some View {
        Form {
            Section {
                ProgressView(value: Double(stepIndex + 1), total: Double(steps.count)) {
                    Text("Step \(stepIndex + 1) of \(steps.count) · \(stepName(step))").font(.footnote)
                }
            }
            switch step {
            case .content: contentStep
            case .layout: layoutStep
            case .paper: paperStep
            case .card: cardStep
            case .message: messageStep
            case .delivery: deliveryStep
            case .review: reviewStep
            }
        }
        .paperBackground()
        .safeAreaInset(edge: .bottom) { actionBar }
    }

    private func stepName(_ s: Step) -> String {
        switch s {
        case .content: kind == .missedNotes ? "Lessons" : "Notes"
        case .layout: "Layout"
        case .paper: "Notebook"
        case .card: "Card"
        case .message: "Message"
        case .delivery: "Delivery"
        case .review: "Review & pay"
        }
    }

    /// Fixed bottom bar: running total, any error, and the step's one primary action.
    private var actionBar: some View {
        VStack(spacing: 10) {
            if let error {
                Label(error, systemImage: "exclamationmark.circle")
                    .font(.footnote)
                    .foregroundStyle(.red)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            AdaptiveStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(quote.total > 0 ? rupees(quote.total) : "—").font(.headline.monospacedDigit())
                    Text(quote.total > 0
                         ? "\(quote.billableUnits) \(isNotes ? "pages" : (cardStyle == .letter ? "letters" : "cards"))\(quote.delivery == 0 ? " · free delivery" : "")"
                         : (isNotes ? "Add your notes to see the price" : "Add recipients to see the price"))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer(minLength: 0)
                if stepIndex > 0 {
                    Button("Back") { go(-1) }
                        .buttonStyle(.bordered)
                        .controlSize(.large)
                }
                if step == .review {
                    Button {
                        Task { await place() }
                    } label: {
                        if placing { ProgressView() } else { Text("Place order") }
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                    .disabled(placing)
                } else {
                    Button("Continue") { go(1) }
                        .buttonStyle(.borderedProminent)
                        .controlSize(.large)
                }
            }
        }
        .padding(.horizontal)
        .padding(.vertical, 12)
        .background(.bar)
    }

    // MARK: Notes steps

    @ViewBuilder private var contentStep: some View {
        if kind == .missedNotes {
            Section {
                Picker("Who is it for?", selection: $missedFor) {
                    ForEach(MissedFor.allCases) { Text($0.rawValue).tag($0) }
                }
                .pickerStyle(.segmented)
                TextField("Subject, e.g. Physics", text: $subject)
                TextField("Lessons missed, e.g. 3–7 Nov (optional)", text: $lessonsMissed)
            } header: {
                Text("About the lessons")
            } footer: {
                Text(missedFor == .child
                     ? "Upload the class notes or handouts from school. We'll write a clean copy for your child to read and revise from."
                     : "Upload a classmate's notes or the teacher's handouts. We'll write a clean copy for you to catch up from.")
            }
        } else {
            Section {
                TextField("Notebook name, e.g. Physics revision (optional)", text: $title)
            }
        }
        Section {
            if DocumentScanner.isAvailable { Button("Scan pages", systemImage: "doc.viewfinder") { scanning = true } }
            PhotosPicker(selection: $photos, maxSelectionCount: 40, matching: .images) { Label("Choose photos", systemImage: "photo.on.rectangle") }
            Button("Import PDF", systemImage: "doc.richtext") { importingPDF = true }
            ForEach(files) { f in
                HStack {
                    LabeledContent(f.name, value: "\(f.pages) \(f.pages == 1 ? "page" : "pages")")
                    Button(role: .destructive) {
                        withAnimation { files.removeAll { $0.id == f.id } }
                    } label: {
                        Image(systemName: "minus.circle.fill")
                            .foregroundStyle(.red)
                            .frame(width: 44, height: 44)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.borderless)
                    .accessibilityLabel("Remove \(f.name)")
                }
            }
            .onDelete { files.remove(atOffsets: $0) }
            if reading {
                HStack(spacing: 12) {
                    ProgressView()
                    Text("Reading the text on your pages")
                        .foregroundStyle(.secondary)
                }
            }
        } header: {
            Text(kind == .missedNotes ? "Class notes or handouts" : "Your notes")
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
        Section {
            Toggle(isOn: $contentsList) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Start with a contents list")
                    Text("Your headings, numbered at the front. Free.").font(.footnote).foregroundStyle(.secondary)
                }
            }
        }
        handwritingSection
    }

    @ViewBuilder private var handwritingSection: some View {
        Section("Handwriting") {
            if readyStyles.isEmpty {
                Label("Your handwriting is still being set up. You can order now; we write once it's ready.", systemImage: "clock")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            } else {
                Picker("Style", selection: $styleID) {
                    ForEach(readyStyles) { Text($0.name).tag(Optional($0.id)) }
                }
            }
        }
    }

    @ViewBuilder private var layoutStep: some View {
        Section {
            HandwritingPage(
                text: notesPreview,
                glyphs: glyphs,
                ink: ink,
                ruled: paper == .ruledNotebook,
                lineSpacing: spacing,
                margin: margin / pageSize.mm.w,
                headingStyle: heading,
                pageWidthMm: pageSize.mm.w
            )
            .aspectRatio(CGFloat(pageSize.mm.w / pageSize.mm.h), contentMode: .fit)
            .frame(maxWidth: 230)
            .background(Theme.surface)
            .overlay(Rectangle().strokeBorder(Theme.line))
            .frame(maxWidth: .infinity)
            .listRowBackground(Color.clear)
        } header: {
            Text("Preview")
        } footer: {
            Text(glyphs != nil ? "Drawn with your own letters. About \(pages) \(pages == 1 ? "page" : "pages")." : "Shown in a sample hand until your style is ready.")
        }
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
            Picker("Page size", selection: $pageSize) {
                ForEach([PageSize.b5, .a5, .a4]) { Text($0.label).tag($0) }
            }
        }
    }

    @ViewBuilder private var paperStep: some View {
        Section {
            ForEach([PaperID.ruledNotebook, .plainNotebook, .looseA4]) { p in
                Button {
                    paper = p
                    if p == .looseA4 { pageSize = .a4 }
                } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(p.name).foregroundStyle(.primary)
                            Text(p.detail).font(.subheadline).foregroundStyle(.secondary)
                        }
                        Spacer()
                        if paper == p {
                            Image(systemName: "checkmark").font(.body.weight(.semibold)).foregroundStyle(Theme.accent)
                        }
                    }
                    .contentShape(Rectangle())
                }
                .accessibilityAddTraits(paper == p ? .isSelected : [])
            }
        } footer: {
            Text("₹9 a page. Paper, ink and contents list included.")
        }
        if quote.minimumApplied {
            Section { Text("Notebooks have a 30-page minimum, so you'll be charged for 30 pages.").foregroundStyle(.secondary) }
        }
    }

    // MARK: Letters & cards steps

    @ViewBuilder private var cardStep: some View {
        Section {
            HandwritingPage(text: cardPreview, glyphs: glyphs, ink: ink, ruled: false, lineSpacing: 1.05, margin: 0.09, pageWidthMm: cardStyle.size.mm.w)
                .aspectRatio(CGFloat(cardStyle.size.mm.w / cardStyle.size.mm.h), contentMode: .fit)
                .frame(maxWidth: cardStyle == .letter ? 200 : 240)
                .background(cardStyle == .kraft ? Color(red: 0.86, green: 0.78, blue: 0.66) : Theme.surface)
                .overlay(Rectangle().strokeBorder(Theme.line))
                .frame(maxWidth: .infinity)
                .listRowBackground(Color.clear)
        } header: {
            Text("Preview")
        }
        Section {
            ForEach(CardStyle.allCases) { s in
                Button {
                    cardStyle = s
                    pageSize = s.size
                } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(s.name).foregroundStyle(.primary)
                            Text(s.detail).font(.subheadline).foregroundStyle(.secondary)
                        }
                        Spacer()
                        if cardStyle == s {
                            Image(systemName: "checkmark").font(.body.weight(.semibold)).foregroundStyle(Theme.accent)
                        }
                    }
                    .contentShape(Rectangle())
                }
                .accessibilityAddTraits(cardStyle == s ? .isSelected : [])
            }
        } header: {
            Text("Card")
        } footer: {
            Text("₹15 a card. Envelope included.")
        }
        Section("Ink") {
            Picker("Ink", selection: $ink) { ForEach(Ink.allCases) { Text($0.label).tag($0) } }.pickerStyle(.segmented)
        }
        handwritingSection
    }

    @ViewBuilder private var messageStep: some View {
        Section {
            TextEditor(text: $message).frame(minHeight: 140)
        } header: {
            Text("Your message")
        } footer: {
            Text("{name} is replaced with each person's name.")
        }
        Section {
            TextEditor(text: $recipients).frame(minHeight: 110)
        } header: {
            Text("Who is it for?")
        } footer: {
            Text("One per line. Add an address after a dash to have the envelope addressed. \(recipientNames.count) \(recipientNames.count == 1 ? "card" : "cards").")
        }
        Section {
            HandwritingPage(text: cardPreview, glyphs: glyphs, ink: ink, ruled: false, lineSpacing: 1.05, margin: 0.09, pageWidthMm: cardStyle.size.mm.w)
                .aspectRatio(CGFloat(cardStyle.size.mm.w / cardStyle.size.mm.h), contentMode: .fit)
                .frame(maxWidth: 220)
                .background(Theme.surface)
                .overlay(Rectangle().strokeBorder(Theme.line))
                .frame(maxWidth: .infinity)
                .listRowBackground(Color.clear)
        } header: {
            Text(recipientNames.first.map { "Card for \($0)" } ?? "Preview")
        }
    }

    // MARK: Shared steps

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
            LabeledContent("What", value: kind.title)
            LabeledContent("Title", value: orderTitle)
            if isNotes {
                LabeledContent("Content", value: files.isEmpty ? "Typed text" : "\(files.count) \(files.count == 1 ? "file" : "files")")
                LabeledContent("Contents list", value: contentsList ? "Yes" : "No")
                LabeledContent("Paper", value: paper.name)
                LabeledContent("Layout", value: "\(ink.label) ink · \(Int(margin)) mm · \(String(format: "%.1f×", spacing))")
            } else {
                LabeledContent("Card", value: "\(cardStyle.name) · \(ink.label) ink")
                LabeledContent("Recipients", value: "\(recipientNames.count)")
            }
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
        if delta > 0, let problem = validate() {
            error = problem
            return
        }
        error = nil
        stepIndex = min(max(0, stepIndex + delta), steps.count - 1)
    }

    private func validate() -> String? {
        switch step {
        case .content:
            if kind == .missedNotes && subject.trimmingCharacters(in: .whitespaces).isEmpty { return "Add the subject you missed." }
            if reading { return "Still reading your pages. One moment." }
            return text.trimmingCharacters(in: .whitespacesAndNewlines).count < 10 ? "Add your pages or type the text you'd like written." : nil
        case .message:
            if message.trimmingCharacters(in: .whitespacesAndNewlines).count < 5 { return "Write the message for your cards." }
            return recipientNames.isEmpty ? "Add at least one name, one per line." : nil
        case .delivery:
            let digits = String(phone.filter(\.isNumber).suffix(10))
            if receiver.trimmingCharacters(in: .whitespaces).isEmpty { return "Enter the receiver's name." }
            if digits.count != 10 || !"6789".contains(digits.first ?? "0") { return "Enter a 10-digit Indian mobile number." }
            if address.trimmingCharacters(in: .whitespaces).count < 5 { return "Enter a flat or house number and building." }
            if pincode.count != 6 || !pincode.hasPrefix("5") { return "Enter a 6-digit Hyderabad pincode." }
            return nil
        default:
            return nil
        }
    }

    private func addImages(_ images: [UIImage]) async {
        guard !images.isEmpty else { return }
        reading = true
        defer { reading = false }
        for img in images {
            guard let jpeg = img.jpegForUpload() else { continue }
            files.append(ScannedFile(data: jpeg, kind: "image", pages: 1, name: "Page \(files.count + 1)"))
            if let t = try? await TextRecognizer.text(from: img), !t.isEmpty {
                text += (text.isEmpty ? "" : "\n") + TextRecognizer.tidy(t)
            }
        }
    }

    private func addPDFs(_ urls: [URL]) async {
        reading = true
        defer { reading = false }
        for url in urls {
            let ok = url.startAccessingSecurityScopedResource()
            defer { if ok { url.stopAccessingSecurityScopedResource() } }
            guard let data = try? Data(contentsOf: url) else { continue }
            let result = try? await TextRecognizer.text(fromPDF: data)
            files.append(ScannedFile(data: data, kind: "pdf", pages: max(1, result?.pages ?? 1), name: url.lastPathComponent))
            if let t = result?.text, !t.isEmpty { text += (text.isEmpty ? "" : "\n") + t }
        }
    }

    private func place() async {
        placing = true
        defer { placing = false }
        let count = recipientNames.count
        let draft = NewOrder(
            title: orderTitle,
            sourceMode: isNotes && !files.isEmpty ? "files" : "text",
            sourceText: orderText,
            paper: isNotes ? paper : cardStyle.paper,
            ink: ink,
            pageSize: isNotes ? pageSize : cardStyle.size,
            marginMm: isNotes ? margin : 9,
            lineSpacing: isNotes ? spacing : 1.1,
            headingStyle: heading,
            copies: isNotes ? 1 : max(1, count),
            pageCount: isNotes ? pages : (cardStyle == .letter ? max(1, count) : 1),
            handwritingProfileId: styleID,
            receiverName: receiver.trimmingCharacters(in: .whitespaces),
            receiverPhone: String(phone.filter(\.isNumber).suffix(10)),
            addressLine1: address.trimmingCharacters(in: .whitespaces),
            area: area,
            pincode: pincode,
            landmark: landmark.isEmpty ? nil : landmark,
            timeSlot: slot
        )
        do {
            var order = try await model.place(draft, files: isNotes ? files : [])
            try await model.demoPay(order)
            order = try await model.order(id: order.id)
            placed = order
        } catch {
            self.error = "Couldn't place the order. Check your connection and try again."
        }
    }
}
