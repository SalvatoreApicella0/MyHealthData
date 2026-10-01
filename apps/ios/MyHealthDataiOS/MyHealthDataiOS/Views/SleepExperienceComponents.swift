import SwiftUI


enum SleepStage: String {
    case core
    case deep
    case rem
    case asleep

    var label: String {
        switch self {
        case .core: "Principale"
        case .deep: "Profondo"
        case .rem: "REM"
        case .asleep: "Sonno non classificato"
        }
    }
}

struct SleepStagePoint: Identifiable {
    var id: String { "\(date.timeIntervalSince1970)-\(stage.rawValue)-\(hours)" }
    var date: Date
    var stage: SleepStage
    var hours: Double
}



struct ExperienceMetricCard: View {
    @Environment(\.colorScheme) private var colorScheme
    var title: String
    var value: String
    var detail: String
    var icon: String
    var tint: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Image(systemName: icon)
                .foregroundStyle(tint)
            Text(value)
                .font(.title2.bold())
                .lineLimit(1)
                .minimumScaleFactor(0.75)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.subheadline.weight(.semibold))
                Text(detail).font(.caption).foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, minHeight: 118, alignment: .leading)
        .padding(14)
        .mhdGlassPanel(tint: tint.opacity(0.06))
    }
}

struct SleepSessionExperienceRow: View {
    @Environment(\.colorScheme) private var colorScheme
    var session: SleepSession

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "bed.double.fill")
                .foregroundStyle(ExperiencePalette.sleep)
                .frame(width: 38, height: 38)
                .background(ExperiencePalette.sleep.opacity(0.12), in: Circle())
            VStack(alignment: .leading, spacing: 3) {
                Text(session.startAt.formatted(.dateTime.weekday(.wide).day().month(.abbreviated).locale(Locale(identifier: "it_IT"))))
                    .font(.headline)
                Text("\(session.startAt.formatted(date: .omitted, time: .shortened)) - \(session.endAt.formatted(date: .omitted, time: .shortened))")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 3) {
                Text(session.durationHours.formatted(.number.precision(.fractionLength(1))))
                    .font(.headline)
                Text("ore").font(.caption).foregroundStyle(.secondary)
            }
            if let quality = session.quality {
                Text("\(quality)/5")
                    .font(.caption.bold())
                    .foregroundStyle(ExperiencePalette.sleep)
                    .padding(.horizontal, 7)
                    .padding(.vertical, 4)
                    .background(ExperiencePalette.sleep.opacity(0.1), in: RoundedRectangle(cornerRadius: 6))
            }
        }
        .padding(12)
        .mhdGlassPanel(tint: ExperiencePalette.sleep.opacity(0.05))
    }
}

struct SleepEmptyState: View {
    var action: () -> Void

    var body: some View {
        ContentUnavailableView {
            Label("Nessuna notte registrata", systemImage: "bed.double")
        } description: {
            Text("Registra una notte per vedere durata e andamento nel tempo.")
        } actions: {
            Button("Registra una notte", action: action)
                .buttonStyle(.borderedProminent)
                .buttonBorderShape(.capsule)
        }
        .frame(maxWidth: .infinity, minHeight: 300)
    }
}
