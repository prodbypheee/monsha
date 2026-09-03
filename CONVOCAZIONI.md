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
2. Nei giorni segnati arrivano tre avvisi a tutti i membri approvati,
   capitano compreso: **alle 8:30** il buongiorno (oggi c’è
   allenamento, tocca qui e segna se ci sei), **alle 14:00** il secondo
   avviso, **alle 18:00** l’ultima chiamata.
3. Chi non risponde lo si va a cercare **uno alla volta**: in fondo
   alla tab, chi convoca trova l'elenco di chi non ha ancora detto
   niente e un bottone per persona. Quindici minuti di pausa prima di
   poter risollecitare la stessa persona.
4. **Alle 20:00** parte la mail del riepilogo a capitano,
   amministrazione e amministratore.

C'era anche un richiamo automatico alle 17:00 a tutta la squadra: non
c'è più. Una notifica che arriva a venti telefoni si ignora, e a
diciotto di quei venti arrivava per niente perché avevano già
risposto. Il colpetto sulla spalla di una persona vera funziona meglio,
e chi ha già risposto non lo riceve affatto.

Gli orari sono ora italiana e restano giusti anche col cambio dell'ora
legale: l'orologio gira ogni mezz'ora e ogni volta guarda che ore sono
a Roma, invece di fidarsi di un orario fisso in UTC che sbaglierebbe di
un'ora per metà anno.

### Perché gli orologi sono due file

Un colpo ogni mezz'ora si scriverebbe naturalmente con una funzione
sola e `'0,30 * * * *'`. **Netlify quell'espressione non la onora**: dal
29 agosto al 3 settembre la funzione non è stata chiamata nemmeno una
volta, e non è arrivata più una notifica. Nessun errore, nessun log:
solo silenzio, che è il modo peggiore in cui una cosa può rompersi.

Ora sono **due funzioni programmate** — `'0 * * * *'` e `'30 * * * *'`
— che chiamano lo stesso codice in `netlify/lib/orologio.mjs`. Due
espressioni a valore singolo sono la stessa forma di quella che
funzionava prima e non chiedono niente al parser. Che capitino nello
stesso minuto non è un problema: il segno di spunta contro il doppio
invio è per giornata e per fascia, quindi la seconda trova già fatto e
se ne va.

E a ogni giro, anche quando non c'è niente da fare, l'orologio lascia
un segno di passaggio. È la cosa che è mancata per cinque giorni:
senza, «non è arrivata la notifica» è indistinguibile da «non era
giorno di allenamento». Si legge dal bottone **«Perché non è
arrivata?»** nel pannello prove.

### A che ora arrivi

Chi dice **Presente** dice anche a che ora, con un orologino sotto i due
bottoni: parte dalle **21:30**, che è l'ora in cui si comincia, e le due
freccette lo spostano di mezz'ora alla volta fino alle **23:30**. Sotto
le 21:30 non si scende — non esiste un arrivo prima dell'inizio, e la
freccia che scende resta spenta finché non si è saliti. Chi non tocca
niente ha già risposto bene.

L'ora si può cambiare anche dopo: toccando una freccia quando si è già
segnati presenti, la nuova ora viene registrata subito, senza dover
ripremere Presente. Rispondendo dai bottoni dentro la notifica, dove un
orologio non ci sta, vale quella di partenza.

A un assente l'ora non si chiede, e nell'elenco della giornata compare
solo sotto chi c'è: «assente alle 21:30» non vorrebbe dire niente.

I due capi e i passi di mezz'ora li fa rispettare il **server**: le
frecce del sito sono comodità, non regola. Quel che arriva fuori dai
capi viene riportato dentro invece di essere rifiutato — una risposta
con l'ora storta resta una risposta, e perderla per colpa di un numero
sarebbe il modo peggiore di trattarla.

### Sollecitare chi non risponde

In fondo alla tab **Convocazioni**, e solo per chi può convocare
(capitano, amministrazione, admin): l'elenco di chi non ha ancora
segnato niente per la giornata aperta, con la faccia, il nome e un
bottone **Sollecita** per ciascuno. Chi ha già risposto non compare;
se hanno risposto tutti la scheda lo dice e basta.

