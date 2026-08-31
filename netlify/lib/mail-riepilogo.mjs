/* =============================================================
   MONACI SHAOLIN — la mail del riepilogo, costruita qui
   -------------------------------------------------------------
   Perche l'HTML sta nel codice e non dentro il template di EmailJS:
   un template si modifica solo a mano, in un campo di testo dentro
   un pannello web, senza cronologia e senza poterlo provare. Qui
   invece e un file come gli altri — si legge, si corregge, si vede
   cosa e cambiato.

   Il template di EmailJS diventa una riga sola, {{{corpo}}} con tre
   graffe, che vuol dire "inserisci questo HTML cosi com'e". Tutte le
   altre variabili restano disponibili, cosi un template vecchio
   continua a funzionare: non si rompe niente a chi non aggiorna.

   Le regole della posta non sono quelle del web e vanno rispettate:

     - impaginazione a tabelle, non flex o grid: Outlook non li
       conosce e sbriciola tutto;
     - stili in linea, niente foglio esterno e niente <style> nel
       corpo: Gmail li butta via;
     - immagini a indirizzo assoluto e https, altrimenti non si
       vedono fuori dal sito;
     - larghezza 600px, il numero su cui e tarato ogni client di
       posta dal 2005.

   Gli angoli tondi degli avatar li ignora Outlook per Windows e li
   mostra quadrati. E accettabile: si perde un vezzo, non un dato.
   ============================================================= */

import { chiave, dataInLettere } from './comune.mjs';
import { daConvocare } from './convocazioni.mjs';

const BG      = '#0b0b0d';
const SCHEDA  = '#121215';
const RIGA    = '#17171b';
const ACC     = '#ff7a29';
const VERDE   = '#7fd6a0';
const TESTO   = '#ece9e4';
const SPENTO  = '#8b8b95';
const BORDO   = '#26262b';

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/* Le virgolette e i segni che in HTML vogliono dire qualcosa vanno
   neutralizzati: un ID di gioco lo scrive chi si registra, e senza
   questo basterebbe un tag nel proprio nick per entrare nel corpo
   della mail di tutta la dirigenza. */
const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/* ---------- la rosa -------------------------------------------
   Serve solo per le facce. Si legge dal sito stesso invece di
   duplicarla qui: la rosa cambia, e due copie che divergono sono
   peggio di nessuna foto. Se non si riesce a leggerla la mail parte
   lo stesso, con le iniziali al posto dei ritratti. */

/* Una persona si puo chiamare in piu modi: l'ID vecchio dopo un
   cambio, o il nome che ha su eLudo, che non e detto coincida. Si
   indicizza per tutti — `nick` piu `altriId` — cosi la faccia si
   trova comunque. Il nick vince: se due schede si contendessero lo
   stesso nome, quella che ce l'ha come nick e quella giusta. */
export function indicizzaRosa(giocatori) {
  const piatto = v => String(v || '').trim().toLowerCase();
  const per = {};
  (giocatori || []).forEach(g => {
    (g.altriId || []).forEach(alt => { if (piatto(alt)) per[piatto(alt)] = g; });
  });
  (giocatori || []).forEach(g => { if (piatto(g.nick)) per[piatto(g.nick)] = g; });
  return per;
}

export async function leggiRosa(sito) {
  try {
    const r = await fetch(sito + '/rosa.json');
    if (!r.ok) return {};
    const d = await r.json();
    return indicizzaRosa(d.giocatori);
  } catch {
    return {};
  }
}

/* ---------- pezzi ---------------------------------------------- */

