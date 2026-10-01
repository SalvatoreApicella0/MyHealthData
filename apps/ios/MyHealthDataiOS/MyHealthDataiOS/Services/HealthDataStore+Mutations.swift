import Foundation

@MainActor
extension HealthDataStore {
    func saveGymPlan(_ plan: GymPlan) {
        mutate(invalidate: .gymPlans) { snapshot in
            if let index = snapshot.gymPlans.firstIndex(where: { $0.id == plan.id }) { snapshot.gymPlans[index] = plan }
            else { snapshot.gymPlans.append(plan) }
        }
    }

    func deleteGymPlan(id: String) {
        mutate(invalidate: .gymPlans) { $0.gymPlans.removeAll { $0.id == id } }
    }

    func saveGymWorkout(_ workout: GymWorkout) {
        mutate(invalidate: .gymWorkouts) { snapshot in
            if let index = snapshot.gymWorkouts.firstIndex(where: { $0.id == workout.id }) { snapshot.gymWorkouts[index] = workout }
            else { snapshot.gymWorkouts.append(workout) }
        }
    }

    func deleteGymWorkout(id: String) {
        mutate(invalidate: .gymWorkouts) { $0.gymWorkouts.removeAll { $0.id == id } }
    }

    func saveProfile(_ profile: LocalProfile) {
        mutate { snapshot in
            snapshot.profile = profile
        }
    }

    func addEvent(_ event: HealthEvent) {
        mutate(invalidate: .events) { snapshot in
            snapshot.events.append(event)
        }
        syncHub()
    }

    func deleteEvent(id: String) {
        mutate(invalidate: .events) { snapshot in
            snapshot.events.removeAll { $0.id == id }
        }
        syncHub()
    }

    func saveEvent(_ event: HealthEvent) {
        mutate(invalidate: .events) { snapshot in
            if let index = snapshot.events.firstIndex(where: { $0.id == event.id }) {
                snapshot.events[index] = event
            } else {
                snapshot.events.append(event)
            }
        }
        syncHub()
    }

    func addMeasurement(_ measurement: Measurement) {
        guard isLoaded, !loadFailed else {
            lastError = "I dati non sono disponibili. Riprova ad aprire il vault prima di salvare."
            return
        }
        snapshot.measurements.append(measurement)
        insertIntoMeasurementCache(measurement)
        schedulePersistence()
        schedulePersonalRelaySync()
        syncHub()
    }

    func updateMeasurement(_ measurement: Measurement) {
        guard isLoaded, !loadFailed else {
            lastError = "I dati non sono disponibili. Riprova ad aprire il vault prima di salvare."
            return
        }
        guard let index = snapshot.measurements.firstIndex(where: { $0.id == measurement.id }) else {
            lastError = "La misura non è più disponibile."
            return
        }
        snapshot.measurements[index] = measurement
        rebuildMeasurementCache()
        schedulePersistence()
        schedulePersonalRelaySync()
        syncHub()
    }

    func deleteMeasurement(id: String) {
        guard let removed = snapshot.measurements.first(where: { $0.id == id }) else { return }
        snapshot.measurements.removeAll { $0.id == id }
        removeFromMeasurementCache(removed)
        schedulePersistence()
        syncHub()
    }

    func addDocument(_ document: HealthDocument) {
        mutate { snapshot in
            snapshot.documents.append(document)
        }
        // Documents must enter the Hub queue immediately after local vault
        // persistence; waiting for the next foreground would make an upload
        // appear randomly missing from the Web archive.
        syncHub()
    }

    func saveDocument(_ document: HealthDocument) {
        mutate { snapshot in
            if let index = snapshot.documents.firstIndex(where: { $0.id == document.id }) {
                snapshot.documents[index] = document
            } else {
                snapshot.documents.append(document)
            }
        }
        syncHub()
    }

    func deleteDocument(id: String) {
        let attachment = snapshot.documents.first { $0.id == id }?.attachment
        mutate(invalidate: [.labResults]) { snapshot in
            snapshot.documents.removeAll { $0.id == id }
            // Lab values imported from this report are part of the document's
            // graph. Remove them in the same mutation so a deleted document
            // cannot leave orphaned canonical records for Hub sync.
            snapshot.labResults.removeAll { $0.linkedDocumentId == id }
        }
        if let attachment {
            Task { [persistence] in
                do {
                    try await persistence.deleteAttachment(attachment)
                } catch {
                    lastError = error.localizedDescription
                }
            }
        }
        syncHub()
    }

