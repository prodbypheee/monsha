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
    unisciti: '/unisciti-a-noi'
  };
  const DA_PERCORSO = {
    '/':               'home',
    '/noi':            'rosa',
    '/albo-doro':      'albo',
    '/albodoro':       'albo',
    '/unisciti-a-noi': 'unisciti',
    '/uniscitianoi':   'unisciti'
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

  fetch('./rosa.json')
    .then(r => r.json())
    .then(d => {
      giocatori = d.giocatori || [];
      disegnaFiltri();
      disegnaRosa();
    })
    .catch(() => {
      const box = document.getElementById('rosa');
      if (box) box.innerHTML = '<p class="sottotesto">Non riesco a caricare la rosa. Ricarica la pagina.</p>';
    });

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

  /* ---------- AVVIO -------------------------------------------- */

  const iniziale = (typeof window.__TAB_INIZIALE__ === 'string' && window.__TAB_INIZIALE__)
    || DA_PERCORSO[percorso()] || 'home';
  // la edge function comunica 'noi' per la rosa: allineo i nomi
  mostra(iniziale === 'noi' ? 'rosa' : (iniziale === 'trofei' ? 'albo' : iniziale), false);
  rivela();

})();
