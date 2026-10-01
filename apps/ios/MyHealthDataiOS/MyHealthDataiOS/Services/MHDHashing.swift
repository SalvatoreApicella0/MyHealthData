import CryptoKit
import Foundation

enum MHDHashing {
    private static let hexadecimalDigits = Array("0123456789abcdef")

    /// Returns the lowercase hexadecimal SHA-256 representation used by the
    /// Hub, export manifests, and local attachment metadata.
    static func sha256Hex(_ data: Data) -> String {
        let digest = SHA256.hash(data: data)
        var result = String()
        result.reserveCapacity(64)
        for byte in digest {
            result.append(hexadecimalDigits[Int(byte >> 4)])
            result.append(hexadecimalDigits[Int(byte & 0x0F)])
        }
        return result
    }

    static func sha256Hex(_ value: String) -> String {
        sha256Hex(Data(value.utf8))
    }
}
