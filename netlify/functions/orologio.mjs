/* =============================================================
   MONACI SHAOLIN — l'orologio, chiamato da fuori
   -------------------------------------------------------------
   Netlify ha due funzioni programmate registrate — chiamandole
   dall'esterno rispondono 403, che e la prova che le conosce — e non
   le chiama mai. Il 3 settembre l'orologio non era mai passato: non
   una volta, da quando esiste.

   Questa e la via di scampo: lo stesso lavoro, raggiungibile da fuori
   da chi ha il diritto di svegliarlo. Due strade, e servono
   entrambe.

     LA SVEGLIA DA FUORI. Con l'intestazione giusta e il segreto che
     sta solo nelle variabili d'ambiente. La usa un'azione programmata
     su GitHub, che di orologi ne fa girare a milioni. E la strada
     affidabile.

     LA SPINTA DI CHI PASSA. Un membro che apre l'area riservata da
     una spinta all'orologio senza accorgersene. Non e affidabile —
     se alle 8:30 nessuno apre il sito, nessuno lo sveglia — ma non
     chiede nessuna configurazione e copre da subito il caso piu
     comune: la sera, quando l'app la aprono tutti.

   Chiamarlo cento volte non fa cento notifiche: il segno di spunta
   contro il doppio invio e per giornata e per fascia, e la seconda
   chiamata trova gia fatto. E fuori dagli orari giusti non fa
   niente comunque.
   ============================================================= */

import { json, errore, esigiMembro } from '../lib/comune.mjs';
import batti from '../lib/orologio.mjs';

/* Il segreto sta in una variabile d'ambiente e non nel codice: questo
   repository e pubblico, e un segreto scritto in un file smette di
   essere un segreto nel momento in cui lo si scrive. */
const SEGRETO = () => process.env.OROLOGIO_SEGRETO || '';

/* Confronto a tempo costante: su un segreto corto la differenza e
   teorica, ma un confronto che esce al primo carattere diverso
   racconta qualcosa a chi lo misura, e non c'e ragione di
   raccontarlo. */
function uguali(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export default async (req) => {
  const segreto = process.env.AUTH_SECRET;
  if (!segreto)
    return errore('Area riservata non configurata: manca AUTH_SECRET.', 503);

  const azione = new URL(req.url).pathname.split('/').filter(Boolean).pop();
  if (req.method !== 'POST' || azione !== 'batti')
    return errore('Azione sconosciuta.', 404);

  const atteso = SEGRETO();
  const dato = req.headers.get('x-orologio') || '';
  const dallaSveglia = !!atteso && uguali(dato, atteso);

  /* Se non arriva dalla sveglia deve arrivare da un membro connesso.
     Aperto a chiunque no: e una funzione che manda notifiche a
     ventitre dispositivi. */
  if (!dallaSveglia) {
    const g = await esigiMembro(req, segreto);
    if (g.errore) return g.errore;
  }

  try {
    await batti();
  } catch (e) {
    console.error('orologio (da fuori):', e);
    return errore('Errore del server.', 500);
  }

  /* A chi passa non si racconta niente: ha aperto l'area riservata,
     non ha chiesto un rapporto. Alla sveglia si dice che e andata,
     cosi nei log di GitHub si vede la differenza fra "chiamato" e
     "chiamato e finito bene". */
  return json({ ok: true, da: dallaSveglia ? 'sveglia' : 'passaggio' });
};

export const config = { path: '/api/orologio/:azione' };
