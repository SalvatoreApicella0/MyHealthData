import Foundation
@preconcurrency import CoreBluetooth
import Observation

struct SmartScaleReading: Equatable, Sendable, Identifiable {
    let id: String
    let deviceID: UUID
    let deviceName: String
    let protocolVariant: String
    let weightKilograms: Double
    let impedanceOhms: Double?
    let rawBodySignalCode: UInt16?
    let capturedAt: Date
    let rawManufacturerData: String
}

struct SmartScaleDevice: Equatable, Sendable, Identifiable {
    let id: UUID
    var name: String
    var rssi: Int
    var serviceUUIDs: [String]
    var manufacturerData: String?
    var protocolHint: String?
    var lastSeenAt: Date
}

enum OKOKAdvertisementParser {
    static func parse(
        manufacturerData: Data,
        deviceID: UUID = UUID(),
        deviceName: String? = nil,
        capturedAt: Date = .now
    ) -> SmartScaleReading? {
        guard manufacturerData.count >= 4 else { return nil }

        let bytes = [UInt8](manufacturerData)
        let companyID = UInt16(bytes[0]) | (UInt16(bytes[1]) << 8)
        let payload = Array(bytes.dropFirst(2))
        let name = deviceName?.trimmingCharacters(in: .whitespacesAndNewlines)
        let displayName = name?.isEmpty == false ? name! : "Bilancia OKOK"
        let raw = manufacturerData.hexString

        if companyID == 0x20CA, let values = parseV20(payload) {
            return reading(
                deviceID: deviceID,
                name: displayName,
                variant: "OKOK V20",
                weight: values.weight,
                impedance: values.impedance,
                date: capturedAt,
                raw: raw
            )
        }

        if companyID == 0x11CA, let weight = parseV11(payload) {
            return reading(deviceID: deviceID, name: displayName, variant: "OKOK V11", weight: weight, date: capturedAt, raw: raw)
        }

        if companyID == 0xF0FF, let weight = parseVF0(payload) {
            return reading(deviceID: deviceID, name: displayName, variant: "OKOK VF0", weight: weight, date: capturedAt, raw: raw)
        }

        if companyID & 0x00FF == 0x00C0, let values = parseC0(payload) {
            return reading(
                deviceID: deviceID,
                name: displayName,
                variant: "OKOK C0",
                weight: values.weight,
                rawBodySignalCode: values.rawBodySignalCode,
                date: capturedAt,
                raw: raw
            )
        }

        return nil
    }

    static func protocolHint(manufacturerData: Data?, deviceName: String?) -> String? {
        if let data = manufacturerData, data.count >= 2 {
            let bytes = [UInt8](data)
            let companyID = UInt16(bytes[0]) | (UInt16(bytes[1]) << 8)
            switch companyID {
            case 0x20CA: return "Possibile OKOK V20"
            case 0x11CA: return "Possibile OKOK V11"
            case 0xF0FF: return "Possibile OKOK VF0"
            default: break
            }
            if companyID & 0x00FF == 0x00C0 { return "Possibile OKOK C0" }
        }

        let normalized = deviceName?.lowercased() ?? ""
        if ["yoda0", "yoda1", "chipsea-ble", "adv"].contains(where: normalized.contains) {
            return "Nome compatibile con OKOK"
        }
        return nil
    }

    private static func parseV20(_ payload: [UInt8]) -> (weight: Double, impedance: Double?)? {
        guard payload.count == 19, payload[6] & 0x01 != 0 else { return nil }
        var checksum: UInt8 = 0x20
        for byte in payload[0..<12] { checksum ^= byte }
        guard checksum == payload[12] else { return nil }

        let divisor = payload[6] & 0x04 != 0 ? 100.0 : 10.0
        let weight = Double(unsigned16BE(payload[8], payload[9])) / divisor
        let impedanceRaw = unsigned16BE(payload[10], payload[11])
        let impedance = impedanceRaw > 0 ? Double(impedanceRaw) / 10.0 : nil
        return validWeight(weight) ? (weight, impedance) : nil
    }

    private static func parseV11(_ payload: [UInt8]) -> Double? {
        guard payload.count == 23 else { return nil }
        var checksum: UInt8 = 0xCA ^ 0x11
        for byte in payload[0..<16] { checksum ^= byte }
        guard checksum == payload[16] else { return nil }

        let properties = payload[9]
        let divisor: Double = switch (properties >> 1) & 0x03 {
        case 1: 1
        case 2: 100
        default: 10
        }
        let raw = Double(unsigned16BE(payload[3], payload[4]))
        let weight = kilograms(raw: raw, divisor: divisor, unitCode: (properties >> 3) & 0x03, stoneByte: payload[3], poundByte: payload[4])
        return weight.flatMap { validWeight($0) ? $0 : nil }
    }

