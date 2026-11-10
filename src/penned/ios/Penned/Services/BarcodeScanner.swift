import SwiftUI
import UIKit
import Vision
import VisionKit

/// Live camera barcode reader for the back of a notebook (EAN/UPC/Code 128). Calls `onFound` once.
struct BarcodeScanner: UIViewControllerRepresentable {
    let onFound: (String) -> Void

    @MainActor static var isAvailable: Bool { DataScannerViewController.isSupported && DataScannerViewController.isAvailable }

    func makeUIViewController(context: Context) -> DataScannerViewController {
        let vc = DataScannerViewController(
            recognizedDataTypes: [.barcode(symbologies: [.ean13, .ean8, .upce, .code128, .code39, .qr])],
            qualityLevel: .balanced,
            recognizesMultipleItems: false,
            isHighFrameRateTrackingEnabled: false,
            isHighlightingEnabled: true
        )
        vc.delegate = context.coordinator
        return vc
    }

    func updateUIViewController(_ vc: DataScannerViewController, context: Context) {
        if !vc.isScanning { try? vc.startScanning() }
    }

    static func dismantleUIViewController(_ vc: DataScannerViewController, coordinator: Coordinator) {
        vc.stopScanning()
    }

    func makeCoordinator() -> Coordinator { Coordinator(onFound: onFound) }

    /// Reads a barcode from a still photo (works on every device and in the Simulator, where the live scanner can't run).
    static func read(from image: UIImage) async -> String? {
        guard let cg = image.cgImage else { return nil }
        let request = VNDetectBarcodesRequest()
        request.symbologies = [.ean13, .ean8, .upce, .code128, .code39, .qr]
        let orientation = CGImagePropertyOrientation(rawValue: UInt32(image.imageOrientation.exifValue)) ?? .up
        do {
            try VNImageRequestHandler(cgImage: cg, orientation: orientation).perform([request])
        } catch {
            return nil
        }
        let values = (request.results ?? []).compactMap(\.payloadStringValue)
        return values.lazy.compactMap { Coordinator.clean($0) }.first
    }

    final class Coordinator: NSObject, DataScannerViewControllerDelegate {
        let onFound: (String) -> Void
        private var done = false
        init(onFound: @escaping (String) -> Void) { self.onFound = onFound }

        func dataScanner(_ scanner: DataScannerViewController, didAdd items: [RecognizedItem], allItems: [RecognizedItem]) {
            guard !done else { return }
            for item in items {
                if case let .barcode(code) = item, let value = code.payloadStringValue, let clean = Self.clean(value) {
                    done = true
                    scanner.stopScanning()
                    onFound(clean)
                    return
                }
            }
        }

        /// Keeps what the database accepts: 4–64 letters, digits or dashes.
        static func clean(_ s: String) -> String? {
            let kept = String(s.filter { $0.isASCII && ($0.isLetter || $0.isNumber || $0 == "-") }.prefix(64))
            return kept.count >= 4 ? kept : nil
        }
    }
}

private extension UIImage.Orientation {
    /// EXIF orientation number for Vision.
    var exifValue: Int {
        switch self {
        case .up: 1
        case .upMirrored: 2
        case .down: 3
        case .downMirrored: 4
        case .leftMirrored: 5
        case .right: 6
        case .rightMirrored: 7
        case .left: 8
        @unknown default: 1
        }
    }
}
