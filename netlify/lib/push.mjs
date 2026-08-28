/* =============================================================
   MONACI SHAOLIN — notifiche push
   -------------------------------------------------------------
   Le notifiche del web sono cifrate dal server e consegnate da un
   servizio del produttore del browser (Google per Chrome, Apple per
   Safari). Il servizio non puo leggerne il contenuto: la chiave sta
   nella sottoscrizione che il telefono ci ha dato. Per questo serve
   la coppia VAPID, che firma le richieste e dice al servizio chi le
   manda.

   Da impostare su Netlify:
     VAPID_PUBLIC_KEY    la meta pubblica, finisce anche nel browser
     VAPID_PRIVATE_KEY   la meta segreta, non deve uscire da qui
     VAPID_SUBJECT       mailto:... di chi gestisce il sito

   Si generano una volta sola con:
     npx web-push generate-vapid-keys

   Se mancano, tutto il resto del sito continua a funzionare: le
   convocazioni si compilano dal sito, semplicemente non parte
   nessuna notifica. Una funzione che esplode perche manca una
   variabile facoltativa e un disservizio che nessuno si aspetta.

   NOTA SU IPHONE: Safari consegna le notifiche solo se il sito e
   stato aggiunto alla schermata Home, e ignora i bottoni dentro la
   notifica. Su iPhone il tocco apre il sito gia sulla scheda giusta.
   Su Android i due bottoni funzionano davvero e non aprono niente.
   ============================================================= */

import webpush from 'web-push';
import { convoc } from './comune.mjs';

const PREFISSO = 'push/';

let pronto = null;

/* La configurazione si fa una volta per esecuzione, non a ogni invio:
   web-push tiene le chiavi in uno stato globale del modulo. */
function configura() {
  if (pronto !== null) return pronto;
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) { pronto = false; return pronto; }
  try {
    webpush.setVapidDetails(
      VAPID_SUBJECT || 'mailto:info@monacishaolin.it',
      VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    pronto = true;
  } catch (e) {
    console.error('push: chiavi VAPID non valide', e.message);
    pronto = false;
  }
  return pronto;
}

export const pushConfigurato = () => configura();
export const chiavePubblica  = () => process.env.VAPID_PUBLIC_KEY || '';

/* ---------- archivio delle sottoscrizioni ---------------------
   Una voce per utente, con dentro tutti i suoi dispositivi: chi apre
   il sito dal telefono e dal computer ne ha due, e deve ricevere la
   notifica su entrambi. La chiave e la stessa impronta dell'email
   usata per gli utenti, cosi non compaiono indirizzi in giro. */

export async function sottoscrizioniDi(chiaveUtente) {
  const v = await convoc().get(PREFISSO + chiaveUtente, { type: 'json' }).catch(() => null);
  return (v && Array.isArray(v.sottoscrizioni)) ? v.sottoscrizioni : [];
}

async function salva(chiaveUtente, sottoscrizioni) {
  if (!sottoscrizioni.length) {
    await convoc().delete(PREFISSO + chiaveUtente).catch(() => {});
    return;
  }
  await convoc().setJSON(PREFISSO + chiaveUtente, { sottoscrizioni });
}

/* Una sottoscrizione valida ha almeno endpoint e le due chiavi.
   Arriva dal browser, quindi si controlla: e pur sempre roba che
   qualcuno potrebbe spedirci a mano. */
export function sottoscrizioneValida(s) {
  return !!(s && typeof s.endpoint === 'string' &&
            /^https:\/\//.test(s.endpoint) && s.endpoint.length < 1000 &&
            s.keys && typeof s.keys.p256dh === 'string' && typeof s.keys.auth === 'string');
}

export async function iscrivi(chiaveUtente, sottoscrizione) {
  const pulita = {
    endpoint: sottoscrizione.endpoint,
    keys: { p256dh: sottoscrizione.keys.p256dh, auth: sottoscrizione.keys.auth },
    aggiunta: new Date().toISOString()
  };
  const attuali = await sottoscrizioniDi(chiaveUtente);
  // Stesso endpoint = stesso dispositivo: si sostituisce, non si duplica,
  // altrimenti la stessa notifica arriva due volte sullo stesso telefono.
  const altre = attuali.filter(s => s.endpoint !== pulita.endpoint);
  // Un tetto ragionevole: piu di sei dispositivi per persona vuol dire
  // che qualcosa non sta cancellando le vecchie sottoscrizioni.
  await salva(chiaveUtente, [pulita, ...altre].slice(0, 6));
}

export async function disiscrivi(chiaveUtente, endpoint) {
  const attuali = await sottoscrizioniDi(chiaveUtente);
  await salva(chiaveUtente, attuali.filter(s => s.endpoint !== endpoint));
}

/* ---------- invio ---------------------------------------------
   Ritorna quante notifiche sono partite davvero. Le sottoscrizioni
   morte (404 o 410: app disinstallata, permesso revocato) vengono
   cancellate qui: se non lo si fa, l'archivio si riempie di indirizzi
   che falliscono per sempre e ogni invio diventa piu lento. */

export async function manda(chiaveUtente, carico, ttl = 3 * 3600) {
  if (!configura()) return 0;

  const sottoscrizioni = await sottoscrizioniDi(chiaveUtente);
  if (!sottoscrizioni.length) return 0;

  const corpo = JSON.stringify(carico);
  const morte = [];
  let riuscite = 0;

  await Promise.all(sottoscrizioni.map(async s => {
    try {
      await webpush.sendNotification(s, corpo, { TTL: ttl, urgency: 'high' });
      riuscite++;
    } catch (e) {
      if (e && (e.statusCode === 404 || e.statusCode === 410)) morte.push(s.endpoint);
      else console.error('push: invio fallito', e && e.statusCode, e && e.message);
    }
  }));

  if (morte.length)
    await salva(chiaveUtente, sottoscrizioni.filter(s => !morte.includes(s.endpoint)));

  return riuscite;
}
