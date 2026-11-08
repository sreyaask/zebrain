import PhotosUI
import SwiftUI
import UniformTypeIdentifiers

/// One order flow, shaped by what the customer is ordering:
/// - Complete notes / Missed notes: Notes → Notebook → Delivery → Review & pay
///   (layout, ink and contents list are Penned's job; the customer only picks the notebook)
/// - Letters & cards:              Card → Message → Delivery → Review & pay
struct NewOrderView: View {
    let kind: OrderKind

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
    @State private var pageSize: PageSize = .b5
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

    private var diagramCount: Int { files.filter(\.isDiagram).count }

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
                    Text(quote.total > 0 ? rupees(quote.total) : "—").font(.headline.monospacedDigit())
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
                        if placing { ProgressView() } else { Text("Place order") }
                    }
                    .buttonStyle(.pennedPrimary)
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
            if DocumentScanner.isAvailable { Button("Scan pages", systemImage: "doc.viewfinder") { scanning = true } }
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
                    Text("Reading the text on your pages")
                        .foregroundStyle(.secondary)
                }
            }
        } header: {
            Text(kind == .missedNotes ? "Class notes or handouts" : "Your notes")
        } footer: {
            Text("Text and diagrams are read on your phone, so you can check them below.")
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
            NotebookOption(title: "Ruled notebook", detail: "A new ruled notebook with a margin.", price: rupees(Quote.notebookPrice),
                           symbol: "line.3.horizontal", selected: notebook == .ruled) { choose(.ruled) }
            NotebookOption(title: "Plain notebook", detail: "A new unruled notebook.", price: rupees(Quote.notebookPrice),
                           symbol: "rectangle.portrait", selected: notebook == .plain) { choose(.plain) }
            NotebookOption(title: "Continue in my notebook", detail: "Our rider collects it, we write in it and bring it back.", price: "Free",
                           symbol: "barcode.viewfinder", selected: notebook == .own) { choose(.own) }
        } header: {
            Text("Notebook")
        } footer: {
            Text("\(rupees(Quote.pagePrice)) a page. A new notebook is \(rupees(Quote.notebookPrice)); writing in yours is free. We take care of the layout, ink and neatness.")
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
            if BarcodeScanner.isAvailable {
                Button("Scan the barcode", systemImage: "barcode.viewfinder") { scanningBarcode = true }
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
            Text(catalogHit != nil ? "We know this notebook, so no measuring needed." : "The barcode is on the back cover. We'll continue after your last written page.")
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
                let pageFiles = files.filter { !$0.isDiagram }.count
                LabeledContent("Content", value: pageFiles == 0 ? "Typed text" : "\(pageFiles) \(pageFiles == 1 ? "file" : "files")" + (diagramCount > 0 ? " · \(diagramCount) \(diagramCount == 1 ? "diagram" : "diagrams")" : ""))
                LabeledContent("Pages", value: "\(pages)")
                LabeledContent("Notebook", value: notebook == .own ? "Your own (\(paper == .ruledNotebook ? "ruled" : "plain")), collected first" : paper.name)
            } else {
                LabeledContent("Card", value: "\(cardStyle.name) · \(ink.label) ink")
                LabeledContent("Recipients", value: "\(recipientNames.count)")
            }
            LabeledContent("Deliver", value: "\(area) · \(slot.label)")
        }
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
            add(await TextRecognizer.read(image: img))
        }
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
            let result = await TextRecognizer.read(pdf: data)
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
            files.append(ScannedFile(data: d.png, kind: "image", pages: 1, name: "Diagram", uploadName: "diagram-\(d.id).png"))
        }
        if !t.isEmpty || !e.diagrams.isEmpty { error = nil }
    }

    /// Removing a page also drops the diagrams that are no longer in the text.
    private func removeFile(_ f: ScannedFile) {
        files.removeAll { $0.id == f.id }
        files.removeAll { d in d.isDiagram && !text.contains("[[diagram:\(d.uploadName!.dropFirst(8).dropLast(4))]]") }
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
        Sounds.shared.play(catalogHit != nil ? .success : .tap)
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
            notebookSpec: isNotes && notebook == .own ? ownSpec : nil
        )
        do {
            var order = try await model.place(draft, files: isNotes ? files : [])
            try await model.demoPay(order)
            order = try await model.order(id: order.id)
            placed = order
            Sounds.shared.play(.success)
        } catch {
            self.error = "Couldn't place the order. Check your connection and try again."
            Sounds.shared.play(.error)
        }
    }
}

/// A big bordered choice for the notebook step.
private struct NotebookOption: View {
    let title: String
    let detail: String
    let price: String
    let symbol: String
    let selected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 14) {
                Image(systemName: symbol)
                    .font(.title3.weight(.bold))
                    .frame(width: 44, height: 44)
                    .background(selected ? Theme.ink : Theme.fill, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .foregroundStyle(selected ? Theme.paper : Theme.ink)
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).font(.headline.weight(.heavy)).foregroundStyle(Theme.ink)
                    Text(detail).font(.footnote).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 6)
                VStack(alignment: .trailing, spacing: 6) {
                    PillTag(text: price, inverted: selected)
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
