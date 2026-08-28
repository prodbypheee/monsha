/* =============================================================
   MONACI SHAOLIN — area riservata, lato server
   -------------------------------------------------------------
   Perche questo file esiste: la lista degli approvati non puo stare
   nel browser. Qualunque cosa scritta in app.js e leggibile e
   modificabile da chiunque apra il codice sorgente, quindi un
   controllo accessi fatto li non e un controllo: e un suggerimento.
   Qui invece gira su Netlify, l'utente vede solo la risposta.

   I MEMBRI non hanno password, ed e una scelta deliberata: entrano con
   email e ID di gioco, la stessa coppia che l'amministratore vede
   quando approva. Il prezzo va detto: chi conosce mail e ID di un
   membro approvato entra al posto suo, e gli ID di gioco si vedono in
   partita. Regge perche a un membro l'area non da nessun potere.

   L'AMMINISTRATORE invece ha anche una password, perche il suo account
   non e come gli altri: da li si approva, si rifiuta e si elimina
   chiunque. La sua impronta sta in ADMIN_PASSWORD_HASH, una variabile
   d'ambiente e non l'archivio: chi riuscisse a leggere il database
   degli utenti non troverebbe comunque niente con cui entrare da admin.

     ADMIN_PASSWORD_HASH  obbligatoria per l'accesso amministratore, nel
                          formato sale:impronta (scrypt). Senza, l'admin
                          non entra affatto — meglio una porta chiusa
                          che una aperta solo con mail e ID.

   Archivio: Netlify Blobs, incluso nel piano gratuito. La chiave
   di ogni utente e l'impronta SHA-256 della sua email, cosi non
   compaiono indirizzi nei nomi delle chiavi.

   Variabili d'ambiente da impostare nel pannello Netlify
   (Site configuration > Environment variables):

     AUTH_SECRET   obbligatoria — stringa casuale lunga, firma le
                   sessioni. Se cambia, tutti vengono disconnessi.
     ADMIN_EMAIL   obbligatoria — chi registra questo indirizzo
                   diventa amministratore ed e approvato subito.

   Facoltative, servono solo per la mail di avviso a ogni nuova
   richiesta. Senza, la registrazione funziona lo stesso: le
   richieste restano nel pannello admin.

     EMAILJS_SERVICE_ID  EMAILJS_TEMPLATE_ID
     EMAILJS_PUBLIC_KEY  EMAILJS_PRIVATE_KEY
   ============================================================= */

import { getStore } from '@netlify/blobs';
import crypto from 'node:crypto';

/* ---------- costanti ------------------------------------------ */

const COOKIE        = 'ms_sessione';
/* Quattrocento giorni e il massimo che i browser accettano: Chrome
   taglia da solo qualunque cookie piu lungo, quindi chiederne di piu
   non servirebbe a niente. A rendere l'accesso davvero permanente non e
   comunque questo numero ma il rinnovo a ogni visita, piu sotto: chi
   apre il sito anche solo una volta ogni tanto non lo rifa mai. */
const DURATA        = 60 * 60 * 24 * 400;
const DURATA_ADMIN  = 60 * 60 * 24 * 2;        // 2 giorni: il pannello vale di piu
const PIATTAFORME   = ['PlayStation', 'Xbox', 'PC'];
const MAX_TENTATIVI = 8;
const BLOCCO_MS     = 15 * 60 * 1000;          // 15 minuti

/* ---------- utilita ------------------------------------------- */

const store = () => getStore('area-utenti');

const chiave = email =>
  crypto.createHash('sha256').update(email).digest('hex');

const normEmail = v => String(v || '').trim().toLowerCase();

const emailValida = v =>
  /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v) && v.length <= 254;

function json(dati, stato = 200, intestazioni = {}) {
  return new Response(JSON.stringify(dati), {
    status: stato,
    headers: { 'content-type': 'application/json; charset=utf-8', ...intestazioni }
  });
}

const errore = (msg, stato = 400) => json({ errore: msg }, stato);

