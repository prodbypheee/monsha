/* =============================================================
   MONACI SHAOLIN — convocazioni, lato server
   -------------------------------------------------------------
   Tutto quello che sta qui dentro esige una sessione valida: non
   c'e nessuna azione pubblica. La sessione si legge dal cookie e
   l'utente si rilegge dall'archivio a ogni richiesta, quindi un
   accesso revocato smette di funzionare subito, anche a meta di una
   giornata di allenamento.

   Chi puo cosa:
     tutti i membri approvati   rispondono presente / assente,
                                vedono chi ha risposto, accendono
                                le notifiche
     capitano, amministrazione  scelgono i giorni di allenamento
     admin                      tutto quanto sopra

   La differenza fra ruolo e incarico e voluta: `ruolo` (admin /
   membro) dice chi comanda sugli accessi, `incarico` (giocatore /
   capitano / amministrazione) dice cosa uno fa negli allenamenti.
   Il capitano non deve poter approvare o cacciare nessuno.
   ============================================================= */

import {
  json, errore, esigiMembro, tuttiGliUtenti, chiave,
  incaricoDi, puoConvocare, oggiRoma, dataValida
} from '../lib/comune.mjs';

import {
  leggiGiorni, salvaGiorni, leggiRisposte, salvaRisposta, fraGiorni,
  prossimoGiorno, rispostaAmmessa, daConvocare, ORIZZONTE_GIORNI
} from '../lib/convocazioni.mjs';

import {
  chiavePubblica, iscrivi, disiscrivi, sottoscrizioniDi, sottoscrizioneValida
} from '../lib/push.mjs';

/* ---------- chi sono e cosa vedo ------------------------------ */

async function stato(req, segreto) {
  const g = await esigiMembro(req, segreto);
  if (g.errore) return g.errore;
  const u = g.utente;

  const giorni = await leggiGiorni();
  const mieDevice = await sottoscrizioniDi(chiave(u.email));

  return json({
    io: {
      email:     u.email,
      idGioco:   u.idGioco,
      ruolo:     u.ruolo,
      incarico:  incaricoDi(u),
      convoca:   puoConvocare(u)
    },
    giorni,
    oggi:      oggiRoma(),
    prossimo:  prossimoGiorno(giorni),
    orizzonte: ORIZZONTE_GIORNI,
    push: {
      chiave:   chiavePubblica(),
      attive:   mieDevice.length
    }
  });
}

/* ---------- la giornata: chi c'e e chi no ---------------------
   Esce l'ID di gioco, non l'email: la rosa e pubblica sul sito,
   gli indirizzi no. Chi non ha ancora risposto compare lo stesso,
   con stato nullo — e proprio quello che il capitano vuole vedere. */

async function giorno(req, segreto, indirizzo) {
  const g = await esigiMembro(req, segreto);
  if (g.errore) return g.errore;

  const data = String(indirizzo.searchParams.get('data') || '');
  if (!dataValida(data)) return errore('Data non valida.');

  const [giorni, risposte, utenti] = await Promise.all([
    leggiGiorni(), leggiRisposte(data), tuttiGliUtenti()
  ]);

  const elenco = daConvocare(utenti).map(u => {
    const k = chiave(u.email);
    const r = risposte[k];
    return {
      idGioco:  u.idGioco,
      incarico: incaricoDi(u),
      stato:    r ? r.stato : null,
      quando:   r ? r.quando : null,
      io:       u.email === g.utente.email
    };
  }).sort((a, b) => a.idGioco.localeCompare(b.idGioco, 'it'));

  return json({
    data,
    allenamento: giorni.includes(data),
    apribile:    rispostaAmmessa(data),
    elenco,
    conta: {
      presenti: elenco.filter(v => v.stato === 'presente').length,
      assenti:  elenco.filter(v => v.stato === 'assente').length,
      muti:     elenco.filter(v => !v.stato).length
    }
  });
}

/* ---------- il capitano sceglie i giorni ---------------------- */

