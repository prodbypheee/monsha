/* =============================================================
   MONACI SHAOLIN — prove della logica
   -------------------------------------------------------------
   node strumenti/prove.mjs

   Prova solo le parti che non toccano l'archivio: i conti sulle
   date, la firma delle sessioni, chi puo fare cosa. Sono
   esattamente i punti dove un errore non si vede finche non e
   troppo tardi — una notifica che arriva il giorno sbagliato per
   l'ora legale, o un cookie che si lascia falsificare.
   ============================================================= */

import assert from 'node:assert/strict';
import {
  creaGettone, leggiGettone, cookieSessione, leggiCookie,
  incaricoDi, puoConvocare, oggiRoma, oraRoma, dataInLettere, dataValida
} from '../netlify/lib/comune.mjs';
import { fraGiorni, rispostaAmmessa, riceveIlRiepilogo, daConvocare, destinatariRiepilogo,
  attesaSollecito, PAUSA_SOLLECITO_MS, fasciaDi, oraArrivo, scorriOra, ORA_DEFAULT }
  from '../netlify/lib/convocazioni.mjs';
import { CASELLE, verificaSchieramento, soloPresenti } from '../netlify/lib/formazione.mjs';

let fatte = 0, rotte = 0;
function prova(nome, fn) {
  try { fn(); fatte++; console.log('  ok   ' + nome); }
  catch (e) { rotte++; console.log('  ROTTA ' + nome + '\n        ' + e.message); }
}

console.log('\nDate e fusi');

prova('oggiRoma restituisce AAAA-MM-GG', () => {
  assert.match(oggiRoma(), /^\d{4}-\d{2}-\d{2}$/);
});

prova('mezzogiorno UTC d\'estate a Roma sono le 14', () => {
  assert.equal(oraRoma(new Date('2026-07-15T12:00:00Z')), 14);
});

prova('mezzogiorno UTC d\'inverno a Roma sono le 13', () => {
  assert.equal(oraRoma(new Date('2026-01-15T12:00:00Z')), 13);
});

prova('mezzanotte non diventa le 24', () => {
  assert.equal(oraRoma(new Date('2026-07-14T22:00:00Z')), 0);
});

prova('le 23:30 UTC sono gia il giorno dopo a Roma', () => {
  assert.equal(oggiRoma(new Date('2026-07-14T23:30:00Z')), '2026-07-15');
});

prova('il cambio di ora legale non sposta i giorni', () => {
  // 29 marzo 2026: l'ora legale entra alle 02:00. Il giorno prima e
  // il giorno dopo devono restare quelli, non scivolare di uno.
  assert.equal(fraGiorni('2026-03-28', 1), '2026-03-29');
  assert.equal(fraGiorni('2026-03-29', 1), '2026-03-30');
  assert.equal(fraGiorni('2026-10-24', 1), '2026-10-25');   // ritorno all'ora solare
});

prova('fraGiorni scavalca mesi e anni', () => {
  assert.equal(fraGiorni('2026-01-31', 1), '2026-02-01');
  assert.equal(fraGiorni('2026-12-31', 1), '2027-01-01');
  assert.equal(fraGiorni('2026-03-01', -1), '2026-02-28');
  assert.equal(fraGiorni('2028-03-01', -1), '2028-02-29');  // bisestile
});

prova('dataInLettere dice il giorno giusto della settimana', () => {
  assert.equal(dataInLettere('2026-09-03'), 'giovedì 3 settembre');
  assert.equal(dataInLettere('2026-01-01'), 'giovedì 1 gennaio');
});

prova('dataValida rifiuta la spazzatura', () => {
  assert.ok(dataValida('2026-09-03'));
  assert.ok(!dataValida('2026-9-3'));
  assert.ok(!dataValida('ieri'));
  assert.ok(!dataValida(''));
  assert.ok(!dataValida('2026-09-03; drop'));
});

console.log('\nFinestra delle risposte');

prova('oggi e i giorni futuri si accettano', () => {
  const oggi = oggiRoma();
  assert.ok(rispostaAmmessa(oggi));
  assert.ok(rispostaAmmessa(fraGiorni(oggi, 3)));
});

prova('un giorno vecchio si rifiuta', () => {
  assert.ok(!rispostaAmmessa(fraGiorni(oggiRoma(), -5)));
});

console.log('\nSessione');

const SEGRETO = 'segreto-di-prova-lungo-abbastanza-per-hmac';

