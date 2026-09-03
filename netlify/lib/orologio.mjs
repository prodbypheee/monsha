/* =============================================================
   MONACI SHAOLIN — l'orologio delle convocazioni
   -------------------------------------------------------------
   Il lavoro sta qui; le funzioni programmate sono due gusci sottili
   che lo chiamano, una allo scoccare dell'ora e una alla mezza.

   PERCHE DUE E NON UNA. Serve un colpo ogni mezz'ora, per via del
   buongiorno delle 8:30. La scrittura naturale sarebbe una sola
   funzione con '0,30 * * * *' — ed e esattamente quella che ci ha
   lasciati senza notifiche dal 29 agosto al 3 settembre: Netlify
   quell'espressione non la onora, e la funzione semplicemente non
   veniva mai chiamata. Nessun errore, nessun log: solo silenzio, che
   e il modo peggiore in cui una cosa puo rompersi.

   Due espressioni a valore singolo — '0 * * * *' e '30 * * * *' —
   sono la stessa forma di quella che funzionava prima e non chiedono
   niente al parser. Costano un file in piu e non si rompono.

   Che tutte e due possano capitare nello stesso minuto non e un
   problema: il segno di spunta contro il doppio invio e per giornata
   e per fascia, quindi la seconda trova gia fatto e se ne va.

   Fa qualcosa solo se oggi e un giorno di allenamento, e solo in
   quattro momenti:

     08:30  il buongiorno: oggi si allena, segna se ci sei
     14:00  secondo avviso a tutti i membri: presente o assente?
     18:00  ultima chiamata, che manca poco
     20:00  mail di riepilogo a capitano, amministrazione e admin

   Gli orari sono ora italiana: l'orologio gira spesso e ogni volta
   chiede "che ore sono a Roma?", invece di fidarsi di un orario fisso
   in UTC che sbaglierebbe di un'ora per meta anno. Cosi il passaggio
   all'ora legale non lo notiamo nemmeno.

   Le esecuzioni a vuoto costano niente: due letture di archivio e un
   ritorno immediato.
   ============================================================= */

import { tuttiGliUtenti, chiave, convoc, oggiRoma, oraRoma, minutoRoma, dataInLettere }
  from '../lib/comune.mjs';
import { leggiGiorni, leggiRisposte, daConvocare, destinatariRiepilogo, fasciaDi }
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

/* ---------- le notifiche -------------------------------------
   Due momenti, due testi. Stanno in una tabella e non in un si/no
   passato di funzione in funzione: un si/no si sbaglia in silenzio —
   e' gia successo, e per un pomeriggio ogni notifica e uscita col
   testo sbagliato senza che niente segnalasse niente. Una chiave che
   non esiste, invece, si vede subito. */

const MOMENTI = {
  mattina: {
    titolo: 'Buongiorno!',
    // 'Oggi' dice gia il giorno meglio della data scritta per
    // esteso: la notizia e che si allena, non quando.
    testo:  () => 'Oggi c’è allenamento. Tocca qui e segna se ci sei.',
    /* Cinque ore: scade alle 13:30, poco prima che parta il secondo
       avviso. Un telefono acceso nel pomeriggio non deve trovarsi
       addosso due volte la stessa domanda. */
    vale: 5 * 3600
  },
  pomeriggio: {
    titolo: 'Allenamento oggi',
    testo:  quando => quando + ': ci sei stasera?',
    // Quattro ore: scade alle 18:00, quando parte l'ultima chiamata.
    vale: 4 * 3600
  },
  sera: {
    titolo: 'Fra poco si gioca',
    testo:  () => 'Stasera allenamento. Se non hai ancora segnato presente o assente, fallo adesso.',
    // Due ore: scade alle 20:00, con il riepilogo. Le tre notifiche
    // della giornata non si sovrappongono mai — un telefono riacceso
    // a sera ne trova una sola, quella giusta per l'ora che e.
    vale: 2 * 3600
  }
};

async function avvisa(data, utenti, momento) {
  const m = MOMENTI[momento];
  if (!m) throw new Error('momento sconosciuto: ' + momento);

  const quando = dataInLettere(data);
  const conMaiuscola = quando.charAt(0).toUpperCase() + quando.slice(1);

  const carico = {
    titolo: m.titolo,
    testo:  m.testo(conMaiuscola),
    data,
    // Su iPhone i bottoni non esistono e il tocco apre il sito: questo
    // indirizzo lo porta gia sulla scheda giusta, con i due bottoni
    // grandi in mezzo allo schermo.
    vai: SITO + '/area-riservata?giorno=' + data
  };

  /* A tutti i membri: e l'annuncio che oggi si gioca, non un
     promemoria per i ritardatari.

     In parallelo e non in fila: venti invii sequenziali, ognuno con la
     sua andata e ritorno verso Google o Apple, sfiorerebbero il tempo
     massimo di una funzione, e chi e in fondo all'elenco riceverebbe
     la notifica un minuto dopo gli altri.

     La validita e scelta momento per momento e non e un dettaglio: un
     telefono rimasto spento non deve accendersi la sera con addosso la
     domanda di un allenamento gia cominciato, ne trovarsi due avvisi
     della stessa giornata uno sopra l'altro. */
  const esiti = await Promise.all(
    utenti.map(u => manda(chiave(u.email), carico, m.vale)));

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
async function giro(oggi, ora, minuto) {
  const fascia = fasciaDi(ora, minuto);
  if (!fascia) return 'niente da fare a quest’ora';

  const giorni = await leggiGiorni();
  if (!giorni.includes(oggi))
    return 'oggi non e giorno di allenamento';

  const [utenti, risposte] = await Promise.all([
    tuttiGliUtenti(), leggiRisposte(oggi)
  ]);
  const membri = daConvocare(utenti);
  if (!membri.length) return 'nessun membro approvato';

  if (await giaFatto(oggi, fascia))
    return 'fascia ' + fascia + ' gia inviata oggi';

  if (fascia === 'riepilogo') {
    if (!postaConfigurata() || !process.env.EMAILJS_TEMPLATE_CONVOCAZIONI)
      return 'riepilogo saltato: posta non configurata';
    const n = await riepiloga(oggi, utenti, risposte);
    return 'riepilogo inviato a ' + n + ' indirizzi';
  }

  if (!pushConfigurato())
    return 'notifiche saltate: mancano le chiavi VAPID';

  const n = await avvisa(oggi, membri, fascia);
  return n + ' notifiche partite (' + fascia + ')';
}

/* ---------- il segno che l'orologio e passato ------------------
   Si scrive a OGNI giro, anche quando non c'e niente da fare. E la
   cosa che e mancata per cinque giorni: senza, "non e arrivata la
   notifica" e indistinguibile da "non era giorno di allenamento", e
   si finisce a cercare il guasto dalla parte sbagliata. */

export async function segnaGiro(esito) {
  await convoc().setJSON('orologio/ultimo', {
    quando: new Date().toISOString(),
    esito
  }).catch(() => {});
}

export async function ultimoGiro() {
  return convoc().get('orologio/ultimo', { type: 'json' }).catch(() => null);
}

/* ---------- il battito ---------------------------------------- */

export default async function batti() {
  const oggi   = oggiRoma();
  const ora    = oraRoma();
  const minuto = minutoRoma();

  let esito;
  try {
    esito = await giro(oggi, ora, minuto);
  } catch (e) {
    esito = 'errore: ' + (e && e.message ? e.message : e);
    console.error('orologio:', e);
  }

  await segnaGiro(esito);

  console.log('orologio:', oggi,
    ora + ':' + String(minuto).padStart(2, '0'), '—', esito);
}
