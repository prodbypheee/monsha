/* =============================================================
   MONACI SHAOLIN — l'orologio delle convocazioni
   -------------------------------------------------------------
   Gira ogni ora tonda e quasi sempre non fa niente. Fa qualcosa solo
   se oggi e un giorno di allenamento, e solo in tre momenti:

     14:00  notifica a tutti i membri: presente o assente?
     18:00  seconda notifica, ma SOLO a chi non ha ancora risposto —
            richiamare anche chi ha gia detto la sua e il modo piu
            rapido per far spegnere le notifiche a tutta la squadra
     20:00  mail di riepilogo a capitano, amministrazione e admin

   Perche ogni ora invece che tre cron alle 14, 18 e 20: il cron di
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
  const esiti = await Promise.all(utenti.map(u => {
    const k = chiave(u.email);
    if (seconda && risposte[k]) return 0;   // ha gia risposto: lasciamolo in pace
    return manda(k, carico, seconda ? 2 * 3600 : 5 * 3600);
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
    const ok = await mandaMail(modello, {
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
    if (ok) partite++;
  }
  return partite;
}

/* ---------- ingresso ------------------------------------------ */

export default async () => {
  const oggi = oggiRoma();
  const ora  = oraRoma();

  if (![14, 18, 20].includes(ora)) return;

  const giorni = await leggiGiorni();
  if (!giorni.includes(oggi)) return;

  const [utenti, risposte] = await Promise.all([
    tuttiGliUtenti(), leggiRisposte(oggi)
  ]);
  const membri = daConvocare(utenti);
  if (!membri.length) return;

  if (await giaFatto(oggi, String(ora))) {
    console.log('convocazioni: fascia', ora, 'gia inviata per', oggi);
    return;
  }

  if (ora === 20) {
    const n = await riepiloga(oggi, utenti, risposte);
    console.log('convocazioni: riepilogo di', oggi, 'inviato a', n, 'persone');
    return;
  }

  if (!pushConfigurato()) {
    console.log('convocazioni: notifiche saltate, mancano le chiavi VAPID');
    return;
  }

  const n = await avvisa(oggi, membri, risposte, ora === 18);
  console.log('convocazioni: fascia', ora, '—', n, 'notifiche partite per', oggi);
};

/* Ogni ora tonda, in UTC. Il filtro sull'ora italiana e sopra. */
export const config = { schedule: '0 * * * *' };
