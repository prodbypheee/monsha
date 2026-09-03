/* =============================================================
   MONACI SHAOLIN — convocazioni, lato server
   -------------------------------------------------------------
   Tutto quello che sta qui dentro esige una sessione valida: non
   c'e nessuna azione pubblica. La sessione si legge dal cookie e
   l'utente si rilegge dall'archivio a ogni richiesta, quindi un
   accesso revocato smette di funzionare subito, anche a meta di una
   giornata di allenamento.

   Chi puo cosa:
     tutti i membri approvati   rispondono presente / assente,
                                vedono chi ha risposto, accendono
                                le notifiche
     capitano, amministrazione  scelgono i giorni di allenamento
     admin                      tutto quanto sopra

   La differenza fra ruolo e incarico e voluta: `ruolo` (admin /
   membro) dice chi comanda sugli accessi, `incarico` (giocatore /
   capitano / amministrazione) dice cosa uno fa negli allenamenti.
   Il capitano non deve poter approvare o cacciare nessuno.
   ============================================================= */

import {
  json, errore, esigiMembro, esigiAdmin, tuttiGliUtenti, chiave,
  incaricoDi, puoConvocare, oggiRoma, dataValida, dataInLettere, normId
} from '../lib/comune.mjs';

import {
  leggiGiorni, salvaGiorni, leggiRisposte, salvaRisposta, fraGiorni,
  prossimoGiorno, rispostaAmmessa, daConvocare, ORIZZONTE_GIORNI,
  destinatariRiepilogo, leggiSolleciti, segnaSollecito, attesaSollecito,
  PAUSA_SOLLECITO_MS, oraArrivo, ORA_DEFAULT, oraTardi
} from '../lib/convocazioni.mjs';

import {
  chiavePubblica, iscrivi, disiscrivi, sottoscrizioneValida,
  manda, pushConfigurato
} from '../lib/push.mjs';

import { mandaMail, postaConfigurata } from '../lib/posta.mjs';
import { preparaRiepilogo, leggiRosa } from '../lib/mail-riepilogo.mjs';

import {
  CASELLE, leggiFormazione, salvaFormazione, verificaSchieramento,
  togliDalCampo, soloPresenti, PARTITE, partitaValida
} from '../lib/formazione.mjs';

/* ---------- chi sono e cosa vedo ------------------------------ */

async function stato(req, segreto) {
  const g = await esigiMembro(req, segreto);
  if (g.errore) return g.errore;
  const u = g.utente;

  const giorni = await leggiGiorni();

  return json({
    io: {
      email:     u.email,
      idGioco:   u.idGioco,
      ruolo:     u.ruolo,
      incarico:  incaricoDi(u),
      convoca:   puoConvocare(u)
    },
    giorni,
    oggi:      oggiRoma(),
    prossimo:  prossimoGiorno(giorni),
    orizzonte: ORIZZONTE_GIORNI,
    push: { chiave: chiavePubblica() }
  });
}

/* ---------- la giornata: chi c'e e chi no ---------------------
   Esce l'ID di gioco, non l'email: la rosa e pubblica sul sito,
   gli indirizzi no. Chi non ha ancora risposto compare lo stesso,
   con stato nullo — e proprio quello che il capitano vuole vedere. */

