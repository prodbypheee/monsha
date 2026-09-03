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
  attesaSollecito, PAUSA_SOLLECITO_MS, fasciaDi, oraArrivo, scorriOra, ORA_DEFAULT, oraTardi }
  from '../netlify/lib/convocazioni.mjs';
import { CASELLE, verificaSchieramento, soloPresenti, partitaValida, PARTITE }
  from '../netlify/lib/formazione.mjs';
import { scegliEvento, trovaNoi, raccogliStatistiche, piatto }
  from '../netlify/lib/campionato.mjs';
import { indicizzaRosa } from '../netlify/lib/mail-riepilogo.mjs';
import { validaProvinante, restaDaVivere, viviSoltanto, VIVE_MS, RUOLI as RUOLI_PROVINO }
  from '../netlify/lib/provinanti.mjs';
import { validaCandidatura, attesaInvio, LIMITI, PAUSA_INVIO_MS, numeroWhatsApp }
  from '../netlify/lib/candidature.mjs';

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

console.log('\nI provinanti');

prova('un provinante vuole un nome e un ruolo vero', () => {
  const v = validaProvinante({ id: 'ProvaTizio', ruolo: 'Attaccante' }).voce;
  assert.equal(v.id, 'ProvaTizio');
  assert.equal(v.ruolo, 'Attaccante');
  assert.equal(v.reparto, 'attaccanti', 'il reparto lo ricava dal ruolo');
});

prova('senza nome non si aggiunge', () => {
  assert.ok(validaProvinante({ id: '   ', ruolo: 'Attaccante' }).errore);
  assert.ok(validaProvinante({ ruolo: 'Attaccante' }).errore);
  assert.ok(validaProvinante(null).errore);
});

prova('un ruolo inventato non passa', () => {
  /* Il ruolo non e decorazione: da lui si ricava il reparto, e un
     reparto che non esiste manderebbe il campo fuori strada. */
  assert.ok(validaProvinante({ id: 'X', ruolo: 'Libero' }).errore);
  assert.ok(validaProvinante({ id: 'X', ruolo: '' }).errore);
});

prova('ogni ruolo ha un reparto fra quelli del campo', () => {
  const buoni = ['portieri', 'difensori', 'centrocampisti', 'attaccanti'];
  RUOLI_PROVINO.forEach(([nome, reparto]) =>
    assert.ok(buoni.includes(reparto), nome + ' ha il reparto ' + reparto));
});

prova('due persone non possono avere lo stesso nome in campo', () => {
  /* In campo sarebbero indistinguibili, e la formazione le
     tratterebbe come una sola. */
  assert.ok(validaProvinante({ id: 'RageeVII', ruolo: 'Attaccante' }, ['RageeVII']).errore);
  assert.ok(validaProvinante({ id: '  rageevii ', ruolo: 'Attaccante' }, ['RageeVII']).errore,
    'maiuscole e spazi non aiutano a intrufolarsi');
});

prova('un nome lunghissimo si taglia invece di far fallire', () => {
  const v = validaProvinante({ id: 'x'.repeat(500), ruolo: 'Portiere' }).voce;
  assert.equal(v.id.length, 60);
});

console.log('\nQuanto vive un provinante');

const SERA = Date.parse('2026-09-03T21:00:00Z');
const oreFa = ore => new Date(SERA - ore * 3600000).toISOString();

prova('appena aggiunto ha due giorni davanti', () => {
  assert.equal(restaDaVivere(oreFa(0), SERA), VIVE_MS);
  assert.equal(VIVE_MS, 2 * 24 * 60 * 60 * 1000);
});

prova('a un\'ora dalla fine e ancora vivo', () => {
  assert.equal(restaDaVivere(oreFa(47), SERA), 3600000);
});

prova('passate le quarantotto ore e finito', () => {
  assert.equal(restaDaVivere(oreFa(48), SERA), 0);
  assert.equal(restaDaVivere(oreFa(100), SERA), 0);
});

