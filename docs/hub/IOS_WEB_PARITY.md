# Parità iOS ↔ Web: contratto canonico

La Web app non è un prodotto parallelo né una dashboard del Hub. È la traduzione browser di MyHealthData iOS. La fonte dei dati, delle etichette, dei moduli, dell’ordine dei flussi e del comportamento è `apps/ios/MyHealthDataiOS/MyHealthDataiOS/`.

La fonte del modello è `Models/MHDModels.swift:MHDDataSnapshot`. La Web non può pubblicare una funzionalità come completa finché non legge, scrive, esporta e sincronizza i medesimi record iOS.

| Snapshot canonico iOS | Modulo/esperienza iOS | Stato Web precedente | Obiettivo Web |
| --- | --- | --- | --- |
| profile, events, measurements, documents | Profilo, Corpo, Misure, Documenti | parziale | allineare campi, formati, import/export e UI |
| cycleEntries, cycleSettings | Ciclo | assente | port completo |
| sleepSessions, sleepSettings | Sonno | assente | port completo |
| foodLogEntries, foodRecipes | Diario alimentare | assente | port completo |
| gymPlans, gymWorkouts | Palestra | assente | port completo |
| appointments | Appuntamenti | assente | port completo |
| medications, medicationDoseEvents | Farmaci | assente | port completo |
| conditionEpisodes, conditionCheckIns | Percorso di salute | assente | port completo |
| labResults | Analisi e trend | assente | port completo |

## Invarianti

1. Un export iOS e uno Web usano lo stesso grafo logico `MHDDataSnapshot`; un import non scarta domini sconosciuti.
2. Il catalogo `HealthFeature` iOS è il catalogo moduli Web: titolo, sottotitolo, simbolo, tinta, immagine e destinazione non vengono reinventati.
3. Hub replica tombstone, revisioni e conflitti per ogni tipo di record, non solo per `Measurement`.
4. Apple Health, HealthKit, BLE e fotocamera restano adattatori nativi: la Web mostra i dati canonici importati e non finge accesso alle API del dispositivo.
5. La parità si verifica con fixture di snapshot iOS e test di round-trip iOS → Hub → Web → Hub → iOS.

## Ordine di porting

1. Portare tipi, codec JSON, repository IndexedDB e migrazione del snapshot completo.
2. Portare il catalogo moduli e le card dal codice iOS, inclusi asset per modulo.
3. Portare i flussi di raccolta dati e i dettagli modulo, uno alla volta, con fixture comuni.
4. Estendere l’API Hub e la sync offline-first a tutto il grafo.
5. Sostituire la vecchia UI Web; non mantenere due varianti funzionali divergenti.

## Stato al 2026-09-13

La Web app è stata ricostruita come traduzione browser del client iOS e non è più
una variante divergente. Riferimenti: requisiti e audit in
[`docs/product/web-ios-parity-2026-09.md`](../product/web-ios-parity-2026-09.md),
hardening in [`docs/security/2026-09-web-hardening.md`](../security/2026-09-web-hardening.md).

Il contratto degli eventi dentali e il replay monotono condiviso sono descritti
in [`DENTAL_CONTRACT.md`](DENTAL_CONTRACT.md).

| Invariante | Stato |
| --- | --- |
| 1. Stesso grafo `MHDDataSnapshot`, nessun dominio scartato all'import | ✅ fixture iOS → Web → export → import (`src/storage/iosRoundTrip.test.ts`) |
| 2. Catalogo `HealthFeature` come catalogo moduli Web | ✅ `src/core/healthModules.ts` + test di parità dell'ordine |
| 3. Hub replica tombstone e revisioni per ogni tipo di record | ✅ Hub + Web + iOS per tutti i domini canonici (`/api/v1/sync/records/{domain}`, `/api/v1/records/{domain}`); il client iOS sincronizza l'intero grafo |
| 4. Adattatori nativi restano nativi; la Web mostra i dati canonici importati | ✅ banner di provenienza nei moduli canonici |
| 5. Round-trip verificato con fixture condivise | 🟡 fixture Web presente; manca la fixture generata dall'app iOS |

Passi 1–3 dell'ordine di porting sono completati per i tipi, i codec, il
repository IndexedDB, il catalogo moduli e gli asset. Il passo 5 (sostituzione
della vecchia UI) è completato. Il passo 4 (sync completa del grafo) è operativo
su Hub, Web e iOS: lo store dell'Hub conserva revisioni e tombstone per ogni
dominio (`records[domain]`), il Web applica i cambi incrementali con un cursore
per dominio e scrive in write-through quando l'Hub è presente, e il client iOS
(`HubSyncClient`, build 67) replica gli stessi domini canonici con endpoint
generici firmati, cursore e fingerprint per dominio.

Limiti noti del protocollo, da affrontare in una fase successiva:

- l'ownership per device impedisce a un iPhone di aggiornare un record creato da
  un altro client: i record non posseduti vengono marcati come remoti e le
  modifiche locali restano locali;
- i conflitti di revisione (409) non hanno ancora una UI di risoluzione: il
  client adotta la revisione remota al pull successivo;
- `profile` resta locale. `events` e `documents` replicano i record; gli allegati dei documenti seguono il canale binario Hub separato e possono essere aperti dal Web quando il file è presente sul Hub.