function avatar(voce, rosa, sito, colore) {
  const g = rosa[String(voce.id || '').trim().toLowerCase()];
  const nome = esc(voce.id);

  const faccia = g
    ? '<img src="' + sito + '/immagini/' + encodeURIComponent(g.img) + '" width="64" height="64" alt="" ' +
      'style="display:block;width:64px;height:64px;border-radius:32px;object-fit:cover;border:2px solid ' + colore + ';">'
    : '<div style="width:64px;height:64px;line-height:60px;border-radius:32px;border:2px solid ' + colore + ';' +
      'background:' + RIGA + ';color:' + colore + ';font-size:24px;text-align:center;">' +
      esc((voce.id || '?').charAt(0).toUpperCase()) + '</div>';

  /* Sotto il nome, per chi c'e, l'ora a cui arriva: e la cosa che il
     capitano cerca leggendo questa mail alle 20:00, e cercarla altrove
     vorrebbe dire aprire il sito. Per assenti e silenziosi non c'e
     niente da scrivere. */
  const quando = (voce.stato === 'presente' && voce.ora)
    ? '<div style="margin-top:3px;font:600 10.5px/1.3 ' + FONT + ';color:' + colore + ';">' +
      esc(voce.ora) + '</div>'
    : '';

  return '<td align="center" valign="top" style="padding:0 6px 18px;width:96px;">' +
    faccia +
    '<div style="margin-top:8px;font:600 11px/1.35 ' + FONT + ';color:' + TESTO + ';' +
    'word-break:break-word;max-width:88px;">' + nome + '</div>' +
    quando +
    '</td>';
}

/* Le facce vanno a capo ogni quattro: cinque non ci stanno su un
   telefono, e una tabella di posta non sa andare a capo da sola. */
function griglia(voci, rosa, sito, colore) {
  if (!voci.length)
    return '<div style="font:400 13px/1.6 ' + FONT + ';color:' + SPENTO + ';padding:2px 0 16px;">Nessuno.</div>';

  let html = '<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>';
  voci.forEach((v, i) => {
    if (i > 0 && i % 4 === 0) html += '</tr><tr>';
    html += avatar(v, rosa, sito, colore);
  });
  return html + '</tr></table>';
}

function sezione(titolo, voci, rosa, sito, colore) {
  return '' +
    '<tr><td style="padding:22px 26px 0;">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>' +
        '<td style="font:600 11px/1 ' + FONT + ';letter-spacing:2px;color:' + colore + ';">' +
          esc(titolo.toUpperCase()) +
        '</td>' +
        '<td align="right" style="font:600 11px/1 ' + FONT + ';color:' + SPENTO + ';">' +
          voci.length +
        '</td>' +
      '</tr></table>' +
      '<div style="height:1px;background:' + BORDO + ';margin:10px 0 16px;"></div>' +
      griglia(voci, rosa, sito, colore) +
    '</td></tr>';
}

function numero(n, etichetta, colore) {
  return '<td align="center" style="padding:0 4px;">' +
    '<div style="font:600 30px/1 ' + FONT + ';color:' + colore + ';">' + n + '</div>' +
    '<div style="margin-top:6px;font:600 9.5px/1.3 ' + FONT + ';letter-spacing:1.4px;color:' + SPENTO + ';">' +
      esc(etichetta.toUpperCase()) + '</div>' +
    '</td>';
}

/* ---------- la mail intera ------------------------------------ */

