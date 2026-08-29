/* =============================================================
   MONACI SHAOLIN — mattoni condivisi fra le functions
   -------------------------------------------------------------
   Perche questo file esiste: sessione, cookie e lettura utenti
   servivano a una sola funzione (area.mjs) finche l'area riservata
   era una schermata sola. Con le convocazioni le funzioni sono tre,
   e la stessa logica copiata tre volte prima o poi diverge: basta
   correggere un controllo di sicurezza in un posto e dimenticarlo
   negli altri due per avere una porta aperta.

   Sta in netlify/lib e non in netlify/functions apposta: Netlify
   pubblica come endpoint ogni file dentro functions/, e questo non
   deve essere raggiungibile dalla rete. esbuild lo impacchetta
   dentro le funzioni che lo importano.
   ============================================================= */

import { getStore } from '@netlify/blobs';
import crypto from 'node:crypto';

/* ---------- costanti ------------------------------------------ */

export const COOKIE       = 'ms_sessione';
/* Quattrocento giorni e il massimo che i browser accettano. A rendere
   l'accesso davvero permanente non e comunque questo numero ma il
   rinnovo a ogni visita: chi apre il sito ogni tanto non lo rifa mai. */
export const DURATA       = 60 * 60 * 24 * 400;
export const DURATA_ADMIN = 60 * 60 * 24 * 2;   // il pannello vale di piu

/* Gli incarichi delle convocazioni. Sono una cosa diversa da `ruolo`
   (admin / membro): quello dice chi comanda sugli accessi, questo dice
   cosa uno fa quando si tratta di allenamenti. Un admin puo essere
   anche capitano, e un capitano non tocca la gestione accessi. */
export const INCARICHI = ['giocatore', 'capitano', 'amministrazione'];

/* ---------- archivi ------------------------------------------- */

/* consistency: 'strong' non e un dettaglio, e la correzione di un
   difetto vero. Netlify Blobs, se non glielo si dice, e a consistenza
   EVENTUALE: una lettura fatta subito dopo una scrittura puo ancora
   restituire il valore di prima. Si vedeva cosi — uno premeva
   ASSENTE, il bottone diventava arancione, e l'elenco sotto
   continuava a mostrarlo presente con la spunta verde, perche la
   rilettura era arrivata prima che la scrittura fosse visibile.

   Con "strong" la lettura aspetta di vedere l'ultima scrittura. Costa
   qualche millisecondo in piu ed e il prezzo giusto: qui si scrive e
   si rilegge nello stesso gesto, e un elenco che mente e peggio di un
   elenco che arriva un attimo dopo.

   Vale anche per gli utenti: e cio che rende vera la promessa che
   revocare un accesso lo toglie al primo caricamento e non fra un
   po'. */
export const store  = () => getStore({ name: 'area-utenti',      consistency: 'strong' });
export const convoc = () => getStore({ name: 'area-convocazioni', consistency: 'strong' });

/* La chiave di ogni utente e l'impronta della sua email, cosi non
   compaiono indirizzi nei nomi delle chiavi. */
export const chiave = email =>
  crypto.createHash('sha256').update(email).digest('hex');

/* ---------- utilita ------------------------------------------- */

export const normEmail = v => String(v || '').trim().toLowerCase();
export const normId    = v => String(v || '').trim().toLowerCase();

export const emailValida = v =>
  /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v) && v.length <= 254;

export function json(dati, stato = 200, intestazioni = {}) {
  return new Response(JSON.stringify(dati), {
    status: stato,
    headers: { 'content-type': 'application/json; charset=utf-8', ...intestazioni }
  });
}

export const errore = (msg, stato = 400) => json({ errore: msg }, stato);

/* ---------- sessione ------------------------------------------
   Gettone firmato in HMAC: <payload base64url>.<firma base64url>.
   Non e cifrato — il contenuto e leggibile — ma non e falsificabile
   senza AUTH_SECRET, ed e questo che conta: nessuno puo promuoversi
   admin riscrivendo il proprio cookie.

   Nota per chi teme il link condiviso: il gettone vive SOLO qui
   dentro, nel cookie. Non compare mai in un indirizzo, quindi
   copiare un link dell'area riservata e mandarlo a qualcun altro non
   trasporta nessuna sessione: chi lo apre viene riconosciuto dal
   proprio cookie, o da nessuno. */

const b64u   = buf => Buffer.from(buf).toString('base64url');
const deb64u = str => Buffer.from(str, 'base64url').toString('utf8');

function firma(testo, segreto) {
  return crypto.createHmac('sha256', segreto).update(testo).digest('base64url');
}

export function creaGettone(dati, segreto, durata = DURATA) {
  const corpo = b64u(JSON.stringify({ ...dati, sca: Date.now() + durata * 1000 }));
  return corpo + '.' + firma(corpo, segreto);
}

