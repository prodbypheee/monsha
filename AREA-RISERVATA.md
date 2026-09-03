# Area riservata — cosa fare per accenderla

Il codice è nel repo e le variabili sono impostate su Netlify:
l'area funziona. Questo file resta come promemoria di com'è messa
insieme e di cosa rifare se un giorno il sito va ricostruito da zero.

## 1. Le variabili obbligatorie

Senza queste la tab risponde "Area riservata non configurata" e non fa
entrare nessuno.


Netlify → **Site configuration → Environment variables → Add a variable**.

| Nome | Valore |
|---|---|
| `AUTH_SECRET` | una stringa casuale lunga (vedi sotto) |
| `ADMIN_EMAIL` | `federicomar123456789@gmail.com` |
| `ADMIN_PASSWORD_HASH` | l'impronta della password del pannello, formato `sale:impronta` (vedi §4-bis per generarla) |

Per generare `AUTH_SECRET`, in un terminale:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Copia il risultato così com'è. Serve a firmare i cookie di sessione:
se lo cambi, tutti vengono disconnessi e devono rifare l'accesso —
nessun account viene perso.

`ADMIN_EMAIL` è l'indirizzo che diventa amministratore. Chi si registra
con quell'indirizzo viene approvato automaticamente e vede il pannello
di gestione; tutti gli altri restano in attesa.

## 2. Diventa amministratore

Dopo il deploy, vai su `monacishaolin.it/area-riservata`, apri **Crea un
account** e registrati con l'indirizzo che hai messo in `ADMIN_EMAIL`.
Entri subito e ti compare il pannello **Gestione accessi**.

Fallo per primo, prima di dire a chiunque che l'area esiste.

## 3. La mail di avviso (facoltativa)

Senza questa parte tutto funziona: le richieste si accumulano nel
pannello e le vedi quando ci entri. Serve solo se vuoi ricevere una
mail a ogni nuova richiesta.

