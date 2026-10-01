import SceneKit

enum DigitalTwinGeometryFactory {
    static func makeGeometry(from mesh: BodyParts3DMeshData, material: SCNMaterial?) -> SCNGeometry? {
        let vertexCount = mesh.part.vertexCount
        let indexCount = mesh.part.indexCount
        guard let material,
              vertexCount > 0, indexCount >= 3, indexCount.isMultiple(of: 3),
              mesh.positions.count == vertexCount * 12,
              mesh.normals.count == vertexCount * 12,
              mesh.indices.count == indexCount * 4 else { return nil }

        let vertices = SCNGeometrySource(
            data: mesh.positions,
            semantic: .vertex,
            vectorCount: vertexCount,
            usesFloatComponents: true,
            componentsPerVector: 3,
            bytesPerComponent: 4,
            dataOffset: 0,
            dataStride: 12
        )
        let normals = SCNGeometrySource(
            data: mesh.normals,
            semantic: .normal,
            vectorCount: vertexCount,
            usesFloatComponents: true,
            componentsPerVector: 3,
            bytesPerComponent: 4,
            dataOffset: 0,
            dataStride: 12
        )
        let triangles = SCNGeometryElement(
            data: mesh.indices,
            primitiveType: .triangles,
            primitiveCount: indexCount / 3,
            bytesPerIndex: 4
        )
        let geometry = SCNGeometry(sources: [vertices, normals], elements: [triangles])
        geometry.materials = [material]
        return geometry
    }
}
