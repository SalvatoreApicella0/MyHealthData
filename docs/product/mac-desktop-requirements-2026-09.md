# Mac Hub e layout desktop — requisiti

Data: 2026-09-22. Stato: shell Mac menu-bar-only; l'azione Apri usa il browser di sistema (non una finestra Electron); installazione/test con vault locale da verificare a ogni rilascio esplicito.

## Shell Mac

Decisione aggiornata 2026-09-14: **solo menu bar + browser di sistema** (modello Jellyfin). Niente finestra embedded, niente icona nel Dock (`LSUIElement`).
Motivo: stesso codice per macOS, Windows e Linux (i target `dmg/zip`, `nsis`,
`AppImage/deb` sono già in `package.json`), quindi nessuna seconda app per
Windows. L'UI è la Web app nel browser, quindi ogni piattaforma usa lo stesso
client senza manutenzione di due shell.

Comportamento e criteri di accettazione:

1. Menu bar: icona template (già fatta), click apre il menu con stato, apri nel
   browser, connetti dispositivo, copia
   indirizzo, avvio al login, esci.
2. UI: il browser di sistema apre `http://127.0.0.1:8472`; non esiste una finestra
   Electron incorporata. La shell non apre da sola il browser all'avvio/login.
3. Single-instance, riavvio automatico del server in caso di crash, log
   `hub.log`, scelta indirizzo LAN che preferisce `en0`/`en1`.
4. L'interfaccia Web ascolta su loopback. La sync iOS ascolta solo sull'IPv4
   LAN selezionato per pairing; se non esiste un indirizzo LAN, resta su loopback.
   Non inoltrare porte Hub su WAN e non pubblicare il listener tramite reverse proxy.
5. Windows/Linux: stessa shell; da verificare `safeStorage` (DPAPI/libsecret),
   comportamento del tray e percorsi di packaging.
6. Decisioni chiuse per Mac: menu-bar-only (`LSUIElement`), nessuna icona Dock;
   Web UI locale-only. Cambiarle richiede una decisione esplicita di prodotto.

## Layout desktop della Web app

Problema: la Web app usa i token visivi iOS (card 146 pt, raggi 22/28, tipografia
grande, colonna singola). A 1440 px sembra un'app iOS stirata.

Requisiti:

1. Token di densità per desktop: base 14 px, padding card 14 px, raggio 16 px,
   tile 128 px, spaziature ridotte circa del 20% rispetto a oggi.
2. Dashboard a griglia 12 colonne: hero compatto (8 col) + pannello stato/azioni
   rapide (4 col); banda widget a 6 elementi compatti; sotto due colonne per
   recenti e moduli.
3. Sidebar 232 px con voci compatte; niente CTA a blocco; eventuale sezione
   scorciatoie moduli.
4. Topbar: breadcrumb, ricerca/`⌘K`, **un solo** `+ Nuovo` con menu (misura,
   evento, documento, appuntamento).
5. Via le CTA ripetute: il "Registra evento" non compare più in sidebar, topbar e
   hero contemporaneamente.
6. Larghezza contenuto massima ~1400 px, griglia fluida; mobile invariato.
