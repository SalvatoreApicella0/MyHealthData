import Charts
import SwiftUI

struct EnhancedBloodworkDashboardView: View {
    @Environment(HealthDataStore.self) private var store
    @State private var isAddingBatch = false
    @State private var isImportingReport = false
    @State private var selectedSeriesID: String?
    @State private var range: LabChartRange = .days90

    private let tint = Color.red

    private var seriesOptions: [LabSeriesKey] {
        Set(store.labResults.map { LabSeriesKey(analyte: $0.analyte, unit: $0.unit) })
            .sorted { $0.displayName.localizedCaseInsensitiveCompare($1.displayName) == .orderedAscending }
    }

    private var selectedSeries: LabSeriesKey? {
        seriesOptions.first { $0.id == selectedSeriesID } ?? seriesOptions.first
    }

    private var chartResults: [LabResult] {
        guard let selectedSeries else { return [] }
        let start = Calendar.current.date(byAdding: .day, value: -range.days, to: .now) ?? .distantPast
        return store.labResults
            .filter {
                $0.analyte == selectedSeries.analyte &&
                    $0.unit == selectedSeries.unit &&
                    $0.collectedAt >= start
            }
            .sorted { $0.collectedAt < $1.collectedAt }
    }

    private var batches: [LabResultBatch] {
        let grouped = Dictionary(grouping: store.labResults) { result in
            LabBatchKey(
                panel: result.panelName,
                day: Calendar.current.startOfDay(for: result.collectedAt),
                laboratory: result.labName?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            )
        }
        return grouped.map { LabResultBatch(key: $0.key, results: $0.value) }
            .sorted { $0.key.day > $1.key.day }
    }

    private var bloodReports: [HealthDocument] {
        store.snapshot.documents
            .filter { $0.documentType == .bloodTest }
            .sorted { $0.documentDate > $1.documentDate }
    }

    var body: some View {
        MHDDataModuleScrollView {
            VStack(alignment: .leading, spacing: 18) {
                MHDModuleHeader(title: "Analisi del sangue", subtitle: "Valori, referti e confronti", symbol: "testtube.2", tint: tint)
                header
                reportSection
                comparisonSection
                batchSection
            }
            .padding()
        }
        .background(Color(.systemGroupedBackground))
        .sheet(isPresented: $isAddingBatch) {
            NavigationStack { LabResultBatchForm() }
        }
        .sheet(isPresented: $isImportingReport) {
            NavigationStack { AddDocumentView(initialType: .bloodTest, initialTitle: "Analisi del sangue") }
        }
        .onChange(of: seriesOptions.map(\.id)) { _, identifiers in
            if let selectedSeriesID, !identifiers.contains(selectedSeriesID) {
                self.selectedSeriesID = identifiers.first
            }
        }
    }

    private var reportSection: some View {
        DashboardSection(title: "Referti") {
            if bloodReports.isEmpty {
                Button {
                    isImportingReport = true
                } label: {
                    Label("Importa il primo referto", systemImage: "doc.badge.plus")
                        .frame(maxWidth: .infinity, minHeight: 48)
                }
                .mhdGlassButton(prominent: true)
                .tint(tint)
            } else {
                ForEach(bloodReports.prefix(5)) { document in
                    HStack(spacing: 12) {
                        Image(systemName: "doc.text.fill")
                            .foregroundStyle(tint)
                            .frame(width: 38, height: 38)
                            .mhdGlassCircle(tint: tint.opacity(0.1))
                        VStack(alignment: .leading, spacing: 3) {
                            Text(document.title).font(.headline).lineLimit(1)
                            Text(document.documentDate).font(.caption).foregroundStyle(.secondary)
                            if document.ocrText != nil {
                                Label("Testo acquisito", systemImage: "text.viewfinder")
                                    .font(.caption2).foregroundStyle(tint)
                            }
                        }
                        Spacer()
                    }
                    .padding(14)
                    .mhdGlassPanel(tint: tint.opacity(0.04))
                }
            }
        }
    }