async function giorno(req, segreto, indirizzo) {
  const g = await esigiMembro(req, segreto);
  if (g.errore) return g.errore;

  const data = String(indirizzo.searchParams.get('data') || '');
  if (!dataValida(data)) return errore('Data non valida.');

  const [giorni, risposte, utenti] = await Promise.all([
    leggiGiorni(), leggiRisposte(data), tuttiGliUtenti()
  ]);

  const membri = daConvocare(utenti);

  const elenco = membri.map(u => {
    const k = chiave(u.email);
    const r = risposte[k];
    return {
      idGioco:  u.idGioco,
      incarico: incaricoDi(u),
      stato:    r ? r.stato : null,
      // Solo i presenti hanno un'ora: "assente alle 21:30" non vuol
      // dire niente, e mostrarla confonderebbe l'elenco.
      ora:      (r && r.stato === 'presente') ? (r.ora || ORA_DEFAULT) : null,
      quando:   r ? r.quando : null,
      io:       u.email === g.utente.email
    };
  }).sort((a, b) => a.idGioco.localeCompare(b.idGioco, 'it'));

  /* La pausa fra un sollecito e l'altro la vede solo chi puo
     sollecitare. Agli altri non servirebbe a niente, e sarebbe una
     lettura d'archivio in piu addosso a ogni rilettura della giornata,
     che adesso avviene da sola ogni mezzo minuto.

     Si mandano i SECONDI CHE MANCANO e non l'ora dell'ultimo
     sollecito: il conto lo fa il server, che e l'unico orologio di cui
     ci si possa fidare. Un telefono col fuso sbagliato non deve poter
     accorciare la pausa. */
  let solleciti;
  if (puoConvocare(g.utente)) {
    const segnati = await leggiSolleciti(data);
    solleciti = {};
    membri.forEach(u => {
      const manca = attesaSollecito((segnati[chiave(u.email)] || {}).quando);
      if (manca > 0) solleciti[normId(u.idGioco)] = Math.ceil(manca / 1000);
    });
  }

  return json({
    data,
    allenamento: giorni.includes(data),
    apribile:    rispostaAmmessa(data),
    elenco,
    conta: {
      presenti: elenco.filter(v => v.stato === 'presente').length,
      assenti:  elenco.filter(v => v.stato === 'assente').length,
      muti:     elenco.filter(v => !v.stato).length
    },
    ...(solleciti ? { solleciti } : {})
  });
}

/* ---------- il capitano sceglie i giorni ---------------------- */

async function giorni(req, segreto) {
  const g = await esigiMembro(req, segreto);
  if (g.errore) return g.errore;
  if (!puoConvocare(g.utente))
    return errore('Solo il capitano o l’amministrazione possono fissare gli allenamenti.', 403);

  const corpo = await req.json().catch(() => ({}));
  if (!Array.isArray(corpo.giorni)) return errore('Elenco dei giorni mancante.');
  if (corpo.giorni.length > 60) return errore('Troppi giorni in una volta sola.');

  const salvati = await salvaGiorni(corpo.giorni, g.utente.idGioco);
  return json({ giorni: salvati, prossimo: prossimoGiorno(salvati) });
}

/* ---------- presente / assente --------------------------------
   Arriva da tre posti diversi: i due bottoni della scheda, i due
   bottoni dentro la notifica su Android, e il tocco sulla notifica
   su iPhone. Per il server sono la stessa identica richiesta. */

async function rispondi(req, segreto) {
  const g = await esigiMembro(req, segreto);
  if (g.errore) return g.errore;

  const corpo = await req.json().catch(() => ({}));
  const data  = String(corpo.data || '');
  const scelta = String(corpo.stato || '');

  if (!dataValida(data))                        return errore('Data non valida.');
  if (!['presente', 'assente'].includes(scelta)) return errore('Risposta non valida.');

  // Si legge da ieri e non da oggi: la finestra di cortesia della
  // notte fonda deve poter trovare l'allenamento di ieri, altrimenti
  // la risposta verrebbe rifiutata perche il giorno non esiste piu.
  const giorni = await leggiGiorni(fraGiorni(oggiRoma(), -1));

  if (!giorni.includes(data))
    return errore('Quel giorno non c’è allenamento.', 409);

  if (!rispostaAmmessa(data))
    return errore('Troppo tardi per rispondere a quella giornata.', 409);

  /* L'ora la si tiene solo per chi c'e. E se non arriva — succede
     rispondendo dai bottoni dentro la notifica, dove un orologio non
     ci sta — vale quella solita: e esattamente il comportamento che
     deve avere chi non tocca niente. */
  const ora = scelta === 'presente' ? oraArrivo(corpo.ora) : null;

  await salvaRisposta(data, g.utente, scelta, ora);

  /* Chi si sfila esce dal campo. Una formazione con dentro qualcuno
     che ha appena detto "non vengo" e peggio di una casella vuota: il
     capitano la legge come buona e scopre il buco all'ultimo momento.

     Sta sul server e non nel sito perche la risposta puo arrivare da
     tre posti — la pagina, i bottoni dentro la notifica su Android, il
     tocco sulla notifica su iPhone — e in due di quei tre il sito non
     e nemmeno aperto. */
  const sfilato = scelta === 'assente'
    ? await togliDalCampo(data, g.utente.idGioco)
    : false;

  return json({ ok: true, data, stato: scelta, ora, toltoDalCampo: sfilato });
}

