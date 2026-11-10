import AVFoundation
import SwiftUI
import UIKit
import Vision
import VisionKit

/// Live camera barcode reader for the back of a notebook (EAN/UPC/Code 128). Calls `onFound` once.
struct BarcodeScanner: UIViewControllerRepresentable {
    let onFound: (String) -> Void

    /// The device can run the live scanner (a real iPhone; never the Simulator). Camera permission is asked on tap:
    /// `DataScannerViewController.isAvailable` stays false until it's granted, so it can't decide whether to show the button.
    @MainActor static var isSupported: Bool { DataScannerViewController.isSupported }

    enum Access { case granted, denied }

    /// Asks for the camera if needed. Denied means the customer must allow it in Settings.
    static func requestAccess() async -> Access {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized: return .granted
        case .notDetermined: return await AVCaptureDevice.requestAccess(for: .video) ? .granted : .denied
        default: return .denied
        }
    }

    func makeUIViewController(context: Context) -> DataScannerViewController {
        let vc = DataScannerViewController(
            recognizedDataTypes: [.barcode(symbologies: [.ean13, .ean8, .upce, .code128, .code39, .qr])],
            qualityLevel: .balanced,
            recognizesMultipleItems: false,
            isHighFrameRateTrackingEnabled: false,
            isHighlightingEnabled: true
        )
        vc.delegate = context.coordinator
        // Start once the camera view is actually on screen (starting earlier can be silently refused).
        Task { @MainActor in
            for _ in 0..<10 where !vc.isScanning {
                try? await Task.sleep(for: .milliseconds(200))
                if vc.view.window != nil { try? vc.startScanning() }
            }
        }
        return vc
    }

    func updateUIViewController(_ vc: DataScannerViewController, context: Context) {}

    static func dismantleUIViewController(_ vc: DataScannerViewController, coordinator: Coordinator) {
        vc.stopScanning()
    }

    func makeCoordinator() -> Coordinator { Coordinator(onFound: onFound) }

    /// Reads a barcode from a still photo (works on every device and in the Simulator, where the live scanner can't run).
    static func read(from image: UIImage) async -> String? {
        guard let cg = image.cgImage else { return nil }
        let orientation = CGImagePropertyOrientation(rawValue: UInt32(image.imageOrientation.exifValue)) ?? .up
        // Try the newest reader, then the oldest one: the newer revisions fail in the Simulator and on some photos.
        for revision in [VNDetectBarcodesRequest.currentRevision, VNDetectBarcodesRequestRevision1] {
            let request = VNDetectBarcodesRequest()
            request.revision = revision
            do {
                try VNImageRequestHandler(cgImage: cg, orientation: orientation).perform([request])
            } catch {
                continue
            }
            if let code = (request.results ?? []).compactMap(\.payloadStringValue).lazy.compactMap({ Coordinator.clean($0) }).first {
                return code
            }
        }
        return nil
    }

    final class Coordinator: NSObject, DataScannerViewControllerDelegate {
        let onFound: (String) -> Void
        private var done = false
        init(onFound: @escaping (String) -> Void) { self.onFound = onFound }

        func dataScanner(_ scanner: DataScannerViewController, didAdd items: [RecognizedItem], allItems: [RecognizedItem]) {
            take(items, from: scanner)
        }

        /// Tapping a highlighted barcode also picks it.
        func dataScanner(_ scanner: DataScannerViewController, didTapOn item: RecognizedItem) {
            take([item], from: scanner)
        }

        private func take(_ items: [RecognizedItem], from scanner: DataScannerViewController) {
            guard !done else { return }
            for item in items {
                if case let .barcode(code) = item, let value = code.payloadStringValue, let clean = Self.clean(value) {
                    done = true
                    scanner.stopScanning()
                    UINotificationFeedbackGenerator().notificationOccurred(.success)
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
