import PhotosUI
import SwiftUI
import UniformTypeIdentifiers

/// One order flow, shaped by what the customer is ordering:
/// - Complete notes / Missed notes: Notes → Notebook → Delivery → Review & pay
///   (layout, ink and contents list are Penned's job; the customer only picks the notebook)
/// - Letters & cards:              Card → Message → Delivery → Review & pay
struct NewOrderView: View {
    let kind: OrderKind
    /// Opens the camera straight away (from the Scan tab).
    var startWithScanner = false
    /// "Order again": copies the delivery details and notebook from an earlier order.
    var prefill: Order? = nil
    /// Opens the draft saved on this phone.
    var resumeDraft = false

    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss

    enum Step { case content, paper, card, message, delivery, review }

    private var steps: [Step] {
        kind == .letters ? [.card, .message, .delivery, .review] : [.content, .paper, .delivery, .review]
    }
    @State private var stepIndex = 0
    private var step: Step { steps[min(stepIndex, steps.count - 1)] }

    // Notes
    @State private var title = ""
    @State private var files: [ScannedFile] = []
    @State private var text = ""
    @State private var reading = false
    /// Formatted pages from Gemini (SVG), and whether the last reading came from Gemini or the phone.
    @State private var formattedPages: [String] = []
    @State private var showingFormatted = false
    @State private var readByAI = false
    @State private var scanning = false
    @State private var photos: [PhotosPickerItem] = []
    @State private var importingPDF = false
    @State private var styleID: UUID?
    /// Pages the customer wants written; nil = what we detected from their files.
    @State private var pageOverride: Int?
    // Missed notes
    enum MissedFor: String, CaseIterable, Identifiable { case me = "Me", child = "My child"; var id: String { rawValue } }
    @State private var missedFor: MissedFor = .me
    @State private var subject = ""
    @State private var lessonsMissed = ""
    // Letters & cards
    @State private var cardStyle: CardPaper = .ivory
    @State private var message = ""
    @State private var recipients = ""
    // Layout: Penned's house style for notes (the customer doesn't choose it).
    @State private var ink: Ink = .blue
    @State private var pageSize: PageSize = .long
    private var margin: Double { 18 }
    private var spacing: Double { 1.3 }
    private var heading: HeadingStyle { .underline }
    // Notebook (notes)
    enum NotebookChoice: String, CaseIterable, Identifiable { case ruled, plain, own; var id: String { rawValue } }
    @State private var notebook: NotebookChoice = .ruled
    @State private var barcode = ""
    @State private var scanningBarcode = false
    @State private var lookingUp = false
    @State private var catalogHit: CatalogNotebook?
    @State private var lookupMissed = false
    @State private var ownWidth: Double?
    @State private var ownHeight: Double?
    @State private var ownPitch: Double?
    @State private var ownMargin: Double?
    @State private var ownRuled = true
    @State private var barcodePhoto: PhotosPickerItem?
    @State private var barcodeMessage: String?
    // Delivery
    @State private var receiver = ""
    @State private var phone = ""
    @State private var address = ""
    @State private var area = "Kondapur"
    @State private var pincode = ""
    @State private var landmark = ""
    @State private var slot: TimeSlot = .within3h
    @State private var instructions: Set<String> = []
    @State private var note = ""
    @State private var saveAddress = true
    @State private var addressLabel = "Home"
    @State private var didPrefill = false
    /// One id per checkout: retrying "Place order" reuses the same order instead of creating another.
    @State private var checkoutID = UUID()
    /// The server's total, once the customer has been shown it (if it differed from the quote).
    @State private var confirmedTotal: Int?
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

    /// The customer's own notebook, from the catalog or their measurements.
    private var ownSpec: NotebookSpec? {
        if let hit = catalogHit { return hit.spec }
        guard let w = ownWidth, let h = ownHeight else { return nil }
        let spec = NotebookSpec(name: nil, widthMm: w, heightMm: h, linePitchMm: ownRuled ? ownPitch : nil, marginMm: ownMargin, ruled: ownRuled, pages: nil)
        return spec.isValid ? spec : nil
    }

    private var paper: PaperID {
        switch notebook {
        case .ruled: .ruledNotebook
        case .plain: .plainNotebook
        case .own: (ownSpec?.ruled ?? ownRuled) ? .ruledNotebook : .plainNotebook
        }
    }

    private var notebookSource: NotebookSource { notebook == .own ? .own : .new }

    private var diagramCount: Int { Set(files.compactMap(\.diagramID)).count }

    /// Pages detected from the text and diagrams, on the notebook being written in.
    private var detectedPages: Int {
        if notebook == .own, let spec = ownSpec {
            return estimatePages(text: text, widthMm: spec.widthMm, heightMm: spec.heightMm,
                                 marginMm: spec.marginMm ?? margin, linePitchMm: spec.linePitchMm ?? 7.2 * spacing)
        }
        return estimatePages(text: text, size: pageSize, marginMm: margin, lineSpacing: spacing)
    }

