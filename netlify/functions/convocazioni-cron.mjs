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
import { leggiGiorni, leggiRisposte, daConvocare, destinatariRiepilogo, segnaGiro }
  from '../lib/convocazioni.mjs';
import { manda, pushConfigurato } from '../lib/push.mjs';
import { mandaMail, postaConfigurata } from '../lib/posta.mjs';

const SITO = process.env.URL || 'https://monacishaolin.it';

/* TEMPORANEA — fascia di prova, ora italiana.

   Arriva a tutti i membri approvati, anche a chi ha gia segnato
   presente o assente, e soprattutto ANCHE SE OGGI NON E GIORNO DI
   ALLENAMENTO: e la differenza che conta. Serve a provare che
   l'orologio giri e che la notifica arrivi; se dipendesse anche dal
   calendario, un silenzio non direbbe piu se e colpa del cron o di un
   calendario vuoto, cioe proprio la domanda a cui deve rispondere.

   L'orario si sposta cambiando questa riga e basta: l'orologio gira
   ogni dieci minuti, quindi va bene qualunque multiplo di dieci (le
   21:15 partirebbero comunque alle 21:10, arrotondando in giu).

   Quando la prova e finita si cancella questa costante: il resto del
   file la usa nei punti segnati con PROVA. */
const PROVA = { ora: 21, minuto: 10 };

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

  const voci = daConvocare(utenti).map(u => ({
    id: u.idGioco,
    stato: (risposte[chiave(u.email)] || {}).stato || null
  })).sort((a, b) => a.id.localeCompare(b.id, 'it'));

  const presenti = voci.filter(v => v.stato === 'presente').map(v => v.id);
  const assenti  = voci.filter(v => v.stato === 'assente').map(v => v.id);
  const muti     = voci.filter(v => !v.stato).map(v => v.id);

  const elenco = n => n.length ? n.join(', ') : '—';
  const quando = dataInLettere(data);

  const destinatari = destinatariRiepilogo(utenti);
  if (!destinatari.length) {
    console.log('convocazioni: riepilogo saltato, nessun destinatario');
    return 0;
  }

  let partite = 0;

  for (const d of destinatari) {
    const esito = await mandaMail(modello, {
      to_email:      d.email,
      capitano:      d.idGioco,
      allenamento:   quando.charAt(0).toUpperCase() + quando.slice(1),
      data:          data,
      n_presenti:    presenti.length,
      n_assenti:     assenti.length,
      n_muti:        muti.length,
      presenti:      elenco(presenti),
      assenti:       elenco(assenti),
      non_risposto:  elenco(muti),
      riassunto:     presenti.length + ' presenti · ' + assenti.length +
                     ' assenti · ' + muti.length + ' senza risposta',
      panel_url:     SITO + '/area-riservata?giorno=' + data
    });
    if (esito.ok) partite++;
  }
  return partite;
}

/* ---------- ingresso ------------------------------------------ */

/* Il lavoro vero. Non ritorna niente di importante: ritorna una frase
   corta che dice cosa ha fatto, e quella frase finisce nel battito.
   E l'unico modo, da fuori, di distinguere un orologio fermo da un
   orologio che gira e non ha niente da fare — dal di fuori sono
   identici, cioe silenzio in entrambi i casi. */
async function giro(oggi, ora, minuti) {
  /* I minuti non hanno bisogno di fuso: sono gli stessi ovunque.
     L'orologio gira ogni dieci minuti, quindi ogni esecuzione cade in
     una decina — 0, 10, 20... — e si ragiona su quella invece che sul
     minuto esatto: una funzione programmata non parte al secondo, e un
     controllo su "minuto === 10" salterebbe il giro a ogni ritardo. */
  const decina = Math.floor(minuti / 10) * 10;

  // PROVA
  const prova = ora === PROVA.ora && decina === Math.floor(PROVA.minuto / 10) * 10;

  /* La prova non guarda il calendario, di proposito: serve a provare
     l'orologio e la consegna, non le convocazioni. Se dovesse anche
     essere giorno di allenamento, un silenzio non direbbe piu se e
     colpa del cron o del calendario vuoto — cioe esattamente la
     domanda a cui deve rispondere. */
  if (prova) {
    if (await giaFatto(oggi, 'prova-' + ora + '-' + decina))
      return 'prova gia inviata oggi';
    if (!pushConfigurato()) return 'prova saltata: mancano le chiavi VAPID';

    const membri = daConvocare(await tuttiGliUtenti());
    if (!membri.length) return 'nessun membro approvato';

    const n = await avvisa(oggi, membri, {}, 'prova');
    return n + ' notifiche di prova partite';
  }

  if (decina !== 0 || ![14, 17, 20].includes(ora))
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

  const modo = ora === 17 ? 'richiamo' : 'prima';

  const n = await avvisa(oggi, membri, risposte, modo);
  return n + ' notifiche partite (' + modo + ')';
}

export default async () => {
  const oggi   = oggiRoma();
  const ora    = oraRoma();
  const minuti = new Date().getUTCMinutes();

  let esito;
  try {
    esito = await giro(oggi, ora, minuti);
  } catch (e) {
    esito = 'errore: ' + (e && e.message ? e.message : e);
    console.error('convocazioni-cron:', e);
  }

  console.log('convocazioni-cron:', oggi, ora + ':' + String(minuti).padStart(2, '0'), '—', esito);

  // Il battito si scrive sempre, anche quando non si e fatto niente e
  // soprattutto quando qualcosa e andato storto.
  await segnaGiro({ oggi, ora, minuti, esito });
};

/* Ogni dieci minuti, in UTC. Il filtro sull'ora italiana e sopra; i
   minuti invece sono gli stessi in ogni fuso.

   Piu spesso del necessario apposta: cosi l'orario della fascia di
   PROVA si sposta cambiando una riga sola, senza dover ritoccare anche
   il cron, e il battito dice come sta il sistema ogni dieci minuti
   invece che ogni ora. Costa 144 esecuzioni al giorno su un piano che
   ne regala 125.000 al mese, e quasi tutte finiscono in due letture e
   un ritorno immediato. Tolta la prova si puo tornare a '0 * * * *'. */
export const config = { schedule: '*/10 * * * *' };