/* ---------- ID di gioco ---------------------------------------
   L'ID e la meta segreta delle credenziali, quindi va confrontato
   con indulgenza su cio che non conta: maiuscole e spazi ai bordi.
   Nessuno si ricorda se il suo tag era "TizioPSN" o "tiziopsn", e
   farlo sbagliare su quello sarebbe solo una porta chiusa in faccia
   alla persona giusta. */

const normId = v => String(v || '').trim().toLowerCase();

/* ---------- password dell'amministratore ----------------------
   Solo l'admin ne ha una. scrypt e la funzione di derivazione
   raccomandata fra quelle incluse in Node: costa memoria oltre che
   tempo, quindi le schede grafiche non la macinano come farebbero
   con SHA. Il sale sta nella variabile insieme all'impronta. */

function derivaScrypt(password, sale) {
  return new Promise((ok, ko) => {
    crypto.scrypt(password, sale, 64, { N: 16384, r: 8, p: 1 }, (err, buf) => {
      if (err) ko(err); else ok(buf.toString('hex'));
    });
  });
}

async function passwordAdminCorretta(password, atteso) {
  const [sale, impronta] = String(atteso || '').split(':');
  if (!sale || !impronta || !password) return false;
  const prova = await derivaScrypt(password, sale);
  const a = Buffer.from(prova, 'hex');
  const b = Buffer.from(impronta, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function idCorretto(prova, utente) {
  // idConfronto non c'e sugli account nati con la versione a
  // password: per quelli si ricava al volo dall'ID salvato.
  const atteso = utente.idConfronto || normId(utente.idGioco);
  const a = Buffer.from(normId(prova));
  const b = Buffer.from(atteso);
  // Confronto a tempo costante: uno normale esce al primo carattere
  // diverso, e la differenza di durata rivela quanti ne erano giusti.
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/* ---------- sessione ------------------------------------------
   Gettone firmato in HMAC: <payload base64url>.<firma base64url>.
   Non e cifrato — il contenuto e leggibile — ma non e falsificabile
   senza AUTH_SECRET, ed e questo che conta: nessuno puo promuoversi
   admin riscrivendo il proprio cookie. */

const b64u   = buf => Buffer.from(buf).toString('base64url');
const deb64u = str => Buffer.from(str, 'base64url').toString('utf8');

function firma(testo, segreto) {
  return crypto.createHmac('sha256', segreto).update(testo).digest('base64url');
}

function creaGettone(dati, segreto, durata = DURATA) {
  const corpo = b64u(JSON.stringify({ ...dati, sca: Date.now() + durata * 1000 }));
  return corpo + '.' + firma(corpo, segreto);
}

function leggiGettone(gettone, segreto) {
  if (!gettone || typeof gettone !== 'string') return null;
  const [corpo, sigla] = gettone.split('.');
  if (!corpo || !sigla) return null;
  const a = Buffer.from(sigla);
  const b = Buffer.from(firma(corpo, segreto));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const dati = JSON.parse(deb64u(corpo));
    if (!dati.sca || dati.sca < Date.now()) return null;
    return dati;
  } catch { return null; }
}

function cookieSessione(valore, durata) {
  return [
    COOKIE + '=' + valore,
    'Path=/',
    'HttpOnly',              // fuori portata di JavaScript: un XSS non ruba la sessione
    'Secure',
    'SameSite=Lax',
    'Max-Age=' + durata
  ].join('; ');
}

function leggiCookie(req) {
  const grezzo = req.headers.get('cookie') || '';
  for (const pezzo of grezzo.split(';')) {
    const [n, ...resto] = pezzo.trim().split('=');
    if (n === COOKIE) return resto.join('=');
  }
  return null;
}

/* ---------- lettura utenti ------------------------------------ */

async function leggiUtente(email) {
  return await store().get(chiave(email), { type: 'json' });
}

async function salvaUtente(utente) {
  await store().setJSON(chiave(utente.email), utente);
}

// Vista ripulita. idGioco resta dentro apposta: l'amministratore
// decide guardando proprio quello, e a ogni altro utente arriva solo
// il proprio. idConfronto invece non esce mai: e un dettaglio interno.
const pubblico = u => ({
  email:       u.email,
  piattaforma: u.piattaforma,
  idGioco:     u.idGioco,
  stato:       u.stato,
  ruolo:       u.ruolo,
  creato:      u.creato,
  deciso:      u.deciso || null
});

/* ---------- avviso all'amministratore -------------------------
   Parte dal server, non dal browser: cosi arriva anche se chi si
   registra chiude la scheda un istante dopo aver premuto invio.
   Se le variabili EmailJS non ci sono, si tace e si prosegue —
   la richiesta e comunque salvata e visibile nel pannello. */

async function avvisaAdmin(utente, origine) {
  const { EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID,
          EMAILJS_PUBLIC_KEY, EMAILJS_PRIVATE_KEY } = process.env;
  if (!EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID ||
      !EMAILJS_PUBLIC_KEY || !EMAILJS_PRIVATE_KEY) return;

  try {
    await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        service_id:  EMAILJS_SERVICE_ID,
        template_id: EMAILJS_TEMPLATE_ID,
        user_id:     EMAILJS_PUBLIC_KEY,
        accessToken: EMAILJS_PRIVATE_KEY,
        template_params: {
          user_email:   utente.email,
          platform:     utente.piattaforma,
          player_id:    utente.idGioco,
          requested_at: new Date(utente.creato).toLocaleString('it-IT'),
          panel_url:    origine + '/area-riservata'
        }
      })
    });
  } catch {
    // Un disservizio della posta non deve far fallire una registrazione
    // gia andata a buon fine: l'utente ha il suo account in attesa.
  }
}

