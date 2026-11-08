import SwiftUI
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