export function leggiGettone(gettone, segreto) {
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

export function cookieSessione(valore, durata) {
  return [
    COOKIE + '=' + valore,
    'Path=/',
    'HttpOnly',              // fuori portata di JavaScript: un XSS non ruba la sessione
    'Secure',
    'SameSite=Lax',
    'Max-Age=' + durata
  ].join('; ');
}

export function leggiCookie(req) {
  const grezzo = req.headers.get('cookie') || '';
  for (const pezzo of grezzo.split(';')) {
    const [n, ...resto] = pezzo.trim().split('=');
    if (n === COOKIE) return resto.join('=');
  }
  return null;
}

/* ---------- utenti -------------------------------------------- */

export async function leggiUtente(email) {
  return await store().get(chiave(email), { type: 'json' });
}

export async function salvaUtente(utente) {
  await store().setJSON(chiave(utente.email), utente);
}

export async function tuttiGliUtenti() {
  const { blobs } = await store().list();
  const tutti = await Promise.all(
    blobs.map(b => store().get(b.key, { type: 'json' }).catch(() => null))
  );
  return tutti.filter(Boolean);
}

/* Gli account nati prima delle convocazioni non hanno il campo.
   Si ricava invece di migrare l'archivio: una migrazione che gira a
   ogni lettura e un modo per corrompere i dati il giorno che sbaglia. */
export const incaricoDi = u =>
  INCARICHI.includes(u && u.incarico) ? u.incarico : 'giocatore';

/* Vista ripulita. idGioco resta dentro apposta: l'amministratore
   decide guardando proprio quello, e a ogni altro utente arriva solo
   il proprio. idConfronto invece non esce mai: e un dettaglio interno. */
export const pubblico = u => ({
  email:       u.email,
  piattaforma: u.piattaforma,
  idGioco:     u.idGioco,
  stato:       u.stato,
  ruolo:       u.ruolo,
  incarico:    incaricoDi(u),
  creato:      u.creato,
  deciso:      u.deciso || null
});

/* Chi puo decidere i giorni di allenamento. L'admin c'e dentro
   sempre: e lui che assegna gli incarichi, sarebbe assurdo che non
   potesse rimediare a un capitano che non tocca il sito da un mese. */
export const puoConvocare = u =>
  u.ruolo === 'admin' || incaricoDi(u) === 'capitano' || incaricoDi(u) === 'amministrazione';

/* ---------- guardie ------------------------------------------- */

/* Rilegge sempre l'utente dall'archivio invece di fidarsi del cookie:
   se revochi un accesso mentre la persona e connessa, deve cadere
   fuori al primo caricamento, non fra quattrocento giorni. */
export async function esigiMembro(req, segreto) {
  const dati = leggiGettone(leggiCookie(req), segreto);
  if (!dati) return { errore: errore('Accesso richiesto.', 401) };
  const utente = await leggiUtente(dati.email);
  if (!utente || utente.stato !== 'approvato')
    return { errore: errore('Accesso richiesto.', 401) };
  return { utente };
}

export async function esigiAdmin(req, segreto) {
  const g = await esigiMembro(req, segreto);
  if (g.errore) return g;
  if (g.utente.ruolo !== 'admin') return { errore: errore('Non autorizzato.', 403) };
  return g;
}

/* ---------- date ----------------------------------------------
   Tutto il calendario ragiona in ora italiana, non in UTC. Senza
   questo, un allenamento del primo settembre segnato alle 00:30
   d'estate finirebbe nel trentuno agosto, e la notifica arriverebbe
   il giorno sbagliato. */

const FUSO = 'Europe/Rome';

// en-CA perche e l'unica lingua che formatta gia come AAAA-MM-GG
export const oggiRoma = (quando = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(quando);

/* hourCycle h23 e non hour12:false: con il secondo, mezzanotte in
   parecchie lingue viene formattata "24" invece di "00". */
export const oraRoma = (quando = new Date()) =>
  Number(new Intl.DateTimeFormat('en-GB',
    { timeZone: FUSO, hour: '2-digit', hourCycle: 'h23' }).format(quando));

/* I minuti servono da quando c'e un appuntamento alle 8:30: con le
   sole ore non si distingue l'esecuzione delle 8:00 da quella delle
   8:30, e il buongiorno partirebbe mezz'ora prima. */
export const minutoRoma = (quando = new Date()) =>
  Number(new Intl.DateTimeFormat('en-GB',
    { timeZone: FUSO, minute: '2-digit' }).format(quando));

export const dataValida = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));

const GIORNI_SET = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
              'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

/* "giovedi 4 settembre". Costruita a mano da una data trattata come
   UTC puro: cosi non c'e nessun fuso di mezzo a spostare il giorno. */
export function dataInLettere(data) {
  const [a, m, g] = String(data).split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1, g));
  return GIORNI_SET[d.getUTCDay()] + ' ' + g + ' ' + MESI[m - 1];
}