prova('un gettone appena fatto si rilegge', () => {
  const g = creaGettone({ email: 'tizio@esempio.it', ruolo: 'membro' }, SEGRETO, 60);
  const d = leggiGettone(g, SEGRETO);
  assert.equal(d.email, 'tizio@esempio.it');
  assert.equal(d.ruolo, 'membro');
});

prova('un gettone scaduto non vale piu', () => {
  const g = creaGettone({ email: 'tizio@esempio.it' }, SEGRETO, -10);
  assert.equal(leggiGettone(g, SEGRETO), null);
});

prova('con un altro segreto non si apre', () => {
  const g = creaGettone({ email: 'tizio@esempio.it' }, SEGRETO, 60);
  assert.equal(leggiGettone(g, 'un-altro-segreto'), null);
});

prova('non ci si puo promuovere admin riscrivendo il corpo', () => {
  const g = creaGettone({ email: 'tizio@esempio.it', ruolo: 'membro' }, SEGRETO, 60);
  const firma = g.split('.')[1];
  const falso = Buffer.from(JSON.stringify({
    email: 'tizio@esempio.it', ruolo: 'admin', sca: Date.now() + 60000
  })).toString('base64url') + '.' + firma;
  assert.equal(leggiGettone(falso, SEGRETO), null);
});

prova('roba a caso non passa', () => {
  ['', null, undefined, 'a.b', 'senzapunto', '....'].forEach(v =>
    assert.equal(leggiGettone(v, SEGRETO), null));
});

prova('il cookie e HttpOnly, Secure e SameSite', () => {
  const c = cookieSessione('xyz', 3600);
  assert.match(c, /HttpOnly/);
  assert.match(c, /Secure/);
  assert.match(c, /SameSite=Lax/);
});

prova('il cookie si rilegge dall\'intestazione', () => {
  const finta = { headers: { get: () => 'altro=1; ms_sessione=abc.def; ancora=2' } };
  assert.equal(leggiCookie(finta), 'abc.def');
});

prova('un gettone non compare mai in un indirizzo', () => {
  // Le uniche cose che il server mette in un URL sono la data della
  // giornata e il percorso. Se un giorno qualcuno ci infilasse il
  // gettone, questa prova va aggiornata di proposito, non per caso.
  const c = cookieSessione('gettone-segreto', 3600);
  assert.ok(c.startsWith('ms_sessione='));
  assert.ok(!/[?&]/.test(c));
});

console.log('\nRuoli e incarichi');

const chi = (r, i) => ({ ruolo: r, incarico: i, stato: 'approvato', email: 'x@y.it', idGioco: 'x' });

prova('senza campo si e giocatori', () => {
  assert.equal(incaricoDi({}), 'giocatore');
  assert.equal(incaricoDi({ incarico: 'imperatore' }), 'giocatore');
});

prova('capitano e amministrazione convocano, il giocatore no', () => {
  assert.ok(puoConvocare(chi('membro', 'capitano')));
  assert.ok(puoConvocare(chi('membro', 'amministrazione')));
  assert.ok(!puoConvocare(chi('membro', 'giocatore')));
  assert.ok(!puoConvocare(chi('membro', undefined)));
});

prova('l\'admin convoca sempre', () => {
  assert.ok(puoConvocare(chi('admin', 'giocatore')));
});

prova('si convocano solo gli approvati', () => {
  const gente = [
    { stato: 'approvato', email: 'a@a.it', idGioco: 'a' },
    { stato: 'in-attesa', email: 'b@b.it', idGioco: 'b' },
    { stato: 'rifiutato', email: 'c@c.it', idGioco: 'c' }
  ];
  assert.equal(daConvocare(gente).length, 1);
});

prova('il riepilogo va a capitano, amministrazione e admin', () => {
  const gente = [
    { stato: 'approvato', ruolo: 'membro', incarico: 'giocatore', email: 'g@x.it' },
    { stato: 'approvato', ruolo: 'membro', incarico: 'capitano', email: 'c@x.it' },
    { stato: 'approvato', ruolo: 'membro', incarico: 'amministrazione', email: 'a@x.it' },
    { stato: 'approvato', ruolo: 'admin',  incarico: 'giocatore', email: 'ad@x.it' },
    { stato: 'in-attesa', ruolo: 'membro', incarico: 'capitano', email: 'no@x.it' }
  ];
  const chi = riceveIlRiepilogo(gente).map(u => u.email);
  assert.deepEqual(chi.sort(), ['a@x.it', 'ad@x.it', 'c@x.it']);
});