    private static func parseVF0(_ payload: [UInt8]) -> Double? {
        guard payload.count >= 4 else { return nil }
        let weight = Double(unsigned16BE(payload[3], payload[2])) / 10.0
        return validWeight(weight) ? weight : nil
    }

    private static func parseC0(_ payload: [UInt8]) -> (weight: Double, rawBodySignalCode: UInt16)? {
        guard payload.count >= 13 else { return nil }
        let attributes = payload[6]
        guard attributes & 0x01 != 0 else { return nil }

        let divisor: Double = switch (attributes >> 1) & 0x03 {
        case 1: 1
        case 2: 100
        default: 10
        }
        let raw = Double(unsigned16BE(payload[0], payload[1]))
        let weight = kilograms(raw: raw, divisor: divisor, unitCode: (attributes >> 3) & 0x03, stoneByte: payload[0], poundByte: payload[1])
        guard let weight, validWeight(weight) else { return nil }
        return (weight, unsigned16BE(payload[2], payload[3]))
    }

    private static func kilograms(raw: Double, divisor: Double, unitCode: UInt8, stoneByte: UInt8, poundByte: UInt8) -> Double? {
        switch unitCode {
        case 0: return raw / divisor
        case 1: return raw / divisor / 2.0
        case 2: return raw / divisor / 2.204_622_621_8
        case 3:
            return Double(stoneByte) * 6.350_293_18 + Double(poundByte) / divisor * 0.453_592_37
        default: return nil
        }
    }

    private static func unsigned16BE(_ high: UInt8, _ low: UInt8) -> UInt16 {
        (UInt16(high) << 8) | UInt16(low)
    }

    private static func validWeight(_ value: Double) -> Bool {
        value >= 2 && value <= 400
    }

    private static func reading(
        deviceID: UUID,
        name: String,
        variant: String,
        weight: Double,
        impedance: Double? = nil,
        rawBodySignalCode: UInt16? = nil,
        date: Date,
        raw: String
    ) -> SmartScaleReading {
        SmartScaleReading(
            id: "\(deviceID.uuidString)-\(raw)-\(Int(date.timeIntervalSince1970))",
            deviceID: deviceID,
            deviceName: name,
            protocolVariant: variant,
            weightKilograms: weight,
            impedanceOhms: impedance,
            rawBodySignalCode: rawBodySignalCode,
            capturedAt: date,
            rawManufacturerData: raw
        )
    }
}

@MainActor
@Observable
final class SmartScaleBluetoothScanner: NSObject, CBCentralManagerDelegate {
    private(set) var bluetoothState = CBManagerState.unknown
    private(set) var isScanning = false
    private(set) var secondsRemaining = 30
    private(set) var devices: [SmartScaleDevice] = []
    private(set) var latestReading: SmartScaleReading?
    private(set) var diagnosticLines: [String] = []

    private var centralManager: CBCentralManager!
    private var countdownTask: Task<Void, Never>?

    override init() {
        super.init()
        centralManager = CBCentralManager(delegate: self, queue: nil)
    }

    func startScan(duration: Int = 30) {
        guard bluetoothState == .poweredOn else { return }
        countdownTask?.cancel()
        devices.removeAll()
        diagnosticLines.removeAll()
        latestReading = nil
        secondsRemaining = duration
        isScanning = true
        appendDiagnostic("Scansione avviata")
        centralManager.scanForPeripherals(
            withServices: nil,
            options: [CBCentralManagerScanOptionAllowDuplicatesKey: true]
        )

        countdownTask = Task { [weak self] in
            guard let self else { return }
            while !Task.isCancelled, self.secondsRemaining > 0 {
                try? await Task.sleep(for: .seconds(1))
                guard !Task.isCancelled else { return }
                self.secondsRemaining -= 1
            }
            if !Task.isCancelled { self.stopScan() }
        }
    }

    func stopScan() {
        countdownTask?.cancel()
        countdownTask = nil
        centralManager.stopScan()
        if isScanning { appendDiagnostic("Scansione terminata") }
        isScanning = false
    }

    func clearReading() {
        latestReading = nil
    }

