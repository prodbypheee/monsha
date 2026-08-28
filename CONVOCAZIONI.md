# Convocazioni — cosa fare per accenderle

La prima tab dentro l'area riservata. Il capitano segna i giorni di
allenamento, ai giocatori arriva una notifica sul telefono con due
bottoni — presente o assente — e alle 20:00 il capitano riceve per
mail l'elenco di chi c'è.

Il codice è nel repository. Perché funzioni tutto servono tre
variabili nuove su Netlify: senza, la tab si usa lo stesso dal sito,
ma non parte nessuna notifica e non arriva nessuna mail.

## 1. Le chiavi delle notifiche

Netlify → **Site configuration → Environment variables**.

| Nome | Valore |
|---|---|
| `VAPID_PUBLIC_KEY` | la metà pubblica della coppia |
| `VAPID_PRIVATE_KEY` | la metà segreta |
| `VAPID_SUBJECT` | `mailto:` con un tuo indirizzo |

La coppia si genera una volta sola, in un terminale dentro la cartella
del sito:

```bash
npm run chiavi-push
```

Sono le chiavi che firmano le notifiche: dicono a Google e ad Apple
che l'avviso arriva davvero dal tuo sito. Se le cambi, tutti i
dispositivi già iscritti smettono di ricevere e devono ripremere
"Attiva le notifiche".

`VAPID_SUBJECT` è solo un recapito che i servizi di notifica usano per
avvisarti se qualcosa va storto: va bene `mailto:tuoindirizzo@…`.

## 2. La mail del riepilogo

