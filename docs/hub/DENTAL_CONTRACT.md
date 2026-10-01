# Contratto dentale Web ↔ iOS

Il contratto dentale è rappresentato da eventi `dental_care`. La Web app li
interpreta in `src/core/dental.ts` con `resolveDentalEvents`; le proiezioni 2D,
3D, riepilogo e storico devono consumare questa proiezione e non rileggere
direttamente i tag.

## Campi e alias

Ogni evento può usare `tooth=<FDI>` e uno o entrambi i tag `action=<valore>` e
`intervention=<valore>`. Sono accettati gli identificativi iOS, i vecchi
identificativi Web e le etichette italiane. Il resolver li porta a un ID stabile
(`checkup`, `filling`, `rootCanal`, `crown`, `implant`, `extraction`,
`orthodontics`, `caries`, `pain`, `cleaning`, `brushing`, `flossing`,
`mouthwash`, `restoration`).

Gli stati espliciti possono essere scritti in `state` o `status`:
`healthy`, `observation`, `caries`, `treated`, `crown`, `implant` e `removed`.
Un dente è valido solo se il valore `tooth` è uno dei 32 denti permanenti FDI.
Gli eventi con un identificativo non valido restano nella cronologia, ma non
entrano nella mappa clinica di un dente.

## Replay deterministico

1. Gli eventi vengono filtrati a `dental_care`, deduplicati per `id` scegliendo
   la revisione con `updatedAt` più recente e ordinati per `occurredAt`.
2. Un evento di estrazione (`state=removed` oppure azione di estrazione) blocca
   il dente nello stato `removed`. Gli eventi ordinari successivi restano nello
   storico, ma non lo riattivano.
3. Il blocco termina solo con `restored=true` oppure con l’azione esplicita di
   ripristino. Il ripristino può riportare il dente a `healthy` o a uno stato
   esplicito non rimosso.
4. La proiezione conserva la cronologia completa per il dettaglio del dente e
   pubblica anche una mappa corrente con stato, tono visuale, rimozione ed
   evento più recente.

Il risultato è indipendente dall’ordine dell’array importato e dagli invii
duplicati. I test in `src/core/dental.test.ts` coprono alias localizzati,
eventi fuori ordine, revisioni duplicate, estrazione monotona, ripristino
esplicito e identificativi FDI invalidi.

## Compatibilità iOS

iOS salva già `state`, `status`, `intervention` e `restored=true` nei propri
eventi. Il Web mantiene quindi la compatibilità con il formato esistente senza
modificare il client iOS. Una modifica al contratto deve aggiornare prima
questo documento e i test Web/iOS condivisi, poi le proiezioni visuali.