    var diagnosticReport: String {
        let deviceSummary = devices.map { device in
            let services = device.serviceUUIDs.isEmpty ? "-" : device.serviceUUIDs.joined(separator: ", ")
            return "\(device.name) | id=\(device.id.uuidString) | RSSI=\(device.rssi) | servizi=\(services) | manufacturer=\(device.manufacturerData ?? "-")"
        }
        return (["MyHealthData - Diagnostica bilancia BLE", "Stato: \(stateLabel)", ""] + deviceSummary + [""] + diagnosticLines).joined(separator: "\n")
    }

    var stateLabel: String {
        switch bluetoothState {
        case .unknown: "Inizializzazione"
        case .resetting: "Ripristino Bluetooth"
        case .unsupported: "Bluetooth LE non supportato"
        case .unauthorized: "Permesso Bluetooth negato"
        case .poweredOff: "Bluetooth spento"
        case .poweredOn: "Pronto"
        @unknown default: "Stato sconosciuto"
        }
    }

    nonisolated func centralManagerDidUpdateState(_ central: CBCentralManager) {
        let state = central.state
        Task { @MainActor [weak self] in
            self?.bluetoothState = state
            if state != .poweredOn { self?.stopScan() }
        }
    }

    nonisolated func centralManager(
        _ central: CBCentralManager,
        didDiscover peripheral: CBPeripheral,
        advertisementData: [String: Any],
        rssi RSSI: NSNumber
    ) {
        let identifier = peripheral.identifier
        let peripheralName = peripheral.name
        let localName = advertisementData[CBAdvertisementDataLocalNameKey] as? String
        let manufacturerData = advertisementData[CBAdvertisementDataManufacturerDataKey] as? Data
        let serviceUUIDs = (advertisementData[CBAdvertisementDataServiceUUIDsKey] as? [CBUUID] ?? []).map(\.uuidString)
        let rssi = RSSI.intValue
        let capturedAt = Date()

        Task { @MainActor [weak self] in
            self?.processAdvertisement(
                identifier: identifier,
                name: localName ?? peripheralName,
                manufacturerData: manufacturerData,
                serviceUUIDs: serviceUUIDs,
                rssi: rssi,
                capturedAt: capturedAt
            )
        }
    }

    private func processAdvertisement(
        identifier: UUID,
        name: String?,
        manufacturerData: Data?,
        serviceUUIDs: [String],
        rssi: Int,
        capturedAt: Date
    ) {
        let displayName = name?.nilIfBlank ?? "Dispositivo senza nome"
        let raw = manufacturerData?.hexString
        let hint = OKOKAdvertisementParser.protocolHint(manufacturerData: manufacturerData, deviceName: displayName)
        let device = SmartScaleDevice(
            id: identifier,
            name: displayName,
            rssi: rssi,
            serviceUUIDs: serviceUUIDs,
            manufacturerData: raw,
            protocolHint: hint,
            lastSeenAt: capturedAt
        )

        if let index = devices.firstIndex(where: { $0.id == identifier }) {
            devices[index] = device
        } else {
            devices.append(device)
        }
        devices.sort { lhs, rhs in
            if (lhs.protocolHint != nil) != (rhs.protocolHint != nil) { return lhs.protocolHint != nil }
            return lhs.rssi > rhs.rssi
        }

        if let manufacturerData,
           let reading = OKOKAdvertisementParser.parse(
               manufacturerData: manufacturerData,
               deviceID: identifier,
               deviceName: displayName,
               capturedAt: capturedAt
           ) {
            if latestReading?.id != reading.id {
                latestReading = reading
                let impedance = reading.impedanceOhms.map { String($0) } ?? "-"
                let bodySignal = reading.rawBodySignalCode.map { String(format: "0x%04X", $0) } ?? "-"
                appendDiagnostic("MISURA \(reading.protocolVariant): \(reading.weightKilograms) kg, impedenza=\(impedance) Ω, codiceBio=\(bodySignal), raw=\(reading.rawManufacturerData)")
            }
        } else if hint != nil, let raw {
            appendDiagnostic("FRAME \(displayName): RSSI=\(rssi), raw=\(raw)")
        }
    }

    private func appendDiagnostic(_ line: String) {
        let timestamp = Date.now.formatted(date: .omitted, time: .standard)
        diagnosticLines.append("[\(timestamp)] \(line)")
        if diagnosticLines.count > 120 {
            diagnosticLines.removeFirst(diagnosticLines.count - 120)
        }
    }
}

private extension Data {
    var hexString: String {
        map { String(format: "%02X", $0) }.joined(separator: " ")
    }
}
