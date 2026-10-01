import SceneKit
import UIKit

struct DigitalTwinEventStats {
    var count: Int
    var maxIntensity: Int?
    var dominantType: EventType?
}

extension SCNVector3 {
    static func + (left: SCNVector3, right: SCNVector3) -> SCNVector3 {
        SCNVector3(left.x + right.x, left.y + right.y, left.z + right.z)
    }

    var normalized: SCNVector3 {
        let length = sqrt(x * x + y * y + z * z)
        guard length > 0 else { return self }
        return SCNVector3(x / length, y / length, z / length)
    }

    func scaled(by value: Float) -> SCNVector3 {
        SCNVector3(x * value, y * value, z * value)
    }
}

func material(color: UIColor, emission: UIColor = .black, roughness: CGFloat = 0.52) -> SCNMaterial {
    let material = SCNMaterial()
    material.diffuse.contents = color
    material.emission.contents = emission
    material.roughness.contents = roughness
    material.metalness.contents = 0.02
    return material
}

func material(image: UIImage) -> SCNMaterial {
    let material = SCNMaterial()
    material.diffuse.contents = image
    material.lightingModel = .constant
    material.isDoubleSided = true
    return material
}

func badgeImage(symbol: String, count: Int, color: UIColor) -> UIImage {
    let size = CGSize(width: 128, height: 54)
    let renderer = UIGraphicsImageRenderer(size: size)
    return renderer.image { context in
        UIColor.white.withAlphaComponent(0.94).setFill()
        UIBezierPath(roundedRect: CGRect(origin: .zero, size: size), cornerRadius: 24).fill()

        color.setFill()
        UIBezierPath(ovalIn: CGRect(x: 9, y: 9, width: 36, height: 36)).fill()

        let symbolAttributes: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 22, weight: .heavy),
            .foregroundColor: UIColor.white
        ]
        let symbolSize = symbol.size(withAttributes: symbolAttributes)
        symbol.draw(
            at: CGPoint(x: 27 - symbolSize.width / 2, y: 27 - symbolSize.height / 2),
            withAttributes: symbolAttributes
        )

        let text = "\(count)"
        let countAttributes: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 26, weight: .bold),
            .foregroundColor: UIColor(red: 0.06, green: 0.09, blue: 0.12, alpha: 1)
        ]
        text.draw(at: CGPoint(x: 56, y: 11), withAttributes: countAttributes)

        context.cgContext.setStrokeColor(UIColor.black.withAlphaComponent(0.08).cgColor)
        context.cgContext.setLineWidth(1)
        UIBezierPath(roundedRect: CGRect(x: 0.5, y: 0.5, width: size.width - 1, height: size.height - 1), cornerRadius: 24).stroke()
    }
}
