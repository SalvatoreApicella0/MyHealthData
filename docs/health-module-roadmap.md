# Health module roadmap

## Product rule

The home screen must not expose every possible module. It should show 4-8 modules selected from available data, active goals, and explicit user choices. The complete catalog belongs in a searchable module library. Modules should open immediately from precomputed daily indexes and progressively disclose detailed records.

## Priority 0: reliable foundations

- Daily HealthKit aggregation using the correct sum, average, latest, minimum, or maximum semantic.
- Source deduplication across iPhone, Apple Watch, and third-party devices.
- Background incremental sync with anchors instead of repeated full imports.
- Friendly Italian labels, units, sources, and explanations.
- Instant module shell, cached summaries, deferred charts, pagination, and bounded rendering.
- Data-quality indicators for missing days, partial permissions, conflicts, and stale sources.

## Priority 1: broad everyday modules

- Activity, steps, workouts, movement minutes, stand time, walking distance, running, cycling, swimming.
- Heart, resting heart rate, HRV, walking heart rate, recovery, cardio fitness, rhythm observations.
- Sleep duration, schedule, consistency, sleep debt, stages, awakenings, naps, bedtime routine.
- Body weight, composition, measurements, BMI, waist trend, body-temperature trend.
- Cycle, symptoms, fertile window, predictions, flow, mood, energy, tests, irregularity journal.
- Medications, schedules, adherence, stock, refills, side effects, as-needed use.
- Symptoms and body map, episodes, triggers, relief, intensity, duration, recurrence.
- Visits, appointments, questions, preparation, outcomes, follow-ups, linked documents.
- Lab results, reference ranges, repeated panels, abnormal values, clinician notes.
- Documents, OCR, reports, prescriptions, imaging, certificates, discharge summaries.

## Priority 2: useful specialist modules

- Blood pressure, glucose, temperature, oxygen saturation, respiratory rate, peak flow.
- Hydration, caffeine, alcohol, nutrition, meal timing, appetite, digestive reactions.
- Headache and migraine, aura, triggers, medications, disability days.
- Pain, chronic pain, joint pain, back pain, neuropathic pain, flare tracking.
- Mental wellbeing, mood, anxiety, stress, mindfulness, journaling, social energy.
- Respiratory health, asthma, inhalers, cough, congestion, allergies, pollen exposure.
- Digestive health, bowel diary, reflux, nausea, bloating, food reactions.
- Skin health, lesions, rashes, acne, wounds, photo comparison, treatment response.
- Recovery, readiness, training load, soreness, fatigue, rest days, injury return.
- Mobility, gait, balance, falls, stair speed, asymmetry, walking aids.
- Hearing and sound exposure, tinnitus, headphone exposure, hearing tests.
- Vision, prescriptions, eye pressure, dry eye, headaches, screen strain.
- Dental health, hygiene, pain, procedures, aligners, sensitivity.
- Sexual health, libido, contraception, STI tests, symptoms, reproductive goals.
- Pregnancy and postpartum, symptoms, measurements, appointments, feeding, recovery.
- Menopause, hot flashes, sleep, mood, treatments, symptom burden.

## Priority 3: condition-oriented modules

- Diabetes, hypertension, asthma, COPD, migraine, epilepsy, thyroid disorders.
- PCOS, endometriosis, IBS, IBD, celiac disease, reflux, food intolerance.
- Arthritis, osteoporosis, fibromyalgia, chronic fatigue, long COVID.
- Depression, anxiety, ADHD, bipolar disorder, panic, burnout.
- Kidney health, liver health, cholesterol, anemia, anticoagulation.
- Cancer care, infusion cycles, adverse effects, recovery, surveillance.
- Rehabilitation, physiotherapy, exercises, range of motion, milestones.
- Post-operative recovery, wound checks, pain, mobility, medication, warning signs.

## Priority 4: life context and prevention

- Vaccinations, screenings, family history, allergies, intolerances, emergency card.
- Smoking and nicotine, alcohol reduction, substance recovery, habit streaks.
- Sun exposure, daylight, UV protection, environmental temperature, air quality.
- Work ergonomics, screen time, posture, breaks, commuting, shift work.
- Travel health, jet lag, time-zone medication plans, travel documents.
- Caregiving, dependent profiles, shared care plans, proxy access.
- Health goals, experiments, correlations, personal baselines, weekly review.
- Emergency timeline, critical medications, implants, devices, contacts, export packet.

## Delivery sequence

1. Correct HealthKit semantics and performance for Activity, Heart, and Sleep.
2. Introduce the searchable module library and personalized home selection.
3. Complete Body, Cycle, Medications, Visits, Labs, and Documents.
4. Add symptom-specific modules as configurations over shared event infrastructure.
5. Add condition-oriented experiences only when their data model and safety language are complete.

## Specialist one-tab requirements

### Alimentazione

- Diario per colazione, pranzo, cena e spuntini; calorie e macro giornalieri/settimanali.
- Ricerca alimenti, preferiti, pasti e ricette riutilizzabili, porzioni e obiettivi personalizzati.
- Inserimento rapido testuale o vocale, scansione barcode, foto del pasto e OCR dell'etichetta.
- Correlazioni con peso, glucosio, sonno, attività e sintomi digestivi.
- Nessuna funzione essenziale nascosta dietro abbonamento; avvisi contro uso ossessivo opzionali.

### Diabete

- Glucosio manuale/HealthKit, contesto pre/post pasto, carboidrati, insulina basale e bolo.
- Registro farmaci, pasti fotografati, attività, note, promemoria e report condivisibile.
- Time-in-range e pattern solo quando i dati disponibili sono adeguati.
- Nessun suggerimento automatico di dose: eventuali calcolatori terapeutici richiedono validazione regolatoria separata.

### Digestione

- Pasti, evacuazioni con Bristol scale, dolore, gonfiore, reflusso, nausea e urgenza.
- Stress, sonno, attività, ciclo, farmaci e alimenti come contesto correlabile.
- Timeline dei flare, alimenti sospetti, esportazione per gastroenterologo e privacy locale.

### Vista

- Prescrizioni per occhio: sfera, cilindro, asse, addizione e distanza interpupillare.
- Occhiali e lenti a contatto, data esame, professionista, foto/scansione prescrizione.
- Trend diottrie, sintomi visivi, secchezza, spasmi, cefalea e visione sfocata.
- Promemoria controlli e sostituzione lenti; nessun test diagnostico improvvisato.