    func addCycleEntry(_ entry: CycleEntry) {
        mutate(invalidate: .cycle) { snapshot in
            snapshot.cycleEntries.append(entry)
        }
    }

    func upsertCycleEntry(_ entry: CycleEntry) {
        mutate(invalidate: .cycle) { snapshot in
            if let index = snapshot.cycleEntries.firstIndex(where: {
                Calendar.current.isDate($0.date, inSameDayAs: entry.date)
            }) {
                snapshot.cycleEntries[index] = entry
            } else {
                snapshot.cycleEntries.append(entry)
            }
        }
    }

    func saveCycleSettings(_ settings: CycleSettings) {
        mutate { snapshot in
            snapshot.cycleSettings = settings
        }
    }

    func deleteCycleEntry(id: String) {
        mutate(invalidate: .cycle) { snapshot in
            snapshot.cycleEntries.removeAll { $0.id == id }
        }
    }

    func addSleepSession(_ session: SleepSession) {
        mutate(invalidate: .sleep) { snapshot in
            snapshot.sleepSessions.append(session)
        }
    }

    func saveSleepSettings(_ settings: SleepSettings) {
        mutate { snapshot in snapshot.sleepSettings = settings }
    }

    func deleteSleepSession(id: String) {
        mutate(invalidate: .sleep) { snapshot in
            snapshot.sleepSessions.removeAll { $0.id == id }
        }
    }

    func addAppointment(_ appointment: AppointmentRecord) {
        mutate(invalidate: .appointments) { snapshot in
            snapshot.appointments.append(appointment)
        }
        syncHub()
    }

    func updateAppointmentStatus(id: String, status: AppointmentRecord.Status) {
        mutate(invalidate: .appointments) { snapshot in
            guard let index = snapshot.appointments.firstIndex(where: { $0.id == id }) else { return }
            snapshot.appointments[index].status = status
            snapshot.appointments[index].updatedAt = .now
        }
        if status != .planned {
            LocalReminderService.shared.cancelAppointment(id: id)
        }
        syncHub()
    }

    func updateAppointment(_ appointment: AppointmentRecord) {
        mutate(invalidate: .appointments) { snapshot in
            guard let index = snapshot.appointments.firstIndex(where: { $0.id == appointment.id }) else { return }
            snapshot.appointments[index] = appointment
        }
        LocalReminderService.shared.cancelAppointment(id: appointment.id)
        if appointment.status == .planned {
            LocalReminderService.shared.scheduleAppointment(appointment)
        }
        // Appointment edits must use the same coalesced Hub path as additions;
        // the local vault remains authoritative if the Hub is unavailable.
        syncHub()
    }

    func deleteAppointment(id: String) {
        mutate(invalidate: .appointments) { snapshot in
            snapshot.appointments.removeAll { $0.id == id }
        }
        LocalReminderService.shared.cancelAppointment(id: id)
        syncHub()
    }

    func addMedication(_ medication: MedicationStatement) {
        mutate(invalidate: .medications) { snapshot in
            snapshot.medications.append(medication)
        }
    }

    func saveMedication(_ medication: MedicationStatement) {
        mutate(invalidate: .medications) { snapshot in
            if let index = snapshot.medications.firstIndex(where: { $0.id == medication.id }) {
                snapshot.medications[index] = medication
            } else {
                snapshot.medications.append(medication)
            }
        }
    }

    func updateMedicationStatus(id: String, status: MedicationStatement.Status) {
        mutate(invalidate: .medications) { snapshot in
            guard let index = snapshot.medications.firstIndex(where: { $0.id == id }) else { return }
            snapshot.medications[index].status = status
            snapshot.medications[index].updatedAt = .now
        }
        if status != .active {
            LocalReminderService.shared.cancelMedication(id: id)
        }
    }

