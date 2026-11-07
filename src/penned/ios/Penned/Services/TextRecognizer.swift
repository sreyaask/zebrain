import PDFKit
import UIKit
import Vision

/// Reads text from photos and PDFs on the device, so the customer can check it before ordering.
enum TextRecognizer {
    static func text(from image: UIImage) async throws -> String {
        guard let cg = image.cgImage else { return "" }
        return try await withCheckedThrowingContinuation { cont in
            let request = VNRecognizeTextRequest { req, err in
                if let err { return cont.resume(throwing: err) }
                let lines = (req.results as? [VNRecognizedTextObservation] ?? []).compactMap { $0.topCandidates(1).first?.string }
                cont.resume(returning: lines.joined(separator: "\n"))
            }
            request.recognitionLevel = .accurate
            request.usesLanguageCorrection = true
            request.recognitionLanguages = ["en-IN", "en-US"]
            do {
                try VNImageRequestHandler(cgImage: cg, orientation: image.cgOrientation).perform([request])
            } catch {
                cont.resume(throwing: error)
            }
        }
    }

    /// Uses the PDF's text layer; scanned PDFs are rendered and read with Vision.
    static func text(fromPDF data: Data) async throws -> (text: String, pages: Int) {
        guard let doc = PDFDocument(data: data) else { return ("", 0) }
        var parts: [String] = []
        for i in 0..<doc.pageCount {
            guard let page = doc.page(at: i) else { continue }
            let layer = page.string?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            if layer.count > 40 {
                parts.append(layer)
            } else {
                let image = page.thumbnail(of: CGSize(width: 1600, height: 2200), for: .mediaBox)
                parts.append(try await text(from: image))
            }
        }
        return (tidy(parts.joined(separator: "\n\n")), doc.pageCount)
    }

    /// Joins lines broken by the original page width; keeps paragraph breaks.
    static func tidy(_ s: String) -> String {
        s.replacingOccurrences(of: "-\n", with: "")
            .components(separatedBy: "\n\n")
            .map { $0.split(whereSeparator: \.isNewline).map { $0.trimmingCharacters(in: .whitespaces) }.joined(separator: " ") }
            .filter { !$0.isEmpty }
            .joined(separator: "\n")
    }
}

extension UIImage {
    var cgOrientation: CGImagePropertyOrientation {
        switch imageOrientation {
        case .up: .up
        case .down: .down
        case .left: .left
        case .right: .right
        case .upMirrored: .upMirrored
        case .downMirrored: .downMirrored
        case .leftMirrored: .leftMirrored
        case .rightMirrored: .rightMirrored
        @unknown default: .up
        }
    }

    /// Downscale so uploads stay small but readable.
    func jpegForUpload(maxEdge: CGFloat = 2400) -> Data? {
        let scale = min(1, maxEdge / max(size.width, size.height))
        let target = CGSize(width: size.width * scale, height: size.height * scale)
        let resized = UIGraphicsImageRenderer(size: target).image { _ in draw(in: CGRect(origin: .zero, size: target)) }
        return resized.jpegData(compressionQuality: 0.85)
    }
}
