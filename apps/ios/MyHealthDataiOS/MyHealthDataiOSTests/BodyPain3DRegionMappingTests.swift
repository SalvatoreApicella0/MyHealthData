import SceneKit
import Testing
@testable import MyHealthDataiOS

struct BodyPain3DRegionMappingTests {
    @Test func legacyPointUsesNearestAnatomicalHotspot() {
        let point = SCNVector3(0, 1.73, 0.08)

        #expect(BodyPain3DRegionMapping.nearestLegacyRegion(to: point) == .head)
    }

    @Test func atlasPartRulesPreferNamedRegionsAndRespectLaterality() {
        let part = BodyParts3DPart(
            id: "left-patella",
            name: "Left patella",
            conceptId: "",
            system: "skeletal",
            chunk: 0,
            positions: 0,
            normals: 0,
            indices: 0,
            vertexCount: 0,
            indexCount: 0,
            bounds: [[0.2, 0.9, 0], [0.3, 1.0, 0]]
        )

        #expect(BodyPain3DRegionMapping.regionForPart(part) == .leftKnee)
    }

    @Test func skinFallbackUsesAtlasCoordinates() {
        let part = BodyParts3DPart(
            id: "skin-head",
            name: "skin",
            conceptId: "",
            system: "integumentary",
            chunk: 0,
            positions: 0,
            normals: 0,
            indices: 0,
            vertexCount: 0,
            indexCount: 0,
            bounds: [[0, 0, 0], [0, 0, 0]]
        )

        #expect(BodyPain3DRegionMapping.regionForTap(part: part, point: SCNVector3(0, 1.7, 0)) == .head)
    }
}
