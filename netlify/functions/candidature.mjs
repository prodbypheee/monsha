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

import { json, errore, esigiGestione, tuttiGliUtenti, chiave } from '../lib/comune.mjs';
import { riceveIlRiepilogo } from '../lib/convocazioni.mjs';
import { manda, pushConfigurato } from '../lib/push.mjs';
import {
  validaCandidatura, salvaCandidatura, leggiCandidature,
  quantoAspettare, segnaPassaggio, potaVecchie, eliminaCandidatura,
  numeroWhatsApp
} from '../lib/candidature.mjs';

/* L'indirizzo di chi chiama lo mette Netlify. Non lo conserviamo in
   chiaro da nessuna parte — serve solo a non farsi riempire
   l'archivio dallo stesso posto in un minuto. */
const daDove = req =>
  req.headers.get('x-nf-client-connection-ip') ||
  (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
  'ignoto';

/* Chi va avvisato quando arriva una candidatura: amministratore,
   capitano e amministrazione. E lo stesso elenco che riceve il
   riepilogo delle 20:00, e non e un caso — sono le persone che
   rispondono di chi entra nel club.

   Due giorni di validita: una candidatura non e urgente come un
   allenamento fra due ore, ma non deve nemmeno svanire perche il
   telefono era spento un pomeriggio. */
async function avvisaChiGestisce(voce, origine) {
  if (!pushConfigurato()) return 0;

  const chi = riceveIlRiepilogo(await tuttiGliUtenti());
  if (!chi.length) return 0;

  /* Il ruolo in italiano corrente: "Attaccante e Seconda punta" si
     legge, "Attaccante, Seconda punta" e un elenco. */
  const ruoli = voce.ruoli.length > 1
    ? voce.ruoli.slice(0, -1).join(', ') + ' e ' + voce.ruoli[voce.ruoli.length - 1]
    : voce.ruoli[0];

  const carico = {
    titolo: 'Qualcuno vuole entrare 🥋',
    /* Chi e, in che ruolo e su cosa gioca: il minimo per decidere se
       vale la pena aprire il sito adesso o dopo cena. Il numero di
       telefono no — una notifica si legge a schermo bloccato, e non
       e roba da lasciare li. */
    testo: voce.id + ' si è candidato come ' + ruoli.toLowerCase() +
           ', su ' + voce.piattaforma + '.',
    /* Niente campo `data`, e di proposito: e quello che fa comparire
       i bottoni Presente e Assente dentro la notifica, e su una
       candidatura non vorrebbero dire niente. */
    vai: origine + '/area-riservata?tab=gestione'
  };

  const esiti = await Promise.all(chi.map(u => manda(chiave(u.email), carico, 48 * 3600)));
  return esiti.reduce((a, b) => a + b, 0);
}

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

  /* La notifica non deve poter far fallire una candidatura gia
     salvata: se il telefono di qualcuno non si raggiunge, la persona
     che si e candidata non c'entra niente. */
  let avvisati = 0;
  try {
    avvisati = await avvisaChiGestisce(esito.voce, new URL(req.url).origin);
  } catch (e) {
    console.error('candidature: avviso —', e && e.message);
  }

  // La potatura non deve poter far fallire un invio riuscito: se va
  // storta si riprova al prossimo, e nel frattempo la candidatura e
  // gia al sicuro.
  potaVecchie().catch(e => console.error('candidature: potatura —', e && e.message));

  return json({ ok: true, avvisati });
}

/* L'invito al gruppo provini sta in una variabile d'ambiente e non nel
   codice. Non e una password, ma e una chiave: chi ce l'ha entra nel
   gruppo. Questo repository e pubblico, e un link scritto in un file
   ci resta anche dopo averlo cancellato, nella cronologia. */
const INVITO = () => String(process.env.WHATSAPP_PROVINI || '').trim();

async function elenco(req, segreto) {
  const g = await esigiGestione(req, segreto);
  if (g.errore) return g.errore;

  const voci = await leggiCandidature();

  /* Il numero ripulito lo calcola il server, una volta sola e con le
     stesse regole per tutti. E lo manda accanto a quello scritto a
     mano, non al posto suo: chi guarda deve poter vedere tutti e due
     e accorgersi se la ripulitura ha sbagliato. */
  const conNumero = voci.map(v => ({ ...v, whatsapp: numeroWhatsApp(v.telefono) }));

  return json({
    candidature: conNumero,
    quante: conNumero.length,
    invito: INVITO() || null
  });
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