prova('una data illeggibile conta come scaduta', () => {
  /* Meglio far sparire un provinante che tenerne uno per sempre
     perche una riga d'archivio era scritta male. */
  assert.equal(restaDaVivere('ieri', SERA), 0);
  assert.equal(restaDaVivere(null, SERA), 0);
});

prova('una data nel futuro non lo fa sparire', () => {
  /* Sara l'orologio di qualcuno a mentire: buttare via il lavoro del
     capitano per quello sarebbe peggio. */
  assert.equal(restaDaVivere(new Date(SERA + 3600000).toISOString(), SERA), VIVE_MS);
});

prova('nell\'elenco restano solo i vivi', () => {
  const lista = [
    { id: 'Fresco', creato: oreFa(1) },
    { id: 'Vecchio', creato: oreFa(70) },
    { id: 'Rotto', creato: 'chissa' },
    { id: 'AlLimite', creato: oreFa(47.5) }
  ];
  assert.deepEqual(viviSoltanto(lista, SERA).map(p => p.id), ['Fresco', 'AlLimite']);
});

console.log('\nLe tre partite della serata');

prova('le partite sono tre', () => {
  assert.equal(PARTITE, 3);
  assert.equal(partitaValida(1), 1);
  assert.equal(partitaValida(2), 2);
  assert.equal(partitaValida(3), 3);
});

prova('fuori dalle tre si torna alla prima', () => {
  /* Il numero arriva dall'indirizzo o dal corpo di una richiesta:
     qualunque cosa sia, deve finire su una casella che esiste. */
  [0, 4, 99, -1, 1.5, 'due', '', null, undefined, {}].forEach(v =>
    assert.equal(partitaValida(v), 1, 'partitaValida(' + JSON.stringify(v) + ')'));
});

prova('il numero scritto come testo vale lo stesso', () => {
  // Dall'indirizzo arriva sempre come stringa.
  assert.equal(partitaValida('2'), 2);
  assert.equal(partitaValida('3'), 3);
});

console.log('\nChi arriva tardi');

prova('all\'ora di tutti non si scrive niente', () => {
  /* Le 21:30 sono l'ora di tutti: scriverla accanto a undici facce su
     undici sarebbe rumore, non informazione. */
  assert.equal(oraTardi('21:30'), null);
  assert.equal(oraTardi(null), null);
  assert.equal(oraTardi(undefined), null);
  assert.equal(oraTardi(''), null);
});

prova('chi arriva dopo si vede, con la sua ora', () => {
  assert.equal(oraTardi('22:00'), '22:00');
  assert.equal(oraTardi('22:30'), '22:30');
  assert.equal(oraTardi('23:30'), '23:30');
});

prova('il confine e escluso, non incluso', () => {
  /* "dopo le 21:30, 21:30 escluso": mezz'ora piu tardi si vede, le
     21:30 spaccate no. */
  assert.equal(oraTardi(ORA_DEFAULT), null);
  assert.notEqual(oraTardi('22:00'), null);
});

prova('un\'ora impossibile non diventa un ritardo', () => {
  /* oraArrivo riporta dentro i limiti quello che non torna, e quello
     che torna alle 21:30 non e un ritardo. */
  assert.equal(oraTardi('03:00'), null);
  assert.equal(oraTardi('pippo'), null);
  assert.equal(oraTardi('21:17'), null);
});

console.log('\nCandidature dei provini');

const BUONA = { id: 'TizioACaso99', piattaforma: 'PC', ruoli: ['Attaccante'] };

prova('senza ID, piattaforma o ruolo non si accetta', () => {
  /* Sono le tre cose senza cui non si puo richiamare nessuno. */
  assert.ok(validaCandidatura({ ...BUONA, id: '   ' }).errore);
  assert.ok(validaCandidatura({ ...BUONA, piattaforma: '' }).errore);
  assert.ok(validaCandidatura({ ...BUONA, ruoli: [] }).errore);
  assert.ok(validaCandidatura(null).errore);
});