    private var header: some View {
        HStack(spacing: 14) {
            Image(systemName: "testtube.2")
                .font(.title2.weight(.semibold))
                .foregroundStyle(tint)
                .frame(width: 44, height: 44)
                .background(tint.opacity(0.12), in: Circle())
            VStack(alignment: .leading, spacing: 3) {
                Text("Risultati di laboratorio")
                    .font(.headline)
                Text("\(store.labResults.count) valori in \(batches.count) prelievi")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Menu {
                Button("Importa referto", systemImage: "doc.viewfinder") { isImportingReport = true }
                Button("Inserimento manuale", systemImage: "keyboard") { isAddingBatch = true }
            } label: {
                Label("Aggiungi referto", systemImage: "plus")
            }.mhdGlassButton(prominent: true).tint(tint)
        }
        .padding(14)
        .mhdGlassPanel(tint: tint.opacity(0.06))
    }

    private var comparisonSection: some View {
        DashboardSection(title: "Confronto") {
            if seriesOptions.isEmpty {
                ContentUnavailableView("Nessun risultato", systemImage: "chart.xyaxis.line")
                    .frame(maxWidth: .infinity, minHeight: 180)
            } else {
                Picker("Analita e unità", selection: seriesSelection) {
                    ForEach(seriesOptions) { option in
                        Text(option.displayName).tag(option.id)
                    }
                }
                .pickerStyle(.menu)

                RangePicker(selection: $range, options: LabChartRange.allCases)

                if chartResults.isEmpty {
                    ContentUnavailableView(
                        "Nessun valore nel periodo",
                        systemImage: "calendar",
                        description: Text("Seleziona un intervallo piu ampio.")
                    )
                    .frame(maxWidth: .infinity, minHeight: 190)
                } else {
                    Chart(chartResults) { result in
                        LineMark(
                            x: .value("Data", result.collectedAt),
                            y: .value("Valore", result.value)
                        )
                        .foregroundStyle(tint)
                        PointMark(
                            x: .value("Data", result.collectedAt),
                            y: .value("Valore", result.value)
                        )
                        .foregroundStyle(tint)
                        .symbolSize(42)
                    }
                    .chartYAxis { AxisMarks(position: .leading) }
                    .chartYScale(domain: AdaptiveChartDomain.range(for: chartResults.map(\.value)))
                    .frame(height: 230)
                    .padding(12)
                    .mhdGlassPanel(tint: tint.opacity(0.04))
                    Text("\(chartResults.count) valori · \(chartCoverage(chartResults.map(\.collectedAt)))")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }

    private var batchSection: some View {
        DashboardSection(title: "Prelievi") {
            if batches.isEmpty {
                ContentUnavailableView("Nessun prelievo", systemImage: "testtube.2")
                    .frame(maxWidth: .infinity, minHeight: 170)
            } else {
                LazyVStack(spacing: 10) {
                    ForEach(batches) { batch in
                        LabBatchCard(batch: batch, tint: tint)
                    }
                }
            }
        }
    }

    private var seriesSelection: Binding<String> {
        Binding(
            get: { selectedSeries?.id ?? "" },
            set: { selectedSeriesID = $0 }
        )
    }
}

private struct LabBatchCard: View {
    let batch: LabResultBatch
    let tint: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(batch.key.panel.isEmpty ? "Pannello senza nome" : batch.key.panel)
                        .font(.headline)
                    Text(batch.key.day.formatted(date: .abbreviated, time: .omitted))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                if !batch.key.laboratory.isEmpty {
                    Text(batch.key.laboratory)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }

            ForEach(batch.results.sorted { $0.analyte < $1.analyte }) { result in
                Divider()
                VStack(alignment: .leading, spacing: 5) {
                    HStack(alignment: .firstTextBaseline) {
                        Text(result.analyte)
                            .font(.subheadline.weight(.semibold))
                        Spacer()
                        Text(resultValue(result))
                            .font(.subheadline.monospacedDigit().weight(.semibold))
                    }
                    ViewThatFits(in: .horizontal) {
                        HStack(spacing: 8) { resultMetadata(result) }
                        VStack(alignment: .leading, spacing: 3) { resultMetadata(result) }
                    }
                }
            }
        }
        .padding(12)
        .mhdGlassPanel(tint: tint.opacity(0.05))
    }

    @ViewBuilder
    private func resultMetadata(_ result: LabResult) -> some View {
        if let limits = numericLimits(result) {
            Text("Limiti \(limits)")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        if let original = result.referenceRange, !original.isEmpty {
            Text("Range originale \(original)")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        if let flag = result.laboratoryFlag, !flag.isEmpty {
            Text("Indicazione del laboratorio: \(flag)")
                .font(.caption.weight(.semibold))
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(.secondary.opacity(0.12), in: RoundedRectangle(cornerRadius: 4))
        }
    }

    private func resultValue(_ result: LabResult) -> String {
        let comparator = result.comparator.map { "\($0) " } ?? ""
        return "\(comparator)\(number(result.value)) \(result.unit)"
    }

    private func numericLimits(_ result: LabResult) -> String? {
        switch (result.referenceLow, result.referenceHigh) {
        case let (low?, high?): return "\(number(low))-\(number(high)) \(result.unit)"
        case let (low?, nil): return "da \(number(low)) \(result.unit)"
        case let (nil, high?): return "fino a \(number(high)) \(result.unit)"
        default: return nil
        }
    }
}

private struct LabResultBatchForm: View {
    @Environment(HealthDataStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var panelName = "Analisi sangue"
    @State private var collectedAt = Date()
    @State private var labName = ""
    @State private var rows = [LabResultDraft()]

    var body: some View {
        Form {
            Section("Prelievo") {
                TextField("Pannello", text: $panelName)
                DatePicker("Data", selection: $collectedAt, displayedComponents: .date)
                TextField("Laboratorio", text: $labName)
            }

            ForEach($rows) { $row in
                Section {
                    TextField("Analita", text: $row.analyte)
                    HStack {
                        Picker("Comparatore", selection: $row.comparator) {
                            Text("Nessuno").tag("")
                            ForEach(["<", "<=", "=", ">=", ">"], id: \.self) { Text($0).tag($0) }
                        }
                        .pickerStyle(.menu)
                        TextField("Valore", text: $row.value)
                            .keyboardType(.decimalPad)
                        TextField("Unità", text: $row.unit)
                            .frame(minWidth: 65)
                    }
                    HStack {
                        TextField("Limite basso", text: $row.referenceLow)
                            .keyboardType(.decimalPad)
                        TextField("Limite alto", text: $row.referenceHigh)
                            .keyboardType(.decimalPad)
                    }
                    TextField("Range originale del referto", text: $row.referenceRange)
                    TextField("Indicazione riportata dal laboratorio", text: $row.laboratoryFlag)
                    TextField("Nota", text: $row.note, axis: .vertical)
                } header: {
                    HStack {
                        Text("Analita \((rows.firstIndex { $0.id == row.id } ?? 0) + 1)")
                        Spacer()
                        if rows.count > 1 {
                            Button("Rimuovi", role: .destructive) { remove(row.id) }
                                .textCase(nil)
                        }
                    }
                }
            }

            Button { rows.append(LabResultDraft()) } label: {
                Label("Aggiungi analita", systemImage: "plus")
            }
        }
        .navigationTitle("Nuovo prelievo")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Annulla") { dismiss() }
            }
            ToolbarItem(placement: .confirmationAction) {
                Button("Salva \(rows.count)", action: save)
                    .disabled(!canSave)
            }
        }
    }

    private var canSave: Bool {
        !panelName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
            !rows.isEmpty && rows.allSatisfy(\.isValid)
    }

    private func remove(_ id: UUID) {
        rows.removeAll { $0.id == id }
    }

    private func save() {
        let panel = panelName.trimmingCharacters(in: .whitespacesAndNewlines)
        let laboratory = optionalText(labName)
        let date = Calendar.current.startOfDay(for: collectedAt)

        for row in rows {
            guard let value = decimal(row.value) else { continue }
            store.addLabResult(
                LabResult(
                    panelName: panel,
                    analyte: row.analyte.trimmingCharacters(in: .whitespacesAndNewlines),
                    value: value,
                    unit: row.unit.trimmingCharacters(in: .whitespacesAndNewlines),
                    referenceRange: optionalText(row.referenceRange),
                    collectedAt: date,
                    labName: laboratory,
                    note: optionalText(row.note),
                    comparator: optionalText(row.comparator),
                    referenceLow: decimal(row.referenceLow),
                    referenceHigh: decimal(row.referenceHigh),
                    laboratoryFlag: optionalText(row.laboratoryFlag)
                )
            )
        }
        dismiss()
    }
}

private struct LabResultDraft: Identifiable {
    let id = UUID()
    var analyte = ""
    var comparator = ""
    var value = ""
    var unit = ""
    var referenceLow = ""
    var referenceHigh = ""
    var referenceRange = ""
    var laboratoryFlag = ""
    var note = ""

    var isValid: Bool {
        !analyte.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
            decimal(value) != nil &&
            !unit.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
            (referenceLow.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || decimal(referenceLow) != nil) &&
            (referenceHigh.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || decimal(referenceHigh) != nil)
    }
}
