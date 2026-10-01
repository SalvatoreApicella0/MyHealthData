# Presentazione delle metriche (Web · DataScrollPage)

Decisione per metrica su come rappresentare il dato nella pagina "Dati" del Web.
Il documento è guidato dai dati reali presenti sul dispositivo e dalle regole di
prodotto (istantaneo / ultimo+tempo / media / aggregato giornaliero / trend utile / tabella).

## Regole di riferimento

- **Istantaneo / ultimo+tempo** → card statica: valore + unità + tempo relativo. Nessuna sparkline.
- **Aggregato giornaliero** → card statica: totale di oggi + media 7 giorni e 30 giorni. Nessun grafico.
- **Trend utile** → card con valore + tempo relativo + sparkline, solo se esiste una serie reale
  (≥3 punti distribuiti su ≥30 giorni).
- **Tabella** → dati sparsi, esami, coppie sinistra/destra, raggruppati per data/coppia.
- Il tempo relativo è sempre mostrato per le metriche istantanee e per l'ultimo campione.

## Evidenza dai dati reali (solo aggregati)

Conteggi e intervalli di date osservati sul dispositivo, usati per decidere
"serie reale" vs "snapshot". Nessun valore clinico è riportato.

| Metrica | n | giorni distinti | range | gap mediano (g) |
|---|---:|---:|---|---:|
| sleep_hours | 29432 | 1593 | 2016-07-01 → 2026-09-14 | 1 |
| oxygen_saturation | 13584 | 1165 | 2022-08-06 → 2026-09-14 | 1 |
| stair_descent_speed | 5570 | 1004 | 2022-08-08 → 2026-09-13 | 1 |
| stair_ascent_speed | 4749 | 1001 | 2022-08-07 → 2026-09-13 | 1 |
| step_count | 2856 | 2856 | 2018-06-25 → 2026-09-13 | 1 |
| active_energy_burned | 2652 | 2652 | 2018-06-25 → 2026-09-13 | 1 |
| heart_rate | 2612 | 2612 | 2016-11-26 → 2026-09-13 | 1 |
| basal_energy_burned | 2255 | 2255 | 2018-06-25 → 2026-09-13 | 1 |
| distance_walking_running | 2209 | 2209 | 2018-06-25 → 2026-09-13 | 1 |
| exercise_minutes | 1973 | 1973 | 2018-06-25 → 2026-09-13 | 1 |
| resting_heart_rate | 1923 | 1687 | 2018-09-20 → 2026-09-13 | 1 |
| flights_climbed | 1853 | 1853 | 2018-10-29 → 2026-09-12 | 1 |
| heart_rate_variability | 1826 | 1826 | 2018-09-19 → 2026-09-13 | 1 |
| headphone_audio_exposure | 1811 | 1811 | 2019-10-06 → 2026-09-13 | 1 |
| walking_heart_rate_average | 1781 | 1781 | 2018-09-19 → 2026-09-12 | 1 |
| stand_minutes | 1601 | 1601 | 2019-09-19 → 2026-09-13 | 1 |
| environmental_audio_exposure | 1172 | 1172 | 2022-08-05 → 2026-09-13 | 1 |
| physical_effort | 1038 | 1038 | 2023-09-17 → 2026-09-13 | 1 |
| respiratory_rate | 886 | 886 | 2022-08-07 → 2026-09-13 | 1 |
| daylight_minutes | 861 | 861 | 2023-09-18 → 2026-09-12 | 1 |
| workout_minutes | 657 | 421 | 2018-07-12 → 2026-09-10 | 2 |
| walking_speed | 316 | 316 | 2021-01-29 → 2026-09-13 | 1 |
| walking_step_length | 316 | 316 | 2021-01-29 → 2026-09-13 | 1 |
| walking_double_support | 312 | 312 | 2021-01-29 → 2026-09-13 | 1 |
| walking_asymmetry | 289 | 289 | 2021-01-29 → 2026-09-13 | 1 |
| weight | 288 | 145 | 2014-10-19 → 2026-09-12 | 6 |
| body_mass_index | 264 | 136 | 2014-10-19 → 2026-09-12 | 6 |
| dietary_water | 181 | 162 | 2015-12-13 → 2026-09-14 | 1 |
| body_fat_percentage | 97 | 76 | 2025-02-03 → 2026-09-12 | 2 |
| height | 95 | 80 | 2016-11-09 → 2026-09-12 | 2 |
| lean_body_mass | 90 | 76 | 2025-02-03 → 2026-09-12 | 2 |
| dietary_energy | 75 | 75 | 2023-06-28 → 2026-07-09 | 1 |
| vo2_max | 66 | 55 | 2019-05-22 → 2026-09-05 | 6 |
| distance_cycling | 24 | 24 | 2018-08-03 → 2022-09-13 | 12 |
| alcohol_units | 17 | 5 | 2026-07-12 → 2026-09-14 | 6 |
| mindful_minutes | 17 | 14 | 2018-09-21 → 2025-09-10 | 21 |
| swimming_stroke_count | 11 | 11 | 2019-03-20 → 2024-03-26 | 21.5 |
| distance_swimming | 10 | 10 | 2019-03-20 → 2024-03-26 | 30 |
| dietary_caffeine | 2 | 2 | 2026-06-27 → 2026-09-14 | 79 |
| circonferenze singole (collo, spalle, vita, fianchi, torace, addome sup./inf.) | 2 | 2 | 2026-07-13 → 2026-07-19 | 6 |
| circonferenze appaiate (braccio, avambraccio, coscia, polpaccio sx/dx) | 1 | 1 | 2026-07-13 | — |
| systolic_pressure / diastolic_pressure | 1 | 1 | 2026-07-12 | — |
| lap_results (analisi) | 0 | — | — | — |
| sleep_sessions | 0 | — | — | — |
| gym_workouts | 1 | 1 | 2026-07-16 | — |
| documents | 6 | 4 | 2026-06-07 → 2026-07-25 | — |
| appointments | 1 | 1 | 2026-07-21 | — |

