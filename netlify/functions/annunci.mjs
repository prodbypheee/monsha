/* =============================================================
   MONACI SHAOLIN — annunci, lato server
   -------------------------------------------------------------
   La bacheca interna. A differenza delle convocazioni, qui non
   comanda nessuno: scrivono tutti i membri approvati, giocatori
   compresi. L'amministratore ha una cosa in piu e una sola —
   puo cancellare gli annunci altrui.

   Ogni annuncio fa vibrare i telefoni di tutta la squadra. E per
   questo che il freno di un annuncio al minuto sta sul server e non
   nel sito: nel sito sarebbe un consiglio, qui e una regola.
   ============================================================= */

import {
  json, errore, esigiMembro, tuttiGliUtenti, chiave
} from '../lib/comune.mjs';

import { daConvocare } from '../lib/convocazioni.mjs';
import { manda, pushConfigurato } from '../lib/push.mjs';

import {
  LUNGHEZZA_MAX, testoValido, leggiAnnunci, scriviAnnuncio,
  cancellaAnnuncio, leggiAnnuncio, attesaResidua, pubblico
} from '../lib/annunci.mjs';

/* ---------- leggere ------------------------------------------- */

async function elenco(req, segreto) {
  const g = await esigiMembro(req, segreto);
  if (g.errore) return g.errore;

  const mia = chiave(g.utente.email);
  const annunci = await leggiAnnunci();

  return json({
    annunci: annunci.map(a => pubblico(a, mia, g.utente.ruolo === 'admin')),
    limite:  LUNGHEZZA_MAX,
    attesa:  attesaResidua(annunci, mia)
  });
}

/* ---------- scrivere ------------------------------------------ */

async function pubblica(req, segreto) {
  const g = await esigiMembro(req, segreto);
  if (g.errore) return g.errore;

  const corpo = await req.json().catch(() => ({}));
  const esito = testoValido(corpo.testo);
  if (esito.errore) return errore(esito.errore);

  const mia = chiave(g.utente.email);
  const annunci = await leggiAnnunci();

  const attesa = attesaResidua(annunci, mia);
  if (attesa > 0)
    return errore('Hai appena scritto: aspetta ' + Math.ceil(attesa / 1000) +
                  ' secondi prima del prossimo annuncio.', 429);

  const voce = await scriviAnnuncio(g.utente, esito.testo);

  const partite = await avvisaTutti(g.utente, voce, new URL(req.url).origin);

  return json({
    ok: true,
    annuncio: pubblico(voce, mia, g.utente.ruolo === 'admin'),
    notificati: partite
  }, 201);
}

/* La notifica porta chi ha scritto nel titolo e cosa ha detto nel
   corpo: si legge tutto dalla schermata bloccata, senza aprire niente.
   Non arriva a chi l'ha scritto — sa gia cosa ha detto. */
async function avvisaTutti(autore, voce, sito) {
  if (!pushConfigurato()) return 0;

  const membri = daConvocare(await tuttiGliUtenti())
    .filter(u => u.email !== autore.email);
  if (!membri.length) return 0;

  const carico = {
    titolo: voce.autore,
    // Il corpo della notifica non lo taglio: se e lungo lo tronca il
    // sistema, che sa quanto ci sta su quello schermo meglio di me.
    testo:  voce.testo,
    data:   '',
    vai:    sito + '/area-riservata?tab=annunci'
  };

  // Dodici ore: un annuncio letto la mattina dopo ha ancora senso,
  // al contrario di una convocazione per la sera prima.
  const esiti = await Promise.all(
    membri.map(u => manda(chiave(u.email), carico, 12 * 3600)));

  return esiti.reduce((a, b) => a + b, 0);
}

/* ---------- cancellare -----------------------------------------
   Il proprio, sempre. Quelli degli altri, solo l'amministratore: una
   bacheca dove chiunque cancella quello che ha scritto un altro non
   e una bacheca. */

async function cancella(req, segreto) {
  const g = await esigiMembro(req, segreto);
  if (g.errore) return g.errore;

  const corpo = await req.json().catch(() => ({}));
  const voce = await leggiAnnuncio(corpo.id);
  if (!voce) return errore('Annuncio non trovato.', 404);

  const mio = voce.chiave === chiave(g.utente.email);
  if (!mio && g.utente.ruolo !== 'admin')
    return errore('Puoi cancellare solo i tuoi annunci.', 403);

  await cancellaAnnuncio(voce.id);
  return json({ ok: true, id: voce.id });
}

/* ---------- ingresso ------------------------------------------ */

export default async (req) => {
  const segreto = process.env.AUTH_SECRET;
  if (!segreto)
    return errore('Area riservata non configurata: manca AUTH_SECRET.', 503);

  const azione = new URL(req.url).pathname.split('/').filter(Boolean).pop();

  try {
    if (req.method === 'GET'  && azione === 'elenco')   return await elenco(req, segreto);
    if (req.method === 'POST' && azione === 'pubblica') return await pubblica(req, segreto);
    if (req.method === 'POST' && azione === 'cancella') return await cancella(req, segreto);
    return errore('Azione sconosciuta.', 404);
  } catch (e) {
    console.error('annunci:', e);
    return errore('Errore del server. Riprova.', 500);
  }
};

export const config = { path: '/api/annunci/:azione' };