/* ---------- chi c'e stato -------------------------------------
   La classifica delle presenze degli ultimi sette giorni. La vede chi
   puo convocare: e uno strumento di chi allena, non una graduatoria
   da appendere in bacheca. */

async function presenze(req, segreto, indirizzo) {
  const g = await esigiMembro(req, segreto);
  if (g.errore) return g.errore;
  if (!puoConvocare(g.utente))
    return errore('Non autorizzato.', 403);

  const quanti = Math.min(60, Math.max(1, Number(indirizzo.searchParams.get('giorni')) || 7));
  const dati = await presenzeRecenti(await tuttiGliUtenti(), quanti);
  return json(dati);
}

/* ---------- formazione ----------------------------------------
   Una per giornata. La compila chi puo convocare, la leggono tutti:
   e la stessa divisione della tab convocazioni, e per la stessa
   ragione — la squadra la schiera chi la allena, non chi passa. */

async function formazione(req, segreto, indirizzo) {
  const g = await esigiMembro(req, segreto);
  if (g.errore) return g.errore;

  const data = String(indirizzo.searchParams.get('data') || '');
  if (!dataValida(data)) return errore('Data non valida.');
  const partita = partitaValida(indirizzo.searchParams.get('partita'));

  const [salvata, risposte, utenti] = await Promise.all([
    leggiFormazione(data, partita), leggiRisposte(data), tuttiGliUtenti()
  ]);

  // Chi c'e davvero quel giorno: sono gli unici schierabili, e il
  // sito non deve nemmeno proporre gli altri.
  const eccoli = daConvocare(utenti)
    .filter(u => (risposte[chiave(u.email)] || {}).stato === 'presente')
    .sort((a, b) => a.idGioco.localeCompare(b.idGioco, 'it'));

  const presenti = eccoli.map(u => u.idGioco);

  /* Chi arriva tardi, e a che ora. Solo dopo le 21:30 — l'ora di
     tutti non e una notizia — e solo per chi c'e: e il dato che
     serve a chi schiera per sapere che quella casella, per la prima
     mezz'ora, e scoperta. */
  const orari = {};
  eccoli.forEach(u => {
    const tardi = oraTardi((risposte[chiave(u.email)] || {}).ora);
    if (tardi) orari[normId(u.idGioco)] = tardi;
  });

  /* LA REGOLA, resa vera per costruzione: in campo si vede solo chi
     e presente adesso. Chi ha segnato assente viene tolto quando
     risponde, ma quella e una pulizia che si puo perdere — un errore
     di rete, una formazione salvata prima che uno cambiasse idea, una
     risposta arrivata da un bottone dentro una notifica. Filtrando
     anche in lettura, un assente non puo comparire in campo nemmeno
     se l'archivio dicesse il contrario.

     L'altra meta della regola viene da se: la panchina e "i presenti
     meno quelli in campo", quindi chi e presente sta sempre da una
     delle due parti e non sparisce mai. */
  const schieramento = soloPresenti(salvata.schieramento, presenti);

  return json({
    data,
    partita,
    partite: PARTITE,
    modulo: salvata.modulo,
    caselle: CASELLE,
    schieramento,
    aggiornato: salvata.aggiornato,
    da: salvata.da,
    presenti,
    orari,
    modificabile: puoConvocare(g.utente)
  });
}

