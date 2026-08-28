/* =============================================================
   MONACI SHAOLIN — generatore delle icone dell'app
   -------------------------------------------------------------
   node strumenti/icone.mjs

   Riscrive monsha/immagini/icona-*.png. Va rilanciato solo se si
   cambiano i colori o il disegno: le icone finite stanno nel
   repository, il sito non ha nessun passaggio di build.

   Perche disegnare invece di ritagliare una foto: queste icone
   finiscono sulla schermata Home dell'iPhone e dentro la notifica,
   dove lo spazio e un quadratino di pochi millimetri. Una foto di
   squadra li dentro e una macchia; il torii arancione su nero si
   riconosce a colpo d'occhio ed e lo stesso segno del sito.

   Il PNG e scritto a mano — intestazione, IHDR, IDAT sgonfiato con
   zlib, IEND — per non aggiungere una libreria di immagini a un
   progetto che per il resto non ha dipendenze grafiche.
   ============================================================= */

import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const QUI = path.dirname(fileURLToPath(import.meta.url));
const DOVE = path.join(QUI, '..', 'monsha', 'immagini');

const FONDO  = [0x0b, 0x0b, 0x0d];   // --bg del foglio di stile
const ACCENTO = [0xff, 0x7a, 0x29];  // --acc

/* ---------- disegno ------------------------------------------
   Coordinate espresse in frazioni del lato, cosi lo stesso disegno
   vale a 192 come a 512 pixel. Ogni voce e un rettangolo pieno:
   architrave, traverso, il pilastrino centrale e i due pilastri. */

const PEZZI = [
  [0.133, 0.234, 0.867, 0.309],   // architrave, il piu largo
  [0.211, 0.383, 0.789, 0.445],   // traverso
  [0.469, 0.309, 0.531, 0.383],   // pilastrino centrale
  [0.273, 0.309, 0.363, 0.820],   // pilastro sinistro
  [0.637, 0.309, 0.727, 0.820]    // pilastro destro
];

/* Android ritaglia l'icona "maskable" dentro un cerchio e tiene per
   buono solo l'80% centrale: il disegno va rimpicciolito verso il
   centro, altrimenti le punte dell'architrave vengono tagliate via. */
const restringi = (pezzi, quanto) => pezzi.map(v =>
  v.map(c => 0.5 + (c - 0.5) * quanto));

function pixel(lato, trasparente, quanto) {
  const dati = Buffer.alloc(lato * (lato * 4 + 1));
  const pezzi = quanto === 1 ? PEZZI : restringi(PEZZI, quanto);

  for (let y = 0; y < lato; y++) {
    const riga = y * (lato * 4 + 1);
    dati[riga] = 0;                                   // filtro "nessuno"
    for (let x = 0; x < lato; x++) {
      const dentro = pezzi.some(([x1, y1, x2, y2]) =>
        x >= x1 * lato && x < x2 * lato && y >= y1 * lato && y < y2 * lato);

      const p = riga + 1 + x * 4;
      if (trasparente) {
        // Versione monocromatica per la barra di stato di Android:
        // bianco dove c'e il segno, trasparente altrove.
        dati[p] = dati[p + 1] = dati[p + 2] = 255;
        dati[p + 3] = dentro ? 255 : 0;
      } else {
        const c = dentro ? ACCENTO : FONDO;
        dati[p] = c[0]; dati[p + 1] = c[1]; dati[p + 2] = c[2]; dati[p + 3] = 255;
      }
    }
  }
  return dati;
}

/* ---------- confezione PNG ------------------------------------ */

function pezzo(tipo, corpo) {
  const testa = Buffer.alloc(8);
  testa.writeUInt32BE(corpo.length, 0);
  testa.write(tipo, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32
    ? zlib.crc32(Buffer.concat([Buffer.from(tipo, 'ascii'), corpo]))
    : crc32(Buffer.concat([Buffer.from(tipo, 'ascii'), corpo])), 0);
  return Buffer.concat([testa, corpo, crc]);
}

/* zlib.crc32 esiste solo da Node 20.15: sulle versioni precedenti
   si calcola qui, sono venti righe e non vale una dipendenza. */
let TAVOLA = null;
function crc32(buf) {
  if (!TAVOLA) {
    TAVOLA = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      TAVOLA[n] = c;
    }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = TAVOLA[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function png(lato, trasparente, quanto = 1) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(lato, 0);
  ihdr.writeUInt32BE(lato, 4);
  ihdr[8] = 8;    // 8 bit per canale
  ihdr[9] = 6;    // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pezzo('IHDR', ihdr),
    pezzo('IDAT', zlib.deflateSync(pixel(lato, trasparente, quanto), { level: 9 })),
    pezzo('IEND', Buffer.alloc(0))
  ]);
}

/* ---------- scrittura ----------------------------------------- */

const DA_FARE = [
  ['icona-192.png',      192, false, 1],     // manifest, notifica
  ['icona-512.png',      512, false, 1],     // manifest, schermata di avvio
  ['icona-180.png',      180, false, 1],     // schermata Home di iPhone
  ['icona-maskable.png', 512, false, 0.72],  // Android, ritagliata a cerchio
  ['icona-badge.png',     96, true,  1]      // barra di stato di Android
];

for (const [nome, lato, trasparente, quanto] of DA_FARE) {
  const file = path.join(DOVE, nome);
  fs.writeFileSync(file, png(lato, trasparente, quanto));
  console.log('scritta', nome, '(' + lato + 'px)');
}