export function costruisciRiepilogo({ titolo, data, voci, rosa, sito }) {
  const presenti = voci.filter(v => v.stato === 'presente');
  const assenti  = voci.filter(v => v.stato === 'assente');
  const muti     = voci.filter(v => !v.stato);

  const collegamento = sito + '/area-riservata?giorno=' + encodeURIComponent(data);

  return '' +
'<div style="margin:0;padding:22px 10px;background:' + BG + ';">' +
  // Riga di anteprima: e la frase che i client mostrano accanto
  // all'oggetto. Nascosta nel corpo, altrimenti comparirebbe due volte.
  '<div style="display:none;max-height:0;overflow:hidden;opacity:0;">' +
    presenti.length + ' presenti, ' + assenti.length + ' assenti, ' + muti.length + ' senza risposta.' +
  '</div>' +

  '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ' +
         'style="max-width:600px;margin:0 auto;background:' + SCHEDA + ';border:1px solid ' + BORDO + ';border-radius:14px;">' +

    // ---- testata ----
    '<tr><td style="padding:26px 26px 0;">' +
      '<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>' +
        '<td><img src="' + sito + '/immagini/icona-192.png" width="34" height="34" alt="" ' +
             'style="display:block;width:34px;height:34px;border-radius:8px;"></td>' +
        '<td style="padding-left:12px;font:600 12px/1 ' + FONT + ';letter-spacing:2.6px;color:' + TESTO + ';">' +
          'MONACI SHAOLIN' +
          '<div style="margin-top:5px;font:600 9.5px/1 ' + FONT + ';letter-spacing:2.2px;color:' + ACC + ';">CONVOCAZIONI</div>' +
        '</td>' +
      '</tr></table>' +
    '</td></tr>' +

    // ---- titolo ----
    '<tr><td style="padding:24px 26px 0;">' +
      '<div style="font:600 26px/1.15 ' + FONT + ';color:' + TESTO + ';letter-spacing:-.5px;">' +
        esc(titolo) +
      '</div>' +
    '</td></tr>' +

    // ---- i tre numeri ----
    '<tr><td style="padding:22px 20px 4px;">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ' +
             'style="background:' + RIGA + ';border-radius:10px;"><tr>' +
        '<td style="padding:18px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>' +
          numero(presenti.length, 'presenti', VERDE) +
          numero(assenti.length,  'assenti',  ACC) +
          numero(muti.length,     'muti',     SPENTO) +
        '</tr></table></td>' +
      '</tr></table>' +
    '</td></tr>' +

    sezione('Presenti',             presenti, rosa, sito, VERDE) +
    sezione('Assenti',              assenti,  rosa, sito, ACC) +
    sezione('Non hanno risposto',   muti,     rosa, sito, SPENTO) +

    // ---- piede ----
    '<tr><td style="padding:8px 26px 28px;">' +
      '<div style="height:1px;background:' + BORDO + ';margin-bottom:18px;"></div>' +
      '<a href="' + collegamento + '" ' +
         'style="display:inline-block;padding:13px 22px;border:1px solid ' + ACC + ';border-radius:8px;' +
         'font:600 11px/1 ' + FONT + ';letter-spacing:1.6px;color:' + ACC + ';text-decoration:none;">' +
        'APRI LA GIORNATA' +
      '</a>' +
      '<div style="margin-top:18px;font:400 11px/1.6 ' + FONT + ';color:' + SPENTO + ';">' +
        'Riepilogo automatico delle convocazioni. Arriva a chi ha un incarico nel club.' +
      '</div>' +
    '</td></tr>' +

  '</table>' +
'</div>';
}

/* ---------- i parametri da passare a EmailJS -------------------
   Sta qui e non nelle due funzioni che spediscono perche le mail
   del riepilogo sono due — quella automatica delle 20:00 e quella
   del bottone di prova — e devono essere la stessa mail. Se il
   contenuto lo costruissero separatamente, la prova smetterebbe di
   provare quello che poi arriva davvero. */

export async function preparaRiepilogo({ data, utenti, risposte, sito }) {
  const voci = daConvocare(utenti).map(u => ({
    id: u.idGioco,
    stato: (risposte[chiave(u.email)] || {}).stato || null,
    ora:   (risposte[chiave(u.email)] || {}).ora || null
  })).sort((a, b) => a.id.localeCompare(b.id, 'it'));

  // Nell'elenco scritto l'ora sta fra parentesi accanto al nome: e la
  // riga che si legge nell'anteprima della posta, senza aprire niente.
  const presenti = voci.filter(v => v.stato === 'presente')
    .map(v => v.ora ? v.id + ' (' + v.ora + ')' : v.id);
  const assenti  = voci.filter(v => v.stato === 'assente').map(v => v.id);
  const muti     = voci.filter(v => !v.stato).map(v => v.id);

  const inLettere = dataInLettere(data);
  const titolo = inLettere.charAt(0).toUpperCase() + inLettere.slice(1);
  const elenco = n => n.length ? n.join(', ') : '—';

  const rosa = await leggiRosa(sito);
  const corpo = costruisciRiepilogo({ titolo, data, voci, rosa, sito });

  return {
    // La grafica. Nel template di EmailJS va messo con TRE graffe,
    // {{{corpo}}}, altrimenti i tag arrivano scritti come testo.
    corpo,

    // Le vecchie variabili restano: un template non aggiornato
    // continua a produrre una mail leggibile invece di una vuota.
    allenamento:  titolo,
    data,
    n_presenti:   presenti.length,
    n_assenti:    assenti.length,
    n_muti:       muti.length,
    presenti:     elenco(presenti),
    assenti:      elenco(assenti),
    non_risposto: elenco(muti),
    riassunto:    presenti.length + ' presenti · ' + assenti.length +
                  ' assenti · ' + muti.length + ' senza risposta',
    panel_url:    sito + '/area-riservata?giorno=' + data
  };
}