prova('una candidatura completa passa intera', () => {
  const v = validaCandidatura({
    ...BUONA, comp: ['FVPA'], club: ['Vecchio FC'],
    giorni: ['lunedì'], telefono: '+39 333', note: 'ciao'
  }).voce;
  assert.equal(v.id, 'TizioACaso99');
  assert.deepEqual(v.ruoli, ['Attaccante']);
  assert.equal(v.note, 'ciao');
});

prova('il resto puo mancare senza far cadere niente', () => {
  const v = validaCandidatura(BUONA).voce;
  assert.deepEqual(v.comp, []);
  assert.deepEqual(v.club, []);
  assert.equal(v.note, '');
});

prova('quello che e troppo lungo si taglia, non si rifiuta', () => {
  /* Una candidatura scritta male resta una persona che vuole giocare
     con noi: si taglia, non si butta. */
  const v = validaCandidatura({ ...BUONA, note: 'x'.repeat(5000) }).voce;
  assert.equal(v.note.length, LIMITI.note);
});

prova('non ci si puo fare un deposito con gli elenchi', () => {
  const v = validaCandidatura({
    ...BUONA,
    ruoli: Array(50).fill('Attaccante'),
    club: Array(99).fill('c')
  }).voce;
  assert.equal(v.ruoli.length, LIMITI.ruoli);
  assert.equal(v.club.length, LIMITI.club);
});

prova('roba che non e una lista non fa saltare niente', () => {
  const v = validaCandidatura({ ...BUONA, comp: 'non una lista', club: null }).voce;
  assert.deepEqual(v.comp, []);
  assert.deepEqual(v.club, []);
});

prova('il numero si ripulisce come lo vuole WhatsApp', () => {
  /* Chi si candida scrive come gli pare; WhatsApp vuole cifre
     attaccate col prefisso davanti. */
  assert.equal(numeroWhatsApp('+39 333 1234567'), '393331234567');
  assert.equal(numeroWhatsApp('333-123-4567'), '393331234567');
  assert.equal(numeroWhatsApp('0039 333 1234567'), '393331234567');
  assert.equal(numeroWhatsApp('  3331234567  '), '393331234567');
});

prova('il 39 si mette solo dove manca', () => {
  /* Un cellulare italiano ha dieci cifre e comincia per 3; col
     prefisso ne ha dodici. Sono due forme distinguibili, e vanno
     distinte: mettere il 39 a chi ce l'ha gia aprirebbe la chat di
     un numero che non esiste. */
  assert.equal(numeroWhatsApp('3331234567'), '393331234567');   // dieci: manca
  assert.equal(numeroWhatsApp('393331234567'), '393331234567'); // dodici: c'e gia
});

prova('un numero straniero non si tocca', () => {
  /* Indovinare un prefisso a chi ne ha gia uno suo sarebbe peggio che
     lasciarlo com'e. */
  assert.equal(numeroWhatsApp('+44 7700 900123'), '447700900123');
  assert.equal(numeroWhatsApp('+1 415 555 0123'), '14155550123');
});

prova('quello che non e un numero non apre nessuna chat', () => {
  /* Meglio nessun bottone che un bottone che apre la chat sbagliata:
     null e il segnale che al sito serve per non mostrarlo. */
  [null, undefined, '', '   ', 'ciao', '12345', '1'.repeat(20)].forEach(v =>
    assert.equal(numeroWhatsApp(v), null, JSON.stringify(v)));
});

prova('la pausa fra due invii e di due minuti', () => {
  const ora = Date.parse('2026-08-31T20:00:00Z');
  assert.equal(PAUSA_INVIO_MS, 2 * 60 * 1000);
  assert.equal(attesaInvio(null, ora), 0);
  assert.equal(attesaInvio(new Date(ora).toISOString(), ora), PAUSA_INVIO_MS);
  assert.equal(attesaInvio(new Date(ora - 3 * 60000).toISOString(), ora), 0);
});

