# Web "Dati" — IA e classificazione metriche (2026-09)

Documento di lavoro. Fonte: revisione prodotto del 2026-09-14. Serve a decidere
cosa mostrare, in che ordine, e con quale visualizzazione, sezione per sezione.

## Decisioni già prese

1. La **Dashboard sparisce** (web e iOS). La home è la scroll "Dati".
2. **Documenti** esce dalla scroll ed è una voce propria (web: sidebar; iOS: tab bar).
3. Sezioni rimosse o accorpate:
   - `Percorso di salute` rimosso dalla scroll.
   - `Respirazione` assorbito in `Cuore e respiro` (i 4 tipi sono già lì).
   - `Glicemia/Diabete` assorbito in `Analisi` come analita + card dedicata.
   - `Diario alimentare` non è più una sezione separata: vive dentro
     `Alimentazione` (giorno + pasti + ricette).
4. Pasti: solo **Colazione, Pranzo, Cena, Spuntini** (gli 8 tipi iOS vengono
   mappati su questi 4 in visualizzazione).
5. Ogni "Aggiungi" apre un **entry form modale dall'alto** (sheet), non un form
   inline nella pagina. Vale per alimentazione, dolori, ciclo, palestra, analisi.
6. Alimentazione: **tutto ad anelli** (kcal necessarie, assunte, macro), e un
   pannello **Impostazioni alimentazione** che, partendo dal peso rilevato,
   calcola fabbisogno e obiettivi (come su iOS).
7. Dolori corporei: card con registrati + anteprima ultimi 3; flusso di aggiunta
   a step (tipo → intensità → tocco sul corpo 3D → conferma); tap su un record
   apre un modale con i punti sul corpo.
8. Ciclo: niente "+" generico; pulsanti **Impostazioni** e **Segna inizio**
   (calendario in un modale).
9. Palestra: **schede di allenamento** con "fatta l'ultima volta", spunta per
   segnare eseguita (data/ora), creazione schede; in futuro avvio sessione.
10. Analisi del sangue: **tabella multi-valore** con placeholder dei valori più
    comuni, raggruppamento per data, rosso/arancio/verde vs riferimento, valori
    mancanti in fondo ("Non disponibile"), un solo entry modale che salva più
    analiti insieme.

## Classificazione metriche (da confermare)

Legenda: **T** = trend/temporale utile; **U** = solo ultimo valore; **M** = media;
**A** = aggregato giornaliero (somma).

### Misure corporee
| Metrica | Classe | Sezione | Note |
|---|---|---|---|
| peso | T + obiettivo | Misure | deduplicato, obiettivo dal profilo/impostazioni |
| BMI, massa grassa, massa magra | T | Misure | calcolati, accorpare in "Composizione" |
| circonferenze (15 + lati sx/dx) | U + delta | Misure | accorpare in una card "Circonferenze" |
| altezza | U | Misure | raramente cambia |

### Cuore e respiro
| Metrica | Classe | Note |
|---|---|---|
| frequenza cardiaca | T + U | sparkline + ultimo |
| FC riposo | T + M | media 7/30 |
| HRV | T + M | |
| SatO₂ | U + M | trend poco utile |
| pressione sistolica/diastolica | T | card doppia accoppiata |
| frequenza respiratoria | U + M | |
| VO₂max, cammino 6 min | T | |
| temperatura corporea | U | |

### Movimento
| Metrica | Classe | Note |
|---|---|---|
| passi | A + M | oggi + media 7g, **niente trend** |
| energia attiva | A + M | |
| distanza camminata/corsa | A + M | |
| minuti esercizio/in piedi | A + M | |
| piani saliti | A + M | |
| velocità camminata, lunghezza passo, asimmetria, doppio appoggio | T | dati iOS-only in gran parte |
| nuoto/cyclette/tapis | U | |

### Sonno
| Metrica | Classe | Note |
|---|---|---|
| durata ultima notte | U + obiettivo | |
| media 7 notti | M | |
| fasi | M (14 notti) | niente totali cumulativi |
| variazione orario | M | |

### Alimentazione
| Metrica | Classe | Note |
|---|---|---|
| kcal assunte / fabbisogno | A + obiettivo | anelli |
| macro P/C/G | A + obiettivo | anelli |
| acqua | A + obiettivo | tasti rapidi |
| caffeina | A | |
| alcol | A settimanale | unità |

### Farmaci
| Metrica | Classe | Note |
|---|---|---|
| terapie attive | stato | orari, scorte |
| aderenza 7g | M | barra |
| dosi recenti | lista | |

### Analisi
| Metrica | Classe | Note |
|---|---|---|
| analiti (glicemia, transaminasi, emocromo, lipidi, TSH, creatinina, HbA1c…) | U vs range | tabella per data; trend solo se ≥2 |
| glicemia | T | card dedicata frequente |

### Altri
| Metrica | Classe | Note |
|---|---|---|
| ciclo | previsioni + ultimi | |
| vista | U (ultima prescrizione) | |
| denti | U + storico | tooth tag |
| allergie | lista | severity |
| intestino | U + lista | Bristol |
| sessuale | contatori + lista | |
| palestra | schede + ultima esecuzione | |

## Cosa manca all'app per essere "tutta la salute"

- Occhiali/gradazione: mostrato in Vista (ultima prescrizione) e in Documenti.
- Denti/carie: odontogramma semplificato con elenco per dente.
- Dolori recenti: nella prima sezione, insieme alle misure corporee.
- Documenti: archivio con ricerca e filtri (tab separata).

## Ordine di implementazione

1. Via Dashboard (web) + Documenti in sidebar; via `Percorso` e `Respirazione`.
2. Entry form modale riutilizzabile (sheet) e conversione di tutti gli "Aggiungi".
3. Alimentazione: 4 pasti, anelli completi, impostazioni con calcolo fabbisogno.
4. Dolori corporei: flusso a step + modale dettaglio con i punti.
5. Ciclo: Impostazioni + Segna inizio.
6. Palestra: schede + "fatta".
7. Analisi: tabella multi-valore con placeholder e raggruppamenti per data.
8. Documenti: tab dedicata.
