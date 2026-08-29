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

/* Quanta storia si tiene. Sei mesi bastano a qualunque statistica che
   abbia senso guardare, e l'elenco resta corto abbastanza da leggerlo
   tutto in un colpo. */
export const MEMORIA_GIORNI = 180;

/* Il capitano sceglie solo il futuro, ma i giorni passati NON si
   buttano: sono la storia degli allenamenti, e senza di quella non si
   puo dire chi c'e stato e chi no. Prima venivano cancellati a ogni
   salvataggio, e ogni volta si perdeva quello che era gia successo. */
export async function salvaGiorni(giorni, autore) {
  const oggi   = oggiRoma();
  const limite = fraGiorni(oggi, ORIZZONTE_GIORNI);
  const soglia = fraGiorni(oggi, -MEMORIA_GIORNI);

  const futuri = [...new Set(
    (Array.isArray(giorni) ? giorni : [])
      .map(g => String(g).trim())
      .filter(g => dataValida(g) && g >= oggi && g <= limite)
  )];

  // Quel che c'era prima di oggi resta, entro la memoria che teniamo.
  const passati = (await leggiTuttiIGiorni()).filter(g => g < oggi && g >= soglia);

  const tutti = [...new Set([...passati, ...futuri])].sort();

  await convoc().setJSON(GIORNI, {
    giorni: tutti,
    aggiornato: new Date().toISOString(),
    da: autore || null
  });

  // A chi salva si risponde con i suoi giorni futuri: la storia non
  // gli interessa, e vedersela comparire nel calendario sarebbe strano.
  return futuri.sort();
}

/* L'elenco grezzo, storia compresa. Serve alle statistiche; il resto
   del sito usa leggiGiorni, che taglia via il passato. */
export async function leggiTuttiIGiorni() {
  const v = await convoc().get(GIORNI, { type: 'json' }).catch(() => null);
  const grezzi = (v && Array.isArray(v.giorni)) ? v.giorni : [];
  return grezzi.filter(dataValida).sort();
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
   mattino, perche una notifica delle 14:00 toccata a mezzanotte e
   mezza e comunque una risposta sincera, e rifiutarla senza spiegare
   perche sarebbe solo scortese. */
export function rispostaAmmessa(data) {
  const oggi = oggiRoma();
  if (data >= oggi) return true;
  return data === fraGiorni(oggi, -1) && oraRoma() < 6;
}

/* ---------- solleciti -----------------------------------------
   Il colpetto sulla spalla: chi convoca sceglie una persona sola fra
   quelle che non hanno ancora risposto e le fa suonare il telefono.

   Una voce per persona e per giorno, `solleciti/<data>/<chiaveMail>`,
   per la stessa ragione delle risposte: nessuna scrittura si scontra
   con un'altra.

   La pausa si conta PER CHI LO RICEVE e non per chi lo manda. Se il
   conto fosse di chi manda, capitano e amministrazione potrebbero
   sollecitare la stessa persona a un minuto di distanza e farle
   suonare il telefono due volte — che e esattamente la cosa che la
   pausa deve impedire. Chi riceve non gliene importa niente di chi ha
   premuto il bottone: gli importa di non essere tempestato. */

const SOLLECITI = 'solleciti/';

export const PAUSA_SOLLECITO_MS = 15 * 60 * 1000;

export async function leggiSolleciti(data) {
  const { blobs } = await convoc().list({ prefix: SOLLECITI + data + '/' });
  const voci = await Promise.all(
    blobs.map(b => convoc().get(b.key, { type: 'json' }).catch(() => null))
  );
  const mappa = {};
  voci.filter(Boolean).forEach(v => { if (v.chiave) mappa[v.chiave] = v; });
  return mappa;
}

export async function segnaSollecito(data, utente, da) {
  const k = chiave(utente.email);
  await convoc().setJSON(SOLLECITI + data + '/' + k, {
    chiave:  k,
    idGioco: utente.idGioco,
    da:      da || null,
    quando:  new Date().toISOString()
  });
}

/* Quanto manca alla prossima volta, in millisecondi. Zero vuol dire
   "adesso si puo".

   Il caso strano e l'ultimo: se la data segnata e nel futuro
   l'orologio di qualcuno mente, e allora si aspetta tutta la pausa
   invece di lasciar passare il sollecito. Fra i due sbagli possibili
   e il meno peggio: al massimo si aspetta un quarto d'ora di troppo,
   mentre l'altro sbaglio fa suonare il telefono di qualcuno a
   ripetizione. */
export function attesaSollecito(ultimo, adesso = Date.now(), pausa = PAUSA_SOLLECITO_MS) {
  if (!ultimo) return 0;
  const t = Date.parse(ultimo);
  if (!Number.isFinite(t)) return 0;
  const passato = adesso - t;
  if (passato < 0) return pausa;
  return Math.max(0, pausa - passato);
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

/* ---------- chi c'e stato negli ultimi giorni ------------------
   Una finestra che scorre: oggi e i sei giorni prima, e dentro quella
   si contano solo i giorni in cui c'era davvero allenamento. Se in
   quella settimana non se ne e tenuto nessuno non si dice niente —
   "0 su 0" non e un'informazione, e una tabella vuota che sembra un
   guasto.

   Si contano le presenze, ma si riportano anche assenze e silenzi:
   chi ha detto "non ci sono" ha fatto la sua parte, chi non ha
   risposto no, e per un capitano sono due cose diverse. */

export async function presenzeRecenti(utenti, quantiGiorni = 7) {
  const oggi = oggiRoma();
  const primo = fraGiorni(oggi, -(quantiGiorni - 1));

  const allenamenti = (await leggiTuttiIGiorni())
    .filter(g => g >= primo && g <= oggi);

  if (!allenamenti.length) return { da: primo, a: oggi, allenamenti: [], righe: [] };

  const risposte = await Promise.all(allenamenti.map(leggiRisposte));

  const righe = daConvocare(utenti).map(u => {
    const k = chiave(u.email);
    let presenti = 0, assenti = 0, muti = 0;
    risposte.forEach(giorno => {
      const s = (giorno[k] || {}).stato;
      if (s === 'presente') presenti++;
      else if (s === 'assente') assenti++;
      else muti++;
    });
    return { idGioco: u.idGioco, presenti, assenti, muti };
  });

  /* Prima chi c'e stato di piu; a parita, prima chi almeno ha
     risposto; a parita ancora, in ordine alfabetico, cosi la classifica
     non balla da un caricamento all'altro. */
  righe.sort((a, b) =>
    b.presenti - a.presenti ||
    a.muti - b.muti ||
    a.idGioco.localeCompare(b.idGioco, 'it'));

  return { da: primo, a: oggi, allenamenti, righe };
}
