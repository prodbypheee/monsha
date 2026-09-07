/* =============================================================
   MONACI SHAOLIN — service worker
   -------------------------------------------------------------
   Serve a una cosa sola: ricevere le notifiche delle convocazioni
   e far funzionare i due bottoni PRESENTE / ASSENTE che ci stanno
   dentro.

   Cosa NON fa, di proposito: non mette niente in cache. Un service
   worker che salva le pagine e la maniera piu comune di ritrovarsi
   il sito vecchio addosso per giorni dopo un aggiornamento, e qui
   non ci sarebbe nessun vantaggio in cambio.

   I due bottoni della notifica funzionano su Android: il browser
   chiama /api/convocazioni/rispondi da qui dentro, con il cookie di
   sessione, e il sito non si apre nemmeno. Su iPhone Safari ignora
   i bottoni: il tocco apre il sito, che si trova gia sulla giornata
   giusta grazie a ?giorno=... nell'indirizzo.
   ============================================================= */

const ICONA = '/immagini/icona-192.png';
const SEGNO = '/immagini/icona-badge.png';

/* Il service worker appena installato prende servizio subito invece
   di aspettare la chiusura di tutte le schede: senza, una correzione
   alle notifiche entrerebbe in vigore chissa quando. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

/* ---------- arrivo della notifica ----------------------------- */

self.addEventListener('push', evento => {
  let d = {};
  try { d = evento.data ? evento.data.json() : {}; } catch { d = {}; }

  const titolo = d.titolo || 'Monaci Shaolin';
  const opzioni = {
    body:  d.testo || '',
    /* Quando la notizia ha un autore, la sua faccia al posto
       dell'icona del club: si riconosce chi ha scritto prima ancora
       di leggere il nome. Se manca, si torna al torii. */
    icon:  d.ritratto || ICONA,
    badge: SEGNO,
    // Stesso tag per la stessa giornata: la seconda notifica sostituisce
    // la prima invece di accatastarsi, e renotify la fa comunque
    // suonare, altrimenti la sostituzione passerebbe inosservata.
    tag:   'convocazione-' + (d.data || 'oggi'),
    renotify: true,
    requireInteraction: true,
    /* Su Android la notifica aperta mostra anche un'immagine grande:
       la stessa faccia. iOS la ignora e non fa danni. */
    image: d.ritratto || undefined,
    data: { data: d.data || '', vai: d.vai || '/area-riservata' },
    /* I due bottoni solo dove hanno un senso, cioe quando la notifica
       riguarda una giornata di allenamento. Su un annuncio della
       bacheca "Presente / Assente" non vorrebbe dire niente, e
       toccarli non avrebbe nessun effetto. */
    /* I due bottoni NON si chiamano piu Presente e Assente.

       PRESENTE e ASSENTE finiscono uguali per cinque lettere su
       sette, sono larghi uguale, e Android li scrive in maiuscolo uno
       accanto all'altro in una striscia alta un dito. Da mezzo metro,
       col telefono in mano mentre si fa altro, sono la stessa parola.

       Qualcuno ha premuto Presente e il server ha ricevuto assente.
       Il codice qui sotto manda quel che riceve — c'e una prova che lo
       verifica — e la conferma ha confermato che dall'altra parte e
       arrivato assente. Quindi quel che e andato storto sta fra il
       dito e l'azione. Fra le spiegazioni possibili, due parole che si
       somigliano cosi e la piu semplice, ed e anche l'unica che si
       puo togliere di mezzo invece di discuterne.

       Adesso sono lunghe diverse, cominciano diverse, e portano
       ognuna il suo segno davanti. Gli identificativi restano quelli
       di prima: cambia cosa legge chi preme, non cosa capisce il
       server. */
    /* I DUE BOTTONI SONO INVERTITI DI PROPOSITO: prima il no, poi il
       si. Non e una scelta di stile, e un esperimento.

       La traccia di una risposta sbagliata diceva questo:

         azione premuta: assente
         bottoni: presente·✅ Ci sono   assente·❌ Non ci sono
         etichetta: convocazione-2026-09-07

       Cioe: una richiesta sola, la notifica giusta, i bottoni giusti
       e nell'ordine giusto, con le etichette nuove che non si possono
       confondere — e il browser che riferisce il SECONDO. Sempre, a
       ogni tentativo.

       Da qui dentro non si vede quale pixel venga toccato, e non si
       vedra mai. Ma se qualcosa preme sistematicamente il secondo
       bottone — un orologio che ne mostra uno solo, una tendina che
       li accorpa, un dito che va a memoria — allora scambiandoli
       quella persona da domani risulta PRESENTE, e l'esperimento
       risponde da solo alla domanda che il codice non puo risolvere.

       Se invece continua a risultare assente, allora non e la
       posizione: e l'etichetta o l'identificativo, e si guarda li.

       In tutti e due i casi la traccia lo dira, perche registra anche
       l'ordine dei bottoni: da ora in poi ogni risposta si porta
       dietro con quale versione e stata data. */
    actions: d.data
      ? [{ action: 'assente',  title: '❌ Non ci sono' },
         { action: 'presente', title: '✅ Ci sono' }]
      : []
  };

  evento.waitUntil(self.registration.showNotification(titolo, opzioni));
});

