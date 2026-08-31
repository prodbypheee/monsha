/* =============================================================
   MONACI SHAOLIN — il campionato, letto da eLudo
   -------------------------------------------------------------
   eLudo e il sito dove si gioca davvero il campionato. Il loro sito
   e un'applicazione Flutter — nell'HTML non c'e un solo dato, e
   raschiare la pagina non porterebbe da nessuna parte — ma sotto c'e
   un'API pubblica che risponde senza credenziali. E quella che si usa
   qui.

   IL PUNTO PIU IMPORTANTE DI TUTTO IL FILE: la squadra ha due
   identita. Ogni stagione ne crea una nuova (475 per la Eludo League
   appena finita), mentre il club ne ha una permanente che non cambia
   mai — la 265. Se qui dentro ci fosse scritto l'id della stagione,
   il giorno che ne comincia un'altra la pagina resterebbe ferma al
   passato senza dire niente. Con l'id permanente si chiede a eLudo "a
   quali campionati partecipa questo club?" e la stagione nuova si
   trova da sola.

   Cosa NON si chiama, di proposito: l'endpoint che risale dalla
   squadra della stagione a quella permanente restituisce anche le
   email dei membri, in chiaro e senza autenticazione. Non ci serve —
   il 265 lo sappiamo — e roba del genere non deve passare nemmeno di
   sfuggita da un nostro server. Gli endpoint usati qui sotto sono
   stati controllati: non contengono nessun indirizzo.
   ============================================================= */

import { getStore } from '@netlify/blobs';

const API = 'https://esport.api.eludo.co/';

/* L'identita permanente del club su eLudo. Questo e l'unico numero
   scritto a mano in tutto il file, ed e quello che non cambia. */
export const CLUB = 265;

/* Ogni quanto si torna a chiedere. Mezz'ora: un campionato non si
   muove piu in fretta di cosi, e venti persone che aprono la tab non
   devono diventare venti scaricamenti da cinque megabyte. */
export const FRESCHEZZA_MS = 30 * 60 * 1000;

const store = () => getStore({ name: 'area-campionato', consistency: 'strong' });
const CHIAVE = 'ultimo';

async function chiama(endpoint, corpo) {
  const r = await fetch(API + endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(corpo)
  });
  if (!r.ok) throw new Error('eludo ' + endpoint + ': ' + r.status);
  return r.json();
}

/* ---------- quale campionato ----------------------------------
   Fra quelli a cui il club partecipa si sceglie quello in corso; se
   sono tutti finiti si tiene l'ultimo, cosi fra una stagione e
   l'altra la pagina racconta com'e andata invece di restare vuota. */

export function scegliEvento(eventi) {
  const buoni = (eventi || []).filter(e => e && e.eventId);
  if (!buoni.length) return null;
  return buoni.find(e => e.eventStatus !== 'ended') || buoni[buoni.length - 1];
}

/* ---------- dove giochiamo ------------------------------------
   Serie e girone non si scrivono a mano: si cercano. Il giorno che
   saliamo di categoria non c'e una riga da cambiare.

   Dentro l'evento la nostra squadra si riconosce dal campo
   `originalTeam`, che punta all'identita permanente. E il modo piu
   solido: il nome si puo scrivere diverso, l'id della stagione
   cambia ogni anno, quello no. */

export function trovaNoi(ev, club = CLUB) {
  const voce = (ev.teams || []).find(t => t.originalTeam === club);
  if (!voce) return null;

  for (const se of ev.subEvents || [])
    for (const f of se.phases || [])
      if (f.eventType === 'roundRobin')
        for (const t of f.teams || [])
          if (t.teamId === voce.teamId)
            return { idStagione: voce.teamId, serie: se.name, fase: f, girone: t.group };

  return null;
}

/* ---------- i conti sui singoli -------------------------------
   I gol dei giocatori non stanno in una classifica gia pronta —
   quella torna vuota — ma dentro ogni partita, una riga per
   giocatore. Si sommano da li, e in cambio si ottengono anche i voti
   e le porte inviolate che una classifica marcatori non avrebbe.

   SI AGGREGA PER IDENTIFICATIVO, MAI PER NOME. Su eLudo lo stesso
   giocatore compare a volte con uno spazio in fondo al nome
   ("rageevii " invece di "rageevii"): contando per nome, il capitano
   risultava due persone diverse con i gol divisi a meta.

   E si guardano solo le partite del nostro girone: la fase ne
   contiene due, e una classifica marcatori che mescola A e B direbbe
   una cosa che nessuno ha giocato. */

export const piatto = v => String(v || '').trim().toLowerCase();

export function raccogliStatistiche(partite, nomiSquadre, girone, soloSquadra) {
  const per = new Map();

  (partite || [])
    .filter(m => !girone || m.matchGroup === girone)
    .forEach(m => (m.playerStats || []).forEach(s => {
      if (soloSquadra && s.teamId !== soloSquadra) return;
      if (!per.has(s.playerId)) per.set(s.playerId, {
        nome: piatto(s.gamerTag),
        squadra: nomiSquadre[s.teamId] || 'squadra ritirata',
        nostro: s.teamId === soloSquadra || false,
        partite: 0, gol: 0, assist: 0, porteInviolate: 0,
        _somma: 0, _conVoto: 0
      });
      const p = per.get(s.playerId);
      p.partite++;
      p.gol += s.goal || 0;
      p.assist += s.assists || 0;
      p.porteInviolate += s.cleanSheetsGk || 0;
      if (s.vote) { p._somma += s.vote; p._conVoto++; }
    }));

  return [...per.values()].map(p => {
    const { _somma, _conVoto, ...resto } = p;
    return { ...resto, voto: _conVoto ? +(_somma / _conVoto).toFixed(2) : null };
  });
}

