/* =============================================================
   MONACI SHAOLIN — la formazione
   -------------------------------------------------------------
   Undici caselle su un campo, una per giornata di allenamento.
   Le compila il capitano (o l'amministrazione) scegliendo fra chi
   ha segnato PRESENTE quel giorno; tutti gli altri la vedono e
   basta.

   Il modulo e il 3-4-1-2, lo stesso del modulo di candidatura:
   tre centrali, due esterni e due centrali di centrocampo, un
   trequartista, due punte. Le coordinate sono percentuali sul
   campo disegnato nel sito — 0 in alto (porta avversaria), 100 in
   basso (porta nostra) — cosi lo stesso elenco vale sia per il
   disegno sia per i controlli del server, e non si possono
   disallineare.

   Ogni casella dichiara il reparto che accetta. E una regola di
   calcio, non di sicurezza: un difensore in attacco non fa danni a
   nessuno, quindi il sito la applica per aiutare e il server la
   ricontrolla per coerenza, ma nessuna delle due cose custodisce
   niente. Cio che il server difende davvero e un'altra cosa: che
   in campo finisca solo chi ha detto di esserci, e nessuno due
   volte.
   ============================================================= */

import { convoc } from './comune.mjs';

const PREFISSO = 'formazione/';

export const MODULO = '3-4-1-2';

export const CASELLE = [
  { id: 'por',  eti: 'POR', reparto: 'portieri',       x: 50, y: 90 },
  { id: 'dcs',  eti: 'DC',  reparto: 'difensori',      x: 20, y: 72 },
  { id: 'dcc',  eti: 'DC',  reparto: 'difensori',      x: 50, y: 76 },
  { id: 'dcd',  eti: 'DC',  reparto: 'difensori',      x: 80, y: 72 },
  { id: 'es',   eti: 'ES',  reparto: 'centrocampisti', x: 11, y: 50 },
  { id: 'cdcs', eti: 'CDC', reparto: 'centrocampisti', x: 37, y: 55 },
  { id: 'cdcd', eti: 'CDC', reparto: 'centrocampisti', x: 63, y: 55 },
  { id: 'ed',   eti: 'ED',  reparto: 'centrocampisti', x: 89, y: 50 },
  { id: 'coc',  eti: 'COC', reparto: 'centrocampisti', x: 50, y: 34 },
  { id: 'atts', eti: 'ATT', reparto: 'attaccanti',     x: 33, y: 15 },
  { id: 'attd', eti: 'ATT', reparto: 'attaccanti',     x: 67, y: 15 }
];

/* Gli Icons restano fuori per scelta: non e un reparto che compare
   in nessuna casella, quindi chi e catalogato cosi non e schierabile
   da nessuna parte. Il giorno che servisse, basta aggiungerlo ai
   reparti ammessi delle caselle che lo devono accettare. */

const ID_CASELLE = CASELLE.map(c => c.id);
const normId = v => String(v || '').trim().toLowerCase();

/* ---------- archivio ------------------------------------------ */

/* Quante formazioni per giornata. In una serata se ne giocano piu
   d'una, e ognuna vuole la sua: cambiare undici caselle fra un
   fischio e l'altro, e perdere quella di prima, non e un modo di
   lavorare.

   Le tre vivono dentro la giornata e basta: la chiave comincia con la
   data, quindi al prossimo allenamento sono tre caselle nuove e
   vuote. Non c'e nessuna scadenza da far scattare — la scadenza e il
   giorno dopo. */
export const PARTITE = 3;

export function partitaValida(n) {
  const v = Number(n);
  return Number.isInteger(v) && v >= 1 && v <= PARTITE ? v : 1;
}

const dove = (data, partita) => PREFISSO + data + '/' + partitaValida(partita);

export async function leggiFormazione(data, partita = 1) {
  const v = await convoc().get(dove(data, partita), { type: 'json' }).catch(() => null);
  return {
    modulo: MODULO,
    schieramento: (v && v.schieramento && typeof v.schieramento === 'object') ? v.schieramento : {},
    aggiornato: (v && v.aggiornato) || null,
    da: (v && v.da) || null
  };
}

export async function salvaFormazione(data, partita, schieramento, autore) {
  await convoc().setJSON(dove(data, partita), {
    modulo: MODULO,
    schieramento,
    aggiornato: new Date().toISOString(),
    da: autore || null
  });
}