console.log('\nDestinatari del riepilogo');

const SQUADRA = [
  { stato: 'approvato', ruolo: 'membro', incarico: 'giocatore', email: 'g@x.it', idGioco: 'Gio' },
  { stato: 'approvato', ruolo: 'membro', incarico: 'capitano',  email: 'Capo@X.it', idGioco: 'Capo' },
  { stato: 'approvato', ruolo: 'admin',  incarico: 'giocatore', email: 'ad@x.it', idGioco: 'Admin' }
];

prova('senza variabile si torna agli incarichi', () => {
  delete process.env.EMAIL_RIEPILOGO;
  const d = destinatariRiepilogo(SQUADRA).map(v => v.email).sort();
  assert.deepEqual(d, ['Capo@X.it', 'ad@x.it']);
});

prova('la variabile ha la precedenza', () => {
  process.env.EMAIL_RIEPILOGO = 'uno@esempio.it, due@esempio.it';
  const d = destinatariRiepilogo(SQUADRA).map(v => v.email);
  assert.deepEqual(d, ['uno@esempio.it', 'due@esempio.it']);
});

prova('virgole, spazi e a capo separano allo stesso modo', () => {
  process.env.EMAIL_RIEPILOGO = ' uno@esempio.it,\n due@esempio.it ;tre@esempio.it ';
  assert.equal(destinatariRiepilogo(SQUADRA).length, 3);
});

prova('doppioni e indirizzi storti si buttano', () => {
  process.env.EMAIL_RIEPILOGO = 'uno@esempio.it, UNO@esempio.it, non-una-mail, @niente';
  const d = destinatariRiepilogo(SQUADRA).map(v => v.email);
  assert.deepEqual(d, ['uno@esempio.it']);
});

prova('a un indirizzo che e anche un account viene attaccato il suo ID', () => {
  process.env.EMAIL_RIEPILOGO = 'capo@x.it, estraneo@esempio.it';
  const d = destinatariRiepilogo(SQUADRA);
  assert.equal(d[0].idGioco, 'Capo');    // riconosciuto anche se scritto in minuscolo
  assert.equal(d[1].idGioco, '');
});

prova('una variabile piena di spazi non azzera i destinatari', () => {
  process.env.EMAIL_RIEPILOGO = '   ';
  assert.equal(destinatariRiepilogo(SQUADRA).length, 2);   // torna agli incarichi
  delete process.env.EMAIL_RIEPILOGO;
});

console.log('\nFormazione');

const REPARTI = { pippo: 'portieri', dino: 'difensori', mimmo: 'centrocampisti',
                  bomber: 'attaccanti', icona: 'icons' };
const repartoDi = id => REPARTI[id] || null;
const PRESENTI = ['Pippo', 'Dino', 'Mimmo', 'Bomber', 'Icona', 'Sconosciuto'];

prova('uno schieramento giusto passa', () => {
  const r = verificaSchieramento(
    { por: 'Pippo', dcc: 'Dino', cdcs: 'Mimmo', atts: 'Bomber' }, PRESENTI);
  assert.equal(r.errore, undefined);
  assert.deepEqual(r.schieramento, { por: 'Pippo', dcc: 'Dino', cdcs: 'Mimmo', atts: 'Bomber' });
});

prova('chi non ha segnato presente non entra', () => {
  assert.match(verificaSchieramento({ por: 'Estraneo' }, PRESENTI).errore, /presente/);
});

prova('lo stesso giocatore non puo stare in due caselle', () => {
  assert.match(verificaSchieramento({ dcs: 'Dino', dcd: 'Dino' }, PRESENTI).errore,
    /due caselle/);
});

prova('un attaccante PUO fare il difensore: il reparto non vieta', () => {
  // Il capitano deve poter spostare chi vuole dove vuole: e una scelta
  // di calcio, e il server non ha titolo per impedirla.
  assert.equal(verificaSchieramento({ dcc: 'Bomber' }, PRESENTI).errore, undefined);
});

prova('un portiere puo fare la punta', () => {
  assert.equal(verificaSchieramento({ attd: 'Pippo' }, PRESENTI).errore, undefined);
});

prova('ogni casella accetta chiunque sia presente', () => {
  CASELLE.forEach(c => {
    ['Pippo', 'Dino', 'Mimmo', 'Bomber'].forEach(chi =>
      assert.equal(verificaSchieramento({ [c.id]: chi }, PRESENTI).errore, undefined,
        chi + ' rifiutato in ' + c.id));
  });
});

