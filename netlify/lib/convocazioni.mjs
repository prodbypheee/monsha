/* =============================================================
   MONACI SHAOLIN — convocazioni, archivio e regole
   -------------------------------------------------------------
   Due cose vivono qui dentro, nello store `area-convocazioni`:

     giorni                        i giorni di allenamento scelti dal
                                   capitano, una voce sola
     risposte/<data>/<chiaveMail>  presente o assente, UNA VOCE PER
                                   PERSONA E PER GIORNO

   La seconda struttura sembra piu complicata del necessario — sarebbe
   piu comodo un unico documento per giornata — ed e invece la parte
   importante: se venti persone rispondono nello stesso minuto alle
   14:00, venti scritture sullo stesso documento si sovrascrivono a
   vicenda e qualcuno sparisce dall'elenco senza accorgersene. Con una
   chiave per persona non esiste proprio la possibilita di scontrarsi.
   ============================================================= */

import { convoc, chiave, oggiRoma, oraRoma, dataValida, incaricoDi } from './comune.mjs';

const GIORNI    = 'giorni';
const RISPOSTE  = 'risposte/';

/* Quanto in la si puo programmare: quattro settimane oltre a quella
   in corso. Serve anche come controllo lato server — il calendario
   del sito si ferma li, ma il server non si fida del sito. */
export const ORIZZONTE_GIORNI = 35;

/* ---------- giorni di allenamento ----------------------------- */

/* I giorni passati vengono buttati via a ogni lettura invece che con
   una pulizia periodica: l'elenco resta corto da solo e non serve
   ricordarsi di far girare niente. */
export async function leggiGiorni(da) {
  const v = await convoc().get(GIORNI, { type: 'json' }).catch(() => null);
  const grezzi = (v && Array.isArray(v.giorni)) ? v.giorni : [];
  const soglia = da || oggiRoma();
  return grezzi.filter(g => dataValida(g) && g >= soglia).sort();
}

export async function salvaGiorni(giorni, autore) {
  const oggi   = oggiRoma();
  const limite = fraGiorni(oggi, ORIZZONTE_GIORNI);

  const puliti = [...new Set(
    (Array.isArray(giorni) ? giorni : [])
      .map(g => String(g).trim())
      .filter(g => dataValida(g) && g >= oggi && g <= limite)
  )].sort();

  await convoc().setJSON(GIORNI, {
    giorni: puliti,
    aggiornato: new Date().toISOString(),
    da: autore || null
  });
  return puliti;
}

/* Somma di giorni fatta sul calendario UTC: nessun fuso di mezzo,
   quindi nessun 31 marzo che diventa 30 per via dell'ora legale. */
export function fraGiorni(data, quanti) {
  const [a, m, g] = String(data).split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1, g));
  d.setUTCDate(d.getUTCDate() + quanti);
  return d.toISOString().slice(0, 10);
}

/* Il primo allenamento utile: oggi se c'e, altrimenti il prossimo. */
export const prossimoGiorno = giorni => {
  const oggi = oggiRoma();
  return giorni.find(g => g >= oggi) || null;
};

/* ---------- risposte ------------------------------------------ */

export async function leggiRisposte(data) {
  const { blobs } = await convoc().list({ prefix: RISPOSTE + data + '/' });
  const voci = await Promise.all(
    blobs.map(b => convoc().get(b.key, { type: 'json' }).catch(() => null))
  );
  const mappa = {};
  voci.filter(Boolean).forEach(v => { if (v.chiave) mappa[v.chiave] = v; });
  return mappa;
}

export async function salvaRisposta(data, utente, stato) {
  const k = chiave(utente.email);
  await convoc().setJSON(RISPOSTE + data + '/' + k, {
    chiave:  k,
    email:   utente.email,
    idGioco: utente.idGioco,
    stato,                      // 'presente' oppure 'assente'
    quando:  new Date().toISOString()
  });
}

/* Fino a quando si accetta una risposta. Il giorno stesso e i giorni
   futuri, ovviamente; ma anche il giorno prima fino alle sei del
   mattino, perche una notifica delle 17:00 toccata a mezzanotte e
   mezza e comunque una risposta sincera, e rifiutarla senza spiegare
   perche sarebbe solo scortese. */
export function rispostaAmmessa(data) {
  const oggi = oggiRoma();
  if (data >= oggi) return true;
  return data === fraGiorni(oggi, -1) && oraRoma() < 6;
}

/* ---------- chi va convocato -----------------------------------
   Tutti i membri approvati, capitano compreso: anche lui deve dire
   se c'e, altrimenti la lista che gli arriva alle 20:00 e monca
   proprio della persona che la legge. */
export const daConvocare = utenti =>
  utenti.filter(u => u.stato === 'approvato');

export const riceveIlRiepilogo = utenti =>
  utenti.filter(u => u.stato === 'approvato' &&
    (u.ruolo === 'admin' || incaricoDi(u) !== 'giocatore'));

/* ---------- a chi va il riepilogo delle 20:00 -----------------
   Gli indirizzi stanno nella variabile EMAIL_RIEPILOGO su Netlify,
   separati da virgola o a capo, e NON nel codice: questo repository
   e pubblico, e tre indirizzi scritti qui dentro finirebbero
   indicizzati e nella cronologia git per sempre, dove i raccoglitori
   di spam li trovano. Una variabile d'ambiente si cambia in dieci
   secondi e non lascia tracce.

   Se la variabile manca si torna agli account con un incarico:
   meglio mandarlo a chi sta gia dentro che non mandarlo affatto.

   Quando l'indirizzo appartiene a un membro, il suo ID di gioco
   viaggia nella mail come {{capitano}}; per gli altri resta vuoto. */

export function destinatariRiepilogo(utenti) {
  const grezzi = String(process.env.EMAIL_RIEPILOGO || '')
    .split(/[\s,;]+/)
    .map(v => v.trim().toLowerCase())
    .filter(v => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v) && v.length <= 254);

  const indirizzi = [...new Set(grezzi)];

  if (!indirizzi.length)
    return riceveIlRiepilogo(utenti).map(u => ({ email: u.email, idGioco: u.idGioco }));

  const perEmail = new Map(utenti.map(u => [String(u.email).toLowerCase(), u]));
  return indirizzi.map(email => ({
    email,
    idGioco: (perEmail.get(email) || {}).idGioco || ''
  }));
}
