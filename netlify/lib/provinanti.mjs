/* =============================================================
   MONACI SHAOLIN — i provinanti
   -------------------------------------------------------------
   Uno che viene a fare una prova non ha un account, non riceve
   notifiche e non segna presente: c'e perche il capitano lo ha
   invitato, e basta. Ma in campo va messo come tutti gli altri, e
   fino a ieri non si poteva.

   Qui dentro vive solo il minimo per schierarlo: un nome e i ruoli
   in cui gioca. Niente email, niente telefono, niente di personale —
   se quella persona poi entra nel club si registra come tutti, e
   allora diventa un membro con la sua scheda.

   RESTANO FINCHE NON SI TOLGONO. Prima sparivano da soli dopo due
   giorni, e sembrava comodo: nessuna lista da pulire. Nella pratica
   voleva dire che uno provato di giovedi non c'era piu il martedi —
   e i provini si guardano su piu serate, non su una. Chi decide
   quando uno ha finito la prova e il capitano, non un contatore.
   ============================================================= */

import { getStore } from '@netlify/blobs';
import { normId } from './comune.mjs';

const store = () => getStore({ name: 'area-convocazioni', consistency: 'strong' });
const PREFISSO = 'provinanti/';

/* I sette ruoli sono ESATTAMENTE quelli del modulo pubblico, parola
   per parola. Non e un dettaglio estetico: dalla candidatura si passa
   in formazione con un bottone, e se i due vocabolari non
   combaciassero quel bottone dovrebbe indovinare cosa intendeva chi
   ha scritto "Esterno sinistro". Cosi non deve indovinare niente.

   Il reparto e l'unica cosa che al campo serve sapere: il ruolo per
   esteso e per gli occhi di chi guarda, il reparto e per le regole. */
export const RUOLI = [
  ['Portiere',           'portieri'],
  ['Difensore centrale', 'difensori'],
  ['Esterno sinistro',   'centrocampisti'],
  ['Esterno destro',     'centrocampisti'],
  ['Centrocampista',     'centrocampisti'],
  ['Trequartista',       'centrocampisti'],
  ['Attaccante',         'attaccanti']
];

export const LUNGHEZZA_ID = 60;

/* Due come nel modulo pubblico: uno dice dove gioca, non elenca tutto
   quello che sa fare. */
export const MAX_RUOLI = 2;

export const repartoDi = nome => {
  const v = RUOLI.find(r => r[0] === nome);
  return v ? v[1] : null;
};

/* ---------- controlli ----------------------------------------- */

/* Accetta sia `ruoli` (un elenco, come arriva da una candidatura) sia
   `ruolo` (uno solo, come dal menu a tendina del campo): sono la
   stessa cosa detta da due porte diverse, e obbligare una delle due a
   travestirsi da altra sarebbe solo lavoro in piu per chi chiama.

   `presi` sono gli ID gia in uso — membri e provinanti — perche due
   persone con lo stesso nome in campo sono indistinguibili, e la
   formazione le tratterebbe come una sola. */
export function validaProvinante(corpo, presi = []) {
  const c = corpo || {};
  const id = String(c.id || '').trim().slice(0, LUNGHEZZA_ID);

  const chiesti = [...new Set(
    (Array.isArray(c.ruoli) ? c.ruoli : [c.ruolo])
      .map(r => String(r || '').trim())
      .filter(Boolean)
  )].slice(0, MAX_RUOLI);

  if (!id) return { errore: 'Manca l’ID di gioco.' };
  if (!chiesti.length) return { errore: 'Ruolo non valido.' };

  const reparti = [];
  for (const r of chiesti) {
    const rep = repartoDi(r);
    if (!rep) return { errore: 'Ruolo non valido: ' + r + '.' };
    if (!reparti.includes(rep)) reparti.push(rep);
  }

  if (presi.some(x => normId(x) === normId(id)))
    return { errore: 'Quell’ID è già in campo: scegline un altro per non confonderli.' };

  /* `ruolo` e `reparto` al singolare restano dentro: sono il primo
     dell'elenco, e servono a chi vuole una risposta sola senza
     ragionare su un elenco — la scritta sotto la tessera, per dirne
     una. Chi deve decidere se uno sta bene in una casella guarda
     `reparti`, che li contiene tutti. */
  return { voce: { id, ruoli: chiesti, reparti, ruolo: chiesti[0], reparto: reparti[0] } };
}

/* ---------- archivio ------------------------------------------ */

/* I provinanti scritti prima che i ruoli diventassero un elenco hanno
   solo `ruolo` e `reparto`. Si sistemano leggendo invece di migrare
   l'archivio: una migrazione che gira a ogni lettura e un modo per
   corrompere i dati il giorno che sbaglia. */
const rileggi = v => ({
  ...v,
  ruoli:   Array.isArray(v.ruoli)   && v.ruoli.length   ? v.ruoli   : [v.ruolo].filter(Boolean),
  reparti: Array.isArray(v.reparti) && v.reparti.length ? v.reparti : [v.reparto].filter(Boolean)
});

export async function leggiProvinanti() {
  const { blobs } = await store().list({ prefix: PREFISSO });
  const voci = await Promise.all(
    blobs.map(b => store().get(b.key, { type: 'json' })
      .then(v => (v ? { ...rileggi(v), chiave: b.key } : null)).catch(() => null))
  );

  return voci.filter(Boolean).sort((a, b) => a.id.localeCompare(b.id, 'it'));
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
