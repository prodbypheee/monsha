/* =============================================================
   MONACI SHAOLIN — l'orologio delle convocazioni
   -------------------------------------------------------------
   Gira ogni ora tonda e quasi sempre non fa niente. Fa qualcosa solo
   se oggi e un giorno di allenamento, e solo in tre momenti:

     14:00  notifica a tutti i membri: presente o assente?
     17:00  seconda notifica, ma SOLO a chi non ha ancora risposto —
            richiamare anche chi ha gia detto la sua e il modo piu
            rapido per far spegnere le notifiche a tutta la squadra
     20:00  mail di riepilogo a capitano, amministrazione e admin

   Perche ogni ora invece che tre cron alle 14, 17 e 20: il cron di
   Netlify ragiona in UTC, e l'Italia sta un'ora avanti d'inverno e
   due d'estate. Un orario fisso in UTC sbaglierebbe di un'ora per
   meta anno. Girando ogni ora e chiedendo "che ore sono a Roma?" il
   passaggio all'ora legale non lo notiamo nemmeno.

   Le esecuzioni a vuoto costano niente: due letture di archivio e
   un ritorno immediato.
   ============================================================= */

import { tuttiGliUtenti, chiave, convoc, oggiRoma, oraRoma, dataInLettere }
  from '../lib/comune.mjs';
import { leggiGiorni, leggiRisposte, daConvocare, destinatariRiepilogo }
  from '../lib/convocazioni.mjs';
import { manda, pushConfigurato } from '../lib/push.mjs';
import { mandaMail, postaConfigurata } from '../lib/posta.mjs';
import { preparaRiepilogo } from '../lib/mail-riepilogo.mjs';

const SITO = process.env.URL || 'https://monacishaolin.it';

/* Segno di spunta contro il doppio invio. Netlify puo rieseguire una
   funzione programmata se la prima volta e andata storta a meta, e
   due notifiche identiche a distanza di un minuto sono il modo piu
   sicuro per far disattivare le notifiche a tutti. */
async function giaFatto(data, fascia) {
  const k = 'inviate/' + data + '/' + fascia;
  const c = await convoc().get(k, { type: 'json' }).catch(() => null);
  if (c) return true;
  await convoc().setJSON(k, { quando: new Date().toISOString() });
  return false;
}

/* ---------- le due notifiche --------------------------------- */

async function avvisa(data, utenti, risposte, seconda) {
  const quando = dataInLettere(data);

  const carico = {
    titolo: seconda ? 'Allenamento fra poco' : 'Allenamento oggi',
    testo:  seconda
      ? 'Non hai ancora risposto per ' + quando + '. Ci sei?'
      : quando.charAt(0).toUpperCase() + quando.slice(1) + ': ci sei stasera?',
    data,
    // Su iPhone i bottoni non esistono e il tocco apre il sito: questo
    // indirizzo lo porta gia sulla scheda giusta, con i due bottoni
    // grandi in mezzo allo schermo.
    vai: SITO + '/area-riservata?giorno=' + data
  };

  // In parallelo e non in fila: venti invii sequenziali, ognuno con la
  // sua andata e ritorno verso Google o Apple, arriverebbero a sfiorare
  // il tempo massimo di una funzione. E chi e in fondo all'elenco non
  // deve ricevere la notifica un minuto dopo gli altri.
  // Tre ore di validita in entrambi i casi, ed e un numero scelto, non
  // tondo per caso: la prima notifica scade quando arriva il richiamo
  // delle 17, il richiamo scade quando parte il riepilogo delle 20. Un
  // telefono spento tutto il pomeriggio non deve accendersi la sera con
  // addosso la domanda di un allenamento gia cominciato.
  const esiti = await Promise.all(utenti.map(u => {
    const k = chiave(u.email);
    if (seconda && risposte[k]) return 0;   // ha gia risposto: lasciamolo in pace
    return manda(k, carico, 3 * 3600);
  }));

  return esiti.reduce((a, b) => a + b, 0);
}

/* ---------- il riepilogo delle 20:00 -------------------------
   Va a capitano, amministrazione e admin. Il testo e gia pronto da
   leggere: chi lo riceve deve poter capire la situazione dalla
   anteprima della mail, senza aprire niente. */

async function riepiloga(data, utenti, risposte) {
  const modello = process.env.EMAILJS_TEMPLATE_CONVOCAZIONI;
  if (!modello || !postaConfigurata()) {
    console.log('convocazioni: riepilogo saltato, posta non configurata');
    return 0;
  }

  const destinatari = destinatariRiepilogo(utenti);
  if (!destinatari.length) {
    console.log('convocazioni: riepilogo saltato, nessun destinatario');
    return 0;
  }

  // Il contenuto si costruisce una volta sola e vale per tutti: cambia
  // solo il destinatario. Ed e lo stesso costruttore che usa il bottone
  // di prova, altrimenti la prova smetterebbe di provare cio che arriva.
  const comuni = await preparaRiepilogo({ data, utenti, risposte, sito: SITO });

  let partite = 0;
  for (const d of destinatari) {
    const esito = await mandaMail(modello, {
      ...comuni, to_email: d.email, capitano: d.idGioco
    });
    if (esito.ok) partite++;
  }
  return partite;
}

/* ---------- ingresso ------------------------------------------ */

/* Il lavoro vero. Ritorna una frase corta che dice cosa ha fatto, e
   quella frase finisce nei log di Netlify: quando un giorno non
   arrivera una notifica, la prima cosa da leggere e li. */
async function giro(oggi, ora) {
  if (![14, 17, 20].includes(ora))
    return 'niente da fare a quest’ora';

  const giorni = await leggiGiorni();
  if (!giorni.includes(oggi))
    return 'oggi non e giorno di allenamento';

  const [utenti, risposte] = await Promise.all([
    tuttiGliUtenti(), leggiRisposte(oggi)
  ]);
  const membri = daConvocare(utenti);
  if (!membri.length) return 'nessun membro approvato';

  const fascia = String(ora);

  if (await giaFatto(oggi, fascia))
    return 'fascia ' + fascia + ' gia inviata oggi';

  if (ora === 20) {
    if (!postaConfigurata() || !process.env.EMAILJS_TEMPLATE_CONVOCAZIONI)
      return 'riepilogo saltato: posta non configurata';
    const n = await riepiloga(oggi, utenti, risposte);
    return 'riepilogo inviato a ' + n + ' indirizzi';
  }

  if (!pushConfigurato())
    return 'notifiche saltate: mancano le chiavi VAPID';

  /* Booleano e non stringa, e non e un dettaglio: avvisa() distingue
     la prima notifica dal richiamo con un si/no, e passandogli
     'prima' — che in JavaScript e vero — ogni notifica usciva col
     testo del richiamo. Le due chiamate devono parlare la stessa
     lingua, e qui la lingua e il si/no. */
  const richiamo = ora === 17;

  const n = await avvisa(oggi, membri, risposte, richiamo);
  return n + ' notifiche partite (' + (richiamo ? 'richiamo' : 'prima') + ')';
}

export default async () => {
  const oggi = oggiRoma();
  const ora  = oraRoma();

  let esito;
  try {
    esito = await giro(oggi, ora);
  } catch (e) {
    esito = 'errore: ' + (e && e.message ? e.message : e);
    console.error('convocazioni-cron:', e);
  }

  console.log('convocazioni-cron:', oggi, ora + ':00 —', esito);
};

/* Ogni ora tonda, in UTC. Il filtro sull'ora italiana e sopra: cosi
   il passaggio all'ora legale non sposta niente. */
export const config = { schedule: '0 * * * *' };