/* ---------- azioni -------------------------------------------- */

async function registrati(req, segreto, adminEmail, origine) {
  const corpo       = await req.json().catch(() => ({}));
  const email       = normEmail(corpo.email);
  const piattaforma = String(corpo.piattaforma || '').trim();
  const idGioco     = String(corpo.idGioco || '').trim();

  if (!emailValida(email)) return errore('Indirizzo email non valido.');
  if (!PIATTAFORME.includes(piattaforma)) return errore('Scegli la piattaforma.');
  if (idGioco.length < 2 || idGioco.length > 40)
    return errore('Inserisci il tuo ID di gioco.');

  if (await leggiUtente(email))
    return errore('Questo indirizzo ha gia una richiesta o un account.', 409);

  const admin = adminEmail && email === normEmail(adminEmail);

  // Registrarsi con l'indirizzo dell'admin non basta a diventarlo:
  // serve la password. Conta solo se l'account admin non esiste piu —
  // altrimenti si e gia fermati sopra — ma e proprio quel caso, il
  // giorno che qualcuno lo cancellasse, a non dover essere una porta
  // aperta per il primo che indovina l'indirizzo.
  if (admin && !(await passwordAdminCorretta(
        String(corpo.password || ''), process.env.ADMIN_PASSWORD_HASH)))
    return errore('Password amministratore non corretta.', 401);

  const utente = {
    email, piattaforma, idGioco, idConfronto: normId(idGioco),
    stato:  admin ? 'approvato' : 'in-attesa',
    ruolo:  admin ? 'admin' : 'membro',
    creato: new Date().toISOString(),
    deciso: admin ? new Date().toISOString() : null,
    tentativi: 0,
    bloccoFino: 0
  };
  await salvaUtente(utente);

  // L'amministratore entra subito: sarebbe assurdo che dovesse
  // approvare se stesso da un pannello a cui non puo accedere.
  if (admin) {
    const gettone = creaGettone({ email, ruolo: 'admin' }, segreto, DURATA_ADMIN);
    return json({ utente: pubblico(utente) }, 201,
      { 'set-cookie': cookieSessione(gettone, DURATA_ADMIN) });
  }

  await avvisaAdmin(utente, origine);
  return json({ utente: pubblico(utente) }, 201);
}