/* ---------- controlli -----------------------------------------
   `presenti` e l'elenco degli ID di chi ha segnato presente quel
   giorno. Il reparto arriva dalla rosa e puo mancare — chi non e in
   rosa non ha un reparto — e in quel caso la casella lo accetta
   comunque: meglio poter schierare qualcuno di cui non sappiamo il
   ruolo che non poterlo schierare affatto. */

export function verificaSchieramento(grezzo, presenti) {
  if (!grezzo || typeof grezzo !== 'object' || Array.isArray(grezzo))
    return { errore: 'Formazione non valida.' };

  const ammessi = new Map(presenti.map(id => [normId(id), id]));
  const pulito = {};
  const gia = new Set();

  for (const [casella, valore] of Object.entries(grezzo)) {
    if (!ID_CASELLE.includes(casella))
      return { errore: 'Casella sconosciuta: ' + casella };

    if (valore === null || valore === undefined || valore === '') continue;

    const chiave = normId(valore);
    if (!ammessi.has(chiave))
      return { errore: 'In campo puoi mettere solo chi ha segnato presente.' };

    if (gia.has(chiave))
      return { errore: 'Lo stesso giocatore compare in due caselle.' };
    gia.add(chiave);

    /* Il reparto NON e piu un divieto. Il sito propone per primi
       quelli del ruolo giusto, ma il capitano deve poter mettere un
       centrocampista in difesa o il portiere in attacco: succede, e
       chi allena sa perche. Un server che glielo impedisse sarebbe un
       server che pretende di capire di calcio piu di lui.

       Restano invece le regole sui dati, che nessuno deve poter
       aggirare: in campo solo chi ha segnato presente, nessuno in due
       caselle, e nessuna casella inventata. */

    // Si salva l'ID come lo conosce l'archivio, non come e stato
    // scritto: cosi il confronto con la rosa resta stabile.
    pulito[casella] = ammessi.get(chiave);
  }

  return { schieramento: pulito };
}

/* ---------- chi si sfila esce dal campo ------------------------
   Se uno segna ASSENTE dopo essere stato schierato, va tolto dalle
   caselle: una formazione con dentro chi ha detto che non viene e
   peggio di una casella vuota, perche il capitano la legge come
   buona e scopre il buco all'ultimo.

   Sta qui e non nel sito perche la risposta puo arrivare da tre
   posti — i bottoni della pagina, quelli dentro la notifica su
   Android, il tocco sulla notifica su iPhone — e in due di quei tre
   casi il sito non e nemmeno aperto. */

export async function togliDalCampo(data, idGioco) {
  const cercato = normId(idGioco);
  if (!cercato) return false;

  /* Tutte e tre le partite, non solo quella aperta: chi dice "non ci
     sono" non c'e in nessuna, e lasciarlo schierato nella seconda
     perche il capitano stava guardando la prima sarebbe proprio il
     buco che questa funzione esiste per chiudere. */
  let tolto = false;

  for (let p = 1; p <= PARTITE; p++) {
    const f = await leggiFormazione(data, p);
    const caselle = Object.entries(f.schieramento)
      .filter(([, chi]) => normId(chi) === cercato)
      .map(([casella]) => casella);

    if (!caselle.length) continue;

    caselle.forEach(c => { delete f.schieramento[c]; });

    /* Si tiene la firma di chi aveva schierato: e ancora la sua
       formazione, semplicemente con un buco in meno di quanti
       credeva. Cambia solo il momento dell'ultima modifica, che e
       vero. */
    await salvaFormazione(data, p, f.schieramento, f.da);
    tolto = true;
  }

  return tolto;
}

/* Lo schieramento ripulito: restano solo le caselle occupate da chi e
   presente adesso. E il filtro che rende la regola vera comunque
   vadano le cose, senza fidarsi di cio che c'e scritto nell'archivio.
   Non scrive niente: e una lettura onesta, non una correzione. */
export function soloPresenti(schieramento, presenti) {
  const ammessi = new Set((presenti || []).map(normId));
  const pulito = {};
  for (const [casella, chi] of Object.entries(schieramento || {}))
    if (chi && ammessi.has(normId(chi))) pulito[casella] = chi;
  return pulito;
}