prova('anche un Icon presente si puo schierare', () => {
  // Gli Icons non compaiono fra i consigliati nel sito, ma se hanno
  // segnato presente il capitano puo comunque metterli in campo.
  assert.equal(verificaSchieramento({ atts: 'Icona' }, PRESENTI).errore, undefined);
});

prova('chi non e in rosa si puo mettere ovunque', () => {
  // Senza reparto non si puo decidere: meglio schierabile che escluso.
  assert.equal(verificaSchieramento({ por: 'Sconosciuto' }, PRESENTI).errore, undefined);
  assert.equal(verificaSchieramento({ attd: 'Sconosciuto' }, PRESENTI).errore, undefined);
});

prova('una casella inventata viene rifiutata', () => {
  assert.match(verificaSchieramento({ libero: 'Dino' }, PRESENTI).errore,
    /Casella sconosciuta/);
});

prova('le caselle vuote restano vuote', () => {
  const r = verificaSchieramento({ por: 'Pippo', dcs: null, dcd: '' }, PRESENTI);
  assert.deepEqual(r.schieramento, { por: 'Pippo' });
});

prova('maiuscole e spazi non contano nel confronto', () => {
  // Si salva l'ID come lo conosce l'archivio, non come e stato scritto.
  assert.equal(verificaSchieramento({ por: '  pIppO ' }, PRESENTI).schieramento.por, 'Pippo');
});

prova('roba che non e un oggetto viene rifiutata', () => {
  [null, 'ciao', 42, ['Pippo']].forEach(v =>
    assert.match(verificaSchieramento(v, PRESENTI).errore, /non valida/));
});

prova('il 3-4-1-2 ha undici caselle e nessuna doppia', () => {
  assert.equal(CASELLE.length, 11);
  assert.equal(new Set(CASELLE.map(c => c.id)).size, 11);
  const per = r => CASELLE.filter(c => c.reparto === r).length;
  assert.equal(per('portieri'), 1);
  assert.equal(per('difensori'), 3);
  assert.equal(per('centrocampisti'), 5);   // due centrali, due esterni, il trequartista
  assert.equal(per('attaccanti'), 2);
});

prova('un assente non puo comparire in campo, comunque sia scritto', () => {
  // La regola: in campo si vede solo chi e presente adesso. Vale anche
  // se nell'archivio e rimasto qualcuno che poi si e sfilato.
  const salvato = { por: 'Pippo', dcc: 'Dino', atts: 'Bomber' };
  const r = soloPresenti(salvato, ['Pippo', 'Bomber']);
  assert.deepEqual(r, { por: 'Pippo', atts: 'Bomber' });
});

prova('il filtro non guarda maiuscole ne spazi', () => {
  assert.deepEqual(soloPresenti({ por: 'Pippo' }, ['  pIPPo ']), { por: 'Pippo' });
});

prova('senza nessun presente il campo resta vuoto', () => {
  assert.deepEqual(soloPresenti({ por: 'Pippo', dcc: 'Dino' }, []), {});
});

prova('caselle vuote o guaste non passano il filtro', () => {
  assert.deepEqual(soloPresenti({ por: null, dcs: '', dcc: 'Dino' }, ['Dino']), { dcc: 'Dino' });
  assert.deepEqual(soloPresenti(null, ['Dino']), {});
});

prova('chi e presente resta sempre da qualche parte', () => {
  /* L'altra meta della regola: la panchina e "i presenti meno quelli
     in campo", quindi ogni presente sta o in campo o in panchina, e
     non puo sparire. Qui si verifica proprio che i due insiemi
     coprano sempre tutti i presenti. */
  const presenti = ['Pippo', 'Dino', 'Mimmo', 'Bomber'];
  const campo = soloPresenti({ por: 'Pippo', dcc: 'Dino', atts: 'Estraneo' }, presenti);
  const inCampo = new Set(Object.values(campo).map(v => v.toLowerCase()));
  const panchina = presenti.filter(id => !inCampo.has(id.toLowerCase()));
  assert.deepEqual([...inCampo].concat(panchina.map(p => p.toLowerCase())).sort(),
                   presenti.map(p => p.toLowerCase()).sort());
});

console.log('\nL\'ora di arrivo');

prova('chi non tocca niente arriva alle 21:30', () => {
  assert.equal(ORA_DEFAULT, '21:30');
  assert.equal(oraArrivo(undefined), '21:30');
  assert.equal(oraArrivo(''), '21:30');
  assert.equal(oraArrivo(null), '21:30');
});

