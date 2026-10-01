import AVFoundation
import SwiftUI

#if os(iOS) && !targetEnvironment(macCatalyst)
struct HubPairingScannerView: UIViewControllerRepresentable {
    let onCode: (String) -> Void
    let onFailure: (String) -> Void

    func makeUIViewController(context: Context) -> ScannerController {
        let controller = ScannerController()
        controller.onCode = onCode
        controller.onFailure = onFailure
        return controller
    }

    func updateUIViewController(_ uiViewController: ScannerController, context: Context) {}
}

final class ScannerController: UIViewController, AVCaptureMetadataOutputObjectsDelegate {
    var onCode: ((String) -> Void)?
    var onFailure: ((String) -> Void)?
    private let capture = CaptureSessionLifecycle()
    private var previewLayer: AVCaptureVideoPreviewLayer?
    private var didReadCode = false

    override func viewDidLoad() {
        super.viewDidLoad()
        Task { @MainActor in await configureCamera() }
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        previewLayer?.frame = view.bounds
    }

    override func viewDidDisappear(_ animated: Bool) {
        super.viewDidDisappear(animated)
        capture.stop()
    }

    private func configureCamera() async {
        let granted: Bool
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized: granted = true
        case .notDetermined: granted = await AVCaptureDevice.requestAccess(for: .video)
        default: granted = false
        }
        guard granted else { onFailure?("Consenti l'accesso alla fotocamera per leggere il codice QR Hub."); return }
        guard viewIfLoaded?.window != nil else { return }
        do {
            // Configuration completes before the serial lifecycle queue starts.
            let session = capture.session
            guard let camera = AVCaptureDevice.default(for: .video) else { throw ScannerError.cameraUnavailable }
            let input = try AVCaptureDeviceInput(device: camera)
            guard session.canAddInput(input) else { throw ScannerError.cameraUnavailable }
            session.addInput(input)
            let output = AVCaptureMetadataOutput()
            guard session.canAddOutput(output) else { throw ScannerError.cameraUnavailable }
            session.addOutput(output)
            output.setMetadataObjectsDelegate(self, queue: .main)
            output.metadataObjectTypes = [.qr]
            let layer = AVCaptureVideoPreviewLayer(session: session)
            layer.videoGravity = .resizeAspectFill
            layer.frame = view.bounds
            view.layer.addSublayer(layer)
            previewLayer = layer
            capture.start()
        } catch { onFailure?("Fotocamera non disponibile per la scansione del QR Hub.") }
    }

    // The metadata callback fires on the capture queue, so the conformance must be
    // `nonisolated` under Swift 6 strict concurrency; state changes hop back to the
    // main actor explicitly.
    nonisolated func metadataOutput(_ output: AVCaptureMetadataOutput, didOutput metadataObjects: [AVMetadataObject], from connection: AVCaptureConnection) {
        guard let value = metadataObjects.compactMap({ ($0 as? AVMetadataMachineReadableCodeObject)?.stringValue }).first else { return }
        Task { @MainActor [weak self] in
            guard let self, !self.didReadCode else { return }
            self.didReadCode = true
            self.capture.stop()
            self.onCode?(value)
        }
    }

    private enum ScannerError: Error { case cameraUnavailable }
}

// AVFoundation owns the preview connection. App-side start/stop calls are
// serialized here, after configuration; no raw session crosses a Task boundary.
private final class CaptureSessionLifecycle: @unchecked Sendable {
    let session = AVCaptureSession()
    private let queue = DispatchQueue(label: "org.myhealthdata.camera-lifecycle", qos: .userInitiated)

    func start() { queue.async { [self] in session.startRunning() } }
    func stop() { queue.async { [self] in session.stopRunning() } }
}
#endif
