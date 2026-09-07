/* =============================================================
   MONACI SHAOLIN — il service worker, in provetta
   -------------------------------------------------------------
   Il service worker era l'unico pezzo del sito senza nessuna prova
   addosso, ed e quello che si puo controllare meno: gira dentro il
   telefono, senza pagina, e quando qualcuno dice "ho premuto
   presente e mi ha segnato assente" non c'e niente da guardare.

   Qui dentro lo si carica per davvero — il file vero, non una copia
   — con attorno un mondo finto: self, fetch, le notifiche. Poi gli si
   premono i bottoni e si guarda cosa parte.

   Non e un browser e non pretende di esserlo: non prova che Android
   consegni l'azione giusta. Prova che, data l'azione, il service
   worker mandi la cosa giusta — che e la meta di cui rispondiamo noi.
   ============================================================= */

import fs from 'node:fs';
import vm from 'node:vm';

export function accendiSW(file = 'monsha/sw.js', risposta = { ok: true, dati: {} }) {
  const ascoltatori = {};
  const inviate  = [];   // le fetch partite
  const mostrate = [];   // le notifiche mostrate
  const aperte   = [];   // gli indirizzi aperti

  const self = {
    addEventListener: (nome, fn) => { (ascoltatori[nome] ||= []).push(fn); },
    location: { origin: 'https://monacishaolin.it' },
    registration: {
      /* Copiate uscendo, e non e pignoleria: il file gira dentro una
         vm, e gli oggetti che nascono li dentro hanno i prototipi di
         quel mondo, non di questo. deepEqual se ne accorge e dice
         «stessa forma ma non lo stesso oggetto» su due array
         identici. Il giro per JSON li riporta a casa. */
      showNotification: (titolo, opzioni) => {
        mostrate.push({ titolo, opzioni: JSON.parse(JSON.stringify(opzioni)) });
        return Promise.resolve();
      },
      pushManager: {
        getSubscription: async () => null,
        subscribe: async () => ({ toJSON: () => ({}) })
      }
    },
    clients: {
      matchAll: async () => [],
      openWindow: async indirizzo => { aperte.push(indirizzo); }
    },
    skipWaiting: () => {}
  };

  const fetchFinto = async (indirizzo, opzioni) => {
    inviate.push({ indirizzo, corpo: JSON.parse(opzioni.body) });
    return {
      ok: risposta.ok,
      status: risposta.ok ? 200 : (risposta.stato || 409),
      json: async () => risposta.dati
    };
  };

  const contesto = vm.createContext({
    self, fetch: fetchFinto, URL, console,
    Promise, JSON, Error, String, Number, Boolean, Object, Array, Date
  });
  contesto.globalThis = contesto;

  vm.runInContext(fs.readFileSync(file, 'utf8'), contesto, { filename: file });

  /* Spara un evento e aspetta tutto quello che l'ascoltatore ha
     passato a waitUntil: senza, si guarderebbe il risultato prima che
     il lavoro sia finito. */
  const spara = async (nome, evento) => {
    const attese = [];
    const e = { ...evento, waitUntil: p => attese.push(p) };
    for (const fn of (ascoltatori[nome] || [])) fn(e);
    await Promise.all(attese);
  };

  /* Fa arrivare una notifica e restituisce quella mostrata. */
  const arrivaNotifica = async carico => {
    await spara('push', { data: { json: () => carico } });
    return mostrate[mostrate.length - 1];
  };

  /* Preme un bottone della notifica appena arrivata. */
  const premi = async (notifica, azione) =>
    spara('notificationclick', {
      action: azione,
      notification: { data: notifica.opzioni.data, close: () => {} }
    });

  return { ascoltatori, inviate, mostrate, aperte, spara, arrivaNotifica, premi };
}
