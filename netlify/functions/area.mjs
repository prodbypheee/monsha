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

   Sessione, cookie e lettura utenti stanno in ../lib/comune.mjs:
   li usa anche la funzione delle convocazioni, e la stessa logica
   di sicurezza scritta due volte prima o poi diverge.

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

import crypto from 'node:crypto';

import {
  DURATA, DURATA_ADMIN, INCARICHI,
  store, chiave, normEmail, normId, emailValida,
  json, errore, creaGettone, leggiGettone, cookieSessione, leggiCookie,
  leggiUtente, salvaUtente, tuttiGliUtenti, pubblico, esigiAdmin, esigiGestione
} from '../lib/comune.mjs';

import { mandaMail } from '../lib/posta.mjs';

/* ---------- costanti ------------------------------------------ */

const PIATTAFORME   = ['PlayStation', 'Xbox', 'PC'];
const MAX_TENTATIVI = 8;
const BLOCCO_MS     = 15 * 60 * 1000;          // 15 minuti

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

/* ---------- ID di gioco ---------------------------------------
   L'ID e la meta segreta delle credenziali, quindi va confrontato
   con indulgenza su cio che non conta: maiuscole e spazi ai bordi.
   Nessuno si ricorda se il suo tag era "TizioPSN" o "tiziopsn", e
   farlo sbagliare su quello sarebbe solo una porta chiusa in faccia
   alla persona giusta. */

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

/* ---------- avviso all'amministratore ------------------------- */