prova('un\'ora scritta bene passa com\'e', () => {
  assert.equal(oraArrivo('21:30'), '21:30');
  assert.equal(oraArrivo('22:30'), '22:30');
  assert.equal(oraArrivo('23:30'), '23:30');
  assert.equal(oraArrivo('22:00'), '22:00');
});

prova('si accettano solo le mezz\'ore', () => {
  /* Le frecce si muovono di mezz'ora: un 21:17 puo arrivare solo da
     una richiesta costruita a mano, e non deve finire in archivio. */
  assert.equal(oraArrivo('21:17'), '21:30');
  assert.equal(oraArrivo('21:45'), '21:30');
});

prova('fuori dai due capi si torna dentro invece di rifiutare', () => {
  /* Una risposta con l'ora storta resta una risposta: perderla per
     colpa di un numero sarebbe il modo peggiore di trattarla. */
  assert.equal(oraArrivo('04:00'), '21:30');
  assert.equal(oraArrivo('18:00'), '21:30');
  assert.equal(oraArrivo('23:00'), '23:00');
});

prova('prima delle 21:30 non si scende', () => {
  /* L'ora in cui si comincia e anche la prima che si puo dire: non
     esiste un arrivo prima dell'inizio. */
  assert.equal(ORA_DEFAULT, '21:30');
  assert.equal(scorriOra('21:30', -1), '21:30');
  assert.equal(oraArrivo('21:00'), '21:30');
  assert.equal(oraArrivo('09:30'), '21:30');
});

prova('roba che non e un\'ora vale come non toccata', () => {
  assert.equal(oraArrivo('domani'), '21:30');
  assert.equal(oraArrivo('99:99'), '21:30');
  assert.equal(oraArrivo({}), '21:30');
});

prova('le frecce si muovono di mezz\'ora', () => {
  assert.equal(scorriOra('21:30', 1), '22:00');
  assert.equal(scorriOra('22:30', -1), '22:00');
  assert.equal(scorriOra('22:00', 1), '22:30');
});

prova('le frecce si fermano ai due capi', () => {
  /* Ferme e non in tondo: dalle 23:30 si deve poter tornare
     indietro, non ricominciare da capo. */
  assert.equal(scorriOra('23:30', 1), '23:30');
  assert.equal(scorriOra('21:30', -1), '21:30');
  assert.equal(scorriOra('23:00', 1), '23:30');
  assert.equal(scorriOra('22:00', -1), '21:30');
});

prova('dalle 21:30 alle 23:30 ci sono quattro mezz\'ore e poi ci si ferma', () => {
  /* Nessun buco e nessun giro in tondo: quattro passi coprono tutta
     la fascia, e dal quinto in poi non si muove piu. */
  const passi = [];
  let ora = ORA_DEFAULT;
  for (let i = 0; i < 6; i++) { ora = scorriOra(ora, 1); passi.push(ora); }
  assert.deepEqual(passi, ['22:00', '22:30', '23:00', '23:30', '23:30', '23:30']);

  let giu = ORA_DEFAULT;
  for (let i = 0; i < 10; i++) giu = scorriOra(giu, -1);
  assert.equal(giu, '21:30');
});

console.log('\nGli appuntamenti della giornata');

prova('alle 8:30 si da il buongiorno', () => {
  assert.equal(fasciaDi(8, 30), 'mattina');
});

prova('alle 8:00 non si sveglia nessuno', () => {
  /* Girando ogni mezz'ora, l'esecuzione delle 8:00 esiste eccome: se
     non distinguesse i minuti, il buongiorno partirebbe mezz'ora
     prima. */
  assert.equal(fasciaDi(8, 0), null);
  assert.equal(fasciaDi(8, 29), null);
});

prova('un ritardo del cron non fa saltare il buongiorno', () => {
  /* Netlify fa partire una funzione all'orario giusto o qualche
     istante dopo, mai prima: la tolleranza sta tutta in avanti. */
  assert.equal(fasciaDi(8, 31), 'mattina');
  assert.equal(fasciaDi(8, 45), 'mattina');
  assert.equal(fasciaDi(8, 59), 'mattina');
});

prova('alle 14:00 il secondo avviso, alle 14:30 no', () => {
  assert.equal(fasciaDi(14, 0), 'pomeriggio');
  assert.equal(fasciaDi(14, 12), 'pomeriggio');
  assert.equal(fasciaDi(14, 30), null);
});

