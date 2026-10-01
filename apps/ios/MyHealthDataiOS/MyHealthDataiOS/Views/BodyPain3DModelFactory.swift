import SceneKit
import UIKit

enum DigitalTwinModelFactory {
    static func makeBodyModelNode() -> SCNNode? {
        guard let url = Bundle.main.url(forResource: "FinalBaseMesh", withExtension: "obj", subdirectory: "Models")
            ?? Bundle.main.url(forResource: "FinalBaseMesh", withExtension: "obj")
        else {
            return nil
        }

        guard
            let sceneSource = SCNSceneSource(url: url, options: nil),
            let scene = sceneSource.scene(options: nil)
        else {
            return nil
        }

        let container = SCNNode()
        for child in scene.rootNode.childNodes {
            container.addChildNode(child)
        }

        normalize(container, targetHeight: 3.42, floorY: -1.48)
        applyBodyMaterial(to: container)
        return container
    }

    static func makeRocketboxModelNode() -> SCNNode? {
        guard let url = modelResourceURL(named: "RocketboxHuman", extension: "obj") else {
            return nil
        }

        guard
            let sceneSource = SCNSceneSource(url: url, options: [
                .checkConsistency: true,
                .flattenScene: false
            ]),
            let scene = sceneSource.scene(options: nil)
        else {
            return nil
        }

        let container = SCNNode()
        container.name = "rocketbox-human"
        for child in scene.rootNode.childNodes {
            container.addChildNode(child)
        }

        normalize(container, targetHeight: 3.42, floorY: -1.48)
        applyRocketboxMaterials(to: container)
        return container
    }

    static func makeFallbackBodyNode() -> SCNNode {
        let node = SCNNode(geometry: SCNCapsule(capRadius: 0.45, height: 3.2))
        node.position = SCNVector3(0, 0.02, 0)
        node.geometry?.firstMaterial = material(color: UIColor(red: 0.78, green: 0.84, blue: 0.82, alpha: 1), roughness: 0.78)
        return node
    }

    private static func normalize(_ node: SCNNode, targetHeight: Float, floorY: Float) {
        let (minBounds, maxBounds) = node.boundingBox
        let height = maxBounds.y - minBounds.y
        guard height > 0 else { return }

        let scale = targetHeight / height
        let centerX = (minBounds.x + maxBounds.x) / 2
        let centerZ = (minBounds.z + maxBounds.z) / 2

        node.scale = SCNVector3(scale, scale, scale)
        node.position = SCNVector3(
            -centerX * scale,
            floorY - minBounds.y * scale,
            -centerZ * scale
        )
    }

    private static func applyBodyMaterial(to node: SCNNode) {
        node.geometry?.materials = [skinMaterial()]
        for child in node.childNodes {
            applyBodyMaterial(to: child)
        }
    }

    private static func skinMaterial() -> SCNMaterial {
        let material = SCNMaterial()
        material.diffuse.contents = UIColor(red: 0.66, green: 0.48, blue: 0.38, alpha: 1)
        material.ambient.contents = UIColor(red: 0.36, green: 0.25, blue: 0.2, alpha: 1)
        material.specular.contents = UIColor.black
        material.roughness.contents = 0.92
        material.metalness.contents = 0.0
        material.lightingModel = .lambert
        material.isDoubleSided = true
        return material
    }

    private static func applyRocketboxMaterials(to node: SCNNode) {
        if let geometry = node.geometry {
            geometry.materials = geometry.materials.map { original in
                switch original.name {
                case "f001_body":
                    return texturedMaterial(
                        diffuse: "f001_body_color",
                        normal: "f001_body_normal",
                        fallback: UIColor(red: 0.62, green: 0.45, blue: 0.35, alpha: 1)
                    )
                case "f001_head":
                    return texturedMaterial(
                        diffuse: "f001_head_color",
                        normal: "f001_head_normal",
                        fallback: UIColor(red: 0.66, green: 0.48, blue: 0.38, alpha: 1)
                    )
                default:
                    return texturedMaterial(
                        diffuse: "f001_body_color",
                        normal: "f001_body_normal",
                        fallback: UIColor(red: 0.12, green: 0.16, blue: 0.18, alpha: 1)
                    )
                }
            }
        }

        for child in node.childNodes {
            applyRocketboxMaterials(to: child)
        }
    }

    private static func texturedMaterial(diffuse: String, normal: String, fallback: UIColor) -> SCNMaterial {
        let material = SCNMaterial()
        material.diffuse.contents = modelTexture(named: diffuse) ?? fallback
        material.normal.contents = modelTexture(named: normal)
        material.specular.contents = UIColor(white: 0.08, alpha: 1)
        material.roughness.contents = 0.82
        material.metalness.contents = 0.0
        material.lightingModel = .physicallyBased
        material.isDoubleSided = true
        return material
    }

    private static func modelTexture(named name: String) -> UIImage? {
        guard let url = modelResourceURL(named: name, extension: "jpg") else {
            return nil
        }
        return UIImage(contentsOfFile: url.path)
    }

    private static func modelResourceURL(named name: String, extension fileExtension: String) -> URL? {
        Bundle.main.url(forResource: name, withExtension: fileExtension, subdirectory: "Models/RocketboxHuman")
            ?? Bundle.main.url(forResource: name, withExtension: fileExtension)
    }
}