console.log('\nChi e chi nella rosa');

const ROSA = [
  { nick: 'Il_Cigno-_-', altriId: ['FRANCESC000SSS'], img: 'cigno.jpeg' },
  { nick: 'RageeVII', img: 'rage.jpeg' },
  { nick: 'mimjcc', img: 'mim.jpeg' }
];

prova('si trova col nome nuovo', () => {
  assert.equal(indicizzaRosa(ROSA)['il_cigno-_-'].img, 'cigno.jpeg');
});

prova('si trova ancora col nome vecchio', () => {
  /* Serve davvero: su eLudo continua a chiamarsi come prima, e senza
     questo la sua faccia sparirebbe dalle statistiche del campionato
     il giorno stesso del cambio di nome. */
  assert.equal(indicizzaRosa(ROSA)['francesc000sss'].img, 'cigno.jpeg');
});

prova('maiuscole e spazi non contano, come ovunque nel sito', () => {
  const r = indicizzaRosa(ROSA);
  assert.equal(r[piatto('  FRANCESC000SSS ')].img, 'cigno.jpeg');
  assert.equal(r[piatto('rageevii')].img, 'rage.jpeg');
});

prova('chi non ha nomi vecchi funziona come prima', () => {
  const r = indicizzaRosa(ROSA);
  assert.equal(r['mimjcc'].img, 'mim.jpeg');
  assert.equal(r['nessuno'], undefined);
});

prova('il nick vince sul nome vecchio di un altro', () => {
  /* Se qualcuno prendesse un ID che era di un altro, la scheda giusta
     e quella di chi ce l'ha adesso come nick. */
  const contesa = [
    { nick: 'vecchio-di-uno', img: 'nuovo.jpeg' },
    { nick: 'altro', altriId: ['vecchio-di-uno'], img: 'passato.jpeg' }
  ];
  assert.equal(indicizzaRosa(contesa)['vecchio-di-uno'].img, 'nuovo.jpeg');
});

prova('una rosa vuota non fa saltare niente', () => {
  assert.deepEqual(indicizzaRosa([]), {});
  assert.deepEqual(indicizzaRosa(null), {});
});

console.log('\nIl campionato letto da eLudo');

prova('fra i campionati si sceglie quello in corso', () => {
  /* Il club resta iscritto anche agli anni passati: se si prendesse
     il primo della lista, la pagina resterebbe ferma alla stagione
     vecchia senza dirlo a nessuno. */
  assert.equal(scegliEvento([
    { eventId: 31, eventStatus: 'ended' },
    { eventId: 99, eventStatus: 'running' }
  ]).eventId, 99);
});

prova('se sono tutti finiti si tiene l\'ultimo', () => {
  /* Fra una stagione e l'altra la pagina racconta com'e andata,
     invece di restare vuota per mesi. */
  assert.equal(scegliEvento([
    { eventId: 12, eventStatus: 'ended' },
    { eventId: 31, eventStatus: 'ended' }
  ]).eventId, 31);
});

prova('senza campionati non si inventa niente', () => {
  assert.equal(scegliEvento([]), null);
  assert.equal(scegliEvento(null), null);
});

prova('la squadra si trova dall\'identita permanente, non dal nome', () => {
  /* Ogni stagione crea una squadra nuova con un id nuovo; quella del
     club non cambia mai. E il nome puo essere scritto diverso. */
  const ev = {
    teams: [{ teamId: 900, originalTeam: 265 }, { teamId: 901, originalTeam: 12 }],
    subEvents: [{
      name: 'Serie B',
      phases: [
        { id: 5, eventType: 'bracket', teams: [{ teamId: 900, group: 'A' }] },
        { id: 7, eventType: 'roundRobin', teams: [{ teamId: 901, group: 'A' }, { teamId: 900, group: 'B' }] }
      ]
    }]
  };
  const noi = trovaNoi(ev, 265);
  assert.equal(noi.serie, 'Serie B');
  assert.equal(noi.girone, 'B');
  assert.equal(noi.idStagione, 900);
  assert.equal(noi.fase.id, 7, 'deve prendere il campionato, non il tabellone');
});

