# Area riservata — cosa fare per accenderla

Il codice è nel repo e le due variabili sono già impostate su Netlify:
l'area funziona. Questo file resta come promemoria di com'è messa
insieme e di cosa rifare se un giorno il sito va ricostruito da zero.

## 1. Le due variabili obbligatorie

Senza queste la tab risponde "Area riservata non configurata" e non fa
entrare nessuno.


Netlify → **Site configuration → Environment variables → Add a variable**.

| Nome | Valore |
|---|---|
| `AUTH_SECRET` | una stringa casuale lunga (vedi sotto) |
| `ADMIN_EMAIL` | `federicomar123456789@gmail.com` |

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

**Non ci sono password.** Si entra con email e ID di gioco, la stessa
coppia che vedi tu quando approvi.

- **Registrazione** → l'account nasce con stato `in-attesa`. Non fa
  entrare nessuno finché non decidi tu.
- **Tu approvi o rifiuti** dal pannello. `Revoca` rimette fuori un
  membro già approvato, e chi è connesso in quel momento cade fuori al
  primo caricamento: la sessione viene ricontrollata contro il database
  a ogni richiesta, non ci si fida del cookie.
- **Accesso** → cookie firmato, `HttpOnly` e `Secure`, valido 30 giorni.
  Non è leggibile da JavaScript, quindi non è rubabile con un XSS, e
  non è falsificabile senza `AUTH_SECRET`: nessuno può promuoversi
  amministratore riscrivendoselo.
- **Otto tentativi sbagliati** bloccano quell'account per 15 minuti.
  Senza password questo freno conta il doppio: un ID di gioco è corto e
  indovinabile, e senza limite si proverebbe a raffica.
- L'ID si confronta ignorando maiuscole e spazi ai bordi: nessuno si
  ricorda se il suo tag era `TizioPSN` o `tiziopsn`.

### Il limite, detto chiaro

Chi conosce email e ID di gioco di un membro **già approvato** entra al
suo posto, e gli ID si vedono in partita. L'approvazione blocca chi non
è nella lista, non l'impersonificazione di chi c'è. Regge finché
nell'area non ci sono dati sensibili.

Se un giorno ce ne fossero, la strada da prendere non è rimettere le
password ma il **collegamento usa-e-getta via mail**: l'utente scrive
l'indirizzo, riceve un link valido una volta sola e clicca. Niente da
ricordare per lui, e nessun segreto indovinabile.

## 5. Dove sta il codice

| File | Cosa fa |
|---|---|
| `netlify/functions/area.mjs` | tutta la logica: accessi, sessioni, approvazioni |
| `monsha/index.html` | il markup della tab (`#tab-area`) |
| `monsha/app.js` | la parte in fondo, `areaRiservata()` |
| `monsha/stile.css` | in fondo, la sezione `AREA RISERVATA` |
| `netlify.toml` | cartella delle functions e rotta `/area-riservata` |

Gli account vivono in **Netlify Blobs** (store `area-utenti`), incluso
nel piano gratuito. Non c'è nessun database esterno da pagare.

## 6. Se qualcosa non va

- **"Area riservata non configurata"** → manca `AUTH_SECRET`.
- **Ti sei registrato ma non sei admin** → `ADMIN_EMAIL` era assente o
  scritta diversamente quando ti sei registrato. Impostala, poi apri il
  pannello Netlify → Blobs → store `area-utenti` ed elimina la tua voce:
  potrai registrarti di nuovo, stavolta da amministratore.
- **Gli errori delle functions** si leggono in Netlify → Logs →
  Functions.