async function salvaLaFormazione(req, segreto) {
  const g = await esigiMembro(req, segreto);
  if (g.errore) return g.errore;
  if (!puoConvocare(g.utente))
    return errore('Solo il capitano o l’amministrazione possono schierare la squadra.', 403);

  const corpo = await req.json().catch(() => ({}));
  const data = String(corpo.data || '');
  if (!dataValida(data)) return errore('Data non valida.');
  const partita = partitaValida(corpo.partita);

  const [risposte, utenti] = await Promise.all([leggiRisposte(data), tuttiGliUtenti()]);
  const presenti = daConvocare(utenti)
    .filter(u => (risposte[chiave(u.email)] || {}).stato === 'presente')
    .map(u => u.idGioco);

  /* Niente controllo sul reparto: il capitano puo schierare chi
     vuole dove vuole. Restano le regole sui dati — presente, non
     doppio, casella esistente — che sono le uniche che il server ha
     titolo di far rispettare. */
  const esito = verificaSchieramento(corpo.schieramento, presenti);
  if (esito.errore) return errore(esito.errore, 409);

  await salvaFormazione(data, partita, esito.schieramento, g.utente.idGioco);
  return json({ ok: true, data, partita, schieramento: esito.schieramento });
}

/* ---------- il colpetto sulla spalla --------------------------
   Chi convoca sceglie una persona sola fra quelle che non hanno
   ancora risposto e le manda una notifica.

   Ogni controllo sta qui e non nel sito. Il sito spegne il bottone e
   mostra il conto alla rovescia, ma e cortesia verso chi guarda, non
   sicurezza: una richiesta costruita a mano salterebbe il bottone e
   arriverebbe lo stesso, quindi la pausa la deve far rispettare il
   server. Stessa ragione per cui si controlla che sia davvero un
   giorno di allenamento e che quella persona non abbia gia risposto. */

async function sollecita(req, segreto) {
  const g = await esigiMembro(req, segreto);
  if (g.errore) return g.errore;
  if (!puoConvocare(g.utente))
    return errore('Solo il capitano o l’amministrazione possono sollecitare.', 403);

  const corpo = await req.json().catch(() => ({}));
  const data = String(corpo.data || '');
  const cercato = normId(corpo.idGioco);

  if (!dataValida(data)) return errore('Data non valida.');
  if (!cercato) return errore('Manca chi sollecitare.');

  const giorni = await leggiGiorni();
  if (!giorni.includes(data)) return errore('Quel giorno non c’è allenamento.', 409);
  if (!rispostaAmmessa(data)) return errore('Quella giornata è chiusa.', 409);

  const membri = daConvocare(await tuttiGliUtenti());
  const chi = membri.find(u => normId(u.idGioco) === cercato);
  if (!chi) return errore('Non trovo quel membro.', 404);

  // Sollecitare chi ha gia risposto non ha senso: nel frattempo puo
  // aver risposto proprio mentre il capitano guardava l'elenco.
  const risposte = await leggiRisposte(data);
  if (risposte[chiave(chi.email)])
    return json({ errore: 'Nel frattempo ha risposto: non serve più.', risposto: true }, 409);

  const segnati = await leggiSolleciti(data);
  const manca = attesaSollecito((segnati[chiave(chi.email)] || {}).quando);
  if (manca > 0)
    return json({
      errore: 'Sollecitato da poco: riprova fra ' + Math.ceil(manca / 60000) + ' minuti.',
      attesa: Math.ceil(manca / 1000)
    }, 429);

  if (!pushConfigurato())
    return errore('Sul server mancano le chiavi VAPID: nessuna notifica puo partire.', 503);

  const quando = dataInLettere(data);
  const carico = {
    titolo: 'Ci sei ' + quando + '?',
    // Si dice chi lo sta cercando: un promemoria automatico si ignora,
    // una persona che ti sta aspettando no.
    testo:  g.utente.idGioco + ' ti chiede di segnare presente o assente.',
    // Con la data dentro, su Android la notifica porta con se i due
    // bottoni: si risponde senza aprire niente.
    data,
    vai: new URL(req.url).origin + '/area-riservata?giorno=' + data
  };

  const partite = await manda(chiave(chi.email), carico, 3 * 3600);

  /* Se non e partito niente il telefono non ha suonato, e allora la
     pausa non comincia: sarebbe un quarto d'ora di attesa in cambio di
     niente. Si dice com'e andata invece di far finta di si. */
  if (!partite)
    return json({ ok: true, partite: 0, attesa: 0, idGioco: chi.idGioco });

  await segnaSollecito(data, chi, g.utente.idGioco);

  return json({
    ok: true,
    partite,
    idGioco: chi.idGioco,
    attesa: Math.ceil(PAUSA_SOLLECITO_MS / 1000)
  });
}