    func addMedicationDoseEvent(_ event: MedicationDoseEvent) {
        mutate(invalidate: [.medications, .medicationDoseEvents]) { snapshot in
            snapshot.medicationDoseEvents.append(event)
            guard event.status == .taken,
                  let medicationIndex = snapshot.medications.firstIndex(where: { $0.id == event.medicationId }),
                  let stock = snapshot.medications[medicationIndex].stockQuantity else { return }
            snapshot.medications[medicationIndex].stockQuantity = max(stock - 1, 0)
            snapshot.medications[medicationIndex].updatedAt = .now
        }
    }

    func deleteMedicationDoseEvent(id: String) {
        mutate(invalidate: .medicationDoseEvents) { snapshot in
            snapshot.medicationDoseEvents.removeAll { $0.id == id }
        }
    }

    func deleteMedication(id: String) {
        mutate(invalidate: .medications) { snapshot in
            snapshot.medications.removeAll { $0.id == id }
        }
    }

    func addConditionEpisode(_ episode: ConditionEpisode) {
        mutate(invalidate: .conditionEpisodes) { snapshot in
            snapshot.conditionEpisodes.append(episode)
        }
    }

    func updateConditionStatus(id: String, status: ConditionEpisode.Status) {
        mutate(invalidate: .conditionEpisodes) { snapshot in
            guard let index = snapshot.conditionEpisodes.firstIndex(where: { $0.id == id }) else { return }
            snapshot.conditionEpisodes[index].status = status
            snapshot.conditionEpisodes[index].updatedAt = .now
        }
    }

    func addConditionCheckIn(_ checkIn: ConditionCheckIn) {
        mutate(invalidate: .conditionCheckIns) { snapshot in
            snapshot.conditionCheckIns.append(checkIn)
        }
    }

    func deleteConditionCheckIn(id: String) {
        mutate(invalidate: .conditionCheckIns) { snapshot in
            snapshot.conditionCheckIns.removeAll { $0.id == id }
        }
    }

    func deleteConditionEpisode(id: String) {
        mutate(invalidate: .conditionEpisodes) { snapshot in
            snapshot.conditionEpisodes.removeAll { $0.id == id }
        }
    }

    func addLabResult(_ result: LabResult) {
        mutate(invalidate: .labResults) { snapshot in
            snapshot.labResults.append(result)
        }
    }

    func deleteLabResult(id: String) {
        mutate(invalidate: .labResults) { snapshot in
            snapshot.labResults.removeAll { $0.id == id }
        }
    }

    func addFoodLogEntry(_ entry: FoodLogEntry) {
        mutate(invalidate: .foodLogEntries) { snapshot in
            snapshot.foodLogEntries.append(entry)
        }
    }

    func deleteFoodLogEntry(id: String) {
        mutate(invalidate: .foodLogEntries) { snapshot in
            snapshot.foodLogEntries.removeAll { $0.id == id }
        }
    }

    func moveFoodLogEntry(id: String, to meal: NutritionMealType) {
        mutate(invalidate: .foodLogEntries) { snapshot in
            guard let index = snapshot.foodLogEntries.firstIndex(where: { $0.id == id }) else { return }
            snapshot.foodLogEntries[index].meal = meal
        }
    }

    func toggleFoodFavorite(id: String) {
        mutate(invalidate: .foodLogEntries) { snapshot in
            guard let entry = snapshot.foodLogEntries.first(where: { $0.id == id }) else { return }
            let key = entry.barcode ?? entry.name.lowercased()
            let newValue = !entry.isFavorite
            for index in snapshot.foodLogEntries.indices {
                let candidate = snapshot.foodLogEntries[index]
                if (candidate.barcode ?? candidate.name.lowercased()) == key {
                    snapshot.foodLogEntries[index].isFavorite = newValue
                }
            }
        }
    }

    func addFoodRecipe(_ recipe: FoodRecipe) {
        mutate { $0.foodRecipes.append(recipe) }
    }

    func saveFoodRecipe(_ recipe: FoodRecipe) {
        mutate { snapshot in
            if let index = snapshot.foodRecipes.firstIndex(where: { $0.id == recipe.id }) {
                snapshot.foodRecipes[index] = recipe
            } else {
                snapshot.foodRecipes.append(recipe)
            }
        }
    }

    func deleteFoodRecipe(id: String) {
        mutate { $0.foodRecipes.removeAll { $0.id == id } }
    }
}
