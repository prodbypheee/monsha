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
    actions: d.data
      ? [{ action: 'presente', title: 'Presente' },
         { action: 'assente',  title: 'Assente'  }]
      : []
  };

  evento.waitUntil(self.registration.showNotification(titolo, opzioni));
});

/* ---------- risposta dai bottoni ------------------------------ */

async function rispondi(data, stato) {
  const r = await fetch('/api/convocazioni/rispondi', {
    method: 'POST',
    // Il cookie di sessione e HttpOnly: non lo vediamo, ma il browser
    // lo attacca lui. E per questo che il bottone della notifica sa
    // gia chi sei senza chiedere niente.
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ data, stato })
  });
  if (!r.ok) throw new Error('risposta rifiutata: ' + r.status);
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
      await rispondi(dati.data, azione);
      await self.registration.showNotification(
        azione === 'presente' ? 'Segnato presente' : 'Segnato assente',
        {
          body:  'Risposta registrata. Puoi cambiarla dal sito.',
          icon:  ICONA,
          badge: SEGNO,
          tag:   'esito-' + dati.data,
          silent: true
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