/* ---------- notifiche ----------------------------------------- */

async function pushIscrivi(req, segreto) {
  const g = await esigiMembro(req, segreto);
  if (g.errore) return g.errore;

  const corpo = await req.json().catch(() => ({}));
  if (!sottoscrizioneValida(corpo.sottoscrizione))
    return errore('Sottoscrizione non valida.');

  await iscrivi(chiave(g.utente.email), corpo.sottoscrizione);
  return json({ ok: true });
}

/* Una notifica di prova a TUTTA la squadra, adesso.

   Solo l'amministratore: e un bottone che fa vibrare venti telefoni,
   e non e una cosa da lasciare a chiunque entri. La notifica dice a
   chiare lettere che e una prova, cosi chi la riceve non corre a
   cercare un allenamento che non c'e.

   Senza questo bottone, per sapere se le notifiche funzionano
   bisognerebbe aspettare le 14:00 di un giorno di allenamento: un
   tentativo ogni ventiquattr'ore, e al buio. Qui la catena intera —
   chiavi, iscrizioni, servizio di Apple o Google, service worker — si
   prova in tre secondi, e il numero che torna dice quanti telefoni
   l'hanno ricevuta davvero. */
async function pushProva(req, segreto) {
  const g = await esigiAdmin(req, segreto);
  if (g.errore) return g.errore;

  if (!pushConfigurato())
    return errore('Sul server mancano le chiavi VAPID: nessuna notifica puo partire.', 503);

  const membri = daConvocare(await tuttiGliUtenti());
  if (!membri.length) return errore('Nessun membro approvato.', 409);

  const carico = {
    titolo: 'Prova notifiche',
    testo:  'Messaggio di prova dei Monaci Shaolin. Nessun allenamento: non devi fare niente.',
    data:   oggiRoma(),
    vai:    new URL(req.url).origin + '/area-riservata'
  };

  // Dieci minuti di validita: una prova che arriva domattina non prova
  // piu niente e confonde chi la legge.
  const esiti = await Promise.all(
    membri.map(u => manda(chiave(u.email), carico, 600)));

  return json({
    ok: true,
    membri:  membri.length,
    partite: esiti.reduce((a, b) => a + b, 0)
  });
}

/* Il riepilogo, adesso, senza aspettare le 20:00. E la stessa identica
   mail che parte da sola la sera, mandata agli stessi indirizzi.

   Solo l'amministratore: spedisce a persone vere e consuma il piano
   gratuito di EmailJS, quindi non e un bottone da lasciare a chiunque
   sappia fissare un allenamento. */
