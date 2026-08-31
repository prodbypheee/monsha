/* =============================================================
   MONACI SHAOLIN — il campionato, lato server
   -------------------------------------------------------------
   Una sola azione: dammi come sta andando il campionato.

   Sta dietro alla sessione come tutto il resto dell'area riservata.
   I dati sono pubblici su eLudo — chiunque puo aprirli — ma la
   fatica di leggerli e tenerli a posto la facciamo per i membri, e
   una porta aperta su una funzione che tira giu cinque megabyte da
   un server altrui e un invito a farla girare a vuoto.
   ============================================================= */

import { json, errore, esigiMembro, esigiAdmin } from '../lib/comune.mjs';
import { leggiCampionato } from '../lib/campionato.mjs';

async function stato(req, segreto) {
  const g = await esigiMembro(req, segreto);
  if (g.errore) return g.errore;

  const dati = await leggiCampionato();
  if (dati.errore) return errore(dati.errore, 503);
  return json(dati);
}

/* Rilettura forzata, solo per l'amministratore: serve quando eLudo
   carica un risultato e non si vuole aspettare la mezz'ora. */
async function aggiorna(req, segreto) {
  const g = await esigiAdmin(req, segreto);
  if (g.errore) return g.errore;

  const dati = await leggiCampionato({ forza: true });
  if (dati.errore) return errore(dati.errore, 503);
  return json(dati);
}

export default async (req) => {
  const segreto = process.env.AUTH_SECRET;
  if (!segreto)
    return errore('Area riservata non configurata: manca AUTH_SECRET.', 503);

  const azione = new URL(req.url).pathname.split('/').filter(Boolean).pop();

  try {
    if (req.method === 'GET'  && azione === 'stato')    return await stato(req, segreto);
    if (req.method === 'POST' && azione === 'aggiorna') return await aggiorna(req, segreto);
    return errore('Azione sconosciuta.', 404);
  } catch (e) {
    console.error('campionato:', e);
    return errore('Errore del server. Riprova.', 500);
  }
};

export const config = { path: '/api/campionato/:azione' };