Premendo il bottone parte una notifica a quella persona sola, con
dentro il nome di chi la sta cercando — un promemoria automatico si
ignora, una persona che ti aspetta no. Su Android la notifica porta
con sé i due bottoni Presente e Assente.

**La pausa è di quindici minuti ed è per chi la riceve, non per chi la
manda.** Se il conto fosse di chi preme, capitano e amministrazione
potrebbero sollecitare la stessa persona a un minuto di distanza e
farle suonare il telefono due volte, che è proprio la cosa da evitare.
A chi guarda, il bottone si spegne e diventa «fra 12 min».

Il conto lo tiene il **server**: il bottone spento è cortesia verso chi
guarda, non sicurezza. Una richiesta costruita a mano salterebbe il
bottone, e infatti il server rifiuta lo stesso — così come rifiuta di
sollecitare per un giorno senza allenamento, per una giornata ormai
chiusa, o una persona che nel frattempo ha risposto.

Se quella persona non ha acceso le notifiche non parte niente, e lo si
dice apertamente invece di far finta: in quel caso la pausa non
comincia nemmeno, perché sarebbe un quarto d'ora di attesa in cambio
di niente.

### Rispondere in anticipo

In cima all'area riservata, appena c'è un allenamento in calendario,
compare la scheda con **PRESENTE** e **ASSENTE**. Le frecce ‹ › scorrono
tutti i giorni programmati: non serve aspettare il giorno stesso, si può
rispondere per giovedì già di lunedì. Si aprono su oggi se oggi si
allena, altrimenti sul primo che viene, e si fermano ai due capi invece
di girare in tondo.

### Chi c'è stato

Sotto le convocazioni, e **solo per chi può convocare**, la classifica
degli ultimi sette giorni: quante presenze su quanti allenamenti, con
sotto le assenze e i silenzi tenuti distinti — chi ha detto «non ci
sono» ha fatto la sua parte, chi non ha risposto no.

La finestra scorre da sola: sono sempre oggi e i sei giorni prima. Se in
quella settimana non si è tenuto nessun allenamento la scheda **non
compare affatto**: «0 su 0» non è un'informazione, è un riquadro vuoto
che sembra un guasto.

Perché funzioni, i giorni passati restano nell'archivio invece di essere
cancellati a ogni salvataggio del calendario, come succedeva prima:
senza quella storia non si può dire chi c'è stato. Se ne tengono sei
mesi.

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
una notifica delle 14:00 toccata a mezzanotte e mezza è comunque una
risposta sincera.

## 4-bis. La formazione

Una tab a parte dentro l'area riservata, con un campo visto dall'alto e
il **3-4-1-2**: portiere, tre centrali, due esterni e due centrali di
centrocampo, un trequartista, due punte.

**La compila chi può convocare** — capitano, amministrazione,
amministratore. Tutti gli altri la vedono e basta: le caselle non si
toccano e i bottoni non ci sono proprio.

### Solo oggi, e fino a tre partite

La formazione è **sempre e solo quella di oggi**. Prima si potevano
preparare anche i giorni successivi, e non serviva a nessuno: chi c'è lo
si sa la sera stessa, e un campo riempito tre giorni prima era lavoro
buttato. Se oggi non si allena, la tab lo dice e basta.

In compenso una serata sono più partite, e ognuna vuole la sua: ci sono
**tre formazioni**, «Partita 1 / 2 / 3», indipendenti fra loro. Cambiare
undici caselle fra un fischio e l'altro, e perdere quella di prima, non è
un modo di lavorare.

**Durano quanto la serata.** Non c'è nessuna scadenza da far scattare: la
chiave dell'archivio comincia con la data, quindi al prossimo allenamento
sono tre caselle nuove e vuote.

Chi segna assente esce **da tutte e tre**, non solo da quella aperta:
lasciarlo schierato nella seconda perché il capitano stava guardando la
prima sarebbe proprio il buco che quella pulizia esiste per chiudere. E
cambiare partita con del lavoro non salvato lo chiede prima, invece di
farlo scoprire dopo.

### Chi arriva tardi

Accanto alla faccia, in campo e in panchina, compare l'ora di chi arriva
**dopo le 21:30** — 21:30 escluse. L'ora di tutti gli altri non è una
notizia, e scriverla accanto a undici facce su undici sarebbe rumore.
Sopra il campo c'è anche la frase per esteso, perché prima di schierare
la cosa da sapere è chi manca all'inizio.

