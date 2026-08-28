/* =============================================================
   MONACI SHAOLIN — logica di pagina
   Tab con URL propri, rosa costruita da rosa.json, filtri,
   foglio dettaglio su telefono, invio candidatura.
   ============================================================= */

(function () {
  'use strict';

  const MOBILE = 768;
  const stretto = () => window.innerWidth <= MOBILE;

  /* ---------- TAB E INDIRIZZI ---------------------------------- */

  const PERCORSI = {
    home:     '/',
    rosa:     '/noi',
    albo:     '/albo-doro',
    unisciti: '/unisciti-a-noi',
    area:     '/area-riservata'
  };
  const DA_PERCORSO = {
    '/':               'home',
    '/noi':            'rosa',
    '/albo-doro':      'albo',
    '/albodoro':       'albo',
    '/unisciti-a-noi': 'unisciti',
    '/uniscitianoi':   'unisciti',
    '/area-riservata': 'area',
    '/areariservata':  'area',
    // Indirizzo del pannello: sta qui solo perche la SPA sappia che tab
    // aprire. Non compare nel menu e non e linkato da nessuna parte.
    '/area-riservata-nimda': 'area'
  };

  function percorso() {
    const p = location.pathname.toLowerCase().replace(/\/+$/, '');
    return p === '' ? '/' : p;
  }

  function mostra(tab, spingi) {
    const el = document.getElementById('tab-' + tab);
    if (!el) return;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('attiva'));
    el.classList.add('attiva');
    document.querySelectorAll('.nav button').forEach(b => {
      if (b.dataset.va === tab) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
    if (spingi !== false && PERCORSI[tab] && percorso() !== PERCORSI[tab] && DA_PERCORSO[percorso()] !== tab) {
      history.pushState({ tab }, '', PERCORSI[tab]);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // L'area riservata si carica solo quando serve: senza questo segnale
    // il sito chiamerebbe il server a ogni visita, anche in home.
    if (tab === 'area') document.dispatchEvent(new CustomEvent('area:aperta'));
    rivela();
  }

  document.addEventListener('click', e => {
    const t = e.target.closest('[data-va]');
    if (!t) return;
    e.preventDefault();
    mostra(t.dataset.va);
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const t = e.target.closest('[data-va]');
    if (!t || t.tagName === 'BUTTON') return;
    e.preventDefault();
    mostra(t.dataset.va);
  });

  window.addEventListener('popstate', e => {
    const tab = (e.state && e.state.tab) || DA_PERCORSO[percorso()] || 'home';
    mostra(tab, false);
  });

  /* ---------- ANIMAZIONE DI COMPARSA --------------------------- */

  let osservatore = null;
  function rivela() {
    const elementi = document.querySelectorAll('.tab.attiva [data-reveal]:not(.visibile)');
    if (!('IntersectionObserver' in window)) {
      elementi.forEach(el => el.classList.add('visibile'));
      return;
    }
    if (!osservatore) {
      osservatore = new IntersectionObserver(voci => {
        voci.forEach((v, i) => {
          if (!v.isIntersecting) return;
          setTimeout(() => v.target.classList.add('visibile'), i * 70);
          osservatore.unobserve(v.target);
        });
      }, { threshold: .12, rootMargin: '0px 0px -8% 0px' });
    }
    elementi.forEach(el => osservatore.observe(el));
  }

  /* ---------- IL CODICE DEL MONACO ----------------------------- */

  (function codice() {
    const track = document.getElementById('codiceTrack');
    const punti = document.getElementById('codiceDot');
    if (!track || !punti) return;
    let i = 0;
    const n = track.children.length;
    setInterval(() => {
      i = (i + 1) % n;
      const alt = track.children[0].offsetHeight;
      track.style.transform = 'translateY(-' + (i * alt) + 'px)';
      [...punti.children].forEach((d, k) => d.classList.toggle('on', k === i));
    }, 3800);
  })();

  /* ---------- GALLERIA SCORREVOLE ------------------------------ */
  // Il nastro scorre in continuo: le immagini vanno duplicate, altrimenti
  // a meta animazione resterebbe una fascia vuota.
  (function galleria() {
    const box = document.getElementById('nastroFoto');
    if (!box) return;
    const foto = [
      ['gal-1-tempio',      'Il cancello del tempio'],
      ['gal-2-controller',  'Dove si decide tutto'],
      ['gal-3-bacheca',     'Venti titoli in bacheca'],
      ['gal-4-curva',       'La curva sotto i fumogeni'],
      ['gal-5-lavagna',     'Moduli provati, non improvvisati'],
      ['gal-6-spogliatoio', "Prima dell'ingresso in campo"],
      ['gal-7-campo',       'Il campo alle undici di sera'],
      ['gal-8-cerchio',     'Il cerchio prima del fischio']
    ];
    const html = foto.map(f =>
      '<figure><img src="./immagini/' + f[0] + '.jpeg" alt="' + f[1] + '" loading="lazy">' +
      '<figcaption>' + f[1] + '</figcaption></figure>').join('');
    box.innerHTML = html + html;
  })();

  /* ---------- ROSA --------------------------------------------- */

  const REPARTI = [
    { id: 'tutti',         nome: 'Tutti' },
    { id: 'portieri',      nome: 'Portieri' },
    { id: 'difensori',     nome: 'Difensori' },
    { id: 'centrocampisti', nome: 'Centrocampo' },
    { id: 'attaccanti',    nome: 'Attacco' },
    { id: 'icons',         nome: 'Icons' }
  ];

  let giocatori = [];
  let filtro = 'tutti';

  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function disegnaFiltri() {
    const box = document.getElementById('filtri');
    if (!box) return;
    box.innerHTML = REPARTI.map(r => {
      const n = r.id === 'tutti' ? giocatori.length : giocatori.filter(g => g.reparto === r.id).length;
      if (!n) return '';
      return '<button type="button" class="filtro" data-rep="' + r.id + '" aria-pressed="' +
             (filtro === r.id) + '">' + esc(r.nome) + ' · ' + n + '</button>';
    }).join('');
  }

  function disegnaRosa() {
    const box = document.getElementById('rosa');
    if (!box) return;
    const lista = filtro === 'tutti' ? giocatori : giocatori.filter(g => g.reparto === filtro);
    box.innerHTML = lista.map((g, i) => {
      const sfondo = "url('./immagini/" + g.img + "')";
      return '' +
        '<button type="button" class="scheda" data-i="' + giocatori.indexOf(g) + '" data-reveal>' +
          '<span class="scheda-mob-pos">' + esc(g.ruolo) + '</span>' +
          '<span class="scheda-testa">' +
            '<span class="scheda-riga">' +
              '<span class="pos">' + esc(g.ruolo) + '</span>' +
              '<span class="tagname">' + esc(g.reparto) + '</span>' +
            '</span>' +
            '<ul class="punti">' + g.punti.map(p => '<li>' + esc(p) + '</li>').join('') + '</ul>' +
          '</span>' +
          '<span class="scheda-foto"><i style="background-image:' + sfondo + '"></i></span>' +
          '<span class="scheda-nome">' +
            '<span class="scheda-ep">' + esc(g.epiteto) + '</span>' +
            '<span class="scheda-nick">' + esc(g.nick) + '</span>' +
          '</span>' +
        '</button>';
    }).join('');
    rivela();
  }

  document.addEventListener('click', e => {
    const f = e.target.closest('.filtro');
    if (f) {
      filtro = f.dataset.rep;
      disegnaFiltri();
      disegnaRosa();
      return;
    }
    const s = e.target.closest('.scheda');
    if (s && stretto()) apriFoglio(giocatori[+s.dataset.i]);
  });

  /* La promessa viene tenuta da parte: l'area riservata deve poter
     aspettare la rosa per mostrare a ciascuno la propria foto, e non
     puo sapere se il caricamento e gia finito o no. */
  const rosaPronta = fetch('./rosa.json')
    .then(r => r.json())
    .then(d => {
      giocatori = d.giocatori || [];
      disegnaFiltri();
      disegnaRosa();
      return giocatori;
    })
    .catch(() => {
      const box = document.getElementById('rosa');
      if (box) box.innerHTML = '<p class="sottotesto">Non riesco a caricare la rosa. Ricarica la pagina.</p>';
      return [];
    });

  /* Accostamento fra ID di gioco e rosa. Il confronto ignora maiuscole
     e spazi ai bordi, esattamente come fa il server quando controlla
     l'ID all'accesso: se le due regole divergessero, uno entrerebbe nel
     sito ma non si riconoscerebbe nella propria scheda. */
  const idPiatto = v => String(v || '').trim().toLowerCase();
  const trovaGiocatore = id => {
    const k = idPiatto(id);
    return k ? (giocatori.find(g => idPiatto(g.nick) === k) || null) : null;
  };

  /* ---------- FOGLIO DETTAGLIO (telefono) ---------------------- */

  const bg = document.getElementById('foglioBg');
  const foglio = document.getElementById('foglio');

  function apriFoglio(g) {
    if (!g || !foglio) return;
    document.getElementById('foglioFoto').style.backgroundImage = "url('./immagini/" + g.img + "')";
    document.getElementById('foglioPos').textContent = g.ruolo;
    document.getElementById('foglioRep').textContent = g.reparto;
    document.getElementById('foglioEp').textContent = g.epiteto;
    document.getElementById('foglioNome').textContent = g.nick;
    document.getElementById('foglioPunti').innerHTML = g.punti.map(p => '<li>' + esc(p) + '</li>').join('');
    foglio.classList.add('aperto');
    bg.classList.add('aperto');
    document.body.style.overflow = 'hidden';
  }
  function chiudiFoglio() {
    if (!foglio) return;
    foglio.classList.remove('aperto');
    bg.classList.remove('aperto');
    document.body.style.overflow = '';
  }
  if (bg) bg.addEventListener('click', chiudiFoglio);
  const chiudi = document.getElementById('foglioChiudi');
  if (chiudi) chiudi.addEventListener('click', chiudiFoglio);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') chiudiFoglio(); });
  window.addEventListener('resize', () => { if (!stretto()) chiudiFoglio(); });

  /* ---------- MODULO CANDIDATURA: quattro passi ---------------- */

  const wizard = document.getElementById('wizard');
  if (wizard) (function () {

    const AIUTO = {
      PlayStation: 'Il tuo PSN ID (PlayStation Network)',
      Xbox:        'Il tuo Xbox Gamertag',
      PC:          'Il tuo ID Origin, Steam o Epic Games'
    };
    const RUOLI = [
      ['POR','Portiere'], ['TD','Terzino destro'], ['DC','Difensore centrale'],
      ['TS','Terzino sinistro'], ['MED','Mediano'], ['COC','Centrocampista'],
      ['ED','Esterno destro'], ['ES','Esterno sinistro'], ['ATT','Attaccante']
    ];
    // Competizioni reali in cui si puo aver militato, con le rispettive
    // divisioni: sono quelle del form precedente alla rifacitura grafica,
    // dove la scelta avveniva in un menu a tendina annidato.
    const COMP_GRUPPI = [
      ['FVPA',            ['Serie A', 'Serie B', 'Serie C']],
      ['FVPA San Marino', ['Serie A', 'Serie B']],
      ['Eludo',           ['Serie A', 'Serie B', 'Serie C', 'Serie D']],
      ['VPG',             ['Serie A', 'Serie B', 'Serie C', 'Serie D1', 'Serie D2']]
    ];
    // valore salvato e inviato: "FVPA — Serie A", cosi resta leggibile
    // nella mail senza dover ricostruire il gruppo di appartenenza
    const COMP = COMP_GRUPPI.reduce((acc, g) =>
      acc.concat(g[1].map(d => g[0] + ' — ' + d)), []);
    const GIORNI = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Weekend'];

    const dati = { piatt: '', id: '', ruoli: [], comp: [], club: [], giorni: [], tel: '', note: '' };
    let passo = 1;
    const TOT = 4;

    const $ = id => document.getElementById(id);

    // etichetta: se passata, e cio che si legge sul pulsante; il valore
    // salvato resta quello completo in data-v
    function chip(testo, attivo, extra, etichetta) {
      return '<button type="button" class="chip' + (extra || '') + '" data-v="' + esc(testo) +
             '" aria-pressed="' + attivo + '">' + esc(etichetta || testo) + '</button>';
    }

    function disegna() {
      $('ruoli').innerHTML = RUOLI.map(r =>
        '<button type="button" class="chip ruolo" data-v="' + r[0] + '" aria-pressed="' +
        dati.ruoli.includes(r[0]) + '"><b>' + r[0] + '</b><span>' + esc(r[1]) + '</span></button>').join('');
      $('nRuoli').textContent = dati.ruoli.length;
      // raggruppate per lega, come nel menu del form precedente: con
      // quattordici voci di fila non si capirebbe a quale lega appartengono
      $('comp').innerHTML = COMP_GRUPPI.map(g =>
        '<div class="comp-gruppo"><span class="comp-lega">' + esc(g[0]) + '</span>' +
        '<div class="comp-voci">' +
        g[1].map(d => {
          const valore = g[0] + ' — ' + d;
          return chip(valore, dati.comp.includes(valore), ' comp-chip', d);
        }).join('') +
        '</div></div>').join('');
      $('giorni').innerHTML = GIORNI.map(g => chip(g, dati.giorni.includes(g), ' quadra')).join('');
      disegnaClub();
      $('idAiuto').textContent = AIUTO[dati.piatt] || '';
      [...$('piatt').children].forEach(b => b.setAttribute('aria-pressed', b.dataset.piatt === dati.piatt));
    }

    function disegnaClub() {
      $('clubList').innerHTML = dati.club.map(c =>
        '<button type="button" class="chip tolgo" data-club="' + esc(c) + '">' + esc(c) + ' ✕</button>').join('');
    }

    function riepilogo() {
      const righe = [
        ['Piattaforma', dati.piatt || '—'],
        ['ID player', dati.id || '—'],
        ['Ruoli', dati.ruoli.join(', ') || '—'],
        ['Competizioni', dati.comp.join(', ') || '—'],
        ['Club', dati.club.join(', ') || '—'],
        ['Giorni', dati.giorni.join(', ') || '—']
      ];
      $('riepilogo').innerHTML = righe.map(r =>
        '<div><dt>' + r[0] + '</dt><dd>' + esc(r[1]) + '</dd></div>').join('');
    }

    function vai(n) {
      passo = Math.min(TOT, Math.max(1, n));
      document.querySelectorAll('.wiz-pass').forEach(s =>
        s.classList.toggle('attivo', +s.dataset.pass === passo));
      document.querySelectorAll('.passo').forEach(p => {
        const i = +p.dataset.p;
        p.classList.toggle('attivo', i === passo);
        p.classList.toggle('fatto', i < passo);
      });
      $('barra').style.width = ((passo - 1) / (TOT - 1) * 100) + '%';
      $('indietro').hidden = passo === 1;
      $('avanti').hidden = passo === TOT;
      $('invia').hidden = passo !== TOT;
      $('esito').textContent = '';
      if (passo === TOT) riepilogo();
      wizard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function valida() {
      const esito = $('esito');
      if (passo === 1 && !dati.piatt) { esito.textContent = 'Scegli la piattaforma per continuare.'; esito.style.color = '#ff9a4d'; return false; }
      if (passo === 1 && !dati.id.trim()) { esito.textContent = 'Serve il tuo ID player.'; esito.style.color = '#ff9a4d'; $('idPlayer').focus(); return false; }
      if (passo === 2 && !dati.ruoli.length) { esito.textContent = 'Indica almeno un ruolo.'; esito.style.color = '#ff9a4d'; return false; }
      return true;
    }

    wizard.addEventListener('click', e => {
      const p = e.target.closest('[data-piatt]');
      if (p) { dati.piatt = p.dataset.piatt; disegna(); return; }

      const c = e.target.closest('[data-club]');
      if (c) { dati.club = dati.club.filter(x => x !== c.dataset.club); disegnaClub(); return; }

      const ch = e.target.closest('.chip');
      if (ch && ch.dataset.v) {
        const v = ch.dataset.v;
        const dove = ch.closest('#ruoli') ? 'ruoli' : ch.closest('#comp') ? 'comp' : 'giorni';
        const lista = dati[dove];
        const i = lista.indexOf(v);
        if (i > -1) lista.splice(i, 1);
        else if (dove === 'ruoli' && lista.length >= 2) {
          $('esito').textContent = 'Massimo due ruoli: deseleziona prima uno.';
          $('esito').style.color = '#ff9a4d';
          return;
        } else lista.push(v);
        // aggiorno solo il pulsante toccato: ridisegnare tutta la lista
        // distruggerebbe i nodi, perdendo il fuoco da tastiera
        ch.setAttribute('aria-pressed', lista.includes(v));
        if (dove === 'ruoli') $('nRuoli').textContent = dati.ruoli.length;
        $('esito').textContent = '';
      }
    });

    $('clubAdd').addEventListener('click', aggiungiClub);
    $('clubIn').addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); aggiungiClub(); }
    });
    function aggiungiClub() {
      const v = $('clubIn').value.trim();
      if (!v || dati.club.includes(v)) return;
      dati.club.push(v);
      $('clubIn').value = '';
      disegnaClub();
    }

    $('idPlayer').addEventListener('input', e => { dati.id = e.target.value; });
    $('telefono').addEventListener('input', e => { dati.tel = e.target.value; });
    $('note').addEventListener('input', e => { dati.note = e.target.value; });

    $('avanti').addEventListener('click', () => { if (valida()) vai(passo + 1); });
    $('indietro').addEventListener('click', () => vai(passo - 1));

    if (window.emailjs) emailjs.init('gYs-un27FZbB_6GZc');

    $('invia').addEventListener('click', async () => {
      const btn = $('invia'), esito = $('esito');

      // Rete di sicurezza: nascondere il pulsante non basta a impedire
      // l'invio. Qui si verifica di essere davvero all'ultimo passo e che
      // i dati obbligatori ci siano, qualunque cosa mostri l'interfaccia.
      if (passo !== TOT) {
        esito.textContent = 'Completa prima tutti i passi.';
        esito.style.color = '#ff9a4d';
        return;
      }
      const mancanti = [];
      if (!dati.piatt) mancanti.push('la piattaforma');
      if (!dati.id.trim()) mancanti.push("l'ID player");
      if (!dati.ruoli.length) mancanti.push('almeno un ruolo');
      if (mancanti.length) {
        esito.textContent = 'Manca ' + mancanti.join(', ') + '.';
        esito.style.color = '#ff9a4d';
        vai(mancanti[0] === 'almeno un ruolo' ? 2 : 1);
        return;
      }

      if (!window.emailjs) { esito.textContent = 'Invio non disponibile. Scrivici sui social.'; esito.style.color = '#ff9a4d'; return; }
      btn.disabled = true;
      const testo = btn.textContent;
      btn.textContent = 'Invio in corso…';
      esito.textContent = '';
      try {
        await emailjs.send('Angelica70', 'template_atxhyt9', {
          from_email: 'candidatura@monacishaolin.com',
          platform: dati.piatt || 'Non specificata',
          player_id: dati.id || 'Non specificato',
          selected_roles: dati.ruoli.map(r => '- ' + r).join('\n') || 'Nessun ruolo selezionato',
          selected_competitions: dati.comp.map(c => '- ' + c).join('\n') || 'Nessuna competizione',
          clubs: dati.club.map(c => '- ' + c).join('\n') || 'Nessun club',
          available_days: dati.giorni.map(g => '- ' + g).join('\n') || 'Nessun giorno',
          phone: dati.tel || 'Non specificato',
          additional_info: dati.note || 'Nessuna informazione aggiuntiva'
        });
        esito.textContent = 'Candidatura inviata. Ti ricontattiamo noi.';
        esito.style.color = '#7fd6a0';
        btn.hidden = true;
      } catch (err) {
        esito.textContent = 'Invio non riuscito. Riprova, o scrivici sui social.';
        esito.style.color = '#ff9a4d';
      } finally {
        btn.disabled = false;
        btn.textContent = testo;
      }
    });

    disegna();
    vai(1);
  })();

  /* ---------- AREA RISERVATA -----------------------------------
     Qui non c'e nessun controllo di sicurezza: e tutto lato server,
     in netlify/functions/area.mjs. Questo codice si limita a mostrare
     cio che il server risponde. Chiunque puo falsificare quello che
     succede in questa pagina, ma non puo falsificare il cookie di
     sessione, ed e quello a decidere.

     La tab si sveglia da sola: mostra() emette 'area:aperta', cosi
     la chiamata al server parte solo se qualcuno entra davvero qui,
     non a ogni caricamento del sito. */

  (function areaRiservata() {
    const $ = id => document.getElementById(id);
    if (!$('tab-area')) return;

    const AIUTO_ID = {
      PlayStation: 'Il tuo PSN ID (PlayStation Network)',
      Xbox:        'Il tuo Xbox Gamertag',
      PC:          'Il tuo ID Origin, Steam o Epic Games'
    };

    let avviata = false;
    let piattaforma = '';
    let ioSono = null;      // l'utente della sessione, quando c'e

    /* L'indirizzo riservato non e una difesa — chi lo scopre non guadagna
       niente, a fermarlo e la password. Serve a non mettere davanti ai
       membri un campo che non li riguarda, e a tenere il pannello fuori
       dal menu. Il modulo e lo stesso, cambia solo cosa si vede. */
    const modoAdmin = () => /nimda/.test(location.pathname);

    function vestiDaAdmin() {
      $('arAccChiave').hidden = false;
      $('arAccTit').textContent = 'Accesso amministratore';
      $('arAccSub').textContent = 'Email, ID di gioco e la password del pannello.';
      // La registrazione resta raggiungibile: e l'unico modo di creare
      // il primo account admin, e senza il campo password fallirebbe.
      $('arRegChiave').hidden = false;
      $('arRegTit').textContent = 'Crea l’account amministratore';
      $('arRegSub').textContent = 'Serve la password del pannello. Da fare una volta sola.';
    }

    /* ---- dialogo col server ---- */

    async function chiama(indirizzo, corpo) {
      const opzioni = { credentials: 'same-origin', method: corpo === undefined ? 'GET' : 'POST' };
      if (corpo !== undefined && corpo !== null) {
        opzioni.headers = { 'content-type': 'application/json' };
        opzioni.body = JSON.stringify(corpo);
      }
      let risposta;
      try {
        risposta = await fetch(indirizzo, opzioni);
      } catch {
        return { ok: false, stato: 0, dati: { errore: 'Connessione non riuscita. Riprova.' } };
      }
      let dati = {};
      try { dati = await risposta.json(); } catch { /* risposta senza corpo */ }
      return { ok: risposta.ok, stato: risposta.status, dati };
    }

    const api     = (azione, corpo) => chiama('/api/area/' + azione, corpo);
    const apiConv = (azione, corpo) => chiama('/api/convocazioni/' + azione, corpo);

    /* ---- schermate ---- */

    const SCHERMATE = ['arCarico', 'arOspite', 'arAvviso', 'arDentro'];
    function schermata(quale) {
      SCHERMATE.forEach(id => { $(id).hidden = (id !== quale); });
    }

    function esito(elemento, testo, buono) {
      elemento.textContent = testo || '';
      elemento.style.color = buono ? '#7fd6a0' : '#ff9a4d';
    }

    function avviso(segno, titolo, testo) {
      $('arAvvisoSegno').textContent = segno;
      $('arAvvisoTit').textContent = titolo;
      $('arAvvisoTesto').textContent = testo;
      schermata('arAvviso');
    }

    /* ---- linguette accedi / registrati ---- */

    document.querySelectorAll('#arOspite .ar-linguetta').forEach(linguetta => {
      linguetta.addEventListener('click', () => {
        const quale = linguetta.dataset.modulo;
        document.querySelectorAll('#arOspite .ar-linguetta').forEach(l => {
          const attiva = l === linguetta;
          l.classList.toggle('attiva', attiva);
          l.setAttribute('aria-selected', String(attiva));
        });
        $('arFormAccedi').hidden   = quale !== 'accedi';
        $('arFormRegistra').hidden = quale !== 'registra';
      });
    });

    $('arAvvisoIndietro').addEventListener('click', () => schermata('arOspite'));

    /* ---- scelta della piattaforma ---- */

    $('arPiatt').addEventListener('click', e => {
      const bottone = e.target.closest('button[data-piatt]');
      if (!bottone) return;
      piattaforma = bottone.dataset.piatt;
      [...$('arPiatt').children].forEach(b =>
        b.setAttribute('aria-pressed', String(b.dataset.piatt === piattaforma)));
      $('arRegIdAiuto').textContent = AIUTO_ID[piattaforma] || '';
      $('arRegId').placeholder = 'Il tuo ID su ' + piattaforma;
    });

    /* ---- accesso ---- */

    $('arFormAccedi').addEventListener('submit', async e => {
      e.preventDefault();
      const btn = $('arAccInvia'), box = $('arAccEsito');
      const email = $('arAccEmail').value.trim();
      const idGioco = $('arAccId').value.trim();
      const password = $('arAccPassword').value;

      if (!email || !idGioco) { esito(box, 'Inserisci email e ID di gioco.'); return; }

      btn.disabled = true;
      const testo = btn.textContent;
      btn.textContent = 'Verifico…';
      esito(box, '');

      const r = await api('accedi', { email, idGioco, password });

      btn.disabled = false;
      btn.textContent = testo;

      if (r.ok) {
        $('arAccId').value = '';
        $('arAccPassword').value = '';
        return entra(r.dati.utente);
      }
      // Account amministratore raggiunto dall'indirizzo normale: invece
      // di un errore incomprensibile, si scopre il campo che manca.
      if (r.dati.stato === 'serve-password') {
        vestiDaAdmin();
        $('arAccPassword').focus();
        esito(box, 'Questo account richiede la password del pannello.');
        return;
      }
      if (r.dati.stato === 'in-attesa') {
        return avviso('⏳', 'Richiesta ancora in attesa',
          'Il tuo account esiste ma non e stato ancora approvato. Ti avvisiamo appena un amministratore decide.');
      }
      if (r.dati.stato === 'rifiutato') {
        return avviso('⛔', 'Richiesta rifiutata',
          'Questo account non e stato abilitato. Se pensi ci sia un errore, scrivici sui social.');
      }
      esito(box, r.dati.errore || 'Accesso non riuscito.');
    });

    /* ---- registrazione ---- */

    $('arFormRegistra').addEventListener('submit', async e => {
      e.preventDefault();
      const btn = $('arRegInvia'), box = $('arRegEsito');
      const email = $('arRegEmail').value.trim();
      const idGioco = $('arRegId').value.trim();

      // Controlli anche qui, non per sicurezza ma per non far fare
      // un giro a vuoto al server su errori evidenti.
      if (!email)             { esito(box, 'Inserisci la tua email.'); return; }
      if (!piattaforma)       { esito(box, 'Scegli la piattaforma su cui giochi.'); return; }
      if (idGioco.length < 2) { esito(box, 'Inserisci il tuo ID di gioco.'); return; }

      btn.disabled = true;
      const testo = btn.textContent;
      btn.textContent = 'Invio…';
      esito(box, '');

      // Vuota per i membri: il server la esige solo se l'indirizzo e
      // quello dell'amministratore.
      const password = $('arRegPassword').value;

      const r = await api('registrati', { email, piattaforma, idGioco, password });

      btn.disabled = false;
      btn.textContent = testo;

      if (!r.ok) { esito(box, r.dati.errore || 'Registrazione non riuscita.'); return; }

      $('arFormRegistra').reset();
      piattaforma = '';
      [...$('arPiatt').children].forEach(b => b.setAttribute('aria-pressed', 'false'));
      $('arRegIdAiuto').textContent = '';

      // L'amministratore e gia dentro: il server gli ha dato la sessione.
      if (r.dati.utente && r.dati.utente.stato === 'approvato') return entra(r.dati.utente);

      avviso('📨', 'Richiesta inviata',
        'Un amministratore ha ricevuto la tua richiesta. Appena viene approvata potrai entrare con la tua email e il tuo ID di gioco.');
    });

    /* ---- dentro ---- */

    const ETICHETTA = {
      giocatore: 'Giocatore',
      capitano: 'Capitano',
      amministrazione: 'Amministrazione'
    };

    /* La scheda di bentornato. La foto arriva dalla rosa pubblica
       accostando l'ID di gioco al nick: nessun dato nuovo da tenere
       aggiornato in due posti, e chi entra si vede subito in faccia. */
    function vestiBentornato(utente) {
      const ritratto = $('arBentornato').querySelector('.ben-ritratto');

      $('benNick').textContent     = utente.idGioco;
      $('benIniziale').textContent = (utente.idGioco || '?').trim().charAt(0).toUpperCase();

      const targhe = $('benTarghe');
      targhe.textContent = '';
      const targa = (testo, acceso) => {
        const s = document.createElement('span');
        s.className = 'targa' + (acceso ? ' acc' : '');
        s.textContent = testo;
        targhe.appendChild(s);
      };

      rosaPronta.then(() => {
        const g = trovaGiocatore(utente.idGioco);

        if (g) {
          $('benFoto').style.backgroundImage = "url('./immagini/" + g.img + "')";
          ritratto.classList.add('con-foto');
          $('benEp').textContent = g.epiteto;
          targa(g.ruolo);
          $('benNota').hidden = true;
        } else {
          ritratto.classList.remove('con-foto');
          $('benFoto').style.backgroundImage = '';
          $('benEp').textContent = '';
          $('benNota').hidden = false;
          $('benNota').textContent =
            'Il tuo ID di gioco non compare fra quelli della rosa sul sito, ' +
            'quindi non ho una foto da metterti qui. Se dovrebbe esserci, dillo a un amministratore.';
        }

        const inc = utente.incarico || 'giocatore';
        if (inc !== 'giocatore') targa(ETICHETTA[inc], true);
        if (utente.ruolo === 'admin') targa('Amministratore', true);
        targa(utente.piattaforma);
      });
    }

    /* ---- tab interne ---- */

    const PANNELLI = ['convocazioni', 'profilo', 'gestione'];

    function pannello(quale) {
      PANNELLI.forEach(p => {
        const sez = $('pan-' + p);
        if (sez) sez.hidden = p !== quale;
      });
      document.querySelectorAll('.ar-sotto-voce').forEach(v => {
        const attiva = v.dataset.pannello === quale;
        v.classList.toggle('attiva', attiva);
        v.setAttribute('aria-selected', String(attiva));
      });
    }

    document.querySelectorAll('.ar-sotto-voce').forEach(voce => {
      voce.addEventListener('click', () => {
        pannello(voce.dataset.pannello);
        // La gestione accessi si ricarica ogni volta che la si apre:
        // le richieste arrivano mentre il pannello e chiuso.
        if (voce.dataset.pannello === 'gestione') caricaRichieste();
      });
    });

    function entra(utente) {
      ioSono = utente;
      $('arProfEmail').textContent    = utente.email;
      $('arProfPiatt').textContent    = utente.piattaforma;
      $('arProfId').textContent       = utente.idGioco;
      $('arProfRuolo').textContent    = utente.ruolo === 'admin' ? 'Amministratore' : 'Membro';
      $('arProfIncarico').textContent = ETICHETTA[utente.incarico || 'giocatore'];

      $('arVoceGestione').hidden = utente.ruolo !== 'admin';
      vestiBentornato(utente);
      schermata('arDentro');
      pannello('convocazioni');
      if (utente.ruolo === 'admin') caricaRichieste();
      convocazioni.avvia(utente);
    }

    $('arEsci').addEventListener('click', async () => {
      await api('esci', {});
      ioSono = null;
      convocazioni.chiudi();
      $('arFormAccedi').reset();
      schermata('arOspite');
    });

    /* ---- pannello amministratore ----
       Le righe si costruiscono con createElement e textContent: email e
       ID di gioco li scrive chi si registra, e con innerHTML basterebbe
       un ID fatto di tag per eseguire codice nel browser dell'admin. */

    function riga(utente, azioni, conIncarico) {
      const el = document.createElement('div');
      el.className = 'ar-voce';

      const info = document.createElement('div');
      info.className = 'ar-voce-info';

      const mail = document.createElement('b');
      mail.textContent = utente.email;

      const meta = document.createElement('span');
      const quando = new Date(utente.creato).toLocaleDateString('it-IT',
        { day: '2-digit', month: 'short', year: 'numeric' });
      meta.textContent = utente.piattaforma + ' · ' + utente.idGioco + ' · ' + quando;

      info.append(mail, meta);

      const gruppo = document.createElement('div');
      gruppo.className = 'ar-voce-azioni';

      /* L'incarico si cambia da un menu invece che da tre bottoni: le
         voci sono poche ma si escludono a vicenda, e un menu dice da
         solo qual e quella in vigore. Compare solo sugli approvati:
         nominare capitano qualcuno che non puo ancora entrare sarebbe
         una promessa a vuoto. */
      if (conIncarico) {
        const menu = document.createElement('select');
        menu.className = 'ar-incarico';
        menu.setAttribute('aria-label', 'Incarico di ' + utente.email);
        [['giocatore', 'Giocatore'],
         ['capitano', 'Capitano'],
         ['amministrazione', 'Amministrazione']].forEach(([v, t]) => {
          const o = document.createElement('option');
          o.value = v; o.textContent = t;
          o.selected = (utente.incarico || 'giocatore') === v;
          menu.appendChild(o);
        });
        menu.addEventListener('change', async () => {
          menu.disabled = true;
          const r = await api('incarico', { email: utente.email, incarico: menu.value });
          menu.disabled = false;
          if (!r.ok) {
            alert(r.dati.errore || 'Non sono riuscito a cambiare l\'incarico.');
            menu.value = utente.incarico || 'giocatore';
            return;
          }
          utente.incarico = menu.value;
          // Se l'admin ha cambiato il proprio incarico, la scheda di
          // bentornato e le convocazioni devono accorgersene subito.
          if (ioSono && utente.email === ioSono.email) {
            ioSono.incarico = menu.value;
            $('arProfIncarico').textContent = ETICHETTA[menu.value];
            vestiBentornato(ioSono);
            convocazioni.avvia(ioSono);
          }
        });
        gruppo.appendChild(menu);
      }

      azioni.forEach(([etichetta, esitoAzione, stile]) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'ar-mini' + (stile ? ' ' + stile : '');
        b.textContent = etichetta;
        b.addEventListener('click', () => decidi(utente.email, esitoAzione, b));
        gruppo.appendChild(b);
      });

      el.append(info, gruppo);
      return el;
    }

    function riempi(contenitore, utenti, azioni, vuoto, conIncarico) {
      contenitore.textContent = '';
      if (!utenti.length) {
        const p = document.createElement('p');
        p.className = 'ar-vuoto';
        p.textContent = vuoto;
        contenitore.appendChild(p);
        return;
      }
      utenti.forEach(u => contenitore.appendChild(riga(u, azioni, conIncarico)));
    }

    async function caricaRichieste() {
      const btn = $('arAggiorna');
      btn.disabled = true;
      const r = await api('richieste');
      btn.disabled = false;
      if (!r.ok) return;

      const { attesa, approvati, rifiutati } = r.dati;
      $('arContaAttesa').textContent     = attesa.length;
      $('arContaApprovati').textContent  = approvati.length;
      $('arContaRifiutati').textContent  = rifiutati.length;

      riempi($('arListaAttesa'), attesa,
        [['Approva', 'approva', 'si'], ['Rifiuta', 'rifiuta', 'no']],
        'Nessuna richiesta in attesa.');

      riempi($('arListaApprovati'), approvati,
        [['Revoca', 'rifiuta', 'no']],
        'Nessun membro approvato.', true);

      riempi($('arListaRifiutati'), rifiutati,
        [['Riammetti', 'approva', 'si'], ['Elimina', 'elimina', 'no']],
        'Nessuna richiesta rifiutata.');
    }

    async function decidi(email, esitoAzione, bottone) {
      if (esitoAzione === 'elimina' &&
          !confirm('Eliminare definitivamente l\'account di ' + email + '?')) return;
      bottone.disabled = true;
      const r = await api('decidi', { email, esito: esitoAzione });
      bottone.disabled = false;
      if (!r.ok) { alert(r.dati.errore || 'Operazione non riuscita.'); return; }
      caricaRichieste();
    }

    $('arAggiorna').addEventListener('click', caricaRichieste);

    /* ================= CONVOCAZIONI =================
       La prima tab interna dell'area. Tre mestieri in una schermata
       sola, perche sono la stessa cosa vista da altezze diverse:

         chiunque       dice presente o assente e vede chi c'e
         capitano       in piu sceglie i giorni di allenamento
         amministrazione stessa cosa del capitano
         admin          ha entrambe, piu la gestione accessi altrove

       Il calendario e il pezzo delicato: le date sono stringhe
       AAAA-MM-GG e i conti si fanno su un calendario UTC, mai con
       l'orologio del telefono. Un telefono col fuso sbagliato o in
       viaggio non deve poter spostare un allenamento di un giorno,
       e la data di "oggi" arriva comunque dal server. */

    const convocazioni = (function () {

      const INIZIALI = ['D', 'L', 'M', 'M', 'G', 'V', 'S'];
      const SETTIMANE = ['Questa settimana', 'La prossima', 'Fra due settimane',
                         'Fra tre settimane', 'Fra quattro settimane'];
      const GIORNI_NOME = ['domenica', 'lunedì', 'martedì', 'mercoledì',
                           'giovedì', 'venerdì', 'sabato'];
      const GIORNI_CORTI = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
      const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
                    'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

      let io = null;
      let oggi = '';
      let orizzonte = 35;
      let giorni = [];
      let scelti = new Set();
      let attivo = null;
      let chiavePush = '';
      let dispositivi = 0;    // quante iscrizioni ha il SERVER per me
      let diagnosi = null;    // solo per l'amministratore

      /* ---- conti sulle date ----
         Trattate come giorni di calendario e basta: si costruisce una
         data UTC dai tre numeri, si somma, si riprende la stringa. Nessun
         fuso di mezzo, quindi nessun 31 marzo che diventa 30. */

      function piu(data, n) {
        const [a, m, g] = data.split('-').map(Number);
        const d = new Date(Date.UTC(a, m - 1, g));
        d.setUTCDate(d.getUTCDate() + n);
        return d.toISOString().slice(0, 10);
      }
      function settimana(data) {
        const [a, m, g] = data.split('-').map(Number);
        return new Date(Date.UTC(a, m - 1, g)).getUTCDay();
      }
      const maiuscola = t => t.charAt(0).toUpperCase() + t.slice(1);
      const inLettere = d =>
        GIORNI_NOME[settimana(d)] + ' ' + Number(d.slice(8)) + ' ' + MESI[Number(d.slice(5, 7)) - 1];
      const cortissima = d => GIORNI_CORTI[settimana(d)] + ' ' + Number(d.slice(8));

      function vicinanza(d) {
        if (d === oggi) return 'Oggi';
        if (d === piu(oggi, 1)) return 'Domani';
        if (d === piu(oggi, 2)) return 'Dopodomani';
        return 'Prossimo allenamento';
      }

      /* ---- calendario del capitano ---- */

      function disegnaCalendario() {
        const box = $('convCalendario');
        box.textContent = '';

        // Si parte dal lunedi di questa settimana anche se e gia
        // giovedi: vedere la settimana intera aiuta a orientarsi, i
        // giorni passati restano li ma spenti.
        const lunedi = piu(oggi, -((settimana(oggi) + 6) % 7));
        const ultimo = piu(oggi, orizzonte);

        SETTIMANE.forEach((nome, s) => {
          const sett = document.createElement('div');
          sett.className = 'cal-sett';

          const eti = document.createElement('div');
          eti.className = 'cal-eti';
          eti.textContent = nome;

          const riga = document.createElement('div');
          riga.className = 'cal-riga';

          for (let g = 0; g < 7; g++) {
            const data = piu(lunedi, s * 7 + g);
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'cal-giorno' + (data === oggi ? ' oggi' : '');
            b.disabled = data < oggi || data > ultimo;
            b.setAttribute('aria-pressed', String(scelti.has(data)));
            b.setAttribute('aria-label', inLettere(data));

            const i = document.createElement('small');
            i.textContent = INIZIALI[settimana(data)];
            const n = document.createElement('b');
            n.textContent = Number(data.slice(8));
            b.append(i, n);

            b.addEventListener('click', () => {
              if (scelti.has(data)) scelti.delete(data); else scelti.add(data);
              b.setAttribute('aria-pressed', String(scelti.has(data)));
              esito($('convEsitoGiorni'), '');
            });

            riga.appendChild(b);
          }

          sett.append(eti, riga);
          box.appendChild(sett);
        });
      }

      $('convSalva').addEventListener('click', async () => {
        const btn = $('convSalva'), box = $('convEsitoGiorni');
        btn.disabled = true;
        const testo = btn.textContent;
        btn.textContent = 'Salvo…';

        const r = await apiConv('giorni', { giorni: [...scelti] });

        btn.disabled = false;
        btn.textContent = testo;

        if (!r.ok) { esito(box, r.dati.errore || 'Non sono riuscito a salvare.'); return; }

        giorni = r.dati.giorni;
        scelti = new Set(giorni);
        esito(box, giorni.length
          ? 'Calendario salvato: ' + giorni.length + (giorni.length === 1 ? ' allenamento.' : ' allenamenti.')
          : 'Calendario svuotato: nessun allenamento in programma.', true);

        disegnaGiorni();
        if (giorni.length) mostraGiorno(giorni.includes(attivo) ? attivo : giorni[0]);
        else svuotaGiornata();
      });

      /* ---- la striscia dei prossimi allenamenti ---- */

      function disegnaGiorni() {
        const box = $('convGiorni');
        box.textContent = '';
        giorni.slice(0, 10).forEach(d => {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'conv-chip';
          b.setAttribute('aria-pressed', String(d === attivo));
          b.textContent = d === oggi ? 'oggi' : (d === piu(oggi, 1) ? 'domani' : cortissima(d));
          b.addEventListener('click', () => mostraGiorno(d));
          box.appendChild(b);
        });
      }

      function segnaChip() {
        [...$('convGiorni').children].forEach((b, i) =>
          b.setAttribute('aria-pressed', String(giorni[i] === attivo)));
      }

      function svuotaGiornata() {
        attivo = null;
        $('convEtichetta').textContent = 'Allenamenti';
        $('convQuando').textContent = 'Nessun allenamento in calendario';
        $('convScelta').hidden = true;
        $('convConta').hidden = true;
        $('convElenco').textContent = '';
        esito($('convEsito'), io && io.convoca
          ? 'Scegli i giorni qui sopra e salva: da quel momento partono le notifiche.'
          : 'Quando il capitano fissa un allenamento lo trovi qui, e ti arriva una notifica.');
      }

      /* ---- una giornata ---- */

      async function mostraGiorno(data) {
        attivo = data;
        segnaChip();
        $('convEtichetta').textContent = vicinanza(data);
        $('convQuando').textContent = maiuscola(inLettere(data));
        $('convScelta').hidden = false;
        esito($('convEsito'), '');
        segnaScelta(null, true);

        const r = await apiConv('giorno?data=' + encodeURIComponent(data));
        // Nel frattempo si puo aver toccato un altro giorno: la
        // risposta vecchia non deve sovrascrivere quella nuova.
        if (!r.ok || attivo !== data) {
          if (!r.ok) esito($('convEsito'), r.dati.errore || 'Non riesco a leggere la giornata.');
          return;
        }

        const mia = (r.dati.elenco.find(v => v.io) || {}).stato || null;
        segnaScelta(mia, !r.dati.apribile);
        if (!r.dati.apribile)
          esito($('convEsito'), 'Questa giornata è chiusa: non si può più cambiare.');

        disegnaConta(r.dati.conta);
        disegnaElenco(r.dati.elenco);
      }

      /* Il conteggio si scrive a mano invece di stare fisso nel markup
         perche in italiano "1 assenti" non si puo leggere, e la voce a
         zero e rumore: si nasconde. */
      function disegnaConta(c) {
        const box = $('convConta');
        box.textContent = '';
        box.hidden = false;

        const voci = [
          ['si',   c.presenti, 'presente',  'presenti'],
          ['no',   c.assenti,  'assente',   'assenti'],
          ['zero', c.muti,     'non ha ancora risposto', 'non hanno ancora risposto']
        ].filter(v => v[1] > 0);

        if (!voci.length) {
          const p = document.createElement('span');
          p.textContent = 'Nessuno ha ancora risposto.';
          box.appendChild(p);
          return;
        }

        voci.forEach(([classe, n, uno, tanti]) => {
          const gruppo = document.createElement('span');
          gruppo.className = 'conv-voce';

          const pallino = document.createElement('span');
          pallino.className = 'conv-pallino ' + classe;

          const numero = document.createElement('b');
          numero.textContent = n;

          const parola = document.createElement('span');
          parola.textContent = ' ' + (n === 1 ? uno : tanti);

          gruppo.append(pallino, numero, parola);
          box.appendChild(gruppo);
        });
      }

      function segnaScelta(stato, bloccata) {
        $('convScelta').querySelectorAll('.conv-btn').forEach(b => {
          b.setAttribute('aria-pressed', String(b.dataset.risposta === stato));
          b.disabled = !!bloccata;
        });
      }

      /* La griglia delle facce. Le foto vengono dalla rosa pubblica;
         chi non ha ancora risposto resta in penombra, cosi il capitano
         capisce in un colpo d'occhio chi deve ancora sentire. */
      function disegnaElenco(voci) {
        const box = $('convElenco');
        const perQuale = attivo;
        box.textContent = '';

        rosaPronta.then(() => {
          if (attivo !== perQuale) return;

          voci.forEach(v => {
            const g = trovaGiocatore(v.idGioco);
            const stato = v.stato === 'presente' ? 'si' : (v.stato === 'assente' ? 'no' : 'zero');

            const tessera = document.createElement('div');
            tessera.className = 'conv-tessera ' + stato + (v.io ? ' io' : '');

            const avatar = document.createElement('div');
            avatar.className = 'conv-avatar' + (g ? ' con-foto' : '');

            if (g) {
              const foto = document.createElement('i');
              foto.style.backgroundImage = "url('./immagini/" + g.img + "')";
              avatar.appendChild(foto);
            }
            const iniziale = document.createElement('span');
            iniziale.textContent = (v.idGioco || '?').charAt(0).toUpperCase();
            avatar.appendChild(iniziale);

            if (v.stato) {
              const segno = document.createElement('em');
              segno.className = 'conv-segno ' + stato;
              segno.textContent = v.stato === 'presente' ? '✓' : '✕';
              segno.title = v.stato;
              avatar.appendChild(segno);
            }

            const nome = document.createElement('span');
            nome.className = 'conv-nome';
            nome.textContent = v.idGioco;

            tessera.append(avatar, nome);

            if (v.incarico && v.incarico !== 'giocatore') {
              const r = document.createElement('span');
              r.className = 'conv-ruolo';
              r.textContent = ETICHETTA[v.incarico];
              tessera.appendChild(r);
            }

            box.appendChild(tessera);
          });
        });
      }

      $('convScelta').addEventListener('click', async e => {
        const b = e.target.closest('.conv-btn');
        if (!b || !attivo || b.disabled) return;

        const scelta = b.dataset.risposta;
        // Si colora subito e si corregge dopo se il server dice di no:
        // su un telefono in corsa l'attesa di mezzo secondo sembra un
        // bottone che non ha funzionato, e si finisce per toccarlo due volte.
        segnaScelta(scelta, false);
        esito($('convEsito'), '');

        const quale = attivo;
        const r = await apiConv('rispondi', { data: quale, stato: scelta });
        if (!r.ok) {
          esito($('convEsito'), r.dati.errore || 'Non sono riuscito a registrare la risposta.');
          segnaScelta(null, false);
          return;
        }
        // La conferma si scrive DOPO il ricarico: mostraGiorno azzera il
        // messaggio, e scrivendola prima si vedrebbe sparire da sola.
        await mostraGiorno(quale);
        if (attivo === quale)
          esito($('convEsito'), scelta === 'presente' ? 'Segnato presente.' : 'Segnato assente.', true);
      });

      /* ---- notifiche del telefono ----
         Su iPhone Safari consegna le notifiche solo a un sito aggiunto
         alla schermata Home, e ignora i bottoni dentro la notifica: li
         il tocco apre il sito, gia sulla giornata giusta. Su Android
         funziona tutto, bottoni compresi. */

      const iPhone = () =>
        /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

      const inHome = () =>
        window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

      const supportate = () =>
        'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

      /* La chiave pubblica viaggia in base64url e il browser la vuole
         in byte: questa e la conversione, ed e sempre la stessa. */
      function daBase64(chiave) {
        const pieno = (chiave + '='.repeat((4 - chiave.length % 4) % 4))
          .replace(/-/g, '+').replace(/_/g, '/');
        const grezzo = atob(pieno);
        const byte = new Uint8Array(grezzo.length);
        for (let i = 0; i < grezzo.length; i++) byte[i] = grezzo.charCodeAt(i);
        return byte;
      }

      async function sottoscrizione() {
        if (!supportate()) return null;
        const reg = await navigator.serviceWorker.getRegistration();
        if (!reg) return null;
        return await reg.pushManager.getSubscription();
      }

      async function mostraStatoPush() {
        const attiva = !!(await sottoscrizione()) && Notification.permission === 'granted';
        $('pushStato').textContent = attiva ? 'attive' : 'spente';
        $('pushStato').classList.toggle('on', attiva);
        $('pushAccendi').hidden = attiva;
        $('pushSpegni').hidden = !attiva;
        /* Il bottone di prova compare quando il SERVER ha almeno
           un'iscrizione. E la distinzione che conta: il telefono puo
           credere di essere iscritto mentre al server non e arrivato
           niente, ed e proprio quel caso che va scoperto subito. */
        $('pushProva').hidden = dispositivi < 1;

        if (!supportate()) {
          $('pushAccendi').hidden = true;
          esito($('pushEsito'),
            'Questo browser non sa ricevere notifiche. Puoi comunque rispondere da questa pagina.');
        } else if (iPhone() && !inHome()) {
          esito($('pushEsito'),
            'Su iPhone le notifiche arrivano solo se il sito sta nella schermata Home: ' +
            'tocca Condividi, poi «Aggiungi alla schermata Home», riapri il sito da lì e torna qui.');
        } else if (Notification.permission === 'denied') {
          // Il bottone sparisce: una volta negato il permesso, il browser
          // non ripropone la domanda, e lasciarlo li vorrebbe dire offrire
          // un bottone che non puo funzionare.
          $('pushAccendi').hidden = true;
          esito($('pushEsito'),
            'Le notifiche sono bloccate per questo sito. Si riattivano dalle impostazioni del browser, ' +
            'alla voce dei permessi di monacishaolin.it.');
        }
      }

      $('pushAccendi').addEventListener('click', async () => {
        const box = $('pushEsito');
        const btn = $('pushAccendi');

        if (!supportate()) return mostraStatoPush();
        if (iPhone() && !inHome()) return mostraStatoPush();
        if (!chiavePush)
          return esito(box, 'Le notifiche non sono ancora configurate sul server: mancano le chiavi VAPID.');

        // Il permesso si chiede per primo e senza niente prima: Safari
        // lo concede solo se la domanda nasce dal tocco, e qualunque
        // attesa in mezzo fa perdere quel legame.
        let permesso;
        try { permesso = await Notification.requestPermission(); }
        catch { permesso = 'denied'; }

        if (permesso !== 'granted') {
          esito(box, 'Senza il permesso non posso avvisarti. Puoi sempre rispondere da qui.');
          return mostraStatoPush();
        }

        btn.disabled = true;
        const testo = btn.textContent;
        btn.textContent = 'Attivo…';

        try {
          const reg = await navigator.serviceWorker.register('/sw.js');
          await navigator.serviceWorker.ready;
          const sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: daBase64(chiavePush)
          });
          const r = await apiConv('push-iscrivi', { sottoscrizione: sub.toJSON() });
          if (!r.ok) throw new Error(r.dati.errore || 'rifiutata');
          esito(box, 'Fatto: ti avviso io nei giorni di allenamento.', true);
        } catch (e) {
          esito(box, 'Non sono riuscito ad attivarle su questo dispositivo. Riprova, o rispondi da qui.');
        }

        btn.disabled = false;
        btn.textContent = testo;
        mostraStatoPush();
      });

      $('pushProva').addEventListener('click', async () => {
        const btn = $('pushProva'), box = $('pushEsito');
        btn.disabled = true;
        const testo = btn.textContent;
        btn.textContent = 'Mando…';
        esito(box, '');

        const r = await apiConv('push-prova', {});

        btn.disabled = false;
        btn.textContent = testo;

        if (!r.ok) { esito(box, r.dati.errore || 'La prova non e partita.'); return; }

        // Zero partite con dispositivi iscritti vuol dire che il servizio
        // di Apple o Google ha rifiutato: e un'informazione, non un
        // dettaglio da nascondere dietro un "fatto".
        esito(box, r.dati.partite
          ? 'Partita verso ' + r.dati.partite +
            (r.dati.partite === 1 ? ' dispositivo.' : ' dispositivi.') +
            ' Se non arriva entro qualche secondo, il problema e nella consegna, non nel sito.'
          : 'Il server ha ' + r.dati.dispositivi + ' iscrizioni ma non e partita nessuna notifica: ' +
            'le iscrizioni sono scadute. Spegni e riattiva le notifiche.',
          !!r.dati.partite);
      });

      $('pushSpegni').addEventListener('click', async () => {
        const sub = await sottoscrizione();
        if (sub) {
          await apiConv('push-esci', { endpoint: sub.endpoint });
          await sub.unsubscribe().catch(() => {});
        }
        esito($('pushEsito'), 'Spente su questo dispositivo.', true);
        mostraStatoPush();
      });

      /* ---- diagnosi, solo per l'amministratore ----
         Risponde alla domanda che altrimenti costa sei ore di attesa:
         e rotto il server o il mio telefono? */

      function mostraDiagnosi() {
        const box = $('convDiagnosi');
        if (!diagnosi) { box.hidden = true; return; }
        box.hidden = false;

        const voci = $('convDiagnosiVoci');
        voci.textContent = '';

        const riga = (etichetta, valore, buono) => {
          const d = document.createElement('div');
          const dt = document.createElement('dt');
          dt.textContent = etichetta;
          const dd = document.createElement('dd');
          dd.textContent = valore;
          if (buono === true) dd.className = 'si';
          if (buono === false) dd.className = 'no';
          d.append(dt, dd);
          voci.appendChild(d);
        };

        const g = diagnosi.orologio;
        if (!g) {
          riga('Orologio', 'non ha mai girato — la funzione programmata non parte', false);
        } else {
          const quando = new Date(g.quando);
          const minutiFa = Math.round((Date.now() - quando.getTime()) / 60000);
          const fresco = minutiFa <= 65;
          riga('Ultimo giro',
            quando.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) +
            ' (' + (minutiFa < 1 ? 'adesso' : minutiFa + ' min fa') + ')',
            fresco);
          riga('Ha fatto', g.esito || '—');
        }

        riga('Chiavi notifiche', diagnosi.chiaviPush ? 'impostate' : 'MANCANTI', diagnosi.chiaviPush);

        /* Variabile per variabile, col nome esatto da cercare su
           Netlify. "Posta non configurata" e una diagnosi inutile
           quando le variabili sono cinque: si sa che manca qualcosa e
           non si sa cosa. */
        const p = diagnosi.posta || {};
        if (p.pronta) {
          riga('Posta', 'configurata', true);
        } else {
          riga('Posta', 'NON configurata — manca quanto segue:', false);
          ['EMAILJS_SERVICE_ID', 'EMAILJS_PUBLIC_KEY', 'EMAILJS_PRIVATE_KEY',
           'EMAILJS_TEMPLATE_CONVOCAZIONI', 'EMAILJS_TEMPLATE_ID'].forEach(nome => {
            riga(nome, p[nome] ? 'c’è' : 'MANCA', !!p[nome]);
          });
        }

        riga('Allenamenti in calendario', giorni.length ? giorni.join(', ') : 'nessuno', giorni.length > 0);
        riga('Tuoi dispositivi iscritti', String(dispositivi), dispositivi > 0);
      }

      $('riepilogoProva').addEventListener('click', async () => {
        const btn = $('riepilogoProva'), box = $('riepilogoEsito');
        btn.disabled = true;
        const testo = btn.textContent;
        btn.textContent = 'Mando…';
        esito(box, '');

        const r = await apiConv('riepilogo-prova', { data: attivo || oggi });

        btn.disabled = false;
        btn.textContent = testo;

        if (!r.ok) { esito(box, r.dati.errore || 'Non e partito.'); return; }
        esito(box, r.dati.partite
          ? 'Partito a ' + r.dati.partite + ' di ' + r.dati.destinatari + ': ' + r.dati.indirizzi.join(', ')
          : 'EmailJS ha rifiutato tutti gli invii: controlla il template e la chiave privata.',
          !!r.dati.partite);
      });

      /* ---- avvio e chiusura ---- */

      async function avvia(utente) {
        const r = await apiConv('stato');
        if (!r.ok) {
          esito($('convEsito'), r.dati.errore || 'Non riesco a leggere le convocazioni.');
          return;
        }

        io = r.dati.io;
        oggi = r.dati.oggi;
        giorni = r.dati.giorni;
        orizzonte = r.dati.orizzonte || 35;
        chiavePush = (r.dati.push && r.dati.push.chiave) || '';
        dispositivi = (r.dati.push && r.dati.push.attive) || 0;
        diagnosi = r.dati.diagnosi || null;

        $('convCapitano').hidden = !io.convoca;
        if (io.convoca) {
          scelti = new Set(giorni);
          $('convSaluto').textContent = io.incarico === 'capitano'
            ? 'Ciao capitano, quali giorni ci sarà allenamento?'
            : 'Quali giorni ci sarà allenamento?';
          disegnaCalendario();
        }

        disegnaGiorni();

        // Se si arriva da una notifica, l'indirizzo dice quale giornata
        // aprire: ?giorno=AAAA-MM-GG. E solo un suggerimento di
        // navigazione — non autentica niente e non salta nessun
        // controllo: chi apre quel link senza accesso vede il modulo.
        const daLink = new URLSearchParams(location.search).get('giorno');
        const scelto = (daLink && giorni.includes(daLink)) ? daLink : r.dati.prossimo;

        if (scelto) mostraGiorno(scelto);
        else svuotaGiornata();

        mostraStatoPush();
        mostraDiagnosi();
      }

      function chiudi() {
        io = null; giorni = []; scelti = new Set(); attivo = null;
        $('convCapitano').hidden = true;
        $('convGiorni').textContent = '';
        $('convElenco').textContent = '';
        $('convConta').hidden = true;
      }

      /* Tornando sul sito dopo aver risposto dalla notifica, la pagina
         ha in mano dati vecchi: si ricarica la giornata da sola. */
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && io && attivo) mostraGiorno(attivo);
      });

      return { avvia, chiudi };
    })();

    /* ---- avvio pigro ---- */

    document.addEventListener('area:aperta', async () => {
      if (avviata) return;
      avviata = true;
      if (modoAdmin()) vestiDaAdmin();
      const r = await api('sessione');
      if (r.ok && r.dati.utente) entra(r.dati.utente);
      else schermata('arOspite');
    });
  })();

  /* ---------- AVVIO -------------------------------------------- */

  const iniziale = (typeof window.__TAB_INIZIALE__ === 'string' && window.__TAB_INIZIALE__)
    || DA_PERCORSO[percorso()] || 'home';
  // la edge function comunica 'noi' per la rosa: allineo i nomi
  mostra(iniziale === 'noi' ? 'rosa' : (iniziale === 'trofei' ? 'albo' : iniziale), false);
  rivela();

})();