prova('se il club non e nell\'evento non si tira a indovinare', () => {
  assert.equal(trovaNoi({ teams: [], subEvents: [] }, 265), null);
});

prova('uno spazio in fondo al nome non fa due giocatori', () => {
  /* Su eLudo lo stesso giocatore compare a volte come "rageevii " e a
     volte come "rageevii". Contando per nome, il capitano risultava
     due persone con i gol divisi a meta. */
  const partite = [
    { matchGroup: 'A', playerStats: [{ playerId: 7, teamId: 1, gamerTag: 'rageevii ', goal: 2, assists: 1, vote: 8 }] },
    { matchGroup: 'A', playerStats: [{ playerId: 7, teamId: 1, gamerTag: 'rageevii',  goal: 3, assists: 0, vote: 7 }] }
  ];
  const r = raccogliStatistiche(partite, { 1: 'Monaci' }, 'A', 1);
  assert.equal(r.length, 1, 'deve restare una persona sola');
  assert.equal(r[0].gol, 5);
  assert.equal(r[0].assist, 1);
  assert.equal(r[0].partite, 2);
  assert.equal(r[0].nome, 'rageevii', 'il nome si mostra pulito');
});

prova('si contano solo le partite del nostro girone', () => {
  /* Una classifica marcatori che mescola girone A e girone B
     racconta un campionato che nessuno ha giocato. */
  const partite = [
    { matchGroup: 'A', playerStats: [{ playerId: 1, teamId: 1, gamerTag: 'nostro', goal: 1 }] },
    { matchGroup: 'B', playerStats: [{ playerId: 2, teamId: 2, gamerTag: 'altrove', goal: 9 }] }
  ];
  const r = raccogliStatistiche(partite, { 1: 'Monaci', 2: 'Altri' }, 'A', null);
  assert.equal(r.length, 1);
  assert.equal(r[0].nome, 'nostro');
});

prova('il voto medio esce dalle partite in cui c\'e un voto', () => {
  /* Chi non ha voto in una partita non deve abbassare la media: una
     partita senza voto e un dato mancante, non uno zero. */
  const partite = [
    { matchGroup: 'A', playerStats: [{ playerId: 1, teamId: 1, gamerTag: 'x', goal: 0, vote: 8 }] },
    { matchGroup: 'A', playerStats: [{ playerId: 1, teamId: 1, gamerTag: 'x', goal: 0 }] },
    { matchGroup: 'A', playerStats: [{ playerId: 1, teamId: 1, gamerTag: 'x', goal: 0, vote: 7 }] }
  ];
  const r = raccogliStatistiche(partite, { 1: 'Monaci' }, 'A', 1);
  assert.equal(r[0].voto, 7.5);
  assert.equal(r[0].partite, 3);
});

prova('chi non ha mai un voto non ne prende uno finto', () => {
  const partite = [{ matchGroup: 'A', playerStats: [{ playerId: 1, teamId: 1, gamerTag: 'x', goal: 1 }] }];
  assert.equal(raccogliStatistiche(partite, { 1: 'M' }, 'A', 1)[0].voto, null);
});

prova('una squadra sparita non lascia un numero al posto del nome', () => {
  const partite = [{ matchGroup: 'A', playerStats: [{ playerId: 1, teamId: 99, gamerTag: 'x', goal: 1 }] }];
  assert.equal(raccogliStatistiche(partite, {}, 'A', null)[0].squadra, 'squadra ritirata');
});

prova('i nomi si appiattiscono come fa il resto del sito', () => {
  assert.equal(piatto('  RageeVII '), 'rageevii');
  assert.equal(piatto(null), '');
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
