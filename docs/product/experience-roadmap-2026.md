# MyHealthData experience roadmap 2026

## Direzione visiva

MyHealthData usa i componenti Apple nativi come base e adotta Liquid Glass con progressive enhancement su iOS 26.

- Cerchi per icone, metriche focali e azioni icon-only.
- Capsule per pulsanti, filtri e selezioni brevi.
- Superfici continue con raggio ampio solo per grafici, documenti e contenuto strutturato.
- Vetro interattivo sulle azioni e sulla navigazione, non su ogni riga di contenuto.
- Colori di sistema vibranti e semantici, con contrasto verificato in light e dark mode.
- Target interattivi di almeno 44 punti, Dynamic Type e fallback Material per iOS 18-25.

Riferimenti: [Apple Liquid Glass](https://developer.apple.com/documentation/TechnologyOverviews/liquid-glass), [Apple Materials HIG](https://developer.apple.com/design/human-interface-guidelines/materials), [custom glass in SwiftUI](https://developer.apple.com/documentation/SwiftUI/Applying-Liquid-Glass-to-custom-views).

## Fondazione HealthKit P0

- L'autorizzazione deve essere seguita da un'importazione reale e da un esito comprensibile.
- Importazione selezionabile per 30 giorni, un anno o tutta la cronologia.
- Nessun limite arbitrario di 500 campioni.
- UUID HealthKit, sorgente e data originali conservati per deduplicazione e provenienza.
- Passaggio successivo: `HKAnchoredObjectQuery`, cursori persistiti, aggiornamenti e cancellazioni incrementali.
- Sonno, pressione e allenamenti devono evolvere da misure isolate a sessioni tipizzate.
- I permessi vengono richiesti solo per dati che l'app persiste e mostra realmente.

Apple non permette di distinguere accesso negato da assenza di dati in lettura. L'interfaccia deve quindi mostrare copertura, intervallo richiesto e percorso per verificare i permessi senza dichiarare falsamente che l'accesso sia stato concesso. Riferimento: [HealthKit authorization](https://developer.apple.com/documentation/HealthKit/authorizing-access-to-health-data).

## Moduli P0

### Cuore e parametri vitali

- Pressione come sessione sistolica/diastolica inseparabile.
- Frequenza cardiaca, riposo, cammino, HRV, saturazione, respirazione, temperatura e VO2 max.
- Contesto manuale opzionale: postura, braccio, dispositivo, riposo e sintomi.
- Nessuna diagnosi, interpretazione ECG o punteggio di rischio.

### Attivita e mobilita

- Allenamenti con tipo, durata, distanza, energia e sforzo percepito.
- Passi, esercizio, stazione eretta, luce diurna e distanze.
- Velocita e lunghezza del passo, asimmetria, doppio appoggio, scale e test dei sei minuti.
- Nessuna route GPS nel P0, classifica o coaching prescrittivo.

### Profilo clinico essenziale

- Allergie e intolleranze, vaccinazioni e procedure pregresse con sorgente e documento.
- Clinical Health Records/FHIR solo dopo capability, privacy policy e permesso separato.
- Nessuna promessa di completezza e nessuna riconciliazione automatica dei conflitti.

## Moduli P1

- Metabolismo e glucosio con contesto dichiarato, pasto, farmaco, attivita e sorgente sensore.
- Diari specializzati per emicrania, fatigue, dolore persistente e recupero, costruiti sul modello Decorso.
- Idratazione, caffeina e alimentazione leggera, senza trasformare le calorie nel centro del prodotto.
- OCR delle analisi come bozza riga per riga, mai come salvataggio clinico automatico.

## Moduli P2

- Respirazione: peak flow, spirometria, inalatore, saturazione e sintomi.
- Benessere mentale: check-in facoltativi e dati HealthKit solo con governance e protocollo di sicurezza.
- Udito e vista: audiogrammi, prescrizioni e documenti per utenti e dispositivi compatibili.

## Funzioni escluse

- Diagnosi o triage automatico.
- Interpretazione ECG e suggerimenti terapeutici.
- Calcolo del bolo insulinico o previsione di ipo/iperglicemia.
- Correlazioni presentate come cause.
- Account cloud obbligatorio, export essenziale o storico completo dietro abbonamento.
- Notifiche che rivelano patologie, farmaci o specialisti sulla schermata bloccata.
