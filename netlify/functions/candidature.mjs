/* =============================================================
   MONACI SHAOLIN — candidature, lato server
   -------------------------------------------------------------
   Due porte, e sono diversissime fra loro:

     POST /invia    APERTA A CHIUNQUE. E l'unico punto del sito dove
                    si scrive senza avere un accesso, perche chi si
                    candida per definizione non ce l'ha. Percio ha
                    tutti gli argini: quanto si puo scrivere, quanto
                    spesso, e quante candidature si tengono.

     GET  /elenco   solo per chi gestisce, cioe admin e capitano.
                    Qui dentro ci sono numeri di telefono di persone
                    che non fanno parte del club: non e roba da
                    lasciare a chiunque abbia un accesso.
   ============================================================= */

import { json, errore, esigiGestione } from '../lib/comune.mjs';
import {
  validaCandidatura, salvaCandidatura, leggiCandidature,
  quantoAspettare, segnaPassaggio, potaVecchie, eliminaCandidatura
} from '../lib/candidature.mjs';

/* L'indirizzo di chi chiama lo mette Netlify. Non lo conserviamo in
   chiaro da nessuna parte — serve solo a non farsi riempire
   l'archivio dallo stesso posto in un minuto. */
const daDove = req =>
  req.headers.get('x-nf-client-connection-ip') ||
  (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
  'ignoto';

async function invia(req) {
  const corpo = await req.json().catch(() => ({}));

  const esito = validaCandidatura(corpo);
  if (esito.errore) return errore(esito.errore);

  const manca = await quantoAspettare(daDove(req));
  if (manca > 0)
    return json({
      errore: 'Hai appena mandato una candidatura: aspetta un paio di minuti.',
      attesa: Math.ceil(manca / 1000)
    }, 429);

  await salvaCandidatura(esito.voce);
  await segnaPassaggio(daDove(req));

  // La potatura non deve poter far fallire un invio riuscito: se va
  // storta si riprova al prossimo, e nel frattempo la candidatura e
  // gia al sicuro.
  potaVecchie().catch(e => console.error('candidature: potatura —', e && e.message));

  return json({ ok: true });
}

async function elenco(req, segreto) {
  const g = await esigiGestione(req, segreto);
  if (g.errore) return g.errore;

  const voci = await leggiCandidature();
  return json({ candidature: voci, quante: voci.length });
}

async function elimina(req, segreto) {
  const g = await esigiGestione(req, segreto);
  if (g.errore) return g.errore;

  const corpo = await req.json().catch(() => ({}));
  const fatto = await eliminaCandidatura(corpo.chiave);
  if (!fatto) return errore('Candidatura non trovata.', 404);
  return json({ ok: true });
}

export default async (req) => {
  const segreto = process.env.AUTH_SECRET;
  if (!segreto)
    return errore('Area riservata non configurata: manca AUTH_SECRET.', 503);

  const azione = new URL(req.url).pathname.split('/').filter(Boolean).pop();

  try {
    if (req.method === 'POST' && azione === 'invia')   return await invia(req);
    if (req.method === 'GET'  && azione === 'elenco')  return await elenco(req, segreto);
    if (req.method === 'POST' && azione === 'elimina') return await elimina(req, segreto);
    return errore('Azione sconosciuta.', 404);
  } catch (e) {
    console.error('candidature:', e);
    return errore('Errore del server. Riprova.', 500);
  }
};

export const config = { path: '/api/candidature/:azione' };
