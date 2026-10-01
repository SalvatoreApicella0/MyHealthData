import SwiftUI

struct BodyMeasurementsScaleControl: View {
    let scanner: SmartScaleBluetoothScanner
    @Binding var resultText: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Button {
                if scanner.isScanning {
                    scanner.stopScan()
                } else {
                    resultText = nil
                    scanner.startScan()
                }
            } label: {
                HStack(spacing: 12) {
                    if scanner.isScanning {
                        ProgressView().tint(.white)
                    } else {
                        Image(systemName: resultText == nil ? "scalemass.fill" : "checkmark.circle.fill")
                    }
                    VStack(alignment: .leading, spacing: 2) {
                        Text(resultText ?? (scanner.isScanning ? "Sali sulla bilancia" : "Inizia a pesare"))
                            .font(.headline)
                        if scanner.isScanning {
                            Text("Ricerca automatica · \(scanner.secondsRemaining) s").font(.caption)
                        }
                    }
                    Spacer()
                    if scanner.isScanning { Image(systemName: "xmark") }
                }
                .frame(maxWidth: .infinity)
                .padding(.horizontal, 4)
                .padding(.vertical, 7)
            }
            .mhdGlassButton(prominent: true)
            .disabled(scanner.bluetoothState != .poweredOn && !scanner.isScanning)

            Label("Questa bilancia trasmette un peso valido; l'impedenza e la composizione non sono disponibili.", systemImage: "info.circle")
                .font(.caption).foregroundStyle(.secondary)

            if let bluetoothMessage {
                Label(bluetoothMessage.text, systemImage: bluetoothMessage.symbol)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.orange)
            }
        }
    }

    private var bluetoothMessage: (text: String, symbol: String)? {
        switch scanner.bluetoothState {
        case .poweredOff:
            ("Attiva Bluetooth per usare la bilancia.", "bolt.horizontal.circle")
        case .unauthorized:
            ("Consenti l'accesso al Bluetooth nelle Impostazioni di sistema.", "lock.circle")
        case .unsupported:
            ("Il Bluetooth di questo dispositivo non supporta la bilancia.", "exclamationmark.triangle")
        default:
            nil
        }
    }
}
