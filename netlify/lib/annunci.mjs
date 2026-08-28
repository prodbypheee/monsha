/* =============================================================
   MONACI SHAOLIN — annunci
   -------------------------------------------------------------
   La bacheca interna: scrivono tutti, giocatori compresi, e a ogni
   annuncio parte una notifica con chi l'ha scritto e cosa ha detto.

   Un blob per annuncio, come per le risposte alle convocazioni e per
   la stessa ragione: se due persone scrivono nello stesso momento su
   un unico documento, una delle due sparisce. La chiave comincia col
   momento in cui e stato scritto, al contrario, cosi l'elenco esce
   gia dal piu recente senza doverlo riordinare tutto.

   IL FRENO CONTA PIU DEL RESTO. Qui chiunque puo far vibrare venti
   telefoni: senza un limite basta una persona annoiata per far
   spegnere le notifiche a tutta la squadra, e quelle degli
   allenamenti se ne vanno insieme alle altre. Un annuncio al minuto
   a testa non da fastidio a nessuno che abbia qualcosa da dire, e
   rende impossibile il tormento.
   ============================================================= */

import { convoc, chiave } from './comune.mjs';

const PREFISSO = 'annunci/';

export const LUNGHEZZA_MAX = 500;
export const QUANTI_NE_TENGO = 60;
export const PAUSA_FRA_ANNUNCI_MS = 60 * 1000;

/* La chiave ordina da sola: si scrive il tempo che manca alla fine
   dei tempi, cosi il piu recente e anche il piu piccolo in ordine
   alfabetico e la lista arriva gia dal nuovo al vecchio. */
const FINE_DEI_TEMPI = 9999999999999;
const chiaveDi = quando => PREFISSO + String(FINE_DEI_TEMPI - quando).padStart(13, '0');

export function testoValido(grezzo) {
  const testo = String(grezzo == null ? '' : grezzo).replace(/\r\n/g, '\n').trim();
  if (testo.length < 2) return { errore: 'Scrivi qualcosa prima di pubblicare.' };
  if (testo.length > LUNGHEZZA_MAX)
    return { errore: 'L’annuncio è troppo lungo: al massimo ' + LUNGHEZZA_MAX + ' caratteri.' };
  // Piu di due righe vuote di fila sono solo un modo per occupare la
  // bacheca: si riducono, senza rifiutare l'annuncio.
  return { testo: testo.replace(/\n{3,}/g, '\n\n') };
}

export async function leggiAnnunci(quanti = QUANTI_NE_TENGO) {
  const { blobs } = await convoc().list({ prefix: PREFISSO });
  const chiavi = blobs.map(b => b.key).sort().slice(0, quanti);
  const voci = await Promise.all(
    chiavi.map(k => convoc().get(k, { type: 'json' }).catch(() => null))
  );
  return voci.filter(Boolean);
}

export async function scriviAnnuncio(utente, testo) {
  const quando = Date.now();
  const voce = {
    id:      chiaveDi(quando),
    autore:  utente.idGioco,
    // Serve a sapere chi puo cancellarlo, e non esce mai verso il sito.
    chiave:  chiave(utente.email),
    testo,
    quando:  new Date(quando).toISOString()
  };
  await convoc().setJSON(voce.id, voce);
  return voce;
}

export async function cancellaAnnuncio(id) {
  if (!String(id || '').startsWith(PREFISSO)) return false;
  await convoc().delete(id);
  return true;
}

export async function leggiAnnuncio(id) {
  if (!String(id || '').startsWith(PREFISSO)) return null;
  return await convoc().get(id, { type: 'json' }).catch(() => null);
}

/* Quanto manca prima di poterne scrivere un altro. Si guarda l'ultimo
   annuncio di quella persona invece di tenere un contatore a parte:
   un dato in meno da mantenere, e non si puo disallineare. */
export function attesaResidua(annunci, chiaveUtente) {
  const suo = annunci.find(a => a.chiave === chiaveUtente);
  if (!suo) return 0;
  const passati = Date.now() - new Date(suo.quando).getTime();
  return Math.max(0, PAUSA_FRA_ANNUNCI_MS - passati);
}

/* Vista per il sito: la chiave interna resta dentro, e ognuno sa
   soltanto se un annuncio e suo. */
export const pubblico = (a, chiaveUtente, admin) => ({
  id:     a.id,
  autore: a.autore,
  testo:  a.testo,
  quando: a.quando,
  mio:    a.chiave === chiaveUtente,
  cancellabile: a.chiave === chiaveUtente || !!admin
});