Due regole, e sono di natura diversa:

- **In campo va solo chi ha segnato presente** quel giorno, e vale in
  ogni momento, non solo quando si schiera. Chi segna assente dopo
  essere stato messo in campo **esce dalle caselle da solo**; e in
  lettura la formazione viene comunque filtrata contro i presenti di
  quel giorno, così un assente non può comparire nemmeno se
  nell'archivio fosse rimasto scritto. L'altra metà della regola viene
  da sé: la panchina è «i presenti meno quelli in campo», quindi chi è
  presente sta sempre da una delle due parti e non sparisce mai.
- **Ogni casella suggerisce un reparto, ma non lo impone.** Il sito
  propone per primi quelli del ruolo giusto e mette gli altri sotto
  una riga che lo dice; **trascinando si mette chiunque ovunque**. Un
  centrocampista in difesa o il portiere in punta sono cose che
  succedono, e chi allena sa perché: un server che glielo impedisse
  pretenderebbe di capire di calcio più di lui.

**Si trascina**: dalla panchina a una casella per farlo entrare, da una
casella a un'altra per scambiare due giocatori, da una casella alla
panchina per farlo uscire. Funziona col dito e col mouse — il drag&drop
del browser sul telefono non esiste, quindi è costruito sui Pointer
Events. Il tocco singolo continua ad aprire la lista, che resta il modo
di schierare da tastiera.

Gli **Icons** non compaiono fra i consigliati di nessuna casella, ma se
hanno segnato presente si possono schierare come tutti gli altri.

Chi ha segnato presente ma non è nella rosa del sito non ha un reparto,
e in quel caso lo si può mettere ovunque: non poterlo schierare
sarebbe peggio che schierarlo nel posto sbagliato.

Il campo è disegnato in SVG, non è un'immagine: resta nitido a ogni
dimensione, non pesa niente e prende i colori del tema. Le posizioni
delle undici caselle stanno in un elenco solo, `CASELLE`, usato sia dal
disegno sia dai controlli del server — così non possono disallinearsi.

## 4-ter. Gli annunci

Una bacheca dentro l'area riservata, e qui **non comanda nessuno**:
scrivono tutti i membri approvati, giocatori compresi. A ogni annuncio
parte una notifica con **chi ha scritto nel titolo e il testo nel
corpo**, così si legge dalla schermata bloccata senza aprire niente.

Ognuno cancella i propri annunci; l'amministratore può cancellare anche
quelli degli altri, ed è la sua unica prerogativa qui.

**Un annuncio al minuto a testa**, e il freno sta sul server, non nel
sito. Qui chiunque può far vibrare venti telefoni: senza un limite
basta una persona annoiata per far spegnere le notifiche a tutta la
squadra — e con quelle se ne vanno anche le convocazioni. Un minuto non
dà fastidio a chi ha davvero qualcosa da dire e rende impossibile il
tormento. Massimo 500 caratteri.

La notifica porta a `?tab=annunci`, che apre direttamente la bacheca.
Gli annunci vivono in `annunci/<chiave>` nello stesso store, uno per
annuncio: se due persone scrivono nello stesso momento su un unico
documento, una delle due sparisce.

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
| `netlify/lib/formazione.mjs` | il 3-4-1-2, le undici caselle e le loro regole |
| `netlify/lib/annunci.mjs` | la bacheca: testo, freno di un minuto, cancellazioni |
| `netlify/functions/annunci.mjs` | le API `/api/annunci/:azione` |
| `netlify/lib/push.mjs` | invio delle notifiche, sottoscrizioni |
| `netlify/lib/posta.mjs` | invio delle mail via EmailJS |
| `netlify/lib/mail-riepilogo.mjs` | la grafica della mail: testata, numeri, facce |
| `netlify/functions/convocazioni.mjs` | le API `/api/convocazioni/:azione` |
| `netlify/lib/orologio.mjs` | il lavoro dell'orologio: 8:30, 14:00, 18:00 e 20:00 |
| `netlify/functions/convocazioni-cron.mjs` | lo chiama allo scoccare dell'ora |
| `netlify/functions/convocazioni-cron-mezza.mjs` | lo chiama alla mezza |
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
formazione/<data>             gli undici schierati quel giorno
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
