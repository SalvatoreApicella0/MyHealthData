import SceneKit

enum BodyPain3DRegionMapping {
    static let webBodyModelVersion = "bodyparts3d-4.0"
    static let legacyBodyModelVersion = "final-base-mesh-v1"

    private struct RegionRule {
        let regex: NSRegularExpression
        let region: BodyRegionId
        let isLateral: Bool

        init(_ pattern: String, _ region: BodyRegionId, _ isLateral: Bool) {
            do {
                self.regex = try NSRegularExpression(pattern: pattern, options: [.caseInsensitive])
            } catch {
                preconditionFailure("Body region regex is invalid (\(pattern)): \(error)")
            }
            self.region = region
            self.isLateral = isLateral
        }
    }

    private static let leftWordRegex = compiledBodyRegex(#"\bleft\b"#)
    private static let rightWordRegex = compiledBodyRegex(#"\bright\b"#)
    private static let regionRules: [RegionRule] = [
        RegionRule(#"\bpatella\b|\bknee\b"#, .leftKnee, true),
        RegionRule(#"femur"#, .leftLeg, true),
        RegionRule(#"\btibia\b|\bfibula\b"#, .leftLeg, true),
        RegionRule(#"\bankle\b|\btarsal\b(?! plate)|\bmetatarsal\b|\bcalcaneus\b|\btalus\b|\btoe\b|\bfoot\b"#, .leftFoot, true),
        RegionRule(#"\bhip bone\b|\bglute|\bbuttock|\bpelvi|\bilium\b|\bischium\b|\bpubis\b"#, .leftHip, true),
        RegionRule(#"\bsacrum\b|\blumbar\b"#, .lowerBack, false),
        RegionRule(#"\bthoracic vertebra\b|\brib\b|\bscapula\b|\btrapezius\b|\blatissimus\b"#, .upperBack, false),
        RegionRule(#"\bpectoral|\bsternum\b|\bmamma"#, .chest, false),
        RegionRule(#"\bheart\b|\blung\b|\bthymus\b"#, .chest, false),
        RegionRule(#"\bstomach\b|\bliver\b|\bintestin|\bcolon\b|\bcaecum\b|\bcecum\b|\brectum\b|\bappendix\b|\bspleen\b|\bpancreas\b|\bgallbladder\b|\bduodenum\b|\bjejunum\b|\bileum\b|(external|internal) oblique|\bkidney\b|\bbladder\b|\bprostate\b|\buterus\b|\bovary\b"#, .abdomen, false),
        RegionRule(#"\bcervical\b|\bthyroid\b|\btrachea\b|\blarynx\b|\bhyoid\b"#, .neck, false),
        RegionRule(#"\bskull\b|\bcranium\b|\bmandible\b|\bmaxilla\b|\bbrain\b|\beye\b|\bear\b|\bnose\b|\btongue\b|\btooth\b|\bteeth\b|\bgingiva\b|\blip\b|\bhair\b|\beyebrow\b|\bface\b|\bfacial\b"#, .head, false),
        RegionRule(#"\bclavicle\b|\bacromion\b|\bdeltoid\b"#, .leftShoulder, true),
        RegionRule(#"\bhumerus\b|\bradius\b|\bulna\b|\barm\b"#, .leftArm, true),
        RegionRule(#"\belbow\b"#, .leftElbow, true),
        RegionRule(#"\bcarpal\b|\bmetacarpal\b|\bfinger\b|\bthumb\b|\bhand\b"#, .leftHand, true)
    ]

    static let anatomicalHotspots: [BodyPain3DHotspot] = [
        .init(region: .head, position: .v(0, 1.73, 0.08), hitRadius: 0.24, markerOffset: .v(0.0, 0.28, 0.18)),
        .init(region: .neck, position: .v(0, 1.33, 0.12), hitRadius: 0.16, markerOffset: .v(0.0, 0.18, 0.18)),
        .init(region: .chest, position: .v(0, 0.86, 0.23), hitRadius: 0.25, markerOffset: .v(0.0, 0.16, 0.22)),
        .init(region: .abdomen, position: .v(0, 0.25, 0.26), hitRadius: 0.25, markerOffset: .v(0.0, 0.12, 0.2)),
        .init(region: .upperBack, position: .v(0, 0.84, -0.25), hitRadius: 0.24, markerOffset: .v(0.0, 0.14, -0.2)),
        .init(region: .lowerBack, position: .v(0, 0.18, -0.26), hitRadius: 0.22, markerOffset: .v(0.0, 0.12, -0.2)),
        .init(region: .rightShoulder, position: .v(-0.54, 1.03, 0.1), hitRadius: 0.17, markerOffset: .v(-0.12, 0.14, 0.18)),
        .init(region: .leftShoulder, position: .v(0.54, 1.03, 0.1), hitRadius: 0.17, markerOffset: .v(0.12, 0.14, 0.18)),
        .init(region: .rightArm, position: .v(-0.78, 0.43, 0.08), hitRadius: 0.18, markerOffset: .v(-0.14, 0.12, 0.18)),
        .init(region: .leftArm, position: .v(0.78, 0.43, 0.08), hitRadius: 0.18, markerOffset: .v(0.14, 0.12, 0.18)),
        .init(region: .rightElbow, position: .v(-0.86, 0.08, 0.08), hitRadius: 0.15, markerOffset: .v(-0.13, 0.12, 0.16)),
        .init(region: .leftElbow, position: .v(0.86, 0.08, 0.08), hitRadius: 0.15, markerOffset: .v(0.13, 0.12, 0.16)),
        .init(region: .rightHand, position: .v(-0.76, -0.52, 0.1), hitRadius: 0.17, markerOffset: .v(-0.12, 0.13, 0.16)),
        .init(region: .leftHand, position: .v(0.76, -0.52, 0.1), hitRadius: 0.17, markerOffset: .v(0.12, 0.13, 0.16)),
        .init(region: .rightHip, position: .v(-0.28, -0.36, 0.14), hitRadius: 0.18, markerOffset: .v(-0.1, 0.12, 0.17)),
        .init(region: .leftHip, position: .v(0.28, -0.36, 0.14), hitRadius: 0.18, markerOffset: .v(0.1, 0.12, 0.17)),
        .init(region: .rightLeg, position: .v(-0.27, -0.82, 0.1), hitRadius: 0.19, markerOffset: .v(-0.09, 0.13, 0.17)),
        .init(region: .leftLeg, position: .v(0.27, -0.82, 0.1), hitRadius: 0.19, markerOffset: .v(0.09, 0.13, 0.17)),
        .init(region: .rightKnee, position: .v(-0.24, -1.1, 0.16), hitRadius: 0.15, markerOffset: .v(-0.08, 0.12, 0.17)),
        .init(region: .leftKnee, position: .v(0.24, -1.1, 0.16), hitRadius: 0.15, markerOffset: .v(0.08, 0.12, 0.17)),
        .init(region: .rightFoot, position: .v(-0.25, -1.5, 0.25), hitRadius: 0.16, markerOffset: .v(-0.04, 0.12, 0.18)),
        .init(region: .leftFoot, position: .v(0.25, -1.5, 0.25), hitRadius: 0.16, markerOffset: .v(0.04, 0.12, 0.18))
    ]

    static func nearestLegacyRegion(to point: SCNVector3) -> BodyRegionId? {
        var best: (region: BodyRegionId, distance: Float)?
        for hotspot in anatomicalHotspots {
            let dx = hotspot.position.x - point.x
            let dy = hotspot.position.y - point.y
            let dz = hotspot.position.z - point.z
            let distance = sqrt(dx * dx + dy * dy + dz * dz)
            if best == nil || distance < best!.distance {
                best = (hotspot.region, distance)
            }
        }
        guard let best, best.distance <= 0.28 else { return nil }
        return best.region
    }

    /// Kept in lockstep with src/body3d/regionMapping.ts: part-name rules
    /// take precedence, then atlas bounds centroid and the point fallback.
    static func regionForTap(part: BodyParts3DPart, point: SCNVector3) -> BodyRegionId {
        if part.system == "integumentary" {
            return atlasRegionForPoint(point) ?? .chest
        }
        return regionForPart(part) ?? atlasRegionForPoint(point) ?? .chest
    }

    static func regionForPart(_ part: BodyParts3DPart) -> BodyRegionId? {
        guard part.system != "integumentary" else { return nil }
        let center = SCNVector3(
            (part.bounds[0][0] + part.bounds[1][0]) / 2,
            (part.bounds[0][1] + part.bounds[1][1]) / 2,
            (part.bounds[0][2] + part.bounds[1][2]) / 2
        )
        let name = part.name.lowercased()
        let side = atlasSide(name: name, x: center.x)
        let searchRange = NSRange(name.startIndex..<name.endIndex, in: name)
        for rule in regionRules where rule.regex.firstMatch(in: name, range: searchRange) != nil {
            return rule.isLateral ? sidedRegion(rule.region, side: side) : rule.region
        }
        return atlasRegionForPoint(center)
    }

    private static func atlasSide(name: String, x: Float) -> BodyPain3DAtlasSide {
        let range = NSRange(name.startIndex..<name.endIndex, in: name)
        if leftWordRegex.firstMatch(in: name, range: range) != nil { return .left }
        if rightWordRegex.firstMatch(in: name, range: range) != nil { return .right }
        if x > 0.03 { return .left }
        if x < -0.03 { return .right }
        return .mid
    }

    private static func sidedRegion(_ region: BodyRegionId, side: BodyPain3DAtlasSide) -> BodyRegionId {
        guard side != .mid else { return region }
        let prefix = side == .left ? "left_" : "right_"
        let raw = region.rawValue.hasPrefix("left_")
            ? prefix + String(region.rawValue.dropFirst("left_".count))
            : region.rawValue
        return BodyRegionId(rawValue: raw) ?? region
    }

    private static func atlasRegionForPoint(_ point: SCNVector3) -> BodyRegionId? {
        let lateral: (BodyRegionId) -> BodyRegionId = { sidedRegion($0, side: atlasSide(name: "", x: point.x)) }
        let axial = abs(point.x)
        if point.y >= 1.56 { return .head }
        if point.y >= 1.44 { return axial >= 0.135 ? lateral(.leftShoulder) : .neck }
        if point.y >= 1.15 {
            if axial >= 0.135 && point.y >= 1.3 { return lateral(.leftShoulder) }
            if axial >= 0.135 { return lateral(.leftArm) }
            return point.z >= 0 ? .chest : .upperBack
        }
        if point.y >= 1.03 {
            if axial >= 0.19 { return lateral(.leftElbow) }
            if axial >= 0.135 { return lateral(.leftArm) }
            return point.z >= 0 ? .abdomen : .lowerBack
        }
        if point.y >= 0.9 {
            if axial >= 0.19 { return lateral(.leftArm) }
            return point.z >= 0 ? .abdomen : .lowerBack
        }
        if point.y >= 0.8 {
            if axial >= 0.18 { return lateral(.leftHand) }
            if axial >= 0.03 { return lateral(.leftHip) }
            return point.z >= 0 ? .abdomen : .lowerBack
        }
        if point.y >= 0.52 {
            if axial >= 0.18 { return lateral(.leftHand) }
            return lateral(.leftLeg)
        }
        if point.y >= 0.4 { return lateral(.leftKnee) }
        if point.y >= 0.13 { return lateral(.leftLeg) }
        return lateral(.leftFoot)
    }

    private static func compiledBodyRegex(_ pattern: String) -> NSRegularExpression {
        do {
            return try NSRegularExpression(pattern: pattern, options: [.caseInsensitive])
        } catch {
            preconditionFailure("Body region regex is invalid (\(pattern)): \(error)")
        }
    }
}

struct BodyPain3DHotspot {
    var region: BodyRegionId
    var position: SCNVector3
    var hitRadius: CGFloat
    var markerOffset: SCNVector3
}

private enum BodyPain3DAtlasSide {
    case left
    case right
    case mid
}

private extension SCNVector3 {
    static func v(_ x: Float, _ y: Float, _ z: Float) -> SCNVector3 {
        SCNVector3(x, y, z)
    }
}