/* ---------- il distillato -------------------------------------
   L'evento intero pesa cinque megabyte. Quello che serve a una
   pagina sono otto chilobyte: qui si butta via il resto.

   La classifica NON si ricalcola dalle partite. I punti li fa il
   campionato con le sue regole sui pari punti, e rifare il conto
   vorrebbe dire indovinarle e sbagliare. */

export function distilla(ev, classificaGrezza, noi) {
  const nomi = {};
  (noi.fase.teams || []).forEach(t => {
    nomi[t.teamId] = (t.team || {}).name || ('#' + t.teamId);
  });

  const classifica = (classificaGrezza || []).map(r => ({
    pos: r.position,
    squadra: nomi[r.participantId] || ('#' + r.participantId),
    noi: r.participantId === noi.idStagione,
    giocate: r.wins + r.draws + r.losses,
    v: r.wins, n: r.draws, p: r.losses,
    gf: r.goalsFor, gs: r.goalsAgainst, dr: r.goalsFor - r.goalsAgainst,
    punti: r.points
  })).sort((a, b) => a.pos - b.pos);

  const partite = noi.fase.matches || [];
  const nostri = raccogliStatistiche(partite, nomi, noi.girone, noi.idStagione)
    .sort((a, b) => b.gol - a.gol || b.assist - a.assist || (b.voto || 0) - (a.voto || 0));

  const tutti = raccogliStatistiche(partite, nomi, noi.girone, null)
    .map(p => ({ ...p, nostro: false }));
  // `nostro` va rimesso guardando la squadra: raccogliStatistiche non
  // lo sa quando non le si passa una squadra da filtrare.
  const nostriNomi = new Set(nostri.map(p => p.nome));
  tutti.forEach(p => { p.nostro = nostriNomi.has(p.nome); });

  const primi = (chiave, minimo = 0) => [...tutti]
    .filter(p => p.partite >= minimo)
    .sort((a, b) => (b[chiave] || 0) - (a[chiave] || 0) || b.gol - a.gol)
    .slice(0, 10)
    .map((p, i) => ({ ...p, posto: i + 1 }));

  const nostraRiga = classifica.find(r => r.noi) || {};

  return {
    evento: { id: ev.id, nome: ev.name, stato: ev.status },
    noi: {
      serie: noi.serie,
      girone: noi.girone,
      squadra: {
        posizione: nostraRiga.pos || null,
        punti: nostraRiga.punti || 0,
        giocate: nostraRiga.giocate || 0,
        v: nostraRiga.v || 0, n: nostraRiga.n || 0, p: nostraRiga.p || 0,
        gf: nostraRiga.gf || 0, gs: nostraRiga.gs || 0,
        squadre: classifica.length
      }
    },
    classifica,
    nostri,
    marcatori: primi('gol'),
    assistman: primi('assist'),
    voti: primi('voto', 8),
    letto: new Date().toISOString()
  };
}

/* ---------- il giro completo ---------------------------------- */

export async function leggiDaEludo(club = CLUB) {
  const eventi = await chiama('teamOpen', { teamId: club, method: 'retrieveEventsForTeam' });
  const scelto = scegliEvento(eventi);
  if (!scelto) return { errore: 'Il club non risulta iscritto a nessun campionato.' };

  const ev = await chiama('eventOpen', { id: scelto.eventId, method: 'retrieveById' });
  const noi = trovaNoi(ev, club);
  if (!noi) return { errore: 'Non trovo la squadra dentro il campionato.' };

  const classifica = await chiama('eventOpen', {
    phaseId: null, subPhaseId: noi.fase.id, matchGroup: noi.girone, method: 'standings'
  });

  return distilla(ev, classifica, noi);
}

/* ---------- quel che si tiene da parte ------------------------
   Si serve sempre qualcosa. Se eLudo non risponde si danno gli
   ultimi dati buoni con la data in cui sono stati letti: una
   classifica di ieri e utile, una pagina di errore no. */

export async function leggiCampionato({ forza = false } = {}) {
  const salvato = await store().get(CHIAVE, { type: 'json' }).catch(() => null);
  const eta = salvato ? Date.now() - Date.parse(salvato.letto) : Infinity;

  if (salvato && !forza && eta < FRESCHEZZA_MS) return { ...salvato, fresco: true };

  try {
    const nuovo = await leggiDaEludo();
    if (nuovo.errore) throw new Error(nuovo.errore);
    await store().setJSON(CHIAVE, nuovo);
    return { ...nuovo, fresco: true };
  } catch (e) {
    console.error('campionato: eludo non risponde —', e && e.message);
    if (salvato) return { ...salvato, fresco: false };
    return { errore: 'Non riesco a leggere il campionato da eLudo.' };
  }
}