Su [EmailJS](https://dashboard.emailjs.com) serve un **secondo
template**, oltre a quello delle richieste di accesso. Nel campo
destinatario metti `{{to_email}}`: i destinatari sono più d'uno e
cambiano, quindi non può essere un indirizzo fisso.

**Nel corpo del messaggio** metti una riga sola, con **tre** graffe:

```
{{{corpo}}}
```

Tre e non due: due graffe scrivono l'HTML come testo, tre lo inseriscono
davvero. Tutta la grafica — testata, numeri, facce dei giocatori, bottone
— la costruisce il server in `netlify/lib/mail-riepilogo.mjs`, quindi si
modifica nel codice e non a mano dentro un campo di EmailJS.

Se lasci il vecchio corpo a testo non si rompe niente: le variabili qui
sotto ci sono ancora e la mail arriva, solo senza grafica.

Variabili disponibili nel template:

```
{{{corpo}}}        la mail intera, gia impaginata (TRE graffe)
{{to_email}}       a chi sta arrivando (mettila nel campo "To")
{{capitano}}       l'ID di gioco di chi la riceve
{{allenamento}}    "Giovedì 4 settembre"
{{data}}           2026-09-04
{{riassunto}}      "9 presenti · 2 assenti · 3 senza risposta"
{{n_presenti}}     {{n_assenti}}     {{n_muti}}
{{presenti}}       elenco di ID separati da virgola
{{assenti}}        idem
{{non_risposto}}   idem
{{panel_url}}      link diretto a quella giornata sul sito
```

Poi aggiungi su Netlify:

| Nome | Valore |
|---|---|
| `EMAILJS_TEMPLATE_CONVOCAZIONI` | l'ID del template appena creato |
| `EMAIL_RIEPILOGO` | gli indirizzi che ricevono il riepilogo, separati da virgola |

Le altre quattro variabili di EmailJS sono già impostate: sono le
stesse dell'avviso per le nuove richieste di accesso.

### Perché gli indirizzi stanno in una variabile e non nel codice

Questo repository è **pubblico**. Un indirizzo scritto in un file
finisce indicizzato dai motori di ricerca e resta nella cronologia git
per sempre — non lo si toglie più nemmeno cancellandolo, se non
riscrivendo tutta la storia del repository. I raccoglitori di spam
leggono esattamente questo. In una variabile d'ambiente invece gli
indirizzi non escono dal pannello Netlify, e si cambiano in dieci
secondi senza fare un commit.

Se `EMAIL_RIEPILOGO` non c'è, il riepilogo torna ad andare agli account
con incarico di capitano o amministrazione e all'amministratore: meglio
mandarlo a chi sta già dentro che non mandarlo affatto.

Gli indirizzi si separano con virgole, spazi o a capo; i doppioni e le
righe che non sono indirizzi vengono ignorati. Quando un indirizzo
corrisponde anche a un account del sito, nella mail `{{capitano}}`
riporta il suo ID di gioco; per gli altri resta vuoto.

Il piano gratuito di EmailJS regge circa 200 mail al mese in tutto.
Con tre allenamenti a settimana e due o tre destinatari siamo intorno
alle quaranta: c'è margine, ma è bene saperlo prima di aggiungere
altre mail automatiche.

## 3. Gli incarichi

Sono una cosa diversa dall'essere amministratore. `admin` comanda
sugli **accessi**; l'incarico dice cosa uno fa negli **allenamenti**.

| Incarico | Cosa può fare |
|---|---|
| Giocatore | risponde presente o assente, vede chi ha risposto |
| Capitano | in più sceglie i giorni di allenamento |
| Amministrazione | esattamente come il capitano |

Si assegnano dal pannello **Gestione**, dal menu accanto a ogni membro
approvato. Chi si registra nasce giocatore, amministratore compreso: se
vuoi essere anche capitano devi assegnartelo, ed è voluto — comandare
sugli accessi non vuol dire essere il capitano.

L'amministratore può sempre fissare gli allenamenti anche senza
incarico, altrimenti un capitano sparito lascerebbe la squadra ferma.

## 4. Come funziona la giornata

1. Il capitano apre **Convocazioni** e tocca i giorni sul calendario:
   questa settimana e le quattro successive. Salva.
2. Nei giorni segnati, **alle 14:00** parte una notifica a tutti i
   membri approvati, capitano compreso.
3. **Alle 17:00** parte una seconda notifica, ma solo a chi non ha
   ancora risposto. Richiamare anche chi ha già detto la sua è il modo
   più rapido per far spegnere le notifiche a tutta la squadra.
4. **Alle 20:00** parte la mail del riepilogo a capitano,
   amministrazione e amministratore.

Gli orari sono ora italiana e restano giusti anche col cambio dell'ora
legale: la funzione programmata gira ogni ora tonda e ogni volta guarda
che ore sono a Roma, invece di fidarsi di un orario fisso in UTC che
sbaglierebbe di un'ora per metà anno.

### Le due prove, solo per l'amministratore

In fondo alla scheda Notifiche, e visibili **solo all'amministratore**,
ci sono due bottoni:

| Bottone | Cosa fa |
|---|---|
| **Notifica di prova a tutti** | manda subito una notifica a tutti i membri che le hanno accese. Dice a chiare lettere che è una prova, e chiede conferma prima di partire. |
| **Manda il riepilogo adesso** | spedisce la stessa identica mail delle 20:00, agli stessi indirizzi, senza aspettare. |

Servono perché altrimenti, per sapere se qualcosa funziona, bisogna
aspettare le 14:00 di un giorno di allenamento: un tentativo ogni
ventiquattr'ore, e al buio.

Sono riservati all'amministratore perché raggiungono persone vere: uno
fa vibrare i telefoni di tutta la squadra, l'altro spedisce mail e
consuma il piano gratuito di EmailJS.

Si può rispondere anche senza notifica, dal sito, e si può cambiare
idea fino a mezzanotte — anzi, fino alle sei del mattino dopo, perché
una notifica delle 17:00 toccata a mezzanotte e mezza è comunque una
risposta sincera.

## 5. I due bottoni dentro la notifica

**Su Android funzionano davvero**: si tocca "Presente" e la risposta
parte, il sito non si apre nemmeno. Il service worker chiama il server
da solo, con il cookie di sessione che il browser attacca lui.

**Su iPhone no, e non è un limite risolvibile**: Safari ignora i
bottoni dentro le notifiche. Lì il tocco apre il sito, già aperto sulla
giornata giusta, con i due bottoni grandi in mezzo allo schermo. È un
tocco in più, non c'è modo di evitarlo.

**Sempre su iPhone**, per ricevere qualsiasi notifica il sito deve
stare nella schermata Home: Condividi → «Aggiungi alla schermata
Home», poi si riapre da lì. Senza, iOS non consegna niente. La scheda
delle notifiche lo spiega da sola a chi apre da iPhone.

## 6. Dove sta il codice

| File | Cosa fa |
|---|---|
| `netlify/lib/comune.mjs` | sessione, cookie, utenti, date italiane — condiviso |
| `netlify/lib/convocazioni.mjs` | giorni e risposte nell'archivio |
| `netlify/lib/push.mjs` | invio delle notifiche, sottoscrizioni |
| `netlify/lib/posta.mjs` | invio delle mail via EmailJS |
| `netlify/lib/mail-riepilogo.mjs` | la grafica della mail: testata, numeri, facce |
| `netlify/functions/convocazioni.mjs` | le API `/api/convocazioni/:azione` |
| `netlify/functions/convocazioni-cron.mjs` | l'orologio: 14:00, 17:00, 20:00 |
| `strumenti/anteprima-mail.mjs` | `npm run anteprima-mail` — genera la mail su file per guardarla |
| `monsha/sw.js` | la notifica e i suoi due bottoni |
| `monsha/manifest.webmanifest` | l'aggiunta alla schermata Home |
| `monsha/index.html` | il markup, dentro `#arDentro` |
| `monsha/app.js` | in fondo, il modulo `convocazioni` |
| `strumenti/prove.mjs` | `npm run prove` — date, fusi, sessioni |
| `strumenti/icone.mjs` | `npm run icone` — rigenera le icone dell'app |

I dati stanno in **Netlify Blobs**, store `area-convocazioni`, incluso
nel piano gratuito:

```
giorni                        i giorni scelti dal capitano
risposte/<data>/<chiave>      una voce per persona e per giornata
push/<chiave>                 i dispositivi iscritti alle notifiche
inviate/<data>/<ora>          segno di spunta contro il doppio invio
```

Le risposte hanno una chiave per persona invece di un unico documento
per giornata, e non è pignoleria: se venti persone rispondono nello
stesso minuto alle 14:00, venti scritture sullo stesso documento si
sovrascrivono a vicenda e qualcuno sparisce dall'elenco senza che
nessuno se ne accorga.

## 7. Se qualcosa non va

- **"Le notifiche non sono ancora configurate sul server"** → mancano
  `VAPID_PUBLIC_KEY` e `VAPID_PRIVATE_KEY`.
- **Nessuna notifica arriva, ma la tab funziona** → guarda Netlify →
  Logs → Functions, riga `convocazioni-cron`. Se non compare niente
  alle 14:00 italiane, la funzione programmata non sta girando; se
  compare "notifiche saltate, mancano le chiavi VAPID", vedi sopra.
- **Il riepilogo non arriva** → manca `EMAILJS_TEMPLATE_CONVOCAZIONI`,
  oppure il template non ha `{{to_email}}` nel campo destinatario.
- **Il riepilogo arriva alle persone sbagliate** → controlla
  `EMAIL_RIEPILOGO`. Nei log della funzione `convocazioni-cron` c'è
  scritto a quante persone è partito.
- **Su iPhone non arriva niente** → il sito non è nella schermata Home,
  o il permesso è stato negato.
- **Un membro non si vede in faccia nella sua scheda** → il suo ID di
  gioco non coincide con nessun `nick` in `monsha/rosa.json`. Il
  confronto ignora maiuscole e spazi, ma non i caratteri diversi.