async function accedi(req, segreto) {
  const corpo   = await req.json().catch(() => ({}));
  const email   = normEmail(corpo.email);
  const idGioco = String(corpo.idGioco || '').trim();

  const NEGATO = 'Email o ID di gioco non corretti.';

  if (!emailValida(email) || !idGioco) return errore(NEGATO, 401);

  const utente = await leggiUtente(email);
  if (!utente) return errore(NEGATO, 401);

  if (utente.bloccoFino && utente.bloccoFino > Date.now()) {
    const min = Math.ceil((utente.bloccoFino - Date.now()) / 60000);
    return errore('Troppi tentativi. Riprova fra ' + min + ' minuti.', 429);
  }

  // Senza password questo freno conta il doppio: un ID di gioco e
  // corto e indovinabile, e senza limite si proverebbe a raffica.
  if (!idCorretto(idGioco, utente)) {
    utente.tentativi = (utente.tentativi || 0) + 1;
    if (utente.tentativi >= MAX_TENTATIVI) {
      utente.bloccoFino = Date.now() + BLOCCO_MS;
      utente.tentativi = 0;
    }
    await salvaUtente(utente);
    return errore(NEGATO, 401);
  }

  // L'amministratore ha una serratura in piu. Il suo account non e come
  // gli altri: da li si approva, si rifiuta e si elimina chiunque, e
  // mail e ID di gioco sono cose che si vedono in giro.
  if (utente.ruolo === 'admin') {
    const atteso = process.env.ADMIN_PASSWORD_HASH;

    // Senza la variabile l'admin non entra. Sembra scomodo, ma
    // l'alternativa sarebbe lasciare il pannello dietro sola mail e ID:
    // meglio una porta chiusa che una che si apre da sola.
    if (!atteso)
      return errore('Accesso amministratore non configurato: manca ADMIN_PASSWORD_HASH.', 503);

    const password = String(corpo.password || '');

    // Chi arriva qui ha gia indovinato mail e ID, quindi dirgli che
    // manca la password non gli regala niente — e all'admin che ha
    // aperto l'indirizzo sbagliato risparmia un errore incomprensibile.
    if (!password) return json({ stato: 'serve-password' }, 403);

    if (!(await passwordAdminCorretta(password, atteso))) {
      utente.tentativi = (utente.tentativi || 0) + 1;
      if (utente.tentativi >= MAX_TENTATIVI) {
        utente.bloccoFino = Date.now() + BLOCCO_MS;
        utente.tentativi = 0;
      }
      await salvaUtente(utente);
      return errore('Password amministratore non corretta.', 401);
    }
  }

  if (utente.tentativi || utente.bloccoFino) {
    utente.tentativi = 0; utente.bloccoFino = 0;
    await salvaUtente(utente);
  }

  // Il controllo dello stato viene dopo quello dell'ID: altrimenti
  // chiunque scoprirebbe, senza credenziali, chi ha un account.
  if (utente.stato === 'in-attesa')  return json({ stato: 'in-attesa' }, 403);
  if (utente.stato === 'rifiutato')  return json({ stato: 'rifiutato' }, 403);

  // Sessione piu corta per l'admin: un cookie rubato al pannello vale
  // molto piu di uno rubato a un membro, quindi scade prima.
  const durata = utente.ruolo === 'admin' ? DURATA_ADMIN : DURATA;
  const gettone = creaGettone({ email, ruolo: utente.ruolo }, segreto, durata);
  return json({ utente: pubblico(utente) }, 200,
    { 'set-cookie': cookieSessione(gettone, durata) });
}

function esci() {
  return json({ ok: true }, 200, { 'set-cookie': cookieSessione('', 0) });
}

/* Chi sono. Rilegge sempre l'utente dall'archivio invece di fidarsi
   del cookie: se revochi un accesso mentre la persona e connessa,
   deve cadere fuori al primo caricamento, non fra trenta giorni. */
