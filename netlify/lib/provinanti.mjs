/* =============================================================
   MONACI SHAOLIN — i provinanti
   -------------------------------------------------------------
   Uno che viene a fare una prova non ha un account, non riceve
   notifiche e non segna presente: c'e perche il capitano lo ha
   invitato, e basta. Ma in campo va messo come tutti gli altri, e
   fino a ieri non si poteva.

   Qui dentro vive solo il minimo per schierarlo: un nome e un
   reparto. Niente email, niente telefono, niente di personale — se
   quella persona poi entra nel club si registra come tutti, e allora
   diventa un membro con la sua scheda.

   DURANO DUE GIORNI. Non c'e nessuna pulizia da far girare: la
   scadenza si guarda quando si legge, e quelli scaduti si buttano
   quando si scrive. Un provino che dura due giorni copre la sera
   della prova e quella dopo, che e il tempo in cui si decide; oltre,
   se uno resta, si registra.
   ============================================================= */

import { getStore } from '@netlify/blobs';
import { normId } from './comune.mjs';

const store = () => getStore({ name: 'area-convocazioni', consistency: 'strong' });
const PREFISSO = 'provinanti/';

export const VIVE_MS = 2 * 24 * 60 * 60 * 1000;

/* I reparti sono quelli delle caselle: e l'unica cosa che al campo
   serve sapere di uno. Il ruolo per esteso e per gli occhi di chi
   guarda, il reparto e per le regole. */
export const RUOLI = [
  ['Portiere',           'portieri'],
  ['Difensore centrale', 'difensori'],
  ['Esterno',            'centrocampisti'],
  ['Centrocampista',     'centrocampisti'],
  ['Trequartista',       'centrocampisti'],
  ['Attaccante',         'attaccanti']
];

export const LUNGHEZZA_ID = 60;

/* ---------- controlli ----------------------------------------- */

/* `presi` sono gli ID gia in uso — membri e provinanti — perche due
   persone con lo stesso nome in campo sono indistinguibili, e la
   formazione le tratterebbe come una sola. */
export function validaProvinante(corpo, presi = []) {
  const id = String((corpo && corpo.id) || '').trim().slice(0, LUNGHEZZA_ID);
  const ruolo = String((corpo && corpo.ruolo) || '').trim();

  if (!id) return { errore: 'Manca l’ID di gioco.' };

  const voce = RUOLI.find(r => r[0] === ruolo);
  if (!voce) return { errore: 'Ruolo non valido.' };

  if (presi.some(x => normId(x) === normId(id)))
    return { errore: 'Quell’ID è già in campo: scegline un altro per non confonderli.' };

  return { voce: { id, ruolo, reparto: voce[1] } };
}

/* Quanto resta da vivere, in millisecondi. Zero vuol dire scaduto.

   Una data illeggibile conta come scaduta: meglio far sparire un
   provinante che tenerne uno per sempre perche una riga d'archivio
   era scritta male. Una data nel futuro invece si tiene — sara
   l'orologio di qualcuno a mentire, e buttare via il lavoro del
   capitano per quello sarebbe peggio. */
export function restaDaVivere(creato, adesso = Date.now(), vive = VIVE_MS) {
  const t = Date.parse(creato);
  if (!Number.isFinite(t)) return 0;
  if (t > adesso) return vive;
  return Math.max(0, vive - (adesso - t));
}

export const viviSoltanto = (lista, adesso = Date.now()) =>
  (lista || []).filter(p => p && restaDaVivere(p.creato, adesso) > 0);

/* ---------- archivio ------------------------------------------ */

export async function leggiProvinanti() {
  const { blobs } = await store().list({ prefix: PREFISSO });
  const voci = await Promise.all(
    blobs.map(b => store().get(b.key, { type: 'json' })
      .then(v => (v ? { ...v, chiave: b.key } : null)).catch(() => null))
  );

  const vivi = viviSoltanto(voci.filter(Boolean));

  /* I morti si buttano qui, mentre si passa: e il momento in cui si
     e gia in mano l'elenco, e non serve nessuna pulizia programmata.
     Se la cancellazione va storta non importa — la lettura li ha gia
     esclusi, e si riprova al prossimo giro. */
  const morti = voci.filter(Boolean).filter(v => !vivi.includes(v));
  if (morti.length)
    Promise.all(morti.map(v => store().delete(v.chiave).catch(() => null)))
      .catch(() => null);

  return vivi.sort((a, b) => a.id.localeCompare(b.id, 'it'));
}

export async function salvaProvinante(voce, autore) {
  const chiave = PREFISSO + normId(voce.id);
  const dentro = { ...voce, creato: new Date().toISOString(), da: autore || null };
  await store().setJSON(chiave, dentro);
  return { ...dentro, chiave };
}

export async function eliminaProvinante(id) {
  const k = PREFISSO + normId(id);
  if (!normId(id)) return false;
  const c = await store().get(k, { type: 'json' }).catch(() => null);
  if (!c) return false;
  await store().delete(k);
  return true;
}
