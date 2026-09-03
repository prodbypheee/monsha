/* =============================================================
   MONACI SHAOLIN — l'orologio, alla mezza
   -------------------------------------------------------------
   Un guscio: il lavoro sta tutto in netlify/lib/orologio.mjs, e
   questa funzione esiste solo per essere chiamata da Netlify.

   Serve per il buongiorno delle 8:30. E un file a se e non una
   virgola dentro l'altro perche la virgola Netlify non la onora,
   e restare senza notifiche per cinque giorni e bastato una volta.
   ============================================================= */

import batti from '../lib/orologio.mjs';

export default batti;

export const config = { schedule: '30 * * * *' };