async function avvisaAdmin(utente, origine) {
  await mandaMail(process.env.EMAILJS_TEMPLATE_ID, {
    user_email:   utente.email,
    platform:     utente.piattaforma,
    player_id:    utente.idGioco,
    requested_at: new Date(utente.creato).toLocaleString('it-IT'),
    panel_url:    origine + '/area-riservata'
  });
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
    // L'incarico nelle convocazioni: si nasce giocatori, il resto lo
    // assegna l'admin. Anche l'admin: comandare sugli accessi non
    // vuol dire essere il capitano.
    incarico: 'giocatore',
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

  /* Anche a chi resta in attesa si da subito il cookie di sessione.
     Non gli apre niente — ogni endpoint esige stato "approvato", e
     finche non lo e non passa da nessuna parte — ma fa si che il
     giorno che lo approvi sia gia riconosciuto e non debba rifare
     l'accesso. Prima doveva ridigitare email e ID una seconda volta,
     e quella era l'unica ragione per cui doveva farlo.

     Non regala niente a nessuno: il cookie va a chi ha appena scritto
     quella email e quell'ID di suo pugno, e la decisione di farlo
     entrare resta tutta tua, nel pannello. */
  const gettone = creaGettone({ email, ruolo: 'membro' }, segreto, DURATA);
  return json({ utente: pubblico(utente) }, 201,
    { 'set-cookie': cookieSessione(gettone, DURATA) });
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
   deve cadere fuori al primo caricamento, non fra quattrocento giorni.

   Il gettone non esce mai da qui dentro: sta nel cookie e basta, non
   compare in nessun indirizzo. E per questo che condividere un link
   dell'area riservata non condivide nessun accesso — chi lo apre
   viene riconosciuto dal proprio cookie, o da nessuno. */
async function sessione(req, segreto) {
  const dati = leggiGettone(leggiCookie(req), segreto);
  if (!dati) return json({ utente: null });

  const utente = await leggiUtente(dati.email);

  /* Account sparito: il cookie non vale piu niente e si butta. */
  if (!utente)
    return json({ utente: null }, 200, { 'set-cookie': cookieSessione('', 0) });

  /* In attesa: il cookie SI TIENE. E la sessione di chi si e appena
     registrato, e serve a farlo riconoscere il giorno che lo approvi
     senza che debba ridigitare email e ID. Non gli apre niente: ogni
     altra richiesta esige stato "approvato". */
  if (utente.stato === 'in-attesa')
    return json({ utente: null, stato: 'in-attesa' });

  /* Rifiutato o revocato: fuori, e il cookie si butta. Tenerlo
     vorrebbe dire mostrargli per sempre la stessa porta chiusa. */
  if (utente.stato !== 'approvato')
    return json({ utente: null, stato: utente.stato }, 200,
      { 'set-cookie': cookieSessione('', 0) });

  // Il conto riparte da qui. E questo, non la durata scritta sopra, a
  // rendere l'accesso permanente: un membro che apre il sito ogni tanto
  // non rivede mai il modulo. Una scadenza fissa invece scatta anche a
  // chi entra tutti i giorni, ed e esattamente il fastidio da togliere.
  const durata = utente.ruolo === 'admin' ? DURATA_ADMIN : DURATA;
  const gettone = creaGettone({ email: utente.email, ruolo: utente.ruolo }, segreto, durata);
  return json({ utente: pubblico(utente) }, 200,
    { 'set-cookie': cookieSessione(gettone, durata) });
}

/* L'elenco lo legge anche il capitano: e la stessa gente che poi
   convoca, e non poterla nemmeno guardare sarebbe strano. */
async function elenco(req, segreto) {
  const g = await esigiGestione(req, segreto);
  if (g.errore) return g.errore;

  const validi = (await tuttiGliUtenti()).map(pubblico)
    .sort((a, b) => new Date(b.creato) - new Date(a.creato));

  return json({
    attesa:    validi.filter(u => u.stato === 'in-attesa'),
    approvati: validi.filter(u => u.stato === 'approvato'),
    rifiutati: validi.filter(u => u.stato === 'rifiutato')
  });
}

async function decidi(req, segreto) {
  const g = await esigiGestione(req, segreto);
  if (g.errore) return g.errore;

  const corpo = await req.json().catch(() => ({}));
  const email = normEmail(corpo.email);
  const esito = String(corpo.esito || '');
  if (!['approva', 'rifiuta', 'elimina'].includes(esito))
    return errore('Esito non valido.');

  /* Far entrare e far uscire puo farlo anche il capitano; cancellare
     per sempre no. Rifiutare si disfa — si riammette e l'account
     torna quello di prima — mentre cancellare butta via anche le
     risposte e le presenze di quella persona. Un'azione
     irreversibile resta di chi risponde del sito. */
  if (esito === 'elimina' && g.utente.ruolo !== 'admin')
    return errore('Solo l’amministratore può eliminare un account.', 403);

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

/* Chi e capitano, chi amministrazione, chi solo giocatore.
   Lo decide l'admin e nessun altro: se potesse farlo un capitano,
   il primo capitano nominato sarebbe anche l'ultimo a poter essere
   sostituito. Sul proprio account l'admin puo agire — assegnarsi il
   capitanato e legittimo — perche qui non si toglie nessun accesso. */
async function incarico(req, segreto) {
  const g = await esigiAdmin(req, segreto);
  if (g.errore) return g.errore;

  const corpo = await req.json().catch(() => ({}));
  const email = normEmail(corpo.email);
  const quale = String(corpo.incarico || '');

  if (!INCARICHI.includes(quale)) return errore('Incarico non valido.');

  const utente = await leggiUtente(email);
  if (!utente) return errore('Utente non trovato.', 404);
  if (utente.stato !== 'approvato')
    return errore('Prima approva l’accesso, poi assegna l’incarico.', 409);

  utente.incarico = quale;
  await salvaUtente(utente);
  return json({ ok: true, utente: pubblico(utente) });
}

/* Correggere l'ID di gioco di qualcuno. Serve perche l'ID lo scrive
   la persona quando si registra, e chi sbaglia una lettera resta con
   quella per sempre: compare nella rosa, nelle convocazioni, in campo
   e nelle mail.

   CHI E CONNESSO NON VIENE BUTTATO FUORI, ed e voluto. L'ID e meta
   delle credenziali, quindi verrebbe da pensare che cambiarlo debba
   invalidare la sessione: non succede perche il gettone contiene solo
   l'email, e a ogni richiesta l'utente si rilegge dall'archivio per
   email. L'ID serve a ENTRARE, non a restare dentro. Chi era gia
   connesso continua senza accorgersi di niente; al prossimo accesso
   usera quello nuovo.

   Tutto il resto del sito segue da solo: presenze, elenchi,
   statistiche e riepiloghi leggono il nome dall'account, non da una
   copia. Restano com'erano solo due cose gia scritte — gli annunci
   pubblicati e le formazioni gia salvate — che sono istantanee di un
   momento, e nel caso d'uso vero (una lettera sbagliata, corretta
   subito) non esistono ancora. */
/* Correggere un ID scritto male e una gentilezza, non un potere: la
   fa anche il capitano. */
async function cambiaId(req, segreto) {
  const g = await esigiGestione(req, segreto);
  if (g.errore) return g.errore;

  const corpo   = await req.json().catch(() => ({}));
  const email   = normEmail(corpo.email);
  const idGioco = String(corpo.idGioco || '').trim();

  if (idGioco.length < 2 || idGioco.length > 40)
    return errore('L’ID di gioco deve avere fra 2 e 40 caratteri.');

  const utente = await leggiUtente(email);
  if (!utente) return errore('Utente non trovato.', 404);

  /* Due persone con lo stesso ID non impediscono l'accesso — quello
     va per email — ma renderebbero impossibile capire chi e chi in
     campo e negli elenchi, dove si legge solo l'ID. */
  const tutti = await tuttiGliUtenti();
  if (tutti.some(u => normEmail(u.email) !== email && normId(u.idGioco) === normId(idGioco)))
    return errore('Questo ID di gioco e gia di un altro membro.', 409);

  utente.idGioco     = idGioco;
  utente.idConfronto = normId(idGioco);
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
    if (req.method === 'POST' && azione === 'incarico')   return await incarico(req, segreto);
    if (req.method === 'POST' && azione === 'id')         return await cambiaId(req, segreto);
    return errore('Azione sconosciuta.', 404);
  } catch (e) {
    console.error('area riservata:', e);
    return errore('Errore del server. Riprova.', 500);
  }
};

export const config = { path: '/api/area/:azione' };