async function riepilogoProva(req, segreto) {
  const g = await esigiAdmin(req, segreto);
  if (g.errore) return g.errore;

  const modello = process.env.EMAILJS_TEMPLATE_CONVOCAZIONI;
  if (!modello || !postaConfigurata())
    return errore('La posta non e configurata: manca EMAILJS_TEMPLATE_CONVOCAZIONI o le chiavi EmailJS.', 503);

  const corpo = await req.json().catch(() => ({}));
  const data = dataValida(corpo.data) ? corpo.data : oggiRoma();

  const [utenti, risposte] = await Promise.all([tuttiGliUtenti(), leggiRisposte(data)]);

  const destinatari = destinatariRiepilogo(utenti);

  /* Stesso costruttore della mail automatica delle 20:00: se il
     contenuto lo facesse ognuno per conto suo, questa prova
     smetterebbe di provare quello che poi arriva davvero. */
  const comuni = await preparaRiepilogo({
    data, utenti, risposte, sito: new URL(req.url).origin
  });

  let partite = 0;
  let motivo = null;      // la prima spiegazione di EmailJS, se rifiuta

  for (const d of destinatari) {
    const esito = await mandaMail(modello, {
      ...comuni, to_email: d.email, capitano: d.idGioco
    });
    if (esito.ok) partite++;
    else if (!motivo) motivo = (esito.stato ? esito.stato + ' — ' : '') + esito.messaggio;
  }

  // Il motivo esce solo di qui, che e riservato all'amministratore, e
  // non contiene segreti: EmailJS risponde con una frase, non con le
  // chiavi. Ma e la frase che dice cosa aggiustare.
  return json({ ok: true, destinatari: destinatari.length, partite, motivo,
                indirizzi: destinatari.map(d => d.email) });
}

async function pushEsci(req, segreto) {
  const g = await esigiMembro(req, segreto);
  if (g.errore) return g.errore;

  const corpo = await req.json().catch(() => ({}));
  await disiscrivi(chiave(g.utente.email), String(corpo.endpoint || ''));
  return json({ ok: true });
}

/* ---------- ingresso ------------------------------------------ */

export default async (req) => {
  const segreto = process.env.AUTH_SECRET;
  if (!segreto)
    return errore('Area riservata non configurata: manca AUTH_SECRET.', 503);

  const indirizzo = new URL(req.url);
  const azione = indirizzo.pathname.split('/').filter(Boolean).pop();

  try {
    if (req.method === 'GET'  && azione === 'stato')        return await stato(req, segreto);
    if (req.method === 'GET'  && azione === 'giorno')       return await giorno(req, segreto, indirizzo);
    if (req.method === 'GET'  && azione === 'presenze')     return await presenze(req, segreto, indirizzo);
    if (req.method === 'GET'  && azione === 'formazione')   return await formazione(req, segreto, indirizzo);
    if (req.method === 'POST' && azione === 'formazione')   return await salvaLaFormazione(req, segreto);
    if (req.method === 'POST' && azione === 'giorni')       return await giorni(req, segreto);
    if (req.method === 'POST' && azione === 'rispondi')     return await rispondi(req, segreto);
    if (req.method === 'POST' && azione === 'sollecita')    return await sollecita(req, segreto);
    if (req.method === 'POST' && azione === 'push-iscrivi') return await pushIscrivi(req, segreto);
    if (req.method === 'POST' && azione === 'push-esci')    return await pushEsci(req, segreto);
    if (req.method === 'POST' && azione === 'push-prova')   return await pushProva(req, segreto);
    if (req.method === 'POST' && azione === 'riepilogo-prova') return await riepilogoProva(req, segreto);
    return errore('Azione sconosciuta.', 404);
  } catch (e) {
    console.error('convocazioni:', e);
    return errore('Errore del server. Riprova.', 500);
  }
};

export const config = { path: '/api/convocazioni/:azione' };
