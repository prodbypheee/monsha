# Il campionato

Una tab dentro l'area riservata: classifica e statistiche del campionato
vero, quello che si gioca su **eLudo**. Qui non si scrive niente — si
legge e si mostra.

## Da dove arrivano i numeri

Il sito di eLudo è un'applicazione Flutter: nell'HTML non c'è un solo
dato, tutto viene disegnato su tela, e raschiare la pagina non porterebbe
da nessuna parte. Sotto però c'è un'API pubblica che risponde **senza
credenziali**, ed è quella che si usa.

Tre chiamate, due secondi in tutto:

| chiamata | cosa dà |
| --- | --- |
| `teamOpen.retrieveEventsForTeam(265)` | a quali campionati partecipa il club |
| `eventOpen.retrieveById(<id>)` | il campionato intero, ~5 MB |
| `eventOpen.standings(faseId, girone)` | la classifica del nostro girone |

## La cosa più importante: le due identità

Su eLudo la squadra ha **due id**. Ogni stagione ne crea uno nuovo — 475
per la Eludo League appena finita — mentre il club ne ha uno permanente
che non cambia mai: il **265**.

Nel codice è scritto solo il 265, ed è l'unico numero scritto a mano.
Tutto il resto si trova da sé:

- a quale campionato partecipiamo → si chiede a eLudo, si prende quello
  non ancora finito (se sono tutti finiti si tiene l'ultimo, così fra una
  stagione e l'altra la pagina racconta com'è andata invece di restare
  vuota);
- in quale serie e in quale girone → si cerca dentro l'evento la squadra
  il cui `originalTeam` è 265;
- come si chiamano gli avversari, quante giornate, chi ha segnato → tutto
  dall'evento.

**Il giorno che comincia un campionato nuovo, o che si sale di categoria,
non c'è una riga da cambiare.**

## Cosa NON si chiama, di proposito

L'endpoint `teamOpen.retrieveOriginalTeamForEventTeam` restituisce anche
**le email dei membri**, in chiaro e senza autenticazione. Non ci serve —
il 265 lo sappiamo — e roba del genere non deve passare nemmeno di
sfuggita da un nostro server. Gli endpoint elencati sopra sono stati
controllati: nel dato che salviamo non c'è nemmeno una chiocciola.

## Cinque megabyte che diventano otto chilobyte

La risposta con il campionato intero pesa ~5 MB: impensabile farla
scaricare a chi apre la tab dal telefono. La funzione la legge sul
server, tiene solo quello che serve e mette da parte il risultato:
**8 KB**.

La copia vale mezz'ora. Un campionato non si muove più in fretta di così,
e venti persone che aprono la tab non devono diventare venti scaricamenti
da cinque megabyte.

Se eLudo non risponde si servono **gli ultimi dati buoni** con la data in
cui sono stati letti, e la pagina lo dice: una classifica di ieri è
utile, una classifica di ieri spacciata per quella di oggi no.

## Due trappole trovate guardando i dati veri

**I nomi hanno gli spazi in fondo.** Su eLudo lo stesso giocatore compare
a volte come `"rageevii "` e a volte come `"rageevii"`. Contando per nome,
il capitano risultava due persone diverse con i gol divisi a metà — 12 e
4 invece di 16. Si aggrega **per identificativo del giocatore**, mai per
nome.

**La fase contiene due gironi.** Una classifica marcatori che mescola il
girone A e il girone B racconta un campionato che nessuno ha giocato. Si
guardano solo le partite del nostro.

## Cosa si vede, e cosa no

- **La classifica** viene dal suo endpoint e non si ricalcola: i punti li
  fa il campionato con le sue regole sui pari punti, e rifare il conto
  vorrebbe dire indovinarle e sbagliare.
- **Le statistiche dei singoli** non stanno in una classifica già pronta
  (quella torna vuota) ma dentro ogni partita, una riga per giocatore. Si
  sommano da lì, e in cambio si ottengono anche i voti e le porte
  inviolate che una classifica marcatori non avrebbe.
- **Le fasi a eliminazione restano fuori.** Nella Eludo League la finale
  non è mai stata registrata su eLudo — la fase esiste, con le due
  finaliste, ma senza risultato. Una sezione che si ferma a metà strada
  racconta la stagione peggio che non raccontarla affatto.

Vale la pena ripeterlo: **si vede quello che eLudo registra**. Se lì manca
un risultato, manca anche qui, e la pagina lo dice apertamente invece di
lasciar credere che sia colpa nostra.

## I file

| file | cosa fa |
| --- | --- |
| `netlify/lib/campionato.mjs` | chiamate a eLudo, distillazione, copia da parte |
| `netlify/functions/campionato.mjs` | `/api/campionato/stato` e `/aggiorna` |
| `monsha/app.js` (modulo `campionato`) | la tab |

`POST /api/campionato/aggiorna` rilegge subito saltando la mezz'ora: è
solo per l'amministratore, e serve quando eLudo carica un risultato e non
si vuole aspettare.
