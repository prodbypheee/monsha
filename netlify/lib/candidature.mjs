/* =============================================================
   MONACI SHAOLIN — le candidature dei provini
   -------------------------------------------------------------
   Prima di questo file una candidatura era solo una mail: partiva dal
   browser di chi si candidava e finiva in una casella. Se quella mail
   si perdeva, o finiva nello spam, o semplicemente veniva letta e poi
   sepolta sotto le altre, della persona non restava niente da nessuna
   parte.

   Adesso resta qui, e la mail continua a partire lo stesso: sono due
   strade indipendenti verso la stessa notizia, e se una si rompe
   l'altra regge.

   UNA VOCE PER CANDIDATURA, `candidature/<quando>-<caso>`. Il nome
   comincia con l'istante in ordine alfabetico crescente, cosi
   l'archivio si legge gia ordinato senza dover aprire tutto per
   guardare le date.

   ATTENZIONE, QUESTO E L'UNICO PUNTO DEL SITO DOVE CHIUNQUE PUO
   SCRIVERE SENZA AVERE UN ACCESSO. Un modulo pubblico che salva e un
   invito a riempirlo di spazzatura, quindi qui sotto ci sono tre
   argini: quanto si puo scrivere, quanto spesso, e quante candidature
   si tengono in tutto.
   ============================================================= */

import { getStore } from '@netlify/blobs';

const store = () => getStore({ name: 'area-candidature', consistency: 'strong' });

const VOCI = 'candidature/';
const PORTE = 'porta/';

/* ---------- gli argini --------------------------------------- */

/* Quanto puo essere lungo ogni pezzo. Sono misure larghe per una
   persona vera e strette per chi volesse usarci come deposito. */
export const LIMITI = {
  id: 60, piattaforma: 20, telefono: 40, note: 1000,
  ruoli: 2, comp: 12, club: 12, giorni: 7, voce: 60
};

/* Quanto deve passare fra due candidature dallo stesso indirizzo di
   rete. Due minuti: chi si accorge di aver sbagliato una lettera
   rimanda subito, chi vuole riempire l'archivio si annoia. */
export const PAUSA_INVIO_MS = 2 * 60 * 1000;

/* Quante se ne tengono. Le piu vecchie si buttano da sole: senza un
   tetto, l'archivio cresce per sempre e la lettura diventa lenta
   proprio quando serve. */
export const QUANTE = 300;

/* ---------- la ripulitura di quello che arriva ----------------
   Non si rifiuta quasi niente: si taglia. Una candidatura scritta
   male resta una persona che vuole giocare con noi, e buttarla per
   una virgola sarebbe il modo peggiore di riceverla. Si rifiuta solo
   quando manca cio senza cui non si puo richiamare nessuno. */

const testo = (v, max) => String(v == null ? '' : v).trim().slice(0, max);

const lista = (v, quanti, lungh) =>
  (Array.isArray(v) ? v : [])
    .map(x => testo(x, lungh))
    .filter(Boolean)
    .slice(0, quanti);

export function validaCandidatura(corpo) {
  const c = corpo || {};

  const id = testo(c.id, LIMITI.id);
  const piattaforma = testo(c.piattaforma, LIMITI.piattaforma);
  const ruoli = lista(c.ruoli, LIMITI.ruoli, LIMITI.voce);

  /* Le tre cose senza cui la candidatura non serve a niente: chi sei
     in gioco, dove giochi, e in che ruolo. Il resto e benvenuto ma
     puo mancare. */
  if (!id) return { errore: 'Manca l’ID di gioco.' };
  if (!piattaforma) return { errore: 'Manca la piattaforma.' };
  if (!ruoli.length) return { errore: 'Manca il ruolo.' };

  return {
    voce: {
      id,
      piattaforma,
      ruoli,
      comp:   lista(c.comp,   LIMITI.comp,   LIMITI.voce),
      club:   lista(c.club,   LIMITI.club,   LIMITI.voce),
      giorni: lista(c.giorni, LIMITI.giorni, LIMITI.voce),
      telefono: testo(c.telefono, LIMITI.telefono),
      note:     testo(c.note, LIMITI.note)
    }
  };
}