async function giorni(req, segreto) {
  const g = await esigiMembro(req, segreto);
  if (g.errore) return g.errore;
  if (!puoConvocare(g.utente))
    return errore('Solo il capitano o l’amministrazione possono fissare gli allenamenti.', 403);

  const corpo = await req.json().catch(() => ({}));
  if (!Array.isArray(corpo.giorni)) return errore('Elenco dei giorni mancante.');
  if (corpo.giorni.length > 60) return errore('Troppi giorni in una volta sola.');

  const salvati = await salvaGiorni(corpo.giorni, g.utente.idGioco);
  return json({ giorni: salvati, prossimo: prossimoGiorno(salvati) });
}

/* ---------- presente / assente --------------------------------
   Arriva da tre posti diversi: i due bottoni della scheda, i due
   bottoni dentro la notifica su Android, e il tocco sulla notifica
   su iPhone. Per il server sono la stessa identica richiesta. */

async function rispondi(req, segreto) {
  const g = await esigiMembro(req, segreto);
  if (g.errore) return g.errore;

  const corpo = await req.json().catch(() => ({}));
  const data  = String(corpo.data || '');
  const scelta = String(corpo.stato || '');

  if (!dataValida(data))                        return errore('Data non valida.');
  if (!['presente', 'assente'].includes(scelta)) return errore('Risposta non valida.');

  // Si legge da ieri e non da oggi: la finestra di cortesia della
  // notte fonda deve poter trovare l'allenamento di ieri, altrimenti
  // la risposta verrebbe rifiutata perche il giorno non esiste piu.
  const giorni = await leggiGiorni(fraGiorni(oggiRoma(), -1));

  if (!giorni.includes(data))
    return errore('Quel giorno non c’è allenamento.', 409);

  if (!rispostaAmmessa(data))
    return errore('Troppo tardi per rispondere a quella giornata.', 409);

  await salvaRisposta(data, g.utente, scelta);
  return json({ ok: true, data, stato: scelta });
}

/* ---------- notifiche ----------------------------------------- */

async function pushIscrivi(req, segreto) {
  const g = await esigiMembro(req, segreto);
  if (g.errore) return g.errore;

  const corpo = await req.json().catch(() => ({}));
  if (!sottoscrizioneValida(corpo.sottoscrizione))
    return errore('Sottoscrizione non valida.');

  await iscrivi(chiave(g.utente.email), corpo.sottoscrizione);
  return json({ ok: true });
}

async function pushEsci(req, segreto) {
  const g = await esigiMembro(req, segreto);
  if (g.errore) return g.errore;

  const corpo = await req.json().catch(() => ({}));
  await disiscrivi(chiave(g.utente.email), String(corpo.endpoint || ''));
  return json({ ok: true });
}

/* ---------- ingresso ------------------------------------------ */

export default async (req) => {
  const segreto = process.env.AUTH_SECRET;
  if (!segreto)
    return errore('Area riservata non configurata: manca AUTH_SECRET.', 503);

  const indirizzo = new URL(req.url);
  const azione = indirizzo.pathname.split('/').filter(Boolean).pop();

  try {
    if (req.method === 'GET'  && azione === 'stato')        return await stato(req, segreto);
    if (req.method === 'GET'  && azione === 'giorno')       return await giorno(req, segreto, indirizzo);
    if (req.method === 'POST' && azione === 'giorni')       return await giorni(req, segreto);
    if (req.method === 'POST' && azione === 'rispondi')     return await rispondi(req, segreto);
    if (req.method === 'POST' && azione === 'push-iscrivi') return await pushIscrivi(req, segreto);
    if (req.method === 'POST' && azione === 'push-esci')    return await pushEsci(req, segreto);
    return errore('Azione sconosciuta.', 404);
  } catch (e) {
    console.error('convocazioni:', e);
    return errore('Errore del server. Riprova.', 500);
  }
};

export const config = { path: '/api/convocazioni/:azione' };
