# Benchmark e requisiti dei moduli

Aggiornato: 11 luglio 2026.

## Principi trasversali

- Il core resta gratuito: inserimento, modifica, storico completo, trend di base, export/import e funzioni privacy.
- Nessun account, analytics, OCR cloud o trasmissione di dati per impostazione predefinita.
- Le associazioni sono descritte come pattern osservati, mai come cause, diagnosi o indicazioni terapeutiche.
- Ogni dato conserva provenienza, timestamp, unita e documento originale quando disponibile.
- Gli stati vuoti devono portare all'azione principale senza mostrare note di implementazione.
- Le curve cliniche usano punti e segmenti reali, senza spline che inventino valori intermedi.

## Ciclo

### P0

- Previsione con durata abituale o ultimo ciclo completo.
- Diario giornaliero, calendario, flusso, sintomi, umore, energia e temperatura.
- Durata ciclo configurabile da 3 a 60 giorni.
- Finestra fertile chiaramente indicata come stima e disattivabile.

### P1

- Rilevamento dei cicli irregolari con copertura dati visibile.
- Esportazione selettiva del diario.
- Annotazioni di farmaci, sonno e sintomi senza inferenze causali.

## Corpo

Benchmark: [WellnessTrax](https://wellness-trax.com/), body mapping di Manage My Pain e tracker locali del dolore.

### P0

- Posizionamento libero di punti tridimensionali, non sole macro-zone.
- Conferma del punto e descrizione anatomica approssimativa prima del form.
- Filtri rapidi per periodo e possibilita di nascondere eventi passati.
- Punto piccolo, leggibile e senza anelli decorativi che ne alterino la posizione percepita.
- Collegamento diretto tra punto, evento, documento e percorso di decorso.

### P1

- Confronto fronte/retro e snapshot statico del punto nell'archivio.
- Cluster discreti quando molti eventi occupano la stessa area.
- Modelli corporei alternativi solo se asset, texture e licenze sono verificati.

## Sonno

Benchmark: [Apple Sleep](https://support.apple.com/guide/watch/track-your-sleep-apd830528336/26/26), [AutoSleep](https://autosleepapp.tantsissa.com/), [Sleep Cycle](https://support.sleepcycle.com/hc/en-us/articles/206704909-Sleep-Cycle-Freemium-vs-Premium-Features), [RISE](https://help.risescience.com/hc/en-us/articles/4405177615639-What-subscription-plans-does-RISE-offer).

### P0

- Sessioni manuali correggibili con durata, qualita percepita, risvegli e note.
- Vista delle ultime sette notti e confronto con un obiettivo esplicito.
- Import HealthKit lossless con sorgente, fasi, sessioni spezzate e deduplicazione.
- Distinzione tra sonno rilevato e percezione soggettiva.

### P1

- Regolarita, deficit rispetto all'obiettivo e intervalli 7/30/90 giorni.
- Tag locali per caffeina, alcol, esercizio, viaggio e farmaci.
- Correzione di nap, falsi sonni e sessioni sovrapposte.

## Farmaci

Benchmark: [Apple Medications](https://support.apple.com/guide/watch/medications-apd3dd24d78b/watchos), [Medisafe](https://medisafeapp.com/), [MyTherapy](https://apps.apple.com/au/app/mytherapy-pill-reminder/id662170995), [Dosecast](https://dosecast.com/about/).

### P0

- Terapie attive, in pausa e concluse con dose, motivo e data inizio/fine.
- Schedule strutturate per giorni, orari, intervalli e al bisogno.
- Evento dose prevista, presa, saltata o posticipata con undo.
- Reminder locali azionabili e privacy-safe.
- Inventario e soglia di riordino.

### P1

- Aderenza descrittiva e report selettivo per il medico.
- Widget e App Intent per registrare una dose in pochi secondi.
- Schedule avanzate, cicli temporanei e cambio fuso orario.

## Visite

Benchmark: [MyChart](https://www.mychart.org/l/en-us/explore/), [Guava](https://guavahealth.com/plans), [MioDottore](https://apps.apple.com/it/app/miodottore-prenota-una-visita/id1064009280), [FSE 2.0](https://www.salute.gov.it/new/it/news-e-media/notizie/fascicolo-sanitario-elettronico-20-entra-fase-operativa/).

### P0

- Flusso prima/durante/dopo: motivo, medico o struttura, domande, documenti, esito e follow-up.
- Creazione, modifica, completamento e annullamento.
- Promemoria locali con testo neutro per impostazione predefinita.
- Collegamento permanente a referti e documenti.

### P1

- Checklist di preparazione e domande da porre.
- Attivita di follow-up con scadenza.
- Link opzionali verso CUP, FSE o provider esterni senza lock-in.

## Decorso e sintomi

Benchmark: [Bearable](https://bearable.app/), [Guava](https://guavahealth.com/plans), [Visible](https://www.makevisible.com/how-it-works), [Manage My Pain](https://apps.apple.com/us/app/manage-my-pain/id1444320523).

### P0

- Check-in rapido senza testo obbligatorio e con sintomi preferiti.
- Stati distinti: presente, assente confermato, non registrato e sconosciuto.
- Frequenza, severita, durata e impatto mostrati separatamente.
- Timeline che collega eventi, punti corporei, farmaci, misure, visite e documenti.
- Confronto prima/dopo puramente descrittivo.

### P1

- Template modificabili per emicrania, dolore, fatigue e recupero postoperatorio.
- Copia del check-in precedente e inserimento retroattivo o batch.
- Copertura dati, numerosita e possibili bias sempre visibili negli insight.

## Analisi

Benchmark: [Apple Health Records](https://support.apple.com/guide/iphone/view-health-records-iph2b3a37ddd/ios), [Ornament](https://apps.apple.com/it/app/ornament-il-tuo-health-coach/id1453537030), [Guava](https://guavahealth.com/plans).

### P0

- Pannello composto da piu risultati con laboratorio, data, documento e sorgente comuni.
- Valori numerici o testuali, comparatore, unita originale e range del laboratorio.
- Confronto dello stesso analita solo tra unita compatibili.
- Modifica, audit e collegamento al referto originale.

### P1

- OCR on-device come bozza da confermare riga per riga.
- Alias e conversioni controllate senza perdere nome o unita originali.
- Ricerca per pannello, analita, periodo e documento.

## Trend

### P0

- Selezione della serie, unita sempre visibile e punti reali.
- Periodi con dati mancanti espliciti.
- Annotazioni per farmaci, visite, ciclo, viaggi e cambio dispositivo.
- Nessuno score opaco o affermazione causale.

### P1

- Intervalli 7/30/90 giorni e confronto tra periodi.
- Correlazioni descrittive con numerosita, copertura e avvisi sui bias.
- Export del grafico con i dati sottostanti.

## Backup e condivisione

Benchmark: [Apple Health sharing/export](https://support.apple.com/en-lamr/guide/iphone/iph5ede58c3d/26/ios/26), [Guava export](https://guavahealth.com/faq) e strumenti specializzati di HealthKit export.

### P0

- Backup completo di allegati, manifest e checksum, con prova di ripristino.
- Cifratura proposta come percorso principale; avviso esplicito per export in chiaro.
- Anteprima esatta di ogni pacchetto selettivo.
- Cancellazione completa di vault, allegati e chiave.

### P1

- Backup automatico su Files o WebDAV.
- Sync self-hosted end-to-end encrypted.
- Export FHIR/IPS e audit locale delle condivisioni.

Le lamentele ricorrenti sull'export Apple sono file XML enormi, attese lunghe, impossibilita di scegliere un intervallo e report poco leggibili per il medico. MyHealthData deve quindi offrire selezione per periodo e categoria, formati leggibili e pacchetti verificabili senza abbonamento.

## Problemi di mercato da evitare

- Storico, export, correzioni e reminder essenziali dietro abbonamento.
- Account cloud obbligatorio per usare un diario personale.
- Moduli troppo ampi che mostrano tutti i campi in ogni inserimento.
- OCR che salva valori clinici senza conferma.
- Notifiche che rivelano patologia, specialista o farmaco sulla schermata bloccata.
- Correlazioni presentate come spiegazioni mediche.

## Funzioni che MyHealthData mantiene nel core gratuito

| Area | Limitazione osservata altrove | Scelta MyHealthData |
|---|---|---|
| Sonno | Storico esteso, trend e note spesso premium | Storico completo, intervalli 7/30/90, obiettivo, deficit e variazione oraria inclusi |
| Farmaci | Numero di terapie, caregiver, report o reminder avanzati limitati | Terapie illimitate, orari/intervalli/al bisogno, registro dosi, scorte e reminder locali inclusi |
| Sintomi | Trend oltre 30 giorni e correlazioni spesso premium | Check-in e storico completi, severita e andamento sempre disponibili |
| Analisi | OCR, trend e archivio longitudinale spesso in abbonamento | Inserimento multi-analita, pannelli e confronti per unita inclusi; OCR resta futuro e on-device |
| Visite | Preparazione e riepilogo dispersi tra portali | Domande, preparazione, follow-up e promemoria locali inclusi |
| Export | Intervalli personalizzati o formati utili spesso a pagamento | Periodo e categorie selezionabili, anteprima e verifica di integrita inclusi |

Le funzioni non ancora implementate non vengono simulate con pulsanti finti: restano nella roadmap finche non esiste un flusso completo e verificabile.