Su [EmailJS](https://dashboard.emailjs.com) crea un nuovo template che
usi queste variabili:

```
{{user_email}}    email di chi ha chiesto l'accesso
{{platform}}      PlayStation / Xbox / PC
{{player_id}}     il suo ID di gioco
{{requested_at}}  data e ora della richiesta
{{panel_url}}     link diretto all'area riservata
```

Imposta il destinatario del template sul tuo indirizzo, poi aggiungi su
Netlify altre quattro variabili:

| Nome | Dove si trova su EmailJS |
|---|---|
| `EMAILJS_SERVICE_ID` | Email Services (per il servizio esistente è `Angelica70`) |
| `EMAILJS_TEMPLATE_ID` | l'ID del template appena creato |
| `EMAILJS_PUBLIC_KEY` | Account → General → Public Key (`gYs-un27FZbB_6GZc`) |
| `EMAILJS_PRIVATE_KEY` | Account → General → Private Key |

Serve anche spuntare, in **Account → Security**, l'opzione che consente
le chiamate API fuori dal browser: la mail parte dal server, non dalla
pagina, così arriva anche se chi si registra chiude subito la scheda.

## 4. Come funziona, in breve

**I membri non hanno password.** Entrano con email e ID di gioco, la
stessa coppia che vedi tu quando approvi.

**Tu sì.** Il tuo account non è come gli altri: da lì si approva, si
rifiuta e si elimina chiunque, e mail e ID di gioco sono cose che si
vedono in giro. Quindi l'accesso amministratore chiede anche una
password, e vive a un indirizzo suo:

```
monacishaolin.it/area-riservata-nimda
```

Quell'indirizzo non compare nel menù, non è linkato da nessuna pagina e
ha `X-Robots-Tag: noindex` così non finisce su Google. Ma è comodità,
non sicurezza: chi lo scoprisse troverebbe comunque la password. Se
apri per sbaglio `/area-riservata` e provi a entrare col tuo account, il
campo password compare da solo — non resti fuori.

- **Registrazione** → l'account nasce con stato `in-attesa`. Non fa
  entrare nessuno finché non decidi tu, ma il cookie di sessione viene
  dato **subito**: non apre niente — ogni richiesta esige stato
  "approvato" — e serve a far sì che il giorno che approvi la persona
  sia già riconosciuta e **non debba rifare l'accesso**. Finché è in
  attesa, aprendo l'area vede «richiesta ancora in attesa» invece del
  modulo. Se la rifiuti o la revochi, il cookie viene buttato.
- **Tu approvi o rifiuti** dal pannello. `Revoca` rimette fuori un
  membro già approvato, e chi è connesso in quel momento cade fuori al
  primo caricamento: la sessione viene ricontrollata contro il database
  a ogni richiesta, non ci si fida del cookie.
- **Accesso** → cookie firmato, `HttpOnly` e `Secure`: 30 giorni per un
  membro, 2 giorni per te, perché un cookie del pannello rubato vale
  molto più di uno di un membro.
  Non è leggibile da JavaScript, quindi non è rubabile con un XSS, e
  non è falsificabile senza `AUTH_SECRET`: nessuno può promuoversi
  amministratore riscrivendoselo.
- **Otto tentativi sbagliati** bloccano quell'account per 15 minuti.
  Vale sia sull'ID di gioco sia sulla password del pannello. Un ID è corto e
  indovinabile, e senza limite si proverebbe a raffica.
- L'ID si confronta ignorando maiuscole e spazi ai bordi: nessuno si
  ricorda se il suo tag era `TizioPSN` o `tiziopsn`.

### Il limite, detto chiaro

Chi conosce email e ID di gioco di un **membro** già approvato entra al
suo posto, e gli ID si vedono in partita. L'approvazione blocca chi non
è nella lista, non l'impersonificazione di chi c'è. Regge perché a un
membro l'area non dà nessun potere: legge e basta.

Il pannello amministratore, che invece il potere ce l'ha, non ha questo
problema: lì serve la password.

Se un giorno anche ai membri servisse una difesa vera, la strada non è
rimettere le password ma il **collegamento usa-e-getta via mail**:
l'utente scrive l'indirizzo, riceve un link valido una volta sola e
clicca. Niente da ricordare per lui, e nessun segreto indovinabile.

## 4-bis. Se perdi la password del pannello

Non è recuperabile: nell'archivio c'è solo l'impronta, e l'impronta non
si può tornare indietro. Se ne genera una nuova. In un terminale, con la
password che vuoi al posto di `LA-TUA-NUOVA-PASSWORD`:

```bash
node -e "const c=require('crypto'),s=c.randomBytes(16).toString('hex');console.log(s+':'+c.scryptSync('LA-TUA-NUOVA-PASSWORD',s,64,{N:16384,r:8,p:1}).toString('hex'))"
```

Incolli il risultato in `ADMIN_PASSWORD_HASH` su Netlify e fai ripartire
un deploy. Nessun account viene perso.

## 4-ter. Il link condiviso non porta con sé l'accesso

Domanda che salta fuori sempre: se mando a qualcuno un link di una
pagina dell'area riservata, quello ci entra col mio account?

No. Il gettone di sessione vive **soltanto** nel cookie, che sta nel
tuo browser e non esce dal tuo dispositivo. Nell'indirizzo non c'è
niente: `/area-riservata` è un percorso e basta. Chi apre quel link
viene riconosciuto dal **proprio** cookie — se è già entrato vede il
suo account, se non è mai entrato vede il modulo di accesso, se è in
attesa vede "richiesta in attesa".

L'unica cosa che romperebbe questa garanzia sarebbe mettere il gettone
dentro un indirizzo — i cosiddetti link magici. Non ce ne sono, e le
notifiche delle convocazioni portano a un percorso normale
(`?giorno=2026-09-04`) che non autentica nessuno: è solo un
suggerimento su quale giornata aprire. C'è anche una prova automatica
che lo verifica, in `strumenti/prove.mjs`.

Resta ovvio il caso del telefono sbloccato prestato a qualcuno: quello
non lo può impedire nessun sito.

## 4-quater. Correggere l'ID di gioco

Nel pannello **Gestione**, accanto a ogni membro, c'è **Cambia ID**:
serve perché l'ID lo scrive la persona quando si registra, e chi
sbaglia una lettera se la porta dietro dappertutto — rosa,
convocazioni, campo, mail.

**Chi è connesso non viene buttato fuori**, ed è voluto. Verrebbe da
pensare il contrario, visto che l'ID è metà delle credenziali: non
succede perché il gettone di sessione contiene solo l'email, e a ogni
richiesta l'utente si rilegge dall'archivio per email. **L'ID serve a
entrare, non a restare dentro.** Chi era già connesso continua senza
accorgersi di niente; al prossimo accesso userà quello nuovo.

Due ID uguali vengono rifiutati: non impedirebbero l'accesso — quello
va per email — ma renderebbero impossibile capire chi è chi in campo e
negli elenchi, dove si legge solo l'ID.

Presenze, elenchi, statistiche e riepiloghi seguono da soli, perché
leggono il nome dall'account. Restano com'erano solo gli annunci già
pubblicati e le formazioni già salvate: sono istantanee di un momento.

## 4-quinquies. Chi tiene la porta

Il pannello **Gestione** lo vedono l'amministratore, **il capitano e
l'amministrazione** — le stesse persone che convocano. Non è un caso
che l'elenco coincida: chi decide chi gioca decide anche chi entra, è
lo stesso mestiere.

Non è la stessa cosa però:

| | admin | capitano e amministrazione |
| --- | --- | --- |
| leggere le candidature dei provini | sì | sì |
| approvare e rifiutare | sì | sì |
| correggere un ID di gioco | sì | sì |
| cambiare gli incarichi | sì | **no** |
| eliminare per sempre un account | sì | **no** |

Le due esclusioni hanno ragioni diverse. **Gli incarichi** restano
dell'amministratore perché chi può nominare capitani sarebbe l'ultimo
capitano sostituibile. **La cancellazione** perché è l'unica azione qui
dentro che non si disfa: rifiutare si annulla — si riammette e
l'account torna quello di prima — mentre cancellare butta via anche le
risposte e le presenze di quella persona.

Quei due comandi non compaiono nemmeno, e il server li rifiuta
comunque: un bottone nascosto è cortesia, non sicurezza.

La regola è scritta **una volta sola** (`puoGestire`, definita in
termini di `puoConvocare`) e c'è una prova che verifica che i due
elenchi restino identici: se un giorno divergono deve essere una
decisione, non una svista in uno dei due posti.

## 4-sexies. Le candidature dei provini

Il modulo di «Unisciti» mandava **solo una mail**, dal browser di chi
si candidava. Se quella mail si perdeva o finiva nello spam, della
persona non restava niente da nessuna parte.

Adesso la candidatura si salva anche da noi e compare in Gestione con
tutto quello che ha scritto: ID, piattaforma, ruoli, competizioni, club
precedenti, giorni, telefono e note. La mail continua a partire lo
stesso — sono due strade verso la stessa notizia, e se una si rompe
l'altra regge. Si prova prima l'archivio: se salta la mail ma la
candidatura e al sicuro, alla persona si risponde comunque che e
arrivata, perche e vero.

**E l'unico punto del sito dove si scrive senza avere un accesso**, e
per forza: chi si candida non ce l'ha. Percio ha tre argini —
quanto si puo scrivere (le note si tagliano a mille caratteri, gli
elenchi a poche voci), quanto spesso (una ogni due minuti dallo stesso
indirizzo di rete) e quante se ne tengono in tutto (le trecento piu
recenti, le vecchie si buttano da sole).

L'indirizzo di rete non si conserva in chiaro e non si mostra da
nessuna parte: se ne tiene solo un'impronta, che serve a sapere «e lo
stesso di prima?» e non «qual e».

### Il gruppo provini su WhatsApp

Sotto ogni candidatura che ha lasciato un numero c’è un bottone
**Inserisci al gruppo provini**. Apre WhatsApp sulla chat di quella
persona con il messaggio già scritto e il link d’invito dentro: un
tocco tuo per mandarlo, uno suo per entrare.

**Aggiungerla al gruppo da qui non si può**, e non è un limite nostro:
WhatsApp non espone nessun modo per farlo, nemmeno con l’API a
pagamento, che i gruppi non li gestisce proprio. Le librerie non
ufficiali che ci riescono pilotano WhatsApp Web, violano i termini e il
rischio concreto è che il numero del club venga bloccato. Quello sopra
è il massimo che esiste davvero.

Serve una variabile su Netlify:

| Nome | Valore |
|---|---|
| WHATSAPP_PROVINI | il link d’invito del gruppo |

Si copia da WhatsApp: apri il gruppo, **Invita tramite link**, copia.
Sta in una variabile e non nel codice per la stessa ragione degli
indirizzi del riepilogo — questo repository è pubblico, e chi ha quel
link entra nel gruppo. Se manca, il bottone lo dice invece di aprire
una chat con dentro un messaggio monco.

Il numero lo ripulisce il server: chi si candida lo scrive come gli
pare e WhatsApp lo vuole in un modo solo. Il numero ripulito compare
sul bottone, così se la ripulitura ha sbagliato si vede **prima** di
premere. Quando non se ne ricava un numero plausibile, il bottone non
compare affatto: meglio nessun bottone che uno che apre la chat
sbagliata.

## 5. Dove sta il codice

| File | Cosa fa |
|---|---|
| `netlify/lib/comune.mjs` | sessione, cookie, utenti — condiviso fra le functions |
| `netlify/lib/posta.mjs` | invio delle mail via EmailJS |
| `netlify/functions/area.mjs` | accessi, sessioni, approvazioni, incarichi |
| `monsha/index.html` | il markup della tab (`#tab-area`) |
| `monsha/app.js` | la parte in fondo, `areaRiservata()` |
| `monsha/stile.css` | in fondo, le sezioni `AREA RISERVATA` e `CONVOCAZIONI` |
| `netlify.toml` | cartella delle functions e rotte `/area-riservata` e `/area-riservata-nimda` |

Dentro l'area riservata c'è la tab **Convocazioni**: allenamenti,
notifiche sul telefono e riepilogo al capitano. Ha un promemoria
suo, [CONVOCAZIONI.md](CONVOCAZIONI.md), con le variabili da
impostare e gli incarichi da assegnare.

Gli account vivono in **Netlify Blobs** (store `area-utenti`), incluso
nel piano gratuito. Non c'è nessun database esterno da pagare.

## 6. Se qualcosa non va

- **"Area riservata non configurata"** → manca `AUTH_SECRET`.
- **"Accesso amministratore non configurato"** → manca `ADMIN_PASSWORD_HASH`.
- **Ti sei registrato ma non sei admin** → `ADMIN_EMAIL` era assente o
  scritta diversamente quando ti sei registrato. Impostala, poi apri il
  pannello Netlify → Blobs → store `area-utenti` ed elimina la tua voce:
  potrai registrarti di nuovo, stavolta da amministratore.
- **Gli errori delle functions** si leggono in Netlify → Logs →
  Functions.