/* ---------- il numero, come lo vuole WhatsApp -----------------
   Chi si candida scrive il numero come gli pare: "+39 333 1234567",
   "333-1234567", "0039 333 1234567". WhatsApp lo vuole in un modo
   solo: cifre attaccate, prefisso internazionale davanti, senza piu.

   Il pezzo delicato e il prefisso mancante. Un cellulare italiano ha
   dieci cifre e comincia per 3; con davanti il 39 ne ha dodici. Sono
   due forme distinguibili, e si distinguono su quelle due regole
   invece che a naso:

     dieci cifre che cominciano per 3   e un italiano senza prefisso
     dodici cifre che cominciano per 39 ce l'ha gia

   Tutto il resto si lascia com'e: un numero straniero l'ha scritto
   chi lo conosce, e indovinargli un prefisso sarebbe peggio che non
   toccarlo. Quello che non ha una lunghezza plausibile torna null, e
   il bottone non compare: meglio nessun bottone che un bottone che
   apre la chat sbagliata. */

export function numeroWhatsApp(grezzo) {
  let n = String(grezzo == null ? '' : grezzo).replace(/\D/g, '');
  if (!n) return null;

  if (n.startsWith('00')) n = n.slice(2);          // 0039… → 39…
  if (n.length === 10 && n.startsWith('3')) n = '39' + n;

  // E.164: da otto a quindici cifre, prefisso compreso.
  if (n.length < 8 || n.length > 15) return null;
  return n;
}

/* ---------- la porta: una ogni due minuti per indirizzo -------
   L'indirizzo di rete non identifica una persona — un'intera casa o
   un intero ufficio ne condividono uno — quindi non si usa per altro
   e non si mostra da nessuna parte. Serve solo a tenere il ritmo. */

export function attesaInvio(ultimo, adesso = Date.now(), pausa = PAUSA_INVIO_MS) {
  if (!ultimo) return 0;
  const t = Date.parse(ultimo);
  if (!Number.isFinite(t)) return 0;
  const passato = adesso - t;
  if (passato < 0) return pausa;          // orologio storto: si aspetta tutto
  return Math.max(0, pausa - passato);
}

const impronta = ip => {
  // Non si conserva l'indirizzo in chiaro: serve sapere "e lo stesso
  // di prima?", non "qual e".
  let h = 5381;
  const s = String(ip || 'ignoto');
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36);
};

export async function quantoAspettare(ip) {
  const k = PORTE + impronta(ip);
  const v = await store().get(k, { type: 'json' }).catch(() => null);
  return attesaInvio(v && v.quando);
}

export async function segnaPassaggio(ip) {
  await store().setJSON(PORTE + impronta(ip), { quando: new Date().toISOString() });
}

/* ---------- scrivere e leggere ------------------------------- */

export async function salvaCandidatura(voce) {
  const quando = new Date().toISOString();
  const caso = Math.random().toString(36).slice(2, 8);
  await store().setJSON(VOCI + quando + '-' + caso, { ...voce, quando });
  return quando;
}

export async function leggiCandidature(quante = QUANTE) {
  const { blobs } = await store().list({ prefix: VOCI });

  // I nomi cominciano con l'istante: ordinandoli al contrario si ha
  // gia la piu recente in cima, senza aprire niente.
  const chiavi = blobs.map(b => b.key).sort().reverse();

  const voci = await Promise.all(
    chiavi.slice(0, quante).map(k =>
      store().get(k, { type: 'json' }).then(v => (v ? { ...v, chiave: k } : null)).catch(() => null))
  );

  return voci.filter(Boolean);
}

/* Il tetto si fa rispettare quando si scrive, non con una pulizia
   periodica: cosi non c'e niente da ricordarsi di far girare. */
export async function potaVecchie(quante = QUANTE) {
  const { blobs } = await store().list({ prefix: VOCI });
  if (blobs.length <= quante) return 0;

  const daButtare = blobs.map(b => b.key).sort().slice(0, blobs.length - quante);
  await Promise.all(daButtare.map(k => store().delete(k).catch(() => null)));
  return daButtare.length;
}

export async function eliminaCandidatura(chiave) {
  const k = String(chiave || '');
  if (!k.startsWith(VOCI)) return false;    // non si cancella fuori casa
  await store().delete(k);
  return true;
}
