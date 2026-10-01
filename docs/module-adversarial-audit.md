# Module Adversarial Audit Loop

This is the repeatable five-pass review used for every health module. It is intentionally module-agnostic so new modules such as palestra receive the same scrutiny as legacy modules.

## Pass 1: Entry and orientation
- Enter from the dashboard and from any quick widget.
- Confirm one title, one leading header, one primary action and a predictable back action.
- Confirm empty, loading, permission-denied and error states are useful and do not block the whole app.

## Pass 2: Fast capture
- Test the most common action with one obvious tap.
- Check keyboard/focus, date defaults, units, cancellation and edit mode.
- Confirm saving is idempotent and does not freeze the main actor.

## Pass 3: Longitudinal data
- Test one record, many records and a large imported dataset.
- Verify date scopes, paging/aggregation, chart readability and deletion/editing.
- Confirm labels are Italian and that the UI distinguishes measured, imported, inferred and user-corrected data.

## Pass 4: Failure and privacy
- Deny permissions, interrupt Bluetooth, disconnect the network, import a malformed file and reopen after termination.
- Confirm errors are recoverable, sensitive content is not logged, and temporary files are cleaned up.
- Confirm destructive actions require the right confirmation and preserve unrelated records.

## Pass 5: Adaptive UI and accessibility
- Test compact iPhone width, iPad split/expanded width and Mac Catalyst resizing.
- Verify two columns on supported iPhones and adaptive four-or-more-column layouts on wide screens.
- Check Dynamic Type, VoiceOver labels, keyboard focus and Reduce Motion.

## Current module matrix
| Module | Entry | Capture | Longitudinal | Failure/privacy | Adaptive/accessibility |
|---|---|---|---|---|---|
| Dolori corporei | Pending focused audit | Pending | Pending | Pending | Pending |
| Ciclo mestruale | Pending focused audit | Pending | Pending | Pending | Pending |
| Salute sessuale | Pending focused audit | Pending | Pending | Pending | Pending |
| Allergie | Pending focused audit | Pending | Pending | Pending | Pending |
| Vista | Pending focused audit | Pending | Pending | Pending | Pending |
| Salute intestinale | Pending focused audit | Pending | Pending | Pending | Pending |
| Denti | Pending focused audit | Pending | Pending | Pending | Pending |
| Sonno | Pending focused audit | Pending | Pending | Pending | Pending |
| Cuore e respiro | Pending focused audit | Pending | Pending | Pending | Pending |
| Movimento | Pending focused audit | Pending | Pending | Pending | Pending |
| Palestra | Single leading header and plan dashboard implemented | Plan/day completion implemented | History and muscle summary implemented; large-data fixture pending | Third-party media excluded; encrypted persistence/export verified by build | Catalyst and generic iOS builds pass; full accessibility pass pending |
| Misure corporee | Dashboard con un solo ingresso principale e stato vuoto compatto | Inserimento manuale centrato su peso/BMI; composizione e circonferenze in gruppi richiudibili; smart-scale ancora disponibile | Latest weight/delta and goal available; large-data fixture pending | Salva solo i campi compilati; diagnostica BLE preservata senza inventare impedenza | Web verificato a 390/640/1280px senza overflow; Catalyst passa; Dynamic Type e hardware compatto ancora da verificare |
| Diario alimentare | Pending focused audit | Pending | Pending | Pending | Pending |
| Acqua e alcol | Pending focused audit | Pending | Pending | Pending | Pending |
| Visite | Pending focused audit | Pending | Pending | Pending | Pending |
| Farmaci | Pending focused audit | Pending | Pending | Pending | Pending |
| Percorso di salute | Ritirato: escluso da cataloghi, navigazione e UI Web/iOS; mapping legacy conservato per import/export | Non applicabile | Non applicabile | Dati storici e sincronizzazione conservati per compatibilità | Non applicabile |
| Documenti sanitari | Pending focused audit | Pending | Pending | Pending | Pending |
| Analisi del sangue | Pending focused audit | Pending | Pending | Pending | Pending |

## Exit criteria
A module is considered complete only when all five passes have no open high-severity defect, its primary capture path is tested with one record and a large dataset, and the Catalyst build succeeds.
