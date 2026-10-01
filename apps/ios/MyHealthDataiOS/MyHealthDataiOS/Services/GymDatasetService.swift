import Foundation

struct GymDatasetService {
    private let exercises: [GymExercise]

    init() {
        guard let url = Bundle.main.url(forResource: "exercises", withExtension: "json", subdirectory: "GymDataset")
            ?? Bundle.main.url(forResource: "exercises", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let decoded = try? MHDDateCoding.decoder.decode([GymExercise].self, from: data) else {
            exercises = []
            return
        }
        exercises = decoded
    }

    func search(_ query: String) -> [GymExercise] {
        let normalized = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !normalized.isEmpty else { return Array(exercises.prefix(80)) }
        return exercises.filter { exercise in
            [exercise.name, exercise.category, exercise.bodyPart, exercise.equipment, exercise.target, exercise.muscleGroup]
                .joined(separator: " ").lowercased().contains(normalized)
        }.prefix(80).map { $0 }
    }

    func exercise(id: String) -> GymExercise? { exercises.first { $0.id == id } }
    var all: [GymExercise] { exercises }
    var count: Int { exercises.count }

    static func imageURL(for exercise: GymExercise) -> URL? {
        resourceURL(for: exercise.image, subdirectory: "images", fallbackExtension: "jpg")
    }

    static func gifURL(for exercise: GymExercise) -> URL? {
        resourceURL(for: exercise.gifURL, subdirectory: "videos", fallbackExtension: "gif")
    }

    private static func resourceURL(for path: String?, subdirectory: String, fallbackExtension: String) -> URL? {
        guard let path else { return nil }
        let source = URL(fileURLWithPath: path)
        let name = source.deletingPathExtension().lastPathComponent
        let ext = source.pathExtension.isEmpty ? fallbackExtension : source.pathExtension
        return Bundle.main.url(forResource: name, withExtension: ext, subdirectory: "GymDataset/\(subdirectory)")
            ?? Bundle.main.url(forResource: name, withExtension: ext)
    }
}