    private var pages: Int { pageOverride ?? detectedPages }

    /// Charged by the server (public.price_order_v2); shown here before placing.
    private var quote: Quote {
        isNotes ? Quote(paper: paper, units: pages, notebookSource: notebookSource) : Quote(paper: cardStyle.paper, units: recipientNames.count)
    }

    /// True once the customer has put something in that would be lost by closing.
    private var hasWork: Bool {
        placed == nil && (!files.isEmpty || !text.isEmpty || !message.isEmpty || !recipients.isEmpty || !subject.isEmpty || stepIndex > 0)
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
        if isNotes { return text }
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
                        .confirmationDialog("Leave this order?", isPresented: $confirmDiscard, titleVisibility: .visible) {
                            Button("Save as draft") {
                                let complete = model.saveDraft(makeDraft(), files: files)
                                model.show(Toast(symbol: complete ? "tray.and.arrow.down" : "exclamationmark.triangle",
                                                 title: complete ? "Draft saved" : "Draft saved without some pages",
                                                 detail: complete ? "Pick it up from Home any time." : "Your phone is low on space. Add those pages again when you resume."))
                                dismiss()
                            }
                            Button("Discard order", role: .destructive) {
                                if resumeDraft { model.clearDraft() }
                                dismiss()
                            }
                            Button("Keep editing", role: .cancel) {}
                        } message: {
                            Text("Save it as a draft to finish later, or discard what you've added.")
                        }
                }
            }
            .interactiveDismissDisabled(hasWork)
            .fullScreenCover(isPresented: $scanning) {
                DocumentScanner(onFinish: { imgs in scanning = false; Task { await addImages(imgs) } }, onCancel: { scanning = false })
                    .ignoresSafeArea()
            }
            .onChange(of: barcodePhoto) { _, item in
                guard let item else { return }
                Task {
                    barcodePhoto = nil
                    guard let data = try? await item.loadTransferable(type: Data.self), let image = UIImage(data: data) else { return }
                    if let code = await BarcodeScanner.read(from: image) {
                        barcodeMessage = nil
                        barcode = code
                        await lookUp()
                    } else {
                        barcodeMessage = "No barcode found in that photo. Try a closer, sharper photo of the back cover, or type the number."
                        Sounds.shared.play(.error)
                    }
                }
            }
            .sheet(isPresented: $showingFormatted) { FormattedPagesView(pages: formattedPages) }
            .sheet(isPresented: $scanningBarcode) {
                NavigationStack {
                    BarcodeScanner { code in
                        scanningBarcode = false
                        barcode = code
                        Task { await lookUp() }
                    }
                    .ignoresSafeArea()
                    .navigationTitle("Scan the barcode")
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { scanningBarcode = false } } }
                }
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
                if resumeDraft { applyDraft() }
                applyPrefill()
                if startWithScanner && files.isEmpty && DocumentScanner.isAvailable { scanning = true }
                styleID = styleID ?? readyStyles.first?.id
                if kind == .letters {
                    ink = .black
                    pageSize = cardStyle.size
                }
            }
            // Changing the order after a failed attempt starts a fresh checkout.
            .onChange(of: quote.total) { _, _ in
                checkoutID = UUID()
                confirmedTotal = nil
            }
            .sensoryFeedback(.success, trigger: placed?.id)
            .sensoryFeedback(.error, trigger: error)
        }
    }

    private var form: some View {
        Form {
            Section {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Step \(stepIndex + 1) of \(steps.count) · \(stepName(step))").font(.subheadline.weight(.heavy))
                    BoldProgress(value: Double(stepIndex + 1) / Double(steps.count))
                }
                .padding(.vertical, 4)
            }
            switch step {
            case .content: contentStep
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
                    HStack(spacing: 4) {
                        Text(quote.total > 0 ? rupees(confirmedTotal ?? quote.total) : "—").font(.headline.weight(.black).monospacedDigit())
                            .contentTransition(.numericText(value: Double(quote.total)))
                            .animation(.snappy, value: quote.total)
                        if quote.total > 0 { Text("TOTAL").font(.caption2.weight(.heavy)).foregroundStyle(.secondary) }
                    }
                    Text(quote.total > 0
                         ? "\(quote.billableUnits) \(isNotes ? "pages" : (cardStyle == .letter ? "letters" : "cards"))\(quote.notebook > 0 ? " + notebook" : "")\(quote.delivery == 0 ? " · free delivery" : "")"
                         : (isNotes ? "Add your notes to see the price" : "Add recipients to see the price"))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer(minLength: 0)
                if stepIndex > 0 {
                    Button("Back") { go(-1) }
                        .buttonStyle(.pennedSecondary)
                }
                if step == .review {
                    Button {
                        Task { await place() }
                    } label: {
                        if placing { ProgressView() } else {
                            HStack(spacing: 6) { Text("Place order"); Image(systemName: "chevron.right").font(.subheadline.weight(.black)) }
                        }
                    }
                    .buttonStyle(.pennedConfirm)
                    .disabled(placing)
                } else {
                    Button("Continue") { go(1) }
                        .buttonStyle(.pennedPrimary)
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
            if DocumentScanner.isAvailable {
                Button("Scan pages", systemImage: "doc.viewfinder") { scanning = true }
            } else {
                Label("The page scanner needs the iPhone camera (it can't run in the Simulator). Choose photos or import a PDF instead.", systemImage: "camera.metering.unknown")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            PhotosPicker(selection: $photos, maxSelectionCount: 40, matching: .images) { Label("Choose photos", systemImage: "photo.on.rectangle") }
            Button("Import PDF", systemImage: "doc.richtext") { importingPDF = true }
            ForEach(files.filter { !$0.isDiagram }) { f in
                HStack {
                    LabeledContent(f.name, value: "\(f.pages) \(f.pages == 1 ? "page" : "pages")")
                    Button(role: .destructive) {
                        withAnimation { removeFile(f) }
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
            if diagramCount > 0 {
                Label("\(diagramCount) \(diagramCount == 1 ? "diagram" : "diagrams") found. We'll draw \(diagramCount == 1 ? "it" : "them") with the pen.", systemImage: "scribble.variable")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            if reading {
                HStack(spacing: 12) {
                    ProgressView()
                    Text(Config.aiReading ? "Gemini is reading and formatting your pages" : "Reading the text on your pages")
                        .foregroundStyle(.secondary)
                }
            } else if readByAI {
                Label("Read and formatted by Gemini", systemImage: "checkmark.seal.fill")
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(Theme.success)
            } else if let problem = model.aiProblem, !files.isEmpty {
                Label(problem, systemImage: "exclamationmark.triangle")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            if !formattedPages.isEmpty {
                Button {
                    Sounds.shared.play(.tap)
                    showingFormatted = true
                } label: {
                    Label("See formatted pages (\(formattedPages.count))", systemImage: "doc.richtext")
                }
            }
        } header: {
            Text(kind == .missedNotes ? "Class notes or handouts" : "Your notes")
        } footer: {
            Text("Gemini reads every word and redraws each diagram in seconds. Check the text below before you pay.")
        }
        Section {
            TextEditor(text: $text).frame(minHeight: 180).font(.body)
        } header: {
            Text("Text to write")
        } footer: {
            Text("Lines starting with # are headings. [[diagram:…]] lines mark where a diagram is drawn.")
        }
        pagesSection
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

    /// How many pages to write: detected from the files, and the customer can change it.
    @ViewBuilder private var pagesSection: some View {
        Section {
            Stepper(value: Binding(get: { max(1, pages) }, set: { pageOverride = $0 }), in: 1...500) {
                LabeledContent("Pages to write", value: "\(max(1, pages))")
            }
            if pageOverride != nil, detectedPages > 0 {
                Button("Use the detected \(detectedPages) \(detectedPages == 1 ? "page" : "pages")") { pageOverride = nil }
            }
        } header: {
            Text("Pages")
        } footer: {
            Text(pageOverride == nil
                 ? "Worked out from your notes. You pay \(rupees(Quote.pagePrice)) for each page you ask for."
                 : "You pay \(rupees(Quote.pagePrice)) for each page you ask for.")
        }
    }

    @ViewBuilder private var paperStep: some View {
        Section {
            NotebookOption(title: "New long notebook · Ruled", detail: "17.5 × 27.5 cm, single-ruled with a margin. The classic for class notes.",
                           price: rupees(Quote.notebookPrice), thumb: .ruled, selected: notebook == .ruled) { choose(.ruled) }
            NotebookOption(title: "New long notebook · Plain", detail: "17.5 × 27.5 cm, no lines. Good for diagrams.",
                           price: rupees(Quote.notebookPrice), thumb: .plain, selected: notebook == .plain) { choose(.plain) }
            NotebookOption(title: "Sheets for my notebook", detail: "Scan your notebook's barcode. We send A4 sheets ruled like your notebook, with cut lines: cut and stick them in.",
                           price: "Free", thumb: .own, selected: notebook == .own) { choose(.own) }
        } header: {
            Text("Notebook")
        } footer: {
            Text("\(rupees(Quote.pagePrice)) a page. A new long notebook (ruled or plain) is \(rupees(Quote.notebookPrice)). Sheets for your own notebook cost only the pages. We take care of the layout, ink and neatness.")
        }
        .listRowBackground(Color.clear)
        .listRowInsets(EdgeInsets(top: 6, leading: 0, bottom: 6, trailing: 0))
        .listRowSeparator(.hidden)

        if notebook == .own { ownNotebookSections }
    }

    @ViewBuilder private var ownNotebookSections: some View {
        Section {
            HStack {
                TextField("Barcode number", text: $barcode)
                    .keyboardType(.asciiCapable)
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled()
                    .onSubmit { Task { await lookUp() } }
                    .onChange(of: barcode) { _, new in
                        if catalogHit?.barcode != new { catalogHit = nil; lookupMissed = false }
                    }
                if lookingUp { ProgressView() }
            }
            if BarcodeScanner.isSupported {
                Button("Scan the barcode", systemImage: "barcode.viewfinder") {
                    Task {
                        if await BarcodeScanner.requestAccess() == .granted {
                            barcodeMessage = nil
                            scanningBarcode = true
                        } else {
                            barcodeMessage = "Penned can't use the camera. Allow it in Settings → Penned → Camera, or read the barcode from a photo."
                            Sounds.shared.play(.error)
                        }
                    }
                }
            } else {
                Text("Live scanning needs the iPhone camera (it can't run in the Simulator). Use a photo of the barcode, or type the number.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            // Works everywhere, including the Simulator and phones without the live scanner.
            PhotosPicker(selection: $barcodePhoto, matching: .images) {
                Label("Read the barcode from a photo", systemImage: "photo")
            }
            if let barcodeMessage {
                Text(barcodeMessage).font(.footnote).foregroundStyle(.secondary)
            }
            if !barcode.isEmpty && catalogHit == nil && !lookupMissed && !lookingUp {
                Button("Look up this notebook", systemImage: "magnifyingglass") { Task { await lookUp() } }
            }
            if let hit = catalogHit {
                VStack(alignment: .leading, spacing: 4) {
                    Label(hit.name, systemImage: "checkmark.seal.fill").font(.headline.weight(.heavy))
                    Text(specSummary(hit.spec)).font(.subheadline).foregroundStyle(.secondary)
                }
                Button("Not this notebook? Measure it instead") { catalogHit = nil; lookupMissed = true }
                    .font(.subheadline)
            }
        } header: {
            Text("Your notebook")
        } footer: {
            Text(catalogHit != nil
                 ? "We know this notebook: your sheets will match its size, lines and margin."
                 : "The barcode is on the back cover. If we don't know your notebook yet, measure it once below.")
        }

        if catalogHit == nil {
            Section {
                Toggle("Ruled pages", isOn: $ownRuled)
                MeasureField(label: "Page width", value: $ownWidth)
                MeasureField(label: "Page height", value: $ownHeight)
                if ownRuled { MeasureField(label: "Line spacing", value: $ownPitch) }
                MeasureField(label: "Left margin", value: $ownMargin)
            } header: {
                Text(lookupMissed ? "New notebook to us: measure it" : "Measurements")
            } footer: {
                Text("In millimetres, with a ruler. For line spacing, measure across 10 lines and divide by 10. Leave the margin empty if there isn't one.")
            }
        }
    }

    private func specSummary(_ s: NotebookSpec) -> String {
        var parts = ["\(fmt(s.widthMm)) × \(fmt(s.heightMm)) mm"]
        parts.append(s.ruled ? "lines \(s.linePitchMm.map(fmt) ?? "?") mm apart" : "plain")
        if let m = s.marginMm { parts.append("margin \(fmt(m)) mm") }
        if let p = s.pages { parts.append("\(p) pages") }
        return parts.joined(separator: " · ")
    }

    private func fmt(_ d: Double) -> String { d == d.rounded() ? String(Int(d)) : String(format: "%.1f", d) }

    // MARK: Letters & cards steps

    @ViewBuilder private var cardStep: some View {
        Section {
            HandwritingPage(text: cardPreview, glyphs: glyphs, ink: ink, ruled: false, lineSpacing: 1.05, margin: 0.09, pageWidthMm: cardStyle.size.mm.w)
                .aspectRatio(CGFloat(cardStyle.size.mm.w / cardStyle.size.mm.h), contentMode: .fit)
                .frame(maxWidth: cardStyle == .letter ? 200 : 240)
                .background(cardStyle == .kraft ? Color(red: 0.86, green: 0.78, blue: 0.66) : Theme.surface)
                .overlay(Rectangle().strokeBorder(Theme.ink, lineWidth: 1.5))
                .frame(maxWidth: .infinity)
                .listRowBackground(Color.clear)
        } header: {
            Text("Preview")
        }
        Section {
            ForEach(CardPaper.allCases) { s in
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
                .overlay(Rectangle().strokeBorder(Theme.ink, lineWidth: 1.5))
                .frame(maxWidth: .infinity)
                .listRowBackground(Color.clear)
        } header: {
            Text(recipientNames.first.map { "Card for \($0)" } ?? "Preview")
        }
    }

    // MARK: Shared steps

    static let instructionChoices = ["Call when you arrive", "Leave with security", "Don't ring the bell", "Hand it to me only"]
    static let addressLabels = ["Home", "Hostel", "Work", "Other"]

    /// The address typed matches one already saved, so there's nothing new to save.
    private var matchesSaved: Bool {
        model.addresses.contains { $0.line1 == address.trimmingCharacters(in: .whitespaces) && $0.area == area && $0.pincode == pincode }
    }

    private var deliveryNote: String? {
        let parts = Self.instructionChoices.filter { instructions.contains($0) } + [note.trimmingCharacters(in: .whitespacesAndNewlines)].filter { !$0.isEmpty }
        return parts.isEmpty ? nil : String(parts.joined(separator: ". ").prefix(200))
    }

    @ViewBuilder private var deliveryStep: some View {
        if !model.addresses.isEmpty {
            Section {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 10) {
                        ForEach(model.addresses) { a in
                            let picked = a.line1 == address && a.area == area && a.pincode == pincode
                            Button { use(a) } label: {
                                VStack(alignment: .leading, spacing: 4) {
                                    Label(a.label, systemImage: a.symbol).font(.subheadline.weight(.heavy))
                                    Text("\(a.line1), \(a.area)").font(.caption).foregroundStyle(.secondary).lineLimit(2)
                                }
                                .frame(width: 170, alignment: .leading)
                                .padding(12)
                                .background(picked ? Theme.successFill : Theme.surface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                                .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(picked ? Theme.success : Theme.ink, lineWidth: picked ? 2.5 : 1.5))
                                .overlay(alignment: .topTrailing) {
                                    if picked { Image(systemName: "checkmark.circle.fill").foregroundStyle(Theme.success).padding(8) }
                                }
                            }
                            .buttonStyle(.plain)
                            .accessibilityAddTraits(picked ? [.isButton, .isSelected] : .isButton)
                        }
                    }
                    .padding(.vertical, 4)
                }
                .listRowBackground(Color.clear)
                .listRowInsets(EdgeInsets(top: 0, leading: 0, bottom: 0, trailing: 0))
            } header: {
                Text("Saved addresses")
            }
        }
        Section("Address") {
            TextField("Flat, house no., building", text: $address).textContentType(.streetAddressLine1)
            Picker("Area", selection: $area) { ForEach(deliveryAreas, id: \.self) { Text($0) } }
            TextField("Pincode", text: $pincode).keyboardType(.numberPad).textContentType(.postalCode)
            TextField("Landmark (optional)", text: $landmark)
            if !matchesSaved {
                Toggle("Save this address", isOn: $saveAddress)
                if saveAddress {
                    ChipRow(options: Self.addressLabels, selected: [addressLabel]) { addressLabel = $0 }
                }
            }
        }
        Section("Receiver") {
            TextField("Name", text: $receiver).textContentType(.name)
            TextField("Mobile number", text: $phone).keyboardType(.phonePad).textContentType(.telephoneNumber)
        }
        Section {
            ChipGrid(options: TimeSlot.allCases.map(\.label), selected: [slot.label]) { label in
                if let s = TimeSlot.allCases.first(where: { $0.label == label }) { slot = s }
            }
            .listRowBackground(Color.clear)
            .listRowInsets(EdgeInsets(top: 4, leading: 0, bottom: 4, trailing: 0))
        } header: {
            Text("When")
        }
        Section {
            ChipGrid(options: Self.instructionChoices, selected: instructions) { choice in
                if instructions.contains(choice) { instructions.remove(choice) } else { instructions.insert(choice) }
            }
            .listRowBackground(Color.clear)
            .listRowInsets(EdgeInsets(top: 4, leading: 0, bottom: 4, trailing: 0))
            TextField("Anything else for the rider? (optional)", text: $note)
        } header: {
            Text("Delivery instructions")
        }
    }

    private func use(_ a: SavedAddress) {
        Sounds.shared.play(.tap)
        address = a.line1
        area = a.area
        pincode = a.pincode
        landmark = a.landmark ?? ""
        if let n = a.receiverName, !n.isEmpty { receiver = n }
        if let p = a.receiverPhone, !p.isEmpty { phone = p }
    }

    private func makeDraft() -> OrderDraft {
        OrderDraft(kind: kind.rawValue, title: title, text: text, subject: subject, lessonsMissed: lessonsMissed,
                   forChild: missedFor == .child, notebook: notebook.rawValue, barcode: barcode,
                   ownWidth: ownWidth, ownHeight: ownHeight, ownPitch: ownPitch, ownMargin: ownMargin, ownRuled: ownRuled,
                   pageOverride: pageOverride, cardStyle: cardStyle.rawValue, message: message, recipients: recipients)
    }

    private func applyDraft() {
        guard !didPrefill, let saved = DraftStore.load(), saved.draft.kind == kind.rawValue else { return }
        let d = saved.draft
        files = saved.files
        title = d.title; text = d.text; subject = d.subject; lessonsMissed = d.lessonsMissed
        missedFor = d.forChild ? .child : .me
        notebook = NotebookChoice(rawValue: d.notebook) ?? .ruled
        barcode = d.barcode
        ownWidth = d.ownWidth; ownHeight = d.ownHeight; ownPitch = d.ownPitch; ownMargin = d.ownMargin; ownRuled = d.ownRuled
        pageOverride = d.pageOverride
        cardStyle = CardPaper(rawValue: d.cardStyle) ?? .ivory
        pageSize = kind == .letters ? cardStyle.size : pageSize
        message = d.message; recipients = d.recipients
    }

    /// Fills the form from an earlier order ("Order again"), or the newest saved address.
    private func applyPrefill() {
        guard !didPrefill else { return }
        didPrefill = true
        if let o = prefill {
            address = o.addressLine1
            area = o.area
            pincode = o.pincode
            landmark = o.landmark ?? ""
            receiver = o.receiverName ?? ""
            phone = o.receiverPhone ?? ""
            if let n = o.deliveryNote {
                for c in Self.instructionChoices where n.contains(c) { instructions.insert(c) }
            }
            if isNotes {
                if o.notebookSource == .own, let spec = o.notebookSpec {
                    notebook = .own
                    barcode = o.notebookBarcode ?? ""
                    ownWidth = spec.widthMm
                    ownHeight = spec.heightMm
                    ownPitch = spec.linePitchMm
                    ownMargin = spec.marginMm
                    ownRuled = spec.ruled
                } else {
                    notebook = o.paper == .plainNotebook ? .plain : .ruled
                }
            }
        } else if let a = model.addresses.first {
            use(a)
        }
    }

    @ViewBuilder private var reviewStep: some View {
        Section("Order") {
            LabeledContent("What", value: kind.title)
            LabeledContent("Title", value: orderTitle)
            if isNotes {
                let pageFiles = files.filter { !$0.isDiagram }.count
                LabeledContent("Content", value: pageFiles == 0 ? "Typed text" : "\(pageFiles) \(pageFiles == 1 ? "file" : "files")" + (diagramCount > 0 ? " · \(diagramCount) \(diagramCount == 1 ? "diagram" : "diagrams")" : ""))
                LabeledContent("Pages", value: "\(pages)")
                LabeledContent("Notebook", value: notebook == .own ? "A4 sheets ruled like your notebook (\(paper == .ruledNotebook ? "ruled" : "plain"))" : paper.name)
            } else {
                LabeledContent("Card", value: "\(cardStyle.name) · \(ink.label) ink")
                LabeledContent("Recipients", value: "\(recipientNames.count)")
            }
            LabeledContent("Deliver", value: "\(area) · \(slot.label)")
            if let n = deliveryNote { LabeledContent("Rider note", value: n) }
        }
        if isNotes { pagePreview }
        Section {
            BillCard(
                lines: quote.billLines(isNotes: isNotes, ownNotebook: isNotes && notebook == .own,
                                       unitName: isNotes ? "pages" : (cardStyle == .letter ? "letters" : "cards")),
                total: quote.total,
                footnote: "This is the final price. Nothing is added after you pay."
            )
            .listRowBackground(Color.clear)
            .listRowInsets(EdgeInsets(top: 4, leading: 0, bottom: 4, trailing: 0))
        }
        Section {
            VStack(alignment: .leading, spacing: 0) {
                GuaranteeRow(guarantee: .rewrite)
                Divider().overlay(Theme.line)
                GuaranteeRow(guarantee: .checked)
                Divider().overlay(Theme.line)
                GuaranteeRow(guarantee: .privateFiles)
            }
            .card(padding: 0, lifted: false)
            .listRowBackground(Color.clear)
            .listRowInsets(EdgeInsets(top: 4, leading: 0, bottom: 4, trailing: 0))
        } header: {
            Text("Our promise")
        }
    }

    private var previewSize: (w: Double, h: Double) {
        if notebook == .own, let s = ownSpec { return (w: s.widthMm, h: s.heightMm) }
        return pageSize.mm
    }

    /// Every page in the customer's own handwriting, swipeable, with the diagrams exactly as on their notes.
    @ViewBuilder private var pagePreview: some View {
        Section {
            PagedPreview(
                text: text, glyphs: glyphs, ink: ink, ruled: paper == .ruledNotebook, lineSpacing: spacing,
                marginMm: margin, headingStyle: heading, pageMm: previewSize,
                diagramImage: { id in
                    files.first { $0.uploadName == "diagram-\(id).png" }.flatMap { UIImage(data: $0.data) }
                },
                diagramSVG: { id in
                    files.first { $0.uploadName == "diagram-\(id).svg" }.flatMap { String(data: $0.data, encoding: .utf8) }
                }
            )
            .listRowBackground(Color.clear)
        } header: {
            Text("Preview")
        } footer: {
            Text(glyphs != nil ? "Drawn with your own letters. Our team does the final layout\(diagramCount > 0 ? " and draws the diagrams" : "")."
                               : "Shown in a sample hand until your handwriting is ready.")
        }
    }

    private func done(_ order: Order) -> some View {
        OrderPlacedView(order: order, ownNotebook: isNotes && notebook == .own) { dismiss() }
    }

    // MARK: Actions

    private func go(_ delta: Int) {
        if delta > 0, let problem = validate() {
            error = problem
            Sounds.shared.play(.error)
            return
        }
        error = nil
        Sounds.shared.play(delta > 0 ? .step : .tap)
        stepIndex = min(max(0, stepIndex + delta), steps.count - 1)
    }

    private func validate() -> String? {
        switch step {
        case .content:
            if kind == .missedNotes && subject.trimmingCharacters(in: .whitespaces).isEmpty { return "Add the subject you missed." }
            if reading { return "Still reading your pages. One moment." }
            return text.trimmingCharacters(in: .whitespacesAndNewlines).count < 10 ? "Add your pages or type the text you'd like written." : nil
        case .paper:
            if notebook == .own && ownSpec == nil {
                return catalogHit == nil && ownWidth == nil ? "Scan the barcode or measure your notebook." : "Check the measurements: width, height\(ownRuled ? ", line spacing" : "") in mm."
            }
            return nil
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
            files.append(ScannedFile(data: jpeg, kind: "image", pages: 1, name: "Page \(files.filter { !$0.isDiagram }.count + 1)"))
        }
        // AI reading when it's switched on (whole batch at once, up to 10 pages), otherwise page by page on the phone.
        if images.count <= 10, let ai = await model.aiRead(images: images) {
            add(ai)
            return
        }
        for img in images { add(await TextRecognizer.read(image: img)) }
    }

    private func addPDFs(_ urls: [URL]) async {
        reading = true
        defer { reading = false }
        for url in urls {
            let ok = url.startAccessingSecurityScopedResource()
            defer { if ok { url.stopAccessingSecurityScopedResource() } }
            guard let data = try? Data(contentsOf: url) else {
                error = "Couldn't open \(url.lastPathComponent)."
                continue
            }
            var result = await TextRecognizer.read(pdf: data)
            // Gemini reads the exact text and finds the diagrams; the phone's reading is the fallback.
            if result.pages > 0, let ai = await model.aiRead(pdf: data, pageCount: result.pages) { result = ai }
            if result.pages == 0 {
                error = "\(url.lastPathComponent) isn't a readable PDF."
                continue
            }
            files.append(ScannedFile(data: data, kind: "pdf", pages: result.pages, name: url.lastPathComponent))
            add(result)
            if result.text.isEmpty && result.diagrams.isEmpty { error = "We couldn't find any notes in \(url.lastPathComponent). Type them below instead." }
        }
    }

    /// Adds what was read from a file: its text, and its diagrams as separate uploads.
    private func add(_ e: Extraction) {
        let t = e.text.trimmingCharacters(in: .whitespacesAndNewlines)
        if !t.isEmpty { text += (text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "" : "\n\n") + t }
        for d in e.diagrams {
            if !d.png.isEmpty {
                files.append(ScannedFile(data: d.png, kind: "image", pages: 1, name: "Diagram", uploadName: "diagram-\(d.id).png"))
            }
            // Gemini's clean drawing: the pen plotter draws this one.
            if let svg = d.svg, let data = svg.data(using: .utf8) {
                files.append(ScannedFile(data: data, kind: "image", pages: 1, name: "Diagram drawing", uploadName: "diagram-\(d.id).svg"))
            }
        }
        formattedPages += e.formatted
        readByAI = e.byAI
        if !t.isEmpty || !e.diagrams.isEmpty { error = nil }
    }

    /// Removing a page also drops the diagrams that are no longer in the text.
    private func removeFile(_ f: ScannedFile) {
        files.removeAll { $0.id == f.id }
        files.removeAll { d in d.diagramID.map { !text.contains("[[diagram:\($0)]]") } ?? false }
    }

    private func choose(_ n: NotebookChoice) {
        Sounds.shared.play(.tap)
        withAnimation(.easeOut(duration: 0.2)) { notebook = n }
    }

    private func lookUp() async {
        let code = BarcodeScanner.Coordinator.clean(barcode) ?? ""
        guard !code.isEmpty else { return }
        barcode = code
        lookingUp = true
        defer { lookingUp = false }
        catalogHit = await model.notebook(barcode: code)
        lookupMissed = catalogHit == nil
        if let hit = catalogHit { ownRuled = hit.ruled }
        barcodeMessage = catalogHit == nil
            ? "Barcode \(code) read. We haven't seen this notebook yet: measure it once below, and we'll remember it for everyone with the same notebook."
            : nil
        Sounds.shared.play(.success)
    }

    private func place() async {
        placing = true
        defer { placing = false }
        let count = recipientNames.count
        let draft = NewOrder(
            id: checkoutID,
            title: orderTitle,
            sourceMode: isNotes && !files.isEmpty ? "files" : "text",
            sourceText: orderText,
            paper: isNotes ? paper : cardStyle.paper,
            ink: ink,
            pageSize: isNotes ? pageSize : cardStyle.size,
            marginMm: isNotes ? min(40, max(8, (notebook == .own ? ownSpec?.marginMm : nil) ?? margin)) : 9,
            lineSpacing: isNotes ? min(2.5, max(0.8, (notebook == .own ? ownSpec?.linePitchMm.map { $0 / 7.2 } : nil) ?? spacing)) : 1.1,
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
            timeSlot: slot,
            notebookSource: isNotes ? notebookSource : .new,
            notebookBarcode: isNotes && notebook == .own && !barcode.isEmpty ? BarcodeScanner.Coordinator.clean(barcode) : nil,
            notebookSpec: isNotes && notebook == .own ? ownSpec : nil,
            deliveryNote: deliveryNote
        )
        do {
            var order = try await model.place(draft, files: isNotes ? files : [], expectedTotal: confirmedTotal ?? quote.total)
            if saveAddress && !matchesSaved {
                await model.save(address: SavedAddress(
                    id: nil, label: addressLabel, line1: draft.addressLine1, area: area, pincode: pincode,
                    landmark: draft.landmark, receiverName: draft.receiverName, receiverPhone: draft.receiverPhone))
            }
            if order.paymentStatus != "paid" { try await model.demoPay(order) }
            // Paid: the draft is done. (Cleared only now, so a failed payment keeps it.)
            if resumeDraft || model.draft?.kind == kind.rawValue { model.clearDraft() }
            // If re-reading the order fails, it is still paid: show it as paid rather than an error.
            if let fresh = try? await model.order(id: order.id) { order = fresh } else { order.paymentStatus = "paid" }
            placed = order
            Sounds.shared.play(.success)
        } catch let AppError.priceChanged(total) {
            confirmedTotal = total
            self.error = AppError.priceChanged(total).errorDescription
            Sounds.shared.play(.error)
        } catch {
            self.error = "Couldn't place the order. Nothing extra was charged; tap Place order to try again."
            Sounds.shared.play(.error)
        }
    }
}

/// A big bordered choice for the notebook step.
private struct NotebookOption: View {
    let title: String
    let detail: String
    let price: String
    let thumb: NotebookThumb.Kind
    let selected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 14) {
                NotebookThumb(kind: thumb)
                    .padding(6)
                    .background(Theme.fill, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).font(.headline.weight(.heavy)).foregroundStyle(Theme.ink)
                    Text(detail).font(.footnote).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 6)
                VStack(alignment: .trailing, spacing: 6) {
                    if price == "Free" {
                        Text("FREE").font(.caption.weight(.heavy)).foregroundStyle(Theme.success)
                            .padding(.horizontal, 9).padding(.vertical, 4)
                            .background(Theme.successFill, in: Capsule())
                    } else {
                        PillTag(text: price, inverted: selected)
                    }
                    Image(systemName: selected ? "checkmark.circle.fill" : "circle")
                        .font(.title3.weight(.bold))
                        .foregroundStyle(Theme.ink)
                        .accessibilityHidden(true)
                }
            }
            .card(padding: 14, lifted: selected)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
    }
}

/// A millimetre measurement field.
private struct MeasureField: View {
    let label: String
    @Binding var value: Double?

    var body: some View {
        LabeledContent(label) {
            HStack(spacing: 6) {
                TextField("0", value: $value, format: FloatingPointFormatStyle<Double>.number.precision(.fractionLength(0...1)))
                    .keyboardType(.decimalPad)
                    .multilineTextAlignment(.trailing)
                    .frame(maxWidth: 90)
                Text("mm").foregroundStyle(.secondary)
            }
        }
    }
}

/// Tap-to-choose chips in a wrapping grid (time slots, delivery instructions).
struct ChipGrid: View {
    let options: [String]
    let selected: Set<String>
    let onTap: (String) -> Void
    var body: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 150), spacing: 8)], alignment: .leading, spacing: 8) {
            ForEach(options, id: \.self) { o in Chip(text: o, on: selected.contains(o)) { onTap(o) } }
        }
    }
}

/// One row of chips (address labels).
struct ChipRow: View {
    let options: [String]
    let selected: Set<String>
    let onTap: (String) -> Void
    var body: some View {
        HStack(spacing: 8) {
            ForEach(options, id: \.self) { o in Chip(text: o, on: selected.contains(o)) { onTap(o) } }
        }
    }
}

private struct Chip: View {
    let text: String
    let on: Bool
    let action: () -> Void
    var body: some View {
        Button {
            Sounds.shared.play(.tap)
            action()
        } label: {
            Text(text)
                .font(.subheadline.weight(.bold))
                .foregroundStyle(on ? Theme.paper : Theme.ink)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
                .padding(.horizontal, 12)
                .frame(maxWidth: .infinity, minHeight: 44)
                .background(on ? Theme.ink : Theme.surface, in: Capsule())
                .overlay(Capsule().strokeBorder(Theme.ink, lineWidth: 1.5))
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(on ? [.isButton, .isSelected] : .isButton)
    }
}
