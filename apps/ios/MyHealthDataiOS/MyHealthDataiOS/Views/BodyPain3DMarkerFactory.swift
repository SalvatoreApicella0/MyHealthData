import SceneKit
import UIKit

enum DigitalTwinMarkerFactory {
    static func makePointMarker(point: BodyPoint, color: UIColor, radius: CGFloat, labelCount: Int? = nil) -> SCNNode {
        let marker = SCNNode()
        marker.name = "precise-body-point"
        marker.position = SCNVector3(Float(point.x), Float(point.y), Float(point.z))

        let sphere = SCNNode(geometry: SCNSphere(radius: radius))
        sphere.geometry?.firstMaterial = material(color: color, emission: color.withAlphaComponent(0.38), roughness: 0.28)
        marker.addChildNode(sphere)

        if let labelCount {
            let badge = SCNNode(geometry: SCNPlane(width: 0.28, height: 0.13))
            badge.position = SCNVector3(0, Float(radius * 4.4), 0)
            badge.constraints = [SCNBillboardConstraint()]
            badge.geometry?.firstMaterial = material(image: badgeImage(symbol: "*", count: labelCount, color: color))
            marker.addChildNode(badge)
        }

        return marker
    }

    static func makeHotspotNode(for hotspot: BodyPain3DHotspot) -> SCNNode {
        let container = SCNNode()
        container.name = hotspot.region.rawValue
        container.position = hotspot.position

        let hitSphere = SCNNode(geometry: SCNSphere(radius: hotspot.hitRadius))
        hitSphere.name = hotspot.region.rawValue
        hitSphere.opacity = 0.001
        hitSphere.geometry?.firstMaterial = material(color: UIColor.white.withAlphaComponent(0.05))
        container.addChildNode(hitSphere)

        let point = SCNNode(geometry: SCNSphere(radius: 0.024))
        point.name = hotspot.region.rawValue
        point.geometry?.firstMaterial = material(color: UIColor(red: 0.07, green: 0.43, blue: 0.48, alpha: 0.9), emission: UIColor(red: 0.07, green: 0.43, blue: 0.48, alpha: 0.25), roughness: 0.35)
        container.addChildNode(point)

        let ring = SCNNode(geometry: SCNTorus(ringRadius: 0.048, pipeRadius: 0.004))
        ring.name = hotspot.region.rawValue
        ring.constraints = [SCNBillboardConstraint()]
        ring.geometry?.firstMaterial = material(color: UIColor.white.withAlphaComponent(0.8), emission: UIColor(red: 0.07, green: 0.43, blue: 0.48, alpha: 0.18))
        container.addChildNode(ring)

        return container
    }

    static func makeMarker(
        hotspot: BodyPain3DHotspot,
        stats: DigitalTwinEventStats,
        anchors: [BodyRegionId: SCNVector3]
    ) -> SCNNode {
        let markerColor = eventColor(type: stats.dominantType, intensity: stats.maxIntensity ?? 0)
        let marker = SCNNode()
        marker.name = hotspot.region.rawValue
        let anchor = anchors[hotspot.region] ?? hotspot.position
        marker.position = anchor + hotspot.markerOffset

        let badge = SCNNode(geometry: SCNPlane(width: 0.34, height: 0.15))
        badge.name = hotspot.region.rawValue
        badge.constraints = [SCNBillboardConstraint()]
        badge.geometry?.firstMaterial = material(image: badgeImage(symbol: eventSymbol(stats.dominantType), count: stats.count, color: markerColor))
        marker.addChildNode(badge)

        return marker
    }

    static func eventStats(for region: BodyRegionId, events: [HealthEvent]) -> DigitalTwinEventStats {
        let regionEvents = events.filter { eventRegion($0) == region }
        let dominant = regionEvents.max { ($0.intensity ?? 0) < ($1.intensity ?? 0) }
        return DigitalTwinEventStats(
            count: regionEvents.count,
            maxIntensity: regionEvents.compactMap(\.intensity).max(),
            dominantType: dominant?.type
        )
    }

    static func eventRegion(_ event: HealthEvent) -> BodyRegionId? {
        event.bodyRegionId ?? event.bodyPoint?.approximateRegionId
    }

    static func eventColor(type: EventType?, intensity: Int) -> UIColor {
        if intensity >= 8 {
            return UIColor(red: 1.0, green: 0.16, blue: 0.32, alpha: 1)
        }

        switch type {
        case .pain:
            return UIColor(red: 0.9, green: 0.2, blue: 0.23, alpha: 1)
        case .burning:
            return UIColor(red: 0.95, green: 0.43, blue: 0.16, alpha: 1)
        case .swelling:
            return UIColor(red: 0.56, green: 0.36, blue: 0.88, alpha: 1)
        case .stiffness:
            return UIColor(red: 0.07, green: 0.43, blue: 0.48, alpha: 1)
        case .tingling:
            return UIColor(red: 0.18, green: 0.37, blue: 0.56, alpha: 1)
        case .wound:
            return UIColor(red: 0.72, green: 0.15, blue: 0.2, alpha: 1)
        default:
            return UIColor(red: 0.07, green: 0.43, blue: 0.48, alpha: 1)
        }
    }

    private static func eventSymbol(_ type: EventType?) -> String {
        switch type {
        case .pain: "!"
        case .burning: "~"
        case .swelling: "+"
        case .stiffness: "="
        case .tingling: "*"
        case .wound: "x"
        default: "*"
        }
    }
}