prova('alle 18:00 l\'ultima chiamata, alle 18:30 no', () => {
  assert.equal(fasciaDi(18, 0), 'sera');
  assert.equal(fasciaDi(18, 29), 'sera');
  assert.equal(fasciaDi(18, 30), null);
});

prova('alle 20:00 il riepilogo, alle 20:30 no', () => {
  assert.equal(fasciaDi(20, 0), 'riepilogo');
  assert.equal(fasciaDi(20, 30), null);
});

prova('nelle altre ore non succede niente', () => {
  for (let o = 0; o < 24; o++) {
    for (const m of [0, 30]) {
      const f = fasciaDi(o, m);
      if (o === 8 && m === 30) continue;
      if (o === 14 && m === 0) continue;
      if (o === 18 && m === 0) continue;
      if (o === 20 && m === 0) continue;
      assert.equal(f, null, 'le ' + o + ':' + m + ' non dovrebbero fare niente');
    }
  }
});

prova('le quattro fasce sono quattro nomi diversi', () => {
  /* Il segno di spunta contro il doppio invio usa il nome della
     fascia come chiave: due fasce che si chiamassero uguale si
     spegnerebbero a vicenda, e una delle due non partirebbe mai. */
  const nomi = [fasciaDi(8, 30), fasciaDi(14, 0), fasciaDi(18, 0), fasciaDi(20, 0)];
  assert.equal(new Set(nomi).size, 4);
});

console.log('\nLa pausa fra un sollecito e l\'altro');

const ADESSO = Date.parse('2026-08-29T15:00:00Z');
const fa = minuti => new Date(ADESSO - minuti * 60000).toISOString();

prova('chi non e mai stato sollecitato si sollecita subito', () => {
  assert.equal(attesaSollecito(null, ADESSO), 0);
  assert.equal(attesaSollecito(undefined, ADESSO), 0);
  assert.equal(attesaSollecito('', ADESSO), 0);
});

prova('appena sollecitato si aspetta un quarto d\'ora', () => {
  assert.equal(attesaSollecito(fa(0), ADESSO), PAUSA_SOLLECITO_MS);
});

prova('a meta pausa manca la meta', () => {
  assert.equal(attesaSollecito(fa(7), ADESSO), 8 * 60000);
});

prova('passati i quindici minuti si puo di nuovo', () => {
  assert.equal(attesaSollecito(fa(15), ADESSO), 0);
  assert.equal(attesaSollecito(fa(60), ADESSO), 0);
});

prova('al quindicesimo minuto esatto e gia libero', () => {
  /* Il confine conta: a 14:59 si aspetta ancora, a 15:00 spaccati no.
     Se il conto fosse col maggiore-uguale sbagliato, il bottone
     resterebbe spento per sempre di un millisecondo. */
  assert.ok(attesaSollecito(fa(14.99), ADESSO) > 0);
  assert.equal(attesaSollecito(fa(15), ADESSO), 0);
});

prova('una data incomprensibile non blocca nessuno', () => {
  /* Meglio un sollecito di troppo che un bottone spento per sempre
     per colpa di una riga d'archivio scritta male. */
  assert.equal(attesaSollecito('domani mattina', ADESSO), 0);
  assert.equal(attesaSollecito('2026-13-45T99:99:99Z', ADESSO), 0);
});

prova('una data nel futuro fa aspettare tutta la pausa', () => {
  /* Orologio sfasato da qualche parte. Fra i due sbagli possibili si
     sceglie quello che al massimo fa aspettare un quarto d'ora di
     troppo, invece di quello che fa suonare un telefono a ripetizione. */
  const fraDieciMinuti = new Date(ADESSO + 10 * 60000).toISOString();
  assert.equal(attesaSollecito(fraDieciMinuti, ADESSO), PAUSA_SOLLECITO_MS);
});

prova('la pausa e di quindici minuti', () => {
  assert.equal(PAUSA_SOLLECITO_MS, 15 * 60 * 1000);
});

prova('le caselle stanno dentro il campo', () => {
  CASELLE.forEach(c => {
    assert.ok(c.x >= 5 && c.x <= 95, c.id + ' fuori in orizzontale');
    assert.ok(c.y >= 5 && c.y <= 95, c.id + ' fuori in verticale');
  });
});

console.log('\n' + fatte + ' passate, ' + rotte + ' rotte\n');
process.exit(rotte ? 1 : 0);
