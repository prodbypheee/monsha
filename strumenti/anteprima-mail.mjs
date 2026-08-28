/* =============================================================
   MONACI SHAOLIN — anteprima della mail del riepilogo
   -------------------------------------------------------------
   npm run anteprima-mail

   Scrive anteprima-mail.html nella cartella del progetto e basta
   aprirlo col browser. Serve a guardare la mail PRIMA di spedirla
   a tre persone vere: una mail non si puo richiamare indietro, e
   provarla mandandola a se stessi consuma il piano gratuito di
   EmailJS e riempie la casella dei destinatari veri.

   Le facce le prende dalla rosa pubblicata sul sito, quindi vuole
   la rete. Senza, la mail si costruisce lo stesso con le iniziali
   al posto dei ritratti — che e poi il ripiego vero, quello che
   vedono i destinatari quando un ID non e nella rosa.

   Il file prodotto e ignorato da git: e roba usa e getta.
   ============================================================= */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { costruisciRiepilogo, leggiRosa } from '../netlify/lib/mail-riepilogo.mjs';

const QUI  = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(QUI, '..', 'anteprima-mail.html');
const SITO = process.env.SITO || 'https://monacishaolin.it';

const rosa = await leggiRosa(SITO);
const quanti = Object.keys(rosa).length;
console.log(quanti
  ? 'rosa letta da ' + SITO + ': ' + quanti + ' giocatori'
  : 'rosa non raggiungibile: anteprima con le sole iniziali');

const nick = Object.values(rosa).map(g => g.nick);

/* Una giornata verosimile invece che tutta piena o tutta vuota: le
   tre sezioni vanno viste popolate insieme, ed e li che si scopre se
   la mail regge. L'ultimo ID non sta nella rosa apposta, per vedere
   il ripiego con l'iniziale accanto ai ritratti veri. */
const voci = [
  ...nick.slice(0, 7).map(id => ({ id, stato: 'presente' })),
  ...nick.slice(7, 10).map(id => ({ id, stato: 'assente' })),
  ...nick.slice(10, 16).map(id => ({ id, stato: null })),
  { id: 'UnoNonInRosa77', stato: 'presente' }
].sort((a, b) => a.id.localeCompare(b.id, 'it'));

const html = costruisciRiepilogo({
  titolo: 'Venerdì 28 agosto',
  data:   '2026-08-28',
  voci, rosa, sito: SITO
});

fs.writeFileSync(FILE, html);
console.log('scritta ' + path.relative(process.cwd(), FILE) + ' (' + html.length + ' byte)');
