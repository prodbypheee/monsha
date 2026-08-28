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

export async function leggiFormazione(data) {
  const v = await convoc().get(PREFISSO + data, { type: 'json' }).catch(() => null);
  return {
    modulo: MODULO,
    schieramento: (v && v.schieramento && typeof v.schieramento === 'object') ? v.schieramento : {},
    aggiornato: (v && v.aggiornato) || null,
    da: (v && v.da) || null
  };
}

export async function salvaFormazione(data, schieramento, autore) {
  await convoc().setJSON(PREFISSO + data, {
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