/* ---------- risposta dai bottoni ------------------------------ */

/* Quel che il service worker aveva sotto gli occhi quando ha deciso.

   Serve a una domanda che senza di questo non ha risposta: uno preme
   il bottone di sinistra e il server riceve assente, sempre, a ogni
   tentativo. Da qui dentro non si vede il dito — ma si vede cosa il
   browser dice sia stato premuto, e soprattutto QUALI BOTTONI la
   notifica avesse davvero addosso in quel momento.

   Se un giorno arrivasse una traccia con i bottoni in ordine
   rovesciato, o con dentro roba che non abbiamo mai scritto noi, la
   caccia finisce li. Se invece dice esattamente quel che ci
   aspettiamo, allora il guasto e piu in la e almeno sappiamo dove non
   e. */
function tracciaDi(evento) {
  const n = evento.notification || {};
  const bottoni = [];
  try {
    (n.actions || []).forEach(a => bottoni.push(a.action + '·' + a.title));
  } catch (e) { /* se il browser non li espone, pazienza */ }
  return { azione: evento.action, tag: n.tag, titolo: n.title, bottoni };
}

async function rispondi(data, stato, traccia) {
  const r = await fetch('/api/convocazioni/rispondi', {
    method: 'POST',
    // Il cookie di sessione e HttpOnly: non lo vediamo, ma il browser
    // lo attacca lui. E per questo che il bottone della notifica sa
    // gia chi sei senza chiedere niente.
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    // "da" serve solo a lasciare traccia di dove e nata la risposta:
    // il server la scrive accanto allo stato, e quando qualcuno dice
    // "ho premuto presente e mi segna assente" si guarda li invece di
    // indovinare.
    body: JSON.stringify({ data, stato, da: 'notifica', traccia })
  });
  if (!r.ok) throw new Error('risposta rifiutata: ' + r.status);
  // Quel che il server dice di aver scritto, non quel che gli abbiamo
  // chiesto: e la differenza fra una conferma e un'eco.
  return await r.json().catch(() => ({}));
}

async function apri(indirizzo) {
  const finestre = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const f of finestre) {
    if (new URL(f.url).origin === self.location.origin) {
      await f.focus();
      if ('navigate' in f) await f.navigate(indirizzo).catch(() => {});
      return;
    }
  }
  await self.clients.openWindow(indirizzo);
}

