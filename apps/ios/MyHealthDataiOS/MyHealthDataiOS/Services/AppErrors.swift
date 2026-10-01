import Foundation

enum AppError: LocalizedError {
    case keychain(String)
    case crypto(String)
    case storage(String)
    case importFailed(String)
    case healthKitUnavailable

    var errorDescription: String? {
        switch self {
        case .keychain(let message): "Keychain error: \(message)"
        case .crypto(let message): "Crypto error: \(message)"
        case .storage(let message): "Storage error: \(message)"
        case .importFailed(let message): "Import failed: \(message)"
        case .healthKitUnavailable: "HealthKit is not available on this device."
        }
    }
}