## Tabella di decisione

| Metrica | Classe | Motivazione | Dove |
|---|---|---|---|
| heart_rate | Istantaneo | snapshot da letture/allenamenti, nessuna serie continua | Cuore e respiro → card statica |
| resting_heart_rate | Istantaneo (media giornaliera) | valore giornaliero stabile, rumore giornaliero alto | Cuore e respiro → card statica |
| walking_heart_rate_average | Istantaneo | snapshot per camminata | Cuore e respiro → card statica |
| heart_rate_variability | Istantaneo | snapshot giornaliero rumoroso | Cuore e respiro → card statica |
| oxygen_saturation | Istantaneo | snapshot rumoroso, nessun trend utile | Cuore e respiro → card statica |
| respiratory_rate | Istantaneo | snapshot giornaliero | Cuore e respiro → card statica |
| vo2_max | Trend utile | 66 punti su 7 anni, serie reale | Cuore e respiro → card + sparkline |
| systolic_pressure / diastolic_pressure | Istantaneo | dato isolato, esame | Cuore e respiro → card statica |
| body_temperature | Istantaneo | valore puntuale | Cuore e respiro → card statica |
| step_count | Aggregato giornaliero | cumulativo giornaliero | Movimento → totale oggi + media 7/30 |
| active_energy_burned | Aggregato giornaliero | cumulativo giornaliero | Movimento → totale oggi + media 7/30 |
| basal_energy_burned | Aggregato giornaliero | cumulativo giornaliero | Movimento → totale oggi + media 7/30 |
| distance_walking_running | Aggregato giornaliero | cumulativo giornaliero | Movimento → card "Distanze" (oggi + media 7g) |
| exercise_minutes | Aggregato giornaliero (settimanale) | cumulativo giornaliero, vista WHO | Movimento → card settimana ISO + media 4/12 settimane |
| stand_minutes | Aggregato giornaliero | cumulativo giornaliero | Movimento → totale oggi + media 7/30 |
| flights_climbed | Aggregato giornaliero | cumulativo giornaliero | Movimento → totale oggi + media 7/30 |
| daylight_minutes | Aggregato giornaliero | cumulativo giornaliero | Movimento → totale oggi + media 7/30 |
| workout_minutes | Aggregato giornaliero | duplicato di exercise_minutes | Movimento → Altri dati |
| distance_cycling | Aggregato giornaliero | cumulativo ma sparso | Movimento → card "Distanze" (ultimo + tempo) |
| distance_swimming | Aggregato giornaliero | cumulativo ma sparso | Movimento → card "Distanze" (ultimo + tempo) |
| swimming_stroke_count | Aggregato giornaliero | cumulativo ma sparso | Movimento → Altri dati |
| treadmill_corrected_distance / treadmill_corrected_energy | Aggregato giornaliero | cumulativi, nessun record | Movimento → Altri dati |
| walking_speed | Istantaneo | metrica di andatura, mostrata come passo | Movimento → tabella "Andatura" (min/km) |
| walking_step_length | Istantaneo | metrica di andatura snapshot | Movimento → tabella "Andatura" |
| walking_asymmetry | Istantaneo | metrica di andatura snapshot | Movimento → tabella "Andatura" |
| walking_double_support | Istantaneo | metrica di andatura snapshot | Movimento → tabella "Andatura" |
| stair_ascent_speed / stair_descent_speed | Istantaneo | metrica di andatura snapshot, stima piani/min | Movimento → card "Scale" unica (piani/min) |
| weight | Trend utile | 288 punti, gap ~6 giorni, serie reale | Misure corporee → card + sparkline |
| body_mass_index | Istantaneo (derivato) | derivato dal peso, ridondante come trend | Misure corporee → card statica |
| body_fat_percentage | Trend utile | 97 punti su 76 giorni | Misure corporee → card + sparkline |
| lean_body_mass | Trend utile | 90 punti su 76 giorni | Misure corporee → card + sparkline |
| height | Istantaneo | valore stabile nel tempo | Misure corporee → card statica |
| circonferenze appaiate (arm/forearm/thigh/calf, sx/dx) | Tabella | confronto sinistra/destra | Misure corporee → tabella compatta |
| circonferenze singole (collo, spalle, vita, fianchi, torace, addome sup./inf.) | Istantaneo | dato sporadico, nessuna serie ≥3 punti/≥30g | Misure corporee → card statiche |
| dietary_water | Aggregato giornaliero | cumulativo giornaliero | Idratazione → totale oggi + media 7/30 |
| dietary_caffeine | Aggregato giornaliero | cumulativo ma sparso | Idratazione → totale oggi + media 7/30 |
| alcohol_units | Aggregato giornaliero | cumulativo ma sparso | Idratazione → totale oggi + media 7/30 |
| dietary_energy | Aggregato giornaliero | cumulativo giornaliero | Alimentazione → totale oggi + media 7/30 |
| sleep_hours | Aggregato giornaliero | media per notte, dato quotidiano | Sonno → media notturna + media 7/30 |
| blood_glucose | Trend utile se serie, altrimenti istantaneo | dipende dai dati del dispositivo | Diabete → card (+ sparkline se serie) |
| mindful_minutes | Aggregato giornaliero | cumulativo sporadico | Movimento → totale oggi + media 7/30 |
| labResults | Tabella | dati tipo esame, raggruppati per data | Analisi → tabella |
| documents | Tabella | documento con data, raggruppati per data | Documenti → tabella |
| appointments | Tabella | appuntamento con data, raggruppati per data | Visite → tabella |
| gymWorkouts | Tabella | seduta con data e serie | Palestra → tabella |
| sleep_sessions | Tabella | sessione con date | Sonno → tabella |