async function sessione(req, segreto) {
  const dati = leggiGettone(leggiCookie(req), segreto);
  if (!dati) return json({ utente: null });
  const utente = await leggiUtente(dati.email);
  if (!utente || utente.stato !== 'approvato')
    return json({ utente: null }, 200, { 'set-cookie': cookieSessione('', 0) });

  // Il conto riparte da qui. E questo, non la durata scritta sopra, a
  // rendere l'accesso permanente: un membro che apre il sito ogni tanto
  // non rivede mai il modulo. Una scadenza fissa invece scatta anche a
  // chi entra tutti i giorni, ed e esattamente il fastidio da togliere.
  const durata = utente.ruolo === 'admin' ? DURATA_ADMIN : DURATA;
  const gettone = creaGettone({ email: utente.email, ruolo: utente.ruolo }, segreto, durata);
  return json({ utente: pubblico(utente) }, 200,
    { 'set-cookie': cookieSessione(gettone, durata) });
}

async function esigiAdmin(req, segreto) {
  const dati = leggiGettone(leggiCookie(req), segreto);
  if (!dati) return { errore: errore('Accesso richiesto.', 401) };
  const utente = await leggiUtente(dati.email);
  if (!utente || utente.ruolo !== 'admin' || utente.stato !== 'approvato')
    return { errore: errore('Non autorizzato.', 403) };
  return { utente };
}

async function elenco(req, segreto) {
  const g = await esigiAdmin(req, segreto);
  if (g.errore) return g.errore;

  const { blobs } = await store().list();
  const tutti = await Promise.all(
    blobs.map(b => store().get(b.key, { type: 'json' }).catch(() => null))
  );
  const validi = tutti.filter(Boolean).map(pubblico)
    .sort((a, b) => new Date(b.creato) - new Date(a.creato));

  return json({
    attesa:    validi.filter(u => u.stato === 'in-attesa'),
    approvati: validi.filter(u => u.stato === 'approvato'),
    rifiutati: validi.filter(u => u.stato === 'rifiutato')
  });
}

async function decidi(req, segreto) {
  const g = await esigiAdmin(req, segreto);
  if (g.errore) return g.errore;

  const corpo = await req.json().catch(() => ({}));
  const email = normEmail(corpo.email);
  const esito = String(corpo.esito || '');
  if (!['approva', 'rifiuta', 'elimina'].includes(esito))
    return errore('Esito non valido.');

  // Rete di sicurezza: se l'admin si rifiutasse o eliminasse da solo,
  // resterebbe un sito senza nessuno che possa approvare.
  if (email === normEmail(g.utente.email))
    return errore('Non puoi modificare il tuo stesso account.');

  const utente = await leggiUtente(email);
  if (!utente) return errore('Utente non trovato.', 404);

  if (esito === 'elimina') {
    await store().delete(chiave(email));
    return json({ ok: true, eliminato: email });
  }

  utente.stato  = esito === 'approva' ? 'approvato' : 'rifiutato';
  utente.deciso = new Date().toISOString();
  await salvaUtente(utente);
  return json({ ok: true, utente: pubblico(utente) });
}

/* ---------- ingresso ------------------------------------------ */

export default async (req) => {
  const segreto    = process.env.AUTH_SECRET;
  const adminEmail = process.env.ADMIN_EMAIL;
  const indirizzo  = new URL(req.url);
  const origine    = indirizzo.origin;

  if (!segreto)
    return errore('Area riservata non configurata: manca AUTH_SECRET.', 503);

  const azione = indirizzo.pathname.split('/').filter(Boolean).pop();

  try {
    if (req.method === 'GET'  && azione === 'sessione')   return await sessione(req, segreto);
    if (req.method === 'GET'  && azione === 'richieste')  return await elenco(req, segreto);
    if (req.method === 'POST' && azione === 'registrati') return await registrati(req, segreto, adminEmail, origine);
    if (req.method === 'POST' && azione === 'accedi')     return await accedi(req, segreto);
    if (req.method === 'POST' && azione === 'esci')       return esci();
    if (req.method === 'POST' && azione === 'decidi')     return await decidi(req, segreto);
    return errore('Azione sconosciuta.', 404);
  } catch (e) {
    console.error('area riservata:', e);
    return errore('Errore del server. Riprova.', 500);
  }
};

export const config = { path: '/api/area/:azione' };