self.addEventListener('notificationclick', evento => {
  const azione = evento.action;
  const dati = evento.notification.data || {};
  evento.notification.close();

  // Tocco sul corpo della notifica (e sempre questo su iPhone):
  // si apre il sito gia sulla giornata giusta.
  if (azione !== 'presente' && azione !== 'assente') {
    evento.waitUntil(apri(dati.vai || '/area-riservata'));
    return;
  }

  evento.waitUntil((async () => {
    try {
      const esito = await rispondi(dati.data, azione, tracciaDi(evento));

      /* LA CONFERMA DICE QUEL CHE IL SERVER HA SCRITTO, non quel che
         abbiamo premuto. Prima ripeteva l'azione — "Segnato presente"
         perche avevi premuto Presente — e quindi non poteva
         contraddire nessuno: se dall'altra parte fosse finita una
         cosa diversa, la conferma avrebbe detto lo stesso che era
         andato tutto bene.

         Una conferma che non puo sbagliare non e una conferma, e una
         eco. Adesso legge lo stato dalla risposta del server, e se un
         giorno i due non combaciano lo si vede sul telefono nel
         momento esatto in cui succede. */
      const salvato = (esito && esito.stato) || azione;

      /* IL CONTRARIO, A PORTATA DI POLLICE.

         Qualcuno ha premuto Presente e si e visto registrare assente.
         Non sappiamo ancora perche — i due bottoni sono uno accanto
         all'altro e larghi un dito, e fra il dito e il server ci sono
         parecchie mani che non sono le nostre.

         Qualunque sia la causa, il danno e lo stesso e si ripara
         nello stesso modo: la conferma porta con se il bottone per
         dire il contrario. Un tocco, dalla stessa notifica, senza
         aprire niente. Non e la spiegazione, e il modo di non
         pagarla.

         "Puoi cambiarla dal sito" restava vero e non serviva a
         niente: chi ha appena risposto dal telefono non apre il sito
         per controllare che il telefono abbia fatto quel che diceva
         di fare. */
      /* IL BOTTONE DEL CONTRARIO E STATO TOLTO.

         L'avevo messo stamattina: la conferma portava un bottone solo,
         l'opposto di quel che era stato registrato, per riparare in un
         tocco. Idea giusta, posto sbagliato.

         Su Android la conferma compare come striscia in cima, cioe
         ESATTAMENTE DOVE IL DITO HA APPENA PREMUTO, un istante dopo
         averlo fatto. Un secondo tocco — uno di quelli che partono da
         soli quando il primo sembra non aver fatto niente — finiva
         sul contrario e capovolgeva la risposta appena data.

         Un rimedio che puo causare la cosa da cui ripara e peggio del
         danno. La correzione resta, ma per la via lunga: si tocca la
         conferma, si apre il sito sulla giornata giusta, e li i due
         bottoni sono grandi e lontani fra loro.

         Se la traccia dovesse dire che non era questo, si rimette —
         ma altrove, non sotto il dito. */

      await self.registration.showNotification(
        salvato === 'presente'
          ? 'Segnato presente' + (esito && esito.ora ? ' — arrivi alle ' + esito.ora : '')
          : 'Segnato assente',
        {
          body:  'Se volevi dire il contrario, tocca qui e cambia dal sito.',
          icon:  ICONA,
          badge: SEGNO,
          tag:   'esito-' + dati.data,
          silent: true,
          /* La data se la porta dietro: toccare la conferma apre il
             sito sulla giornata giusta, dove i due bottoni sono
             grandi e lontani fra loro. */
          data:  { data: dati.data, vai: dati.vai },
          // Nessun bottone: vedi sopra.
          actions: []
        });
    } catch {
      // Sessione scaduta, accesso revocato, rete assente: invece di
      // sparire in silenzio si apre il sito, dove la persona vede
      // cosa e successo e puo rispondere a mano.
      await apri(dati.vai || '/area-riservata');
    }
  })());
});

/* ---------- rinnovo della sottoscrizione ----------------------
   Ogni tanto il browser rigenera da solo le chiavi del dispositivo.
   Se non gliene diamo notizia, quel telefono smette di ricevere
   notifiche senza che nessuno se ne accorga. */

self.addEventListener('pushsubscriptionchange', evento => {
  evento.waitUntil((async () => {
    try {
      const vecchia = evento.oldSubscription || await self.registration.pushManager.getSubscription();
      const chiave = evento.newSubscription
        ? null
        : (vecchia && vecchia.options && vecchia.options.applicationServerKey);

      const nuova = evento.newSubscription ||
        await self.registration.pushManager.subscribe({
          userVisibleOnly: true, applicationServerKey: chiave });

      await fetch('/api/convocazioni/push-iscrivi', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sottoscrizione: nuova.toJSON() })
      });
    } catch (e) {
      // Non c'e niente da fare qui: al prossimo accesso al sito la
      // pagina si riscrive da sola nell'elenco.
    }
  })());
});
