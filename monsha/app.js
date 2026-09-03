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

  /* ---------- LA STORIA: LINEA TEMPORALE -----------------------
     I punti si costruiscono dalle tappe che stanno gia nel markup,
     leggendo il loro data-anno: gli anni non sono scritti due volte,
     quindi non possono discordare. Se JavaScript non gira, le tappe
     restano tutte visibili una sotto l'altra e la storia si legge
     lo stesso — e per questo che la classe che le nasconde la mette
     il codice, non il foglio di stile. */

  (function storia() {
    const linea = document.getElementById('storiaLinea');
    const box = document.getElementById('storiaTappe');
    if (!linea || !box) return;

    const tappe = [...box.querySelectorAll('.storia-tappa')];
    if (tappe.length < 2) return;

    function scegli(i) {
      tappe.forEach((t, k) => t.classList.toggle('attiva', k === i));
      [...linea.children].forEach((b, k) =>
        b.setAttribute('aria-selected', String(k === i)));
    }

    tappe.forEach((tappa, i) => {
      const anno = tappa.dataset.anno || '';
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'storia-punto';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(i === 0));
      b.setAttribute('aria-label', 'Il ' + anno);
      b.textContent = anno;
      b.addEventListener('click', () => scegli(i));
      // Frecce destra e sinistra: e una fila di punti, ci si aspetta
      // di poterla percorrere da tastiera.
      b.addEventListener('keydown', e => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        const dove = (i + (e.key === 'ArrowRight' ? 1 : -1) + tappe.length) % tappe.length;
        scegli(dove);
        linea.children[dove].focus();
      });
      linea.appendChild(b);
    });

    box.classList.add('pronte');
    scegli(0);
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
    if (!k) return null;
    /* Prima il nick, poi i nomi vecchi. L'ordine conta: se due schede
       si contendessero lo stesso nome, quella che ce l'ha come nick e
       quella giusta. */
    return giocatori.find(g => idPiatto(g.nick) === k)
        || giocatori.find(g => (g.altriId || []).some(a => idPiatto(a) === k))
        || null;
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

      btn.disabled = true;
      const testo = btn.textContent;
      btn.textContent = 'Invio in corso…';
      esito.textContent = '';

      /* Due strade verso la stessa notizia, e si prova prima la
         nostra: la mail puo finire nello spam o perdersi, l'archivio
         no. Se il salvataggio va storto si manda comunque la mail —
         una candidatura ricevita male e sempre meglio di una
         candidatura persa. */
      let salvata = false;
      try {
        const r = await fetch('/api/candidature/invia', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            id: dati.id, piattaforma: dati.piatt, ruoli: dati.ruoli,
            comp: dati.comp, club: dati.club, giorni: dati.giorni,
            telefono: dati.tel, note: dati.note
          })
        });
        salvata = r.ok;
      } catch { /* si prosegue con la mail */ }

      if (!window.emailjs) {
        btn.disabled = false;
        btn.textContent = testo;
        if (salvata) {
          esito.textContent = 'Candidatura inviata. Ti ricontattiamo noi.';
          esito.style.color = '#7fd6a0';
          btn.hidden = true;
        } else {
          esito.textContent = 'Invio non disponibile. Scrivici sui social.';
          esito.style.color = '#ff9a4d';
        }
        return;
      }

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
        // La mail non e partita, ma se la candidatura e nel nostro
        // archivio la persona non e persa: non la si manda via.
        if (salvata) {
          esito.textContent = 'Candidatura inviata. Ti ricontattiamo noi.';
          esito.style.color = '#7fd6a0';
          btn.hidden = true;
        } else {
          esito.textContent = 'Invio non riuscito. Riprova, o scrivici sui social.';
          esito.style.color = '#ff9a4d';
        }
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
        'Un amministratore ha ricevuto la tua richiesta. Da qui in poi ti riconosciamo: appena viene approvata entri da solo, senza rifare l’accesso.');
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

      /* Sotto il nome resta solo l'incarico: ruolo in campo,
         piattaforma e ID sono nella tab Profilo, e qui rubavano lo
         spazio ai due bottoni dell'allenamento. */
      const inc = utente.incarico || 'giocatore';
      if (inc !== 'giocatore') targa(ETICHETTA[inc], true);
      if (utente.ruolo === 'admin') targa('Amministratore', true);

      rosaPronta.then(() => {
        const g = trovaGiocatore(utente.idGioco);

        if (g) {
          $('benFoto').style.backgroundImage = "url('./immagini/" + g.img + "')";
          ritratto.classList.add('con-foto');
          $('benNota').hidden = true;
        } else {
          ritratto.classList.remove('con-foto');
          $('benFoto').style.backgroundImage = '';
          $('benNota').hidden = false;
          $('benNota').textContent =
            'Il tuo ID di gioco non compare fra quelli della rosa sul sito, ' +
            'quindi non ho una foto da metterti qui. Se dovrebbe esserci, dillo a un amministratore.';
        }
      });
    }

    /* ---- tab interne ---- */

    const PANNELLI = ['convocazioni', 'formazione', 'campionato', 'annunci', 'profilo', 'gestione'];

    function pannello(quale) {
      aperto = quale;
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
        // Ogni pannello si rilegge quando lo si apre: le cose
        // succedono mentre lo si teneva chiuso.
        rinfresca();
      });
    });

    /* ---- rinfresco ----------------------------------------------
       L'area riservata e roba viva: mentre uno la guarda, un altro
       risponde presente, un terzo scrive in bacheca, un quarto chiede
       di entrare. Finche non si rilegge, la pagina racconta com'era il
       mondo nell'istante in cui e stata aperta — ed e per questo che
       sembrava servisse chiudere e riaprire l'app per vedere le
       novita.

       Si rilegge in tre momenti: quando si apre un pannello, quando si
       torna sull'app dopo averla lasciata, e ogni mezzo minuto mentre
       la si tiene aperta.

       Si rilegge solo il pannello che si sta guardando. Leggerli tutti
       e quattro sarebbe lavoro buttato: gli altri tre li si rilegge
       comunque nel momento in cui li si apre.

       Le riletture automatiche sono silenziose — non spengono i
       bottoni "Aggiorna", non svuotano le liste per poi riempirle —
       perche una cosa che succede da sola non deve farsi notare. */

    let aperto = 'convocazioni';
    const OGNI_QUANTO = 30000;

    function rinfresca(zitto) {
      if (!ioSono) return;                                  // non e entrato nessuno
      if (document.hidden) return;                          // app in secondo piano
      if ($('arDentro').hidden) return;                     // non e la schermata di dentro
      const tab = document.getElementById('tab-area');
      if (tab && !tab.classList.contains('attiva')) return; // si sta guardando un'altra tab

      if (aperto === 'convocazioni')    convocazioni.ricarica();
      else if (aperto === 'formazione') formazione.ricarica();
      else if (aperto === 'campionato') campionato.apri(zitto);
      else if (aperto === 'annunci')    annunci.apri(zitto);
      else if (aperto === 'gestione')   { caricaRichieste(zitto); caricaCandidature(zitto); }
    }

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) rinfresca(true);
    });
    setInterval(() => rinfresca(true), OGNI_QUANTO);

    function entra(utente) {
      ioSono = utente;
      $('arProfEmail').textContent    = utente.email;
      $('arProfPiatt').textContent    = utente.piattaforma;
      $('arProfId').textContent       = utente.idGioco;
      $('arProfRuolo').textContent    = utente.ruolo === 'admin' ? 'Amministratore' : 'Membro';
      $('arProfIncarico').textContent = ETICHETTA[utente.incarico || 'giocatore'];

      /* La gestione la vede anche il capitano: e lui che fa entrare
         la gente e che legge le candidature dei provini. Gli incarichi
         e la cancellazione definitiva restano dell'amministratore, e
         infatti quei comandi sotto non gli compaiono nemmeno. */
      const gestisce = utente.ruolo === 'admin' || utente.incarico === 'capitano';
      $('arVoceGestione').hidden = !gestisce;
      $('arPannelloEti').textContent = utente.ruolo === 'admin'
        ? 'Pannello amministratore' : 'Pannello capitano';
      // L'introduzione spiega come si entra: a chi e gia dentro toglie
      // solo spazio in cima, e quello spazio serve ai due bottoni.
      $('arIntro').hidden = true;
      vestiBentornato(utente);
      schermata('arDentro');

      /* La notifica di un annuncio porta a ?tab=annunci: chi la tocca
         deve trovarsi davanti quello che ha appena letto, non le
         convocazioni. E solo un suggerimento su quale pannello aprire —
         non autentica niente e non salta nessun controllo. */
      const chiesta = new URLSearchParams(location.search).get('tab');
      /* La gestione si apre da un link solo a chi la puo vedere: la
         notifica di una candidatura ci porta dentro, ma a un
         giocatore quel pannello non esiste e mandarcelo lo
         lascerebbe davanti a una pagina vuota. */
      const ammessa = PANNELLI.includes(chiesta) && (chiesta !== 'gestione' || gestisce);
      const dove = ammessa ? chiesta : 'convocazioni';

      pannello(dove);
      if (dove === 'annunci') annunci.apri();

      if (gestisce) { caricaRichieste(); caricaCandidature(true); }
      convocazioni.avvia(utente);
    }

    $('arEsci').addEventListener('click', async () => {
      await api('esci', {});
      ioSono = null;
      // Chi esce torna a essere uno di fuori: l'introduzione riappare.
      $('arIntro').hidden = false;
      convocazioni.chiudi();
      annunci.chiudi();
      campionato.chiudi();
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

      /* Correggere l'ID di gioco. Lo scrive la persona quando si
         registra, e chi sbaglia una lettera se la porta dietro
         dappertutto: rosa, convocazioni, campo, mail.

         Chi e connesso NON viene buttato fuori: il gettone di sessione
         contiene l'email, non l'ID, e l'utente si rilegge per email a
         ogni richiesta. L'ID serve a entrare, non a restare dentro. */
      const soloAdmin = ioSono && ioSono.ruolo === 'admin';

      const idBtn = document.createElement('button');
      idBtn.type = 'button';
      idBtn.className = 'ar-mini';
      idBtn.textContent = 'Cambia ID';
      idBtn.addEventListener('click', async () => {
        const nuovo = prompt(
          'ID di gioco di ' + utente.email + '\n\n' +
          'Chi è connesso resta connesso: userà quello nuovo al prossimo accesso.',
          utente.idGioco);
        if (nuovo === null) return;

        const pulito = nuovo.trim();
        if (pulito === utente.idGioco) return;

        idBtn.disabled = true;
        const r = await api('id', { email: utente.email, idGioco: pulito });
        idBtn.disabled = false;

        if (!r.ok) { alert(r.dati.errore || 'Non sono riuscito a cambiarlo.'); return; }

        utente.idGioco = r.dati.utente.idGioco;
        meta.textContent = utente.piattaforma + ' · ' + utente.idGioco + ' · ' + quando;

        // Se l'admin ha corretto il proprio ID, la sua scheda di
        // bentornato e la sua foto devono aggiornarsi subito.
        if (ioSono && utente.email === ioSono.email) {
          ioSono.idGioco = utente.idGioco;
          $('arProfId').textContent = utente.idGioco;
          vestiBentornato(ioSono);
        }
      });
      gruppo.appendChild(idBtn);

      /* L'incarico si cambia da un menu invece che da tre bottoni: le
         voci sono poche ma si escludono a vicenda, e un menu dice da
         solo qual e quella in vigore. Compare solo sugli approvati:
         nominare capitano qualcuno che non puo ancora entrare sarebbe
         una promessa a vuoto. */
      if (conIncarico && soloAdmin) {
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

    async function caricaRichieste(zitto) {
      const btn = $('arAggiorna');
      if (!zitto) btn.disabled = true;
      const r = await api('richieste');
      if (!zitto) btn.disabled = false;
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
      /* Un approvato deve comparire subito fra i convocati: e la
         ragione per cui lo si approva. Le convocazioni le tiene in
         mano un altro pannello, che non sa niente di quel che e appena
         successo qui — glielo si dice. */
      convocazioni.ricarica();
    }

    $('arAggiorna').addEventListener('click', () => caricaRichieste());

    /* ---- candidature dei provini ----
       Le legge chi gestisce: qui dentro ci sono numeri di telefono di
       persone che non fanno parte del club, e non e roba da lasciare
       a chiunque abbia un accesso. */

    const CAMPI = [
      ['ruoli',  'Ruoli'],
      ['comp',   'Competizioni'],
      ['club',   'Club'],
      ['giorni', 'Giorni'],
      ['telefono', 'Telefono'],
      ['note',   'Note']
    ];

    async function caricaCandidature(zitto) {
      const r = await chiama('/api/candidature/elenco');
      if (!r.ok) {
        if (!zitto) esito($('candEsito'), r.dati.errore || 'Non riesco a leggere le candidature.');
        return;
      }

      const voci = r.dati.candidature || [];
      $('candConta').textContent = voci.length
        ? voci.length + (voci.length === 1 ? ' candidatura' : ' candidature')
        : 'nessuna';
      esito($('candEsito'), '');

      const box = $('candElenco');
      box.textContent = '';

      if (!voci.length) {
        const p = document.createElement('p');
        p.className = 'cand-vuoto';
        p.textContent = 'Ancora nessuna candidatura.';
        box.appendChild(p);
        return;
      }

      voci.forEach(v => box.appendChild(schedaCandidatura(v)));
    }

    /* Tutto con textContent: quello che c'e scritto qui dentro l'ha
       battuto uno sconosciuto dal modulo pubblico, ed e l'ultimo
       posto al mondo dove infilare dell'HTML. */
    function schedaCandidatura(v) {
      const d = document.createElement('div');
      d.className = 'cand-voce';

      const capo = document.createElement('div');
      capo.className = 'cand-capo';

      const id = document.createElement('span');
      id.className = 'cand-id';
      id.textContent = v.id;

      const piatt = document.createElement('span');
      piatt.className = 'cand-piatt';
      piatt.textContent = v.piattaforma;

      const quando = document.createElement('span');
      quando.className = 'cand-quando';
      quando.textContent = daQuando(v.quando);

      capo.append(id, piatt, quando);

      const campi = document.createElement('dl');
      campi.className = 'cand-campi';

      CAMPI.forEach(([chiave, eti]) => {
        const val = v[chiave];
        const testo = Array.isArray(val) ? val.join(', ') : (val || '');
        if (!testo) return;
        const riga = document.createElement('div');
        riga.className = 'cand-campo';
        const dt = document.createElement('dt');
        dt.textContent = eti;
        const dd = document.createElement('dd');
        if (chiave === 'note') dd.className = 'note';
        dd.textContent = testo;
        riga.append(dt, dd);
        campi.appendChild(riga);
      });

      const via = document.createElement('button');
      via.type = 'button';
      via.className = 'ar-mini cand-via';
      via.textContent = 'Elimina';
      via.addEventListener('click', async () => {
        if (!confirm('Eliminare la candidatura di ' + v.id + '?')) return;
        via.disabled = true;
        const r = await chiama('/api/candidature/elimina', { chiave: v.chiave });
        if (!r.ok) { via.disabled = false; alert(r.dati.errore || 'Non riuscito.'); return; }
        d.remove();
        caricaCandidature(true);
      });

      d.append(capo, campi, via);
      return d;
    }

    function daQuando(iso) {
      const min = Math.round((Date.now() - Date.parse(iso)) / 60000);
      if (!Number.isFinite(min)) return '';
      if (min < 60) return min < 2 ? 'adesso' : min + ' minuti fa';
      const ore = Math.round(min / 60);
      if (ore < 24) return ore === 1 ? 'un\'ora fa' : ore + ' ore fa';
      const gg = Math.round(ore / 24);
      if (gg < 30) return gg === 1 ? 'ieri' : gg + ' giorni fa';
      return new Date(iso).toLocaleDateString('it-IT',
        { day: 'numeric', month: 'long', year: 'numeric' });
    }

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

    /* ---- conti sulle date, in comune fra convocazioni e formazione ----
       Le date sono stringhe AAAA-MM-GG e i conti si fanno su un
       calendario UTC, mai con l'orologio del telefono: un telefono col
       fuso sbagliato o in viaggio non deve poter spostare un
       allenamento di un giorno. Stanno qui fuori e non dentro un
       modulo perche servono a due tab, e la stessa formula scritta due
       volte prima o poi diverge. */

    const GIORNI_NOME = ['domenica', 'lunedì', 'martedì', 'mercoledì',
                         'giovedì', 'venerdì', 'sabato'];
    const GIORNI_CORTI = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
    const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
                  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

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

    const convocazioni = (function () {

      const INIZIALI = ['D', 'L', 'M', 'M', 'G', 'V', 'S'];
      const SETTIMANE = ['Questa settimana', 'La prossima', 'Fra due settimane',
                         'Fra tre settimane', 'Fra quattro settimane'];

      let io = null;
      let oggi = '';
      let orizzonte = 35;
      let giorni = [];
      let scelti = new Set();
      let attivo = null;
      let chiavePush = '';
      /* Il giorno mostrato dalla scheda in cima. Non e per forza oggi:
         con le frecce si scorrono tutti gli allenamenti programmati e
         si puo rispondere in anticipo. */
      let sopra = null;

      /* Quando si potra risollecitare ciascuno, per ID di gioco
         appiattito. Sono istanti dell'orologio di QUESTO telefono,
         ricavati dai secondi che manda il server: se il telefono e
         sfasato si sbaglia di poco e per poco, perche a ogni rilettura
         della giornata arrivano i secondi giusti — e comunque la pausa
         vera la fa rispettare il server, non questo conto. */
      let scadenze = {};
      let bottoniSollecito = {};

      /* ---- a che ora arrivi ----
         L'ora scelta per ciascuna giornata, e la risposta che ho gia
         dato per ciascuna. La seconda serve perche cambiare l'ora dopo
         aver gia detto "ci sono" deve ri-registrarla subito: altrimenti
         il numero direbbe una cosa e l'archivio un'altra, e nell'elenco
         gli altri leggerebbero l'ora vecchia.

         Le regole per muovere le frecce sono le stesse del server,
         ripetute qui solo per far muovere i numeri. A decidere e il
         server: qualunque cosa gli arrivi, la riporta dentro i limiti. */
      const ORA_DEFAULT = '21:30';
      const ORA_PRIMA  = 21 * 60 + 30;
      const ORA_ULTIMA = 23 * 60 + 30;

      let oreScelte = {};
      let mioStato  = {};

      const OROLOGI = { convScelta: ['convOra', 'convOraNum'],
                        oggiScelta: ['oggiOra', 'oggiOraNum'] };

      const inMinuti = v => {
        const m = /^(\d{1,2}):(\d{2})$/.exec(String(v || ''));
        if (!m) return null;
        const ore = Number(m[1]), min = Number(m[2]);
        if (ore < 0 || ore > 23 || (min !== 0 && min !== 30)) return null;
        return ore * 60 + min;
      };
      const inOra = m =>
        String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');

      const oraDi = data => oreScelte[data] || ORA_DEFAULT;

      /* Ridipinge l'orologio di un contenitore: il numero e le due
         frecce, spente ai capi o quando la giornata e chiusa. */
      function pittaOrologio(idScelta) {
        const par = OROLOGI[idScelta];
        if (!par) return;
        const box = $(par[0]);
        const data = idScelta === 'convScelta' ? attivo : sopra;
        if (!data) return;

        const ora = oraDi(data);
        $(par[1]).textContent = ora;

        const m = inMinuti(ora);
        const chiusa = box.dataset.bloccata === '1';
        box.querySelectorAll('.oraz-fr').forEach(b => {
          const passo = Number(b.dataset.passo);
          b.disabled = chiusa ||
            (passo < 0 && m <= ORA_PRIMA) ||
            (passo > 0 && m >= ORA_ULTIMA);
        });
      }

      function vestiOra(data) {
        if (attivo === data) pittaOrologio('convScelta');
        if (sopra === data && !$('arOggi').hidden) pittaOrologio('oggiScelta');
      }

      function scorriOra(data, passo, cassetta) {
        const nuova = inOra(Math.min(ORA_ULTIMA,
          Math.max(ORA_PRIMA, inMinuti(oraDi(data)) + passo * 30)));
        if (nuova === oraDi(data)) return;

        oreScelte[data] = nuova;
        vestiOra(data);

        // Gia detto che ci sono: la nuova ora va registrata adesso.
        if (mioStato[data] === 'presente') rispondi(data, 'presente', cassetta);
      }

      $('convOra').addEventListener('click', e => {
        const b = e.target.closest('.oraz-fr');
        if (!b || b.disabled || !attivo) return;
        scorriOra(attivo, Number(b.dataset.passo), $('convEsito'));
      });

      $('oggiOra').addEventListener('click', e => {
        const b = e.target.closest('.oraz-fr');
        if (!b || b.disabled || !sopra) return;
        scorriOra(sopra, Number(b.dataset.passo), $('oggiEsito'));
      });
      /* Quel che ho appena risposto, per giornata. Serve solo finche
         il server non conferma la stessa cosa: e la rete di sicurezza
         contro una rilettura che arriva indietro. */
      const mieRisposte = {};

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

        // Il calendario e cambiato: anche il campo deve seguirlo,
        // altrimenti resta appeso a una giornata che non c'e piu.
        formazione.aggiorna(giorni, oggi, io);
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
        $('convSolleciti').hidden = true;
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

      /* Cambio di giornata: qui si azzera tutto e si aspetta, perche
         di quel giorno non sappiamo ancora niente. */
      async function mostraGiorno(data) {
        attivo = data;
        segnaChip();
        $('convEtichetta').textContent = vicinanza(data);
        $('convQuando').textContent = maiuscola(inLettere(data));
        $('convScelta').hidden = false;
        esito($('convEsito'), '');
        segnaScelta(null, true);
        await caricaGiornata(data, true);
      }

      /* Rilettura della stessa giornata. `toccaBottoni` esiste per un
         motivo preciso: dopo che hai premuto Presente, i due bottoni
         dicono gia la verita e non vanno rimessi a zero. Prima li
         spegneva e li disabilitava mentre il server rispondeva, e chi
         premeva in quel mezzo secondo trovava un bottone morto — da
         cui l'impressione di doverlo premere due volte. */
      async function caricaGiornata(data, toccaBottoni) {
        const r = await apiConv('giorno?data=' + encodeURIComponent(data));
        // Nel frattempo si puo aver toccato un altro giorno: la
        // risposta vecchia non deve sovrascrivere quella nuova.
        if (!r.ok || attivo !== data) {
          if (!r.ok) esito($('convEsito'), r.dati.errore || 'Non riesco a leggere la giornata.');
          return;
        }

        /* Rete di sicurezza: quel che ho appena scelto vale piu di
           quel che il server mi rimanda, finche i due non concordano.
           Serviva perche l'archivio poteva restituire il valore
           precedente per un istante, e si vedeva il bottone ASSENTE
           acceso e la propria faccia ancora con la spunta verde nella
           lista sotto. Appena il server concorda, l'eccezione cade. */
        const mia = r.dati.elenco.find(v => v.io) || {};
        mioStato[data] = mia.stato || null;
        // L'ora gia registrata vince su quella di partenza: chi torna
        // sulla pagina deve ritrovare l'ora che ha scelto, non le 21:30.
        if (mia.stato === 'presente' && mia.ora) oreScelte[data] = mia.ora;

        const miaSalvata = mieRisposte[data];
        const suaVersione = mia.stato || null;
        if (miaSalvata && suaVersione === miaSalvata) delete mieRisposte[data];

        const elenco = miaSalvata
          ? r.dati.elenco.map(v => (v.io ? { ...v, stato: miaSalvata } : v))
          : r.dati.elenco;

        if (toccaBottoni) {
          const mia = (elenco.find(v => v.io) || {}).stato || null;
          // Anche la scheda in cima, se e la stessa giornata.
          segnaOvunque(data, mia, !r.dati.apribile);
          if (!r.dati.apribile)
            esito($('convEsito'), 'Questa giornata è chiusa: non si può più cambiare.');
        }

        // I conteggi si ricavano dall'elenco appena corretto, non da
        // quelli del server: altrimenti direbbero un numero e le facce
        // sotto ne mostrerebbero un altro.
        disegnaConta({
          presenti: elenco.filter(v => v.stato === 'presente').length,
          assenti:  elenco.filter(v => v.stato === 'assente').length,
          muti:     elenco.filter(v => !v.stato).length
        });
        disegnaElenco(elenco);
        vestiOra(data);
        mostraSolleciti(r.dati, elenco);
      }

      /* ---- il colpetto sulla spalla ----
         In fondo alla tab, e solo per chi convoca: l'elenco di chi non
         ha ancora detto niente, con un bottone per persona.

         Uno alla volta e non "sollecita tutti", ed e la ragione per cui
         il richiamo automatico delle 17:00 non c'e piu: una notifica
         che arriva a venti telefoni si ignora, una persona che ti sta
         cercando no. La pausa di un quarto d'ora e per persona, non per
         chi preme: due capitani che sollecitano lo stesso giocatore a
         un minuto di distanza gli farebbero suonare il telefono due
         volte, che e la cosa che la pausa deve impedire. */

      function mostraSolleciti(dati, elenco) {
        const scheda = $('convSolleciti');

        // Niente allenamento o giornata chiusa: non c'e niente da
        // sollecitare, e la scheda sparisce invece di restare li vuota.
        if (!io || !io.convoca || !dati.allenamento || !dati.apribile) {
          scheda.hidden = true;
          return;
        }
        scheda.hidden = false;

        // I secondi del server diventano istanti locali. Si riparte
        // dalla risposta del server ogni volta: e lui che tiene il
        // conto, questo e solo il modo di mostrarlo.
        scadenze = {};
        Object.entries(dati.solleciti || {}).forEach(([k, s]) => {
          scadenze[k] = Date.now() + s * 1000;
        });

        const muti = elenco.filter(v => !v.stato);

        $('solQuanti').textContent = muti.length
          ? muti.length + (muti.length === 1 ? ' persona' : ' persone')
          : 'nessuno';
        $('solNota').textContent = muti.length
          ? 'Una persona alla volta. Dopo averne sollecitato uno, per quella persona si riparte fra quindici minuti.'
          : '';

        const box = $('solElenco');
        box.textContent = '';
        bottoniSollecito = {};

        if (!muti.length) {
          const p = document.createElement('p');
          p.className = 'sol-vuoto';
          p.textContent = 'Hanno risposto tutti.';
          box.appendChild(p);
          esito($('solEsito'), '');
          return;
        }

        rosaPronta.then(() => {
          box.textContent = '';

          muti.forEach(v => {
            const g = trovaGiocatore(v.idGioco);

            const riga = document.createElement('div');
            riga.className = 'sol-riga';

            const faccia = document.createElement('div');
            faccia.className = 'pres-faccia' + (g ? ' con-foto' : '');
            if (g) {
              const foto = document.createElement('i');
              foto.style.backgroundImage = "url('./immagini/" + g.img + "')";
              faccia.appendChild(foto);
            }
            const iniziale = document.createElement('span');
            iniziale.textContent = (v.idGioco || '?').charAt(0).toUpperCase();
            faccia.appendChild(iniziale);

            const nome = document.createElement('div');
            nome.className = 'sol-nome';
            nome.textContent = v.idGioco;

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'sol-btn';
            btn.addEventListener('click', () => sollecita(v.idGioco, btn));

            bottoniSollecito[idPiatto(v.idGioco)] = btn;
            riga.append(faccia, nome, btn);
            box.appendChild(riga);
          });

          battito();
        });
      }

      /* Aggiorna solo le scritte dei bottoni: si chiama ogni dieci
         secondi e non deve ridisegnare niente, altrimenti la lista
         sfarfalla sotto le dita. */
      function battito() {
        Object.entries(bottoniSollecito).forEach(([k, btn]) => {
          const manca = scadenze[k] ? scadenze[k] - Date.now() : 0;
          if (manca > 0) {
            const min = Math.ceil(manca / 60000);
            btn.disabled = true;
            btn.textContent = 'fra ' + min + ' min';
          } else {
            btn.disabled = false;
            btn.textContent = 'Sollecita';
          }
        });
      }
      setInterval(battito, 10000);

      async function sollecita(idGioco, btn) {
        const k = idPiatto(idGioco);
        btn.disabled = true;
        btn.textContent = 'Mando…';
        esito($('solEsito'), '');

        const r = await apiConv('sollecita', { data: attivo, idGioco });

        if (!r.ok) {
          // Se il server dice quanto manca, gli si crede: e lui che
          // tiene il conto vero.
          if (r.dati.attesa) scadenze[k] = Date.now() + r.dati.attesa * 1000;
          esito($('solEsito'), r.dati.errore || 'Non sono riuscito a sollecitare.');
          // Puo aver risposto proprio mentre guardavi l'elenco: allora
          // l'elenco e vecchio e va riletto.
          if (r.dati.risposto) caricaGiornata(attivo, true);
          else battito();
          return;
        }

        /* Zero notifiche partite non e un errore: vuol dire che quella
           persona non le ha accese. Va detto, perche il capitano deve
           sapere che quel telefono non ha suonato e che deve cercarla
           in un altro modo. E in quel caso la pausa non parte. */
        if (!r.dati.partite) {
          esito($('solEsito'), idGioco + ' non ha acceso le notifiche: il telefono non gli è suonato. Cercalo in un altro modo.');
          battito();
          return;
        }

        scadenze[k] = Date.now() + (r.dati.attesa || 900) * 1000;
        esito($('solEsito'), 'Fatto: ' + idGioco + ' è stato avvisato.', true);
        battito();
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

      /* I due bottoni esistono in due copie: quelli della scheda in
         cima, che riguardano sempre oggi, e quelli della giornata che
         si sta guardando. Quando sono la stessa giornata devono dire
         la stessa cosa, altrimenti uno dei due mente. */
      function segnaScelta(stato, bloccata, dove) {
        const box = dove || $('convScelta');
        box.querySelectorAll('.conv-btn').forEach(b => {
          b.setAttribute('aria-pressed', String(b.dataset.risposta === stato));
          b.disabled = !!bloccata;
        });

        /* L'orologio segue i due bottoni: se la giornata e chiusa si
           spegne con loro. Spento e non nascosto — sparire mentre si
           carica farebbe saltare la pagina sotto le dita. */
        const par = OROLOGI[box.id];
        if (par) {
          $(par[0]).dataset.bloccata = bloccata ? '1' : '';
          pittaOrologio(box.id);
        }
      }

      function segnaOvunque(data, stato, bloccata) {
        if (attivo === data) segnaScelta(stato, bloccata, $('convScelta'));
        if (sopra === data && !$('arOggi').hidden)
          segnaScelta(stato, bloccata, $('oggiScelta'));
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

            /* L'ora solo per chi c'e: "assente alle 21:30" non vuol
               dire niente. E sotto il nome, non accanto: la notizia e
               che c'e, l'ora e il dettaglio. */
            if (v.stato === 'presente' && v.ora) {
              const q = document.createElement('em');
              q.className = 'conv-ora';
              q.textContent = v.ora;
              nome.appendChild(q);
            }

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

      /* Una sola strada per rispondere, chiamata dai bottoni della
         scheda di oggi e da quelli della giornata: due copie della
         stessa procedura sarebbero due posti dove correggere un
         difetto, e uno dei due resterebbe indietro. */
      async function rispondi(data, scelta, cassetta) {
        // Si colora subito e si corregge dopo se il server dice di no:
        // su un telefono in corsa l'attesa di mezzo secondo sembra un
        // bottone che non ha funzionato, e si finisce per toccarlo due volte.
        segnaOvunque(data, scelta, false);
        esito(cassetta, '');

        const r = await apiConv('rispondi', {
          data, stato: scelta,
          // Solo quando serve: a un assente l'ora di arrivo non si chiede.
          ...(scelta === 'presente' ? { ora: oraDi(data) } : {})
        });
        if (!r.ok) {
          esito(cassetta, r.dati.errore || 'Non sono riuscito a registrare la risposta.');
          segnaOvunque(data, null, false);
          return;
        }

        mieRisposte[data] = scelta;
        mioStato[data] = scelta;

        // L'ora buona e quella che risponde il server, non quella che
        // gli abbiamo mandato: e lui che la riporta dentro i limiti.
        if (scelta === 'presente') { oreScelte[data] = r.dati.ora || oraDi(data); vestiOra(data); }

        esito(cassetta, scelta === 'presente'
          ? 'Segnato presente, arrivo alle ' + oraDi(data) + '.'
          : 'Segnato assente.', true);

        // Elenco e conteggi si aggiornano quando arrivano, senza
        // aspettarli e senza toccare i due bottoni: la risposta e gia
        // registrata, e rimetterli a zero sarebbe una bugia.
        if (attivo) caricaGiornata(attivo, false);
      }

      $('convScelta').addEventListener('click', e => {
        const b = e.target.closest('.conv-btn');
        if (!b || !attivo || b.disabled) return;
        rispondi(attivo, b.dataset.risposta, $('convEsito'));
      });

      $('oggiScelta').addEventListener('click', e => {
        const b = e.target.closest('.conv-btn');
        if (!b || !sopra || b.disabled) return;
        rispondi(sopra, b.dataset.risposta, $('oggiEsito'));
      });

      /* Le frecce scorrono gli allenamenti programmati. Si fermano ai
         due capi invece di girare in tondo: tornare al primo dopo
         l'ultimo fa perdere il filo di dove si e arrivati. */
      function scorriSopra(passo) {
        const dove = giorni[giorni.indexOf(sopra) + passo];
        if (dove) mostraSopra(dove);
      }

      $('oggiPrima').addEventListener('click', () => scorriSopra(-1));
      $('oggiDopo').addEventListener('click',  () => scorriSopra(1));

      /* Mostra una giornata nella scheda in cima: etichetta, data,
         frecce che si spengono ai capi, e la risposta gia data. */
      async function mostraSopra(data, zitto) {
        sopra = data;
        const i = giorni.indexOf(data);
        $('oggiPrima').disabled = i <= 0;
        $('oggiDopo').disabled  = i < 0 || i >= giorni.length - 1;

        $('oggiEtichetta').textContent = data === oggi
          ? 'Oggi si allena'
          : (data === piu(oggi, 1) ? 'Domani si allena' : 'Prossimo allenamento');
        $('oggiQuando').textContent = maiuscola(inLettere(data));
        esito($('oggiEsito'), '');
        // Cambiando giornata i bottoni si spengono perche di quel
        // giorno non sappiamo ancora niente. Nella rilettura della
        // STESSA giornata no: spegnerli ogni volta li farebbe
        // lampeggiare sotto le dita di chi sta per premerli.
        if (!zitto) segnaScelta(null, true, $('oggiScelta'));

        const r = await apiConv('giorno?data=' + encodeURIComponent(data));
        if (!r.ok || sopra !== data) return;

        const mio = r.dati.elenco.find(v => v.io) || {};
        mioStato[data] = mio.stato || null;
        if (mio.stato === 'presente' && mio.ora) oreScelte[data] = mio.ora;

        const mia = mieRisposte[data] || mio.stato || null;
        segnaScelta(mia, !r.dati.apribile, $('oggiScelta'));
        vestiOra(data);
        if (!r.dati.apribile)
          esito($('oggiEsito'), 'Questa giornata è chiusa: non si può più cambiare.');
      }

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
        // Una conferma prima di far vibrare venti telefoni. Su un
        // telefono un tocco per sbaglio e cosa di tutti i giorni, e
        // questa e una di quelle cose che non si annullano.
        if (!confirm('Mando una notifica di prova a TUTTI i membri con le notifiche accese. Procedo?'))
          return;

        const btn = $('pushProva'), box = $('riepilogoEsito');
        btn.disabled = true;
        const testo = btn.textContent;
        btn.textContent = 'Mando…';
        esito(box, '');

        const r = await apiConv('push-prova', {});

        btn.disabled = false;
        btn.textContent = testo;

        if (!r.ok) { esito(box, r.dati.errore || 'La prova non e partita.'); return; }

        /* Zero partite su N membri non vuol dire "errore": vuol dire
           che nessuno ha ancora acceso le notifiche. Sono due cose
           diverse e vanno dette diverse, altrimenti si cerca un guasto
           dove non c'e. */
        esito(box, r.dati.partite
          ? 'Partita verso ' + r.dati.partite +
            (r.dati.partite === 1 ? ' dispositivo' : ' dispositivi') +
            ' su ' + r.dati.membri + ' membri. Chi non la riceve non ha ancora acceso le notifiche.'
          : 'Nessuna notifica partita: su ' + r.dati.membri +
            ' membri, nessuno ha ancora acceso le notifiche sul proprio telefono.',
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

        // Quando EmailJS rifiuta, dice sempre perche. Si riporta la sua
        // frase invece di indovinare: "controlla il template e la chiave"
        // e un consiglio, "API calls are disabled for non-browser
        // applications" e la soluzione.
        esito(box, r.dati.partite
          ? 'Partito a ' + r.dati.partite + ' di ' + r.dati.destinatari + ': ' + r.dati.indirizzi.join(', ')
          : 'EmailJS ha rifiutato. Risposta testuale: ' + (r.dati.motivo || 'nessuna'),
          !!r.dati.partite);
      });

      /* ---- perche non e arrivata ----
         Quando una notifica non arriva le domande sono sempre le
         stesse quattro: oggi si allena? l'orologio ha girato? le
         chiavi ci sono? qualcuno le ha davvero accese? Questo bottone
         risponde a tutte e quattro invece di far tirare a indovinare.
         Non manda niente: guarda e riferisce. */

      $('diagnosi').addEventListener('click', async () => {
        const btn = $('diagnosi'), box = $('diagnosiEsito');
        btn.disabled = true;
        box.hidden = false;
        box.textContent = 'Guardo…';

        const r = await apiConv('diagnosi');
        btn.disabled = false;

        if (!r.ok) { box.textContent = r.dati.errore || 'Non riesco a leggere.'; return; }

        const d = r.dati;
        const si = v => v ? 'sì' : 'NO';
        const fasce = {
          mattina: 'buongiorno 8:30', pomeriggio: 'avviso 14:00',
          sera: 'ultima chiamata 18:00', riepilogo: 'mail 20:00'
        };

        const righe = [
          'Sul server sono le ' + String(d.adesso.ora).padStart(2, '0') + ':' +
            String(d.adesso.minuto).padStart(2, '0') + ' di ' + d.adesso.data + '.',
          '',
          'Oggi si allena:        ' + si(d.allenamentoOggi),
          'Prossimi allenamenti:  ' + (d.prossimiGiorni.length ? d.prossimiGiorni.join(', ') : 'nessuno in calendario'),
          '',
          'Oggi è partito:'
        ];

        Object.entries(fasce).forEach(([k, eti]) => {
          const q = d.inviate[k];
          righe.push('  ' + eti.padEnd(22) +
            (q ? 'sì, alle ' + new Date(q).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
               : 'no'));
        });

        righe.push('',
          'Membri approvati:      ' + d.membri,
          'Con notifiche accese:  ' + d.conNotifiche + ' (su ' + d.telefoni + ' dispositivi)',
          '',
          'Chiavi notifiche:      ' + si(d.configurato.push),
          'Posta:                 ' + si(d.configurato.posta),
          'Modello riepilogo:     ' + si(d.configurato.modelloRiepilogo));

        /* La riga che conta: invece di lasciare interpretare
           l'elenco, si dice qual e la causa piu probabile. */
        let verdetto;
        if (!d.allenamentoOggi) verdetto = 'Oggi non è giorno di allenamento: è normale che non sia arrivato niente.';
        else if (!d.configurato.push) verdetto = 'Mancano le chiavi VAPID sul server: nessuna notifica può partire.';
        else if (!d.conNotifiche) verdetto = 'Nessuno ha acceso le notifiche: non c’è nessun telefono da raggiungere.';
        else if (d.adesso.ora >= 9 && !d.inviate.mattina) verdetto = 'Le 8:30 sono passate e il buongiorno non risulta partito: l’orologio non ha girato.';
        else verdetto = 'Le fasce già passate risultano partite: se un telefono non ha suonato, il problema è su quel telefono.';

        righe.push('', verdetto);
        box.textContent = righe.join('\n');
      });

      /* Riempie solo i due bottoni in cima, senza toccare la giornata
         aperta sotto: serve quando le due non coincidono. */
      /* ---- chi c'e stato negli ultimi sette giorni ----
         Solo per chi convoca: e uno strumento di chi allena, non una
         graduatoria da appendere in bacheca.

         Se in quella settimana non si e allenato nessun giorno la
         scheda non compare affatto: "0 su 0" non e un'informazione, e
         un riquadro vuoto che sembra un guasto. */

      async function caricaPresenze() {
        if (!io || !io.convoca) { $('convPresenze').hidden = true; return; }

        const r = await apiConv('presenze');
        if (!r.ok) { $('convPresenze').hidden = true; return; }

        const quanti = (r.dati.allenamenti || []).length;
        if (!quanti) { $('convPresenze').hidden = true; return; }

        $('convPresenze').hidden = false;
        $('presQuanti').textContent = quanti + (quanti === 1 ? ' allenamento' : ' allenamenti');

        /* Si nominano i giorni in cui ci si e allenati davvero, non i
           due capi della finestra: "dal 23 al 29" quando in mezzo c'e
           stato un solo allenamento dice una cosa falsa. E col giorno
           della settimana solo quando e uno: "dal sabato 29 al sabato
           29" non si puo leggere. */
        const gg = r.dati.allenamenti;
        const breve = d => Number(d.slice(8)) + ' ' + MESI[Number(d.slice(5, 7)) - 1];
        $('presPeriodo').textContent = quanti === 1
          ? 'Un solo allenamento: ' + inLettere(gg[0]) + '.'
          : quanti + ' allenamenti, dal ' + breve(gg[0]) + ' al ' + breve(gg[gg.length - 1]) + '.';

        const box = $('presElenco');
        box.textContent = '';

        rosaPronta.then(() => {
          box.textContent = '';

          (r.dati.righe || []).forEach(v => {
            const g = trovaGiocatore(v.idGioco);

            const riga = document.createElement('div');
            riga.className = 'pres-riga' +
              (v.presenti === quanti ? ' pieno' : '') +
              (v.presenti === 0 ? ' zero' : '');

            const faccia = document.createElement('div');
            faccia.className = 'pres-faccia' + (g ? ' con-foto' : '');
            if (g) {
              const foto = document.createElement('i');
              foto.style.backgroundImage = "url('./immagini/" + g.img + "')";
              faccia.appendChild(foto);
            }
            const iniziale = document.createElement('span');
            iniziale.textContent = (v.idGioco || '?').charAt(0).toUpperCase();
            faccia.appendChild(iniziale);

            const nome = document.createElement('div');
            nome.className = 'pres-nome';
            nome.textContent = v.idGioco;

            const conto = document.createElement('div');
            conto.className = 'pres-conto';
            conto.textContent = v.presenti + ' su ' + quanti;

            /* Assenze e silenzi si distinguono: chi ha detto "non ci
               sono" ha fatto la sua parte, chi non ha risposto no, e
               per un capitano sono due cose diverse. */
            const pezzi = [];
            if (v.assenti) pezzi.push(v.assenti + (v.assenti === 1 ? ' assenza' : ' assenze'));
            if (v.muti) pezzi.push(v.muti === 1 ? '1 senza risposta' : v.muti + ' senza risposta');
            if (pezzi.length) {
              const sotto = document.createElement('span');
              sotto.className = 'pres-dettaglio';
              sotto.textContent = pezzi.join(' · ');
              conto.appendChild(sotto);
            }

            riga.append(faccia, nome, conto);
            box.appendChild(riga);
          });
        });
      }

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

        /* La scheda in cima: c'e solo se oggi si allena, ed e la prima
           cosa che si vede. Chi apre da una notifica ha un gesto solo
           da fare e non deve andarselo a cercare piu in basso. */
        /* La scheda in cima c'e appena esiste un allenamento in
           calendario, non solo se e oggi: si puo rispondere in
           anticipo per tutti quelli programmati, scorrendoli con le
           frecce. Si apre su oggi se oggi si allena, altrimenti sul
           primo che viene. */
        $('arOggi').hidden = !giorni.length;

        if (scelto) mostraGiorno(scelto);
        else svuotaGiornata();

        if (giorni.length) mostraSopra(giorni.includes(oggi) ? oggi : giorni[0]);
        else sopra = null;

        mostraStatoPush();

        // I due bottoni di prova raggiungono persone vere: li vede
        // solo l'amministratore.
        $('convProve').hidden = io.ruolo !== 'admin';

        // I giorni li passiamo alla formazione invece di farglieli
        // richiedere: e la stessa risposta del server, appena letta.
        formazione.aggiorna(giorni, oggi, io);

        caricaPresenze();
      }

      function chiudi() {
        formazione.chiudi();
        $('arOggi').hidden = true;
        $('convPresenze').hidden = true;
        $('convSolleciti').hidden = true;
        scadenze = {}; bottoniSollecito = {};
        oreScelte = {}; mioStato = {};
        sopra = null;
        io = null; giorni = []; scelti = new Set(); attivo = null;
        $('convCapitano').hidden = true;
        $('convGiorni').textContent = '';
        $('convElenco').textContent = '';
        $('convConta').hidden = true;
      }

      /* ---- rilettura ----
         Tutto quello che avvia() legge dal server puo essere cambiato
         mentre si guardava altro: un nuovo membro approvato, un
         allenamento aggiunto dal capitano, dieci risposte arrivate.
         Qui si rilegge, ma restando dov'eravamo: stessa giornata
         aperta, stessa scheda in cima, e nessun bottone che si spegne
         per un istante. Un aggiornamento che si fa notare e peggio di
         uno in ritardo. */
      async function ricarica() {
        if (!io) return;
        const r = await apiConv('stato');
        if (!r.ok) return;

        /* Il capitano puo avere giorni segnati e non ancora salvati:
           ridisegnargli il calendario glieli cancellerebbe sotto le
           dita. Si guarda prima di sovrascrivere `giorni`. */
        const staScegliendo = io.convoca &&
          (scelti.size !== giorni.length || giorni.some(g => !scelti.has(g)));

        io = r.dati.io;
        oggi = r.dati.oggi;
        giorni = r.dati.giorni;

        $('convCapitano').hidden = !io.convoca;
        if (io.convoca && !staScegliendo) { scelti = new Set(giorni); disegnaCalendario(); }

        disegnaGiorni();
        $('arOggi').hidden = !giorni.length;

        // Se la giornata aperta esiste ancora si rilegge e basta; solo
        // se e sparita si va da un'altra parte.
        if (attivo && giorni.includes(attivo)) caricaGiornata(attivo, true);
        else if (r.dati.prossimo) mostraGiorno(r.dati.prossimo);
        else svuotaGiornata();

        if (sopra && giorni.includes(sopra)) mostraSopra(sopra, true);
        else if (giorni.length) mostraSopra(giorni.includes(oggi) ? oggi : giorni[0]);
        else sopra = null;

        caricaPresenze();
      }

      return { avvia, chiudi, ricarica };
    })();


    /* ================= FORMAZIONE =================
       Undici caselle su un campo, una formazione per giornata.

       Chi puo convocare schiera, tutti gli altri guardano: la stessa
       divisione della tab convocazioni, e per la stessa ragione — la
       squadra la mette in campo chi la allena.

       Due regole, e sono di natura diversa:

         in campo va solo chi ha segnato PRESENTE quel giorno
             questa la fa rispettare il server, perche riguarda i dati;

         nelle caselle di difesa vanno difensori, a centrocampo
         centrocampisti ed esterni, in attacco attaccanti
             questa e una regola di calcio: il sito propone soltanto
             chi puo starci, cosi non c'e nemmeno modo di sbagliare.

       Gli Icons restano fuori: non appartengono a nessun reparto
       schierabile, quindi non compaiono in nessuna lista. */

    const formazione = (function () {

      let io = null;
      let giorni = [];
      let oggi = '';
      let attivo = null;

      let caselle = [];
      let schieramento = {};
      let presenti = [];
      let modificabile = false;
      let apertaSu = null;      // la casella che il foglio sta compilando
      /* Vero quando il campo e stato toccato e non ancora salvato. Serve
         a non ricaricare la giornata da sotto le mani a chi sta
         schierando: rileggere dal server cancellerebbe il suo lavoro. */
      let sporco = false;

      const REPARTO_ETICHETTA = {
        portieri: 'un portiere',
        difensori: 'un difensore',
        centrocampisti: 'un centrocampista o un esterno',
        attaccanti: 'un attaccante'
      };

      /* ---- le partite della serata ----
         La formazione e sempre e solo quella di OGGI: preparare in
         anticipo il campo di giovedi non serviva a nessuno, perche chi
         c'e lo si sa la sera stessa.

         In compenso una serata sono piu partite, e ognuna vuole la
         sua formazione: tre caselle, che si azzerano da sole al
         prossimo allenamento perche vivono dentro la data. */

      let partita = 1;
      let quantePartite = 3;
      let orari = {};

      function disegnaPartite() {
        const box = $('formPartite');
        box.textContent = '';
        for (let n = 1; n <= quantePartite; n++) {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'conv-chip';
          b.setAttribute('aria-pressed', String(n === partita));
          b.textContent = 'Partita ' + n;
          b.addEventListener('click', () => vaiAlla(n));
          box.appendChild(b);
        }
      }

      function segnaChip() {
        [...$('formPartite').children].forEach((b, i) =>
          b.setAttribute('aria-pressed', String(i + 1 === partita)));
      }

      /* Cambiare partita butta via quello che non e stato salvato:
         meglio chiederlo prima che scoprirlo dopo. */
      function vaiAlla(n) {
        if (n === partita) return;
        if (sporco && !confirm('La formazione della partita ' + partita +
            ' non è salvata: cambiando la perdi. Continuare?')) return;
        mostra(n);
      }

      /* ---- il campo ---- */

      function disegnaCampo() {
        const box = $('formCaselle');
        box.textContent = '';

        rosaPronta.then(() => {
          box.textContent = '';

          caselle.forEach(c => {
            const chi = schieramento[c.id] || null;
            const g = chi ? trovaGiocatore(chi) : null;

            const el = document.createElement(modificabile ? 'button' : 'div');
            if (modificabile) {
              el.type = 'button';
              el.addEventListener('click', () => apriScelta(c));
            }
            el.className = 'casella' + (chi ? ' piena' : '') + (modificabile ? ' tocca' : '');
            el.dataset.casella = c.id;
            el.style.left = c.x + '%';
            el.style.top  = c.y + '%';
            /* Si prende e si trascina: su un'altra casella per
               scambiare i due, sulla panchina per farlo uscire. */
            if (modificabile && chi)
              el.addEventListener('pointerdown', e => iniziaPresa(e, c.id, chi));
            el.setAttribute('aria-label',
              c.eti + (chi ? ': ' + chi : ': vuoto') + (modificabile ? ' — tocca per cambiare' : ''));

            const cerchio = document.createElement('span');
            cerchio.className = 'casella-cerchio';

            if (g) {
              const foto = document.createElement('i');
              foto.style.backgroundImage = "url('./immagini/" + g.img + "')";
              cerchio.appendChild(foto);
            }
            const sigla = document.createElement('span');
            sigla.className = 'casella-sigla';
            sigla.textContent = chi && !g ? (chi.charAt(0).toUpperCase()) : c.eti;
            cerchio.appendChild(sigla);

            const nome = document.createElement('span');
            nome.className = 'casella-nome';
            if (chi) {
              const ruolo = document.createElement('b');
              ruolo.textContent = c.eti;
              nome.append(ruolo, document.createTextNode(chi));

              /* Chi entra tardi lo si vede sulla casella: quel posto,
                 per la prima mezz'ora, e scoperto, ed e una cosa da
                 sapere guardando il campo, non aprendo un elenco. */
              const tardi = orari[idPiatto(chi)];
              if (tardi) {
                const q = document.createElement('em');
                q.className = 'casella-tardi';
                q.textContent = 'dalle ' + tardi;
                nome.appendChild(q);
              }
            }

            el.append(cerchio, nome);
            box.appendChild(el);
          });

          disegnaPanchina();
        });
      }

      /* La panchina: chi ha segnato presente e non e ancora finito in
         nessuna casella. Non e l'elenco degli assenti — quelli stanno
         nella tab convocazioni — ma la scorta che il capitano ha
         ancora in mano mentre schiera. */
      function disegnaPanchina() {
        const box = $('formPanchinaElenco');
        const riquadro = $('formPanchina');
        box.textContent = '';

        const inCampo = new Set(
          Object.values(schieramento).map(v => String(v).toLowerCase()));
        const fuori = presenti.filter(id => !inCampo.has(String(id).toLowerCase()));

        $('formPanchinaConta').textContent = fuori.length;

        if (!fuori.length) {
          riquadro.hidden = !presenti.length;
          if (presenti.length) {
            const p = document.createElement('p');
            p.className = 'ar-vuoto';
            p.textContent = 'Nessuno: sono tutti in campo.';
            box.appendChild(p);
          }
          return;
        }

        riquadro.hidden = false;

        fuori.forEach(id => {
          const g = trovaGiocatore(id);

          const t = document.createElement('div');
          t.className = 'conv-tessera' + (modificabile ? ' prendibile' : '');
          // Dalla panchina si trascina direttamente in campo.
          if (modificabile)
            t.addEventListener('pointerdown', e => iniziaPresa(e, 'panchina', id));

          const avatar = document.createElement('div');
          avatar.className = 'conv-avatar' + (g ? ' con-foto' : '');
          if (g) {
            const foto = document.createElement('i');
            foto.style.backgroundImage = "url('./immagini/" + g.img + "')";
            avatar.appendChild(foto);
          }
          const iniziale = document.createElement('span');
          iniziale.textContent = id.charAt(0).toUpperCase();
          avatar.appendChild(iniziale);

          const nome = document.createElement('span');
          nome.className = 'conv-nome';
          nome.textContent = id;

          // L'ora serve gia qui: si sceglie chi schierare prima di
          // schierarlo, e sapere che uno arriva alle 22:30 cambia la
          // scelta.
          const tardi = orari[idPiatto(id)];
          if (tardi) {
            const q = document.createElement('em');
            q.className = 'tardi';
            q.textContent = tardi;
            nome.appendChild(q);
          }

          t.append(avatar, nome);

          if (g) {
            const r = document.createElement('span');
            r.className = 'conv-ruolo';
            r.textContent = g.ruolo;
            t.appendChild(r);
          }

          box.appendChild(t);
        });
      }

      /* ---- chi puo stare in una casella ----
         Presente quel giorno, non gia schierato altrove, e del
         reparto giusto. Chi non e nella rosa del sito non ha un
         reparto: lo si accetta ovunque, perche non poterlo schierare
         sarebbe peggio che schierarlo nel posto sbagliato. */

      function occupatiTranne(c) {
        return new Set(
          Object.entries(schieramento)
            .filter(([k]) => k !== c.id)
            .map(([, v]) => String(v).toLowerCase()));
      }

      /* Chi puo stare in una casella: TUTTI i presenti non gia
         schierati altrove. Il reparto non vieta piu niente — decide
         solo l'ordine. Prima quelli del ruolo giusto, poi gli altri
         sotto una riga che lo dice: il capitano trova subito la scelta
         ovvia e non gli e impedita quella strana.

         Chi non e nella rosa del sito non ha un reparto e finisce fra
         i consigliati di ogni casella: di lui non sappiamo niente,
         quindi non c'e ragione di metterlo in coda da nessuna parte. */
      function candidati(c) {
        const occupati = occupatiTranne(c);
        const liberi = presenti.filter(id => !occupati.has(String(id).toLowerCase()));

        const suo = id => {
          const g = trovaGiocatore(id);
          return !g || g.reparto === c.reparto;
        };

        return { consigliati: liberi.filter(suo), altri: liberi.filter(id => !suo(id)) };
      }


      /* ---- trascinare ----
         Il drag&drop nativo del browser sul telefono non esiste: e
         fatto per il mouse e su touch semplicemente non parte. Qui si
         usano i Pointer Events, che parlano la stessa lingua per dito
         e mouse, e ci si costruisce sopra il minimo indispensabile:
         un fantasma che segue il dito, e all'arrivo si guarda cosa c'e
         sotto con elementFromPoint.

         Il gesto comincia solo dopo qualche pixel di movimento: senza
         quella soglia un tocco fermo verrebbe scambiato per un
         trascinamento, e la scelta a tocco — che resta, ed e come si
         fa da tastiera — non funzionerebbe piu. */

      const SOGLIA = 8;   // pixel prima di considerarlo un trascinamento

      let presa = null;   // { da, id, x0, y0, fantasma, partito }

      function fantasmaDi(id) {
        const g = trovaGiocatore(id);
        const f = document.createElement('div');
        f.className = 'trascinato';
        if (g) f.style.backgroundImage = "url('./immagini/" + g.img + "')";
        else f.textContent = (id || '?').charAt(0).toUpperCase();
        document.body.appendChild(f);
        return f;
      }

      function muoviFantasma(e) {
        presa.fantasma.style.left = e.clientX + 'px';
        presa.fantasma.style.top  = e.clientY + 'px';

        // Evidenzia la casella sotto il dito, cosi si sa dove si molla.
        const sotto = bersaglio(e, presa.fantasma);
        document.querySelectorAll('.casella.sotto-mira')
          .forEach(n => n.classList.remove('sotto-mira'));
        if (sotto && sotto.dataset) sotto.classList.add('sotto-mira');
      }

      /* Cosa c'e sotto il dito. Il fantasma va nascosto un istante,
         altrimenti elementFromPoint trova sempre e solo lui. */
      function bersaglio(e, fantasma) {
        fantasma.style.display = 'none';
        const el = document.elementFromPoint(e.clientX, e.clientY);
        fantasma.style.display = '';
        if (!el) return null;
        return el.closest('.casella') || el.closest('#formPanchina');
      }

      function iniziaPresa(e, da, id) {
        if (!modificabile || !id) return;
        // Solo il tasto sinistro del mouse; col dito non c'e questione.
        if (e.button !== undefined && e.button !== 0) return;
        presa = { da, id, x0: e.clientX, y0: e.clientY, fantasma: null, partito: false };
        e.target.setPointerCapture && e.target.setPointerCapture(e.pointerId);
        presa.bersagliato = e.target;
      }

      document.addEventListener('pointermove', e => {
        if (!presa) return;

        if (!presa.partito) {
          const quanto = Math.hypot(e.clientX - presa.x0, e.clientY - presa.y0);
          if (quanto < SOGLIA) return;
          presa.partito = true;
          presa.fantasma = fantasmaDi(presa.id);
          document.body.classList.add('sta-trascinando');
        }

        // Da qui in poi il dito sta trascinando, non scorrendo.
        e.preventDefault();
        muoviFantasma(e);
      }, { passive: false });

      document.addEventListener('pointerup', e => {
        if (!presa) return;
        const g = presa;
        presa = null;

        if (!g.partito) return;   // era un tocco: se ne occupa il click

        const sotto = bersaglio(e, g.fantasma);
        g.fantasma.remove();
        document.body.classList.remove('sta-trascinando');
        document.querySelectorAll('.casella.sotto-mira')
          .forEach(n => n.classList.remove('sotto-mira'));

        molla(g, sotto);
      });

      document.addEventListener('pointercancel', () => {
        if (presa && presa.fantasma) presa.fantasma.remove();
        document.body.classList.remove('sta-trascinando');
        document.querySelectorAll('.casella.sotto-mira')
          .forEach(n => n.classList.remove('sotto-mira'));
        presa = null;
      });

      /* Dove e finito il giocatore trascinato.

         panchina -> casella   entra in campo, e chi c'era torna fuori
         casella  -> casella   si scambiano di posto
         casella  -> panchina  esce dal campo
         altrove               non succede niente */
      function molla(g, sotto) {
        if (!sotto) return;

        const inPanchina = sotto.id === 'formPanchina' || sotto.closest('#formPanchina');
        const casella = sotto.classList && sotto.classList.contains('casella') ? sotto : null;

        if (inPanchina) {
          if (g.da === 'panchina') return;          // era gia fuori
          delete schieramento[g.da];
        } else if (casella) {
          const dove = casella.dataset.casella;
          if (!dove) return;

          if (g.da === 'panchina') {
            schieramento[dove] = g.id;
          } else {
            if (g.da === dove) return;
            // Scambio: chi stava li va dove stava l'altro.
            const altro = schieramento[dove];
            schieramento[dove] = g.id;
            if (altro) schieramento[g.da] = altro; else delete schieramento[g.da];
          }
        } else {
          return;
        }

        disegnaCampo();
        sporco = true;
        esito($('formEsito'), 'Modifica non ancora salvata.', false);
      }

      /* ---- il foglio di scelta ---- */

      function apriScelta(c) {
        apertaSu = c;
        $('sceltaRuolo').textContent = c.eti;
        $('sceltaTit').textContent = 'Chi ci metti?';
        $('sceltaAiuto').textContent =
          'Qui di solito ci va ' + (REPARTO_ETICHETTA[c.reparto] || 'un giocatore') +
          ', ma puoi metterci chiunque sia presente.';

        const elenco = $('sceltaElenco');
        elenco.textContent = '';

        rosaPronta.then(() => {
          const { consigliati, altri } = candidati(c);

          if (!consigliati.length && !altri.length) {
            const p = document.createElement('p');
            p.className = 'scelta-vuoto';
            p.textContent = presenti.length
              ? 'Sono già tutti in campo: in panchina non è rimasto nessuno.'
              : 'Per questa giornata non ha ancora segnato presente nessuno.';
            elenco.appendChild(p);
          }

          // Prima la voce per svuotare, se c'e gia qualcuno.
          if (schieramento[c.id]) elenco.appendChild(tessera(null, c));
          consigliati.forEach(id => elenco.appendChild(tessera(id, c)));

          /* Gli altri reparti restano disponibili, sotto una riga che
             dice cosa sono: la scelta ovvia si trova per prima, quella
             insolita non e vietata. */
          if (altri.length) {
            const riga = document.createElement('div');
            riga.className = 'scelta-altri';
            riga.textContent = 'Da altri reparti';
            elenco.appendChild(riga);
            altri.forEach(id => elenco.appendChild(tessera(id, c)));
          }

          $('sceltaFoglio').classList.add('aperto');
          $('sceltaBg').classList.add('aperto');
          document.body.style.overflow = 'hidden';
        });
      }

      function tessera(id, c) {
        const g = id ? trovaGiocatore(id) : null;

        const t = document.createElement('button');
        t.type = 'button';
        t.className = 'conv-tessera' + (id ? '' : ' zero');
        t.style.background = 'none';
        t.style.border = '0';
        t.style.cursor = 'pointer';
        t.style.padding = '0';

        const avatar = document.createElement('div');
        avatar.className = 'conv-avatar' + (g ? ' con-foto' : '');
        if (g) {
          const foto = document.createElement('i');
          foto.style.backgroundImage = "url('./immagini/" + g.img + "')";
          avatar.appendChild(foto);
        }
        const iniziale = document.createElement('span');
        iniziale.textContent = id ? id.charAt(0).toUpperCase() : '✕';
        avatar.appendChild(iniziale);

        const nome = document.createElement('span');
        nome.className = 'conv-nome';
        nome.textContent = id || 'Lascia vuota';

        t.append(avatar, nome);

        if (g) {
          const r = document.createElement('span');
          r.className = 'conv-ruolo';
          r.textContent = g.ruolo;
          t.appendChild(r);
        }

        t.addEventListener('click', () => {
          if (id) schieramento[c.id] = id;
          else delete schieramento[c.id];
          chiudiScelta();
          disegnaCampo();
          sporco = true;
        esito($('formEsito'), 'Modifica non ancora salvata.', false);
        });

        return t;
      }

      function chiudiScelta() {
        apertaSu = null;
        $('sceltaFoglio').classList.remove('aperto');
        $('sceltaBg').classList.remove('aperto');
        document.body.style.overflow = '';
      }

      $('sceltaChiudi').addEventListener('click', chiudiScelta);
      $('sceltaBg').addEventListener('click', chiudiScelta);
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && apertaSu) chiudiScelta();
      });

      /* ---- salvataggio ---- */

      $('formSalva').addEventListener('click', async () => {
        if (!attivo) return;
        const btn = $('formSalva'), box = $('formEsito');
        btn.disabled = true;
        const testo = btn.textContent;
        btn.textContent = 'Salvo…';

        const r = await apiConv('formazione', { data: attivo, partita, schieramento });

        btn.disabled = false;
        btn.textContent = testo;

        if (!r.ok) { esito(box, r.dati.errore || 'Non sono riuscito a salvare.'); return; }

        schieramento = r.dati.schieramento || {};
        sporco = false;                       // salvato: si puo rileggere
        const quanti = Object.keys(schieramento).length;
        esito(box, quanti === 11
          ? 'Formazione salvata: undici in campo.'
          : 'Formazione salvata: ' + quanti + ' su 11.', true);

        // La firma si aggiorna qui invece di richiedere di nuovo la
        // giornata al server: l'abbiamo appena salvata noi, sappiamo
        // chi e stato e quando.
        mostraFirma(new Date().toISOString(), io && io.idGioco);

        disegnaCampo();
      });

      $('formSvuota').addEventListener('click', () => {
        if (!Object.keys(schieramento).length) return;
        if (!confirm('Tolgo tutti dal campo? La formazione resta vuota finche non salvi.')) return;
        schieramento = {};
        disegnaCampo();
        sporco = true;
        esito($('formEsito'), 'Campo svuotato. Salva per confermare.', false);
      });

      /* Chi ha schierato e quando: serve a sapere se quella in campo
         e ancora la formazione di ieri o e stata rivista stamattina. */
      function mostraFirma(quando, chi) {
        const firma = $('formFirma');
        if (!quando) { firma.hidden = true; return; }
        firma.hidden = false;
        firma.textContent = 'Ultima modifica: ' +
          new Date(quando).toLocaleString('it-IT',
            { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) +
          (chi ? ' — ' + chi : '');
      }

      /* ---- caricamento di una giornata ---- */

      async function mostra(quale) {
        partita = quale;
        segnaChip();
        $('formQuando').textContent = maiuscola(inLettere(attivo));
        $('formEtichetta').textContent = 'Partita ' + partita + ' di oggi';
        esito($('formEsito'), '');

        const r = await apiConv('formazione?data=' + encodeURIComponent(attivo) +
          '&partita=' + partita);
        if (!r.ok || partita !== quale) {
          if (!r.ok) esito($('formEsito'), r.dati.errore || 'Non riesco a leggere la formazione.');
          return;
        }

        caselle = r.dati.caselle || [];
        schieramento = r.dati.schieramento || {};
        presenti = r.dati.presenti || [];
        orari = r.dati.orari || {};
        quantePartite = r.dati.partite || 3;
        modificabile = !!r.dati.modificabile;
        sporco = false;                       // appena letta dal server

        /* Chi arriva tardi si dice anche a parole, sopra il campo: sul
           disegno l'orario e piccolo, e la prima cosa da sapere prima
           di schierare e quanti mancano all'inizio. */
        const inRitardo = presenti.filter(id => orari[idPiatto(id)]);
        $('formTardi').hidden = !inRitardo.length;
        if (inRitardo.length)
          $('formTardi').textContent = inRitardo.length === 1
            ? inRitardo[0] + ' arriva alle ' + orari[idPiatto(inRitardo[0])] + '.'
            : 'Arrivano più tardi: ' + inRitardo
                .map(id => id + ' alle ' + orari[idPiatto(id)]).join(', ') + '.';

        $('formModulo').textContent = r.dati.modulo;
        $('formAzioni').hidden = !modificabile;

        $('formNota').textContent = modificabile
          ? (presenti.length
              ? 'Tocca una casella e scegli fra i ' + presenti.length + ' presenti. Ogni reparto ha le sue.'
              : 'Per questa giornata non ha ancora segnato presente nessuno: non c’è nessuno da schierare.')
          : 'La formazione la decide il capitano. Qui la vedi come sarà.';

        mostraFirma(r.dati.aggiornato, r.dati.da);
        disegnaCampo();
      }

      function svuota(perche) {
        attivo = null;
        caselle = [];
        schieramento = {};
        presenti = [];
        orari = {};
        $('formQuando').textContent = 'Oggi non si allena';
        $('formEtichetta').textContent = 'Formazione';
        $('formPartite').textContent = '';
        $('formCaselle').textContent = '';
        $('formPanchina').hidden = true;
        $('formTardi').hidden = true;
        $('formAzioni').hidden = true;
        $('formFirma').hidden = true;
        esito($('formEsito'), perche ||
          'La formazione si mette la sera stessa: quando c’è allenamento, qui compare il campo.');
      }

      /* ---- ingresso ----
         I giorni arrivano dalla tab convocazioni, che li ha gia
         chiesti al server: due tab della stessa area non devono fare
         due volte la stessa domanda. */

      function aggiorna(elenco, dataOggi, utente) {
        giorni = elenco || [];
        oggi = dataOggi;
        io = utente;

        /* Solo oggi. La formazione di un allenamento fra tre giorni
           non si puo fare — non si sa ancora chi ci sara — e poterla
           aprire lo stesso invitava solo a lavorare a vuoto. */
        if (!giorni.includes(oggi)) { svuota(); return; }

        attivo = oggi;
        disegnaPartite();
        mostra(giorni.includes(oggi) && partita >= 1 && partita <= quantePartite ? partita : 1);
      }

      function chiudi() {
        chiudiScelta();
        svuota();
        io = null; giorni = []; partita = 1; orari = {};
      }

      /* Rilettura della giornata aperta. La chiamano l'apertura della
         tab e il ritorno sul sito: i presenti cambiano mentre la gente
         risponde, e una panchina di dieci minuti fa non serve a niente.

         Se pero c'e del lavoro non salvato non si tocca niente:
         ricaricare cancellerebbe la formazione che il capitano sta
         mettendo in piedi, ed e molto peggio di una panchina vecchia. */
      function ricarica() {
        if (!io || !attivo || sporco) return;
        mostra(partita);
      }

      return { aggiorna, chiudi, ricarica };
    })();


    /* ================= ANNUNCI =================
       La bacheca. Qui non comanda nessuno: scrivono tutti i membri
       approvati, giocatori compresi, e ogni annuncio fa vibrare i
       telefoni della squadra.

       Il testo di chi scrive entra sempre con textContent, mai come
       HTML: e l'unico punto del sito dove una persona scrive del testo
       che poi leggono tutti gli altri, ed e esattamente li che
       basterebbe un tag per far succedere qualcosa nel browser
       altrui. */

    const annunci = (function () {

      let limite = 500;
      let caricati = false;

      const apiAnn = (azione, corpo) => chiama('/api/annunci/' + azione, corpo);

      /* "3 minuti fa" invece dell'ora esatta: in una bacheca conta
         quanto e fresca una cosa, non a che ora precisa e stata detta.
         Oltre il giorno si torna alla data, che a quel punto e
         l'informazione utile. */
      function quandoInParole(iso) {
        const quando = new Date(iso);
        const min = Math.round((Date.now() - quando.getTime()) / 60000);
        if (min < 1) return 'adesso';
        if (min < 60) return min + (min === 1 ? ' minuto fa' : ' minuti fa');
        const ore = Math.round(min / 60);
        if (ore < 24) return ore + (ore === 1 ? ' ora fa' : ' ore fa');
        return quando.toLocaleDateString('it-IT',
          { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
      }

      function disegna(voci) {
        const box = $('annElenco');
        box.textContent = '';

        if (!voci.length) {
          const p = document.createElement('p');
          p.className = 'ar-vuoto';
          p.textContent = 'Ancora nessun annuncio. Comincia tu.';
          box.appendChild(p);
          return;
        }

        rosaPronta.then(() => {
          box.textContent = '';

          voci.forEach(a => {
            const g = trovaGiocatore(a.autore);

            const riga = document.createElement('div');
            riga.className = 'ann-voce' + (a.mio ? ' mio' : '');

            const faccia = document.createElement('div');
            faccia.className = 'ann-faccia' + (g ? ' con-foto' : '');
            if (g) {
              const foto = document.createElement('i');
              foto.style.backgroundImage = "url('./immagini/" + g.img + "')";
              faccia.appendChild(foto);
            }
            const iniziale = document.createElement('span');
            iniziale.textContent = (a.autore || '?').charAt(0).toUpperCase();
            faccia.appendChild(iniziale);

            const corpo = document.createElement('div');

            const testa = document.createElement('div');
            testa.className = 'ann-testa';
            const autore = document.createElement('span');
            autore.className = 'ann-autore';
            autore.textContent = a.autore;
            const quando = document.createElement('span');
            quando.className = 'ann-quando';
            quando.textContent = quandoInParole(a.quando);
            testa.append(autore, quando);

            const testo = document.createElement('p');
            testo.className = 'ann-testo';
            // textContent, non innerHTML: lo scrive una persona.
            testo.textContent = a.testo;

            corpo.append(testa, testo);

            if (a.cancellabile) {
              const via = document.createElement('button');
              via.type = 'button';
              via.className = 'ann-cancella';
              via.textContent = a.mio ? 'Cancella' : 'Cancella (admin)';
              via.addEventListener('click', () => cancella(a, via));
              corpo.appendChild(via);
            }

            riga.append(faccia, corpo);
            box.appendChild(riga);
          });
        });
      }

      async function cancella(a, bottone) {
        if (!confirm('Cancellare questo annuncio?')) return;
        bottone.disabled = true;
        const r = await apiAnn('cancella', { id: a.id });
        if (!r.ok) {
          bottone.disabled = false;
          esito($('annEsito'), r.dati.errore || 'Non sono riuscito a cancellarlo.');
          return;
        }
        carica();
      }

      async function carica(zitto) {
        const btn = $('annAggiorna');
        if (!zitto) btn.disabled = true;
        const r = await apiAnn('elenco');
        if (!zitto) btn.disabled = false;

        if (!r.ok) {
          esito($('annEsito'), r.dati.errore || 'Non riesco a leggere la bacheca.');
          return;
        }

        limite = r.dati.limite || 500;
        $('annTesto').setAttribute('maxlength', String(limite));
        disegna(r.dati.annunci || []);
        contaCaratteri();
        caricati = true;
      }

      function contaCaratteri() {
        const n = $('annTesto').value.length;
        const eti = $('annConta');
        eti.textContent = n + ' / ' + limite;
        // Si accende solo quando il limite si avvicina davvero.
        eti.classList.toggle('vicino', n > limite - 60);
      }

      $('annTesto').addEventListener('input', contaCaratteri);

      $('annPubblica').addEventListener('click', async () => {
        const testo = $('annTesto').value.trim();
        const box = $('annEsito');

        if (testo.length < 2) { esito(box, 'Scrivi qualcosa prima di pubblicare.'); return; }

        const btn = $('annPubblica');
        btn.disabled = true;
        const etichetta = btn.textContent;
        btn.textContent = 'Pubblico…';
        esito(box, '');

        const r = await apiAnn('pubblica', { testo });

        btn.disabled = false;
        btn.textContent = etichetta;

        if (!r.ok) { esito(box, r.dati.errore || 'Non sono riuscito a pubblicare.'); return; }

        $('annTesto').value = '';
        contaCaratteri();

        /* Il numero di notifiche partite si dice: chi scrive ha appena
           interrotto venti persone e ha diritto di sapere quante. Zero
           non e un errore — vuol dire che nessuno le ha ancora accese. */
        esito(box, r.dati.notificati
          ? 'Pubblicato. Notifica arrivata a ' + r.dati.notificati +
            (r.dati.notificati === 1 ? ' dispositivo.' : ' dispositivi.')
          : 'Pubblicato. Nessuna notifica: nessun altro le ha accese.', true);

        carica();
      });

      $('annAggiorna').addEventListener('click', () => carica());

      /* Si carica alla prima apertura della tab e poi quando si torna:
         una bacheca vecchia di un'ora non e una bacheca. */
      function apri(zitto) { carica(zitto); }
      function chiudi() { caricati = false; $('annElenco').textContent = ''; $('annTesto').value = ''; }

      return { apri, chiudi, caricati: () => caricati };
    })();

    /* ================= CAMPIONATO =================
       La classifica e le statistiche del campionato vero, quello che
       si gioca su eLudo. Qui non si scrive niente: si legge e si
       mostra.

       Tutto il lavoro sta sul server — cinque megabyte da eLudo che
       diventano otto chilobyte — e questa parte si limita a
       disegnare quello che arriva. Se il server serve dati vecchi
       perche eLudo non risponde, lo si dice invece di far finta che
       siano di adesso: una classifica di ieri e utile, una classifica
       di ieri spacciata per quella di oggi no. */

    const campionato = (function () {

      const apiCamp = (azione, corpo) => chiama('/api/campionato/' + azione, corpo);

      const ORDINI = [['gol', 'Gol'], ['assist', 'Assist'],
                      ['voto', 'Voto'], ['partite', 'Presenze']];
      const QUALI  = [['marcatori', 'Marcatori'], ['assistman', 'Assist'],
                      ['voti', 'Voto medio']];

      let dati = null, ordine = 'gol', quale = 'marcatori';

      async function apri(zitto) {
        if (!zitto) esito($('campEsito'), 'Leggo il campionato…');

        const r = await apiCamp('stato');
        if (!r.ok) {
          esito($('campEsito'), r.dati.errore || 'Non riesco a leggere il campionato.');
          return;
        }

        dati = r.dati;
        esito($('campEsito'), '');
        disegna();
      }

      function chiudi() {
        dati = null;
        ['campTesta', 'campSchedaCls', 'campSchedaNostri', 'campSchedaLega'].forEach(id => {
          $(id).hidden = true;
        });
        $('campNota').hidden = true;
        $('campEsito').textContent = '';
      }

      function disegna() {
        if (!dati) return;
        const s = dati.noi.squadra;

        $('campTesta').hidden = false;
        $('campPos').textContent = s.posizione ? s.posizione + '°' : '—';
        $('campDove').innerHTML = 'su ' + s.squadre + ' squadre<br>' +
          esc(dati.noi.serie) + ' · girone ' + esc(dati.noi.girone);

        $('campCifre').innerHTML =
          cifra(s.punti, 'punti') +
          cifra(s.v + '–' + s.n + '–' + s.p, 'V N P') +
          cifra(s.gf + ':' + s.gs, 'gol') +
          cifra(s.giocate, 'giocate');

        $('campSchedaCls').hidden = false;
        $('campClsTit').textContent = dati.noi.serie + ' — girone ' + dati.noi.girone;
        $('campLetto').textContent = quando(dati.letto);
        classifica();

        $('campSchedaNostri').hidden = !dati.nostri.length;
        if (dati.nostri.length) {
          righello($('campOrdina'), ORDINI, ordine, k => { ordine = k; disegna(); });
          elenco($('campNostri'), [...dati.nostri].sort(
            (a, b) => ((b[ordine] || 0) - (a[ordine] || 0)) || b.gol - a.gol), false);
        }

        $('campSchedaLega').hidden = !dati.marcatori.length;
        if (dati.marcatori.length) {
          righello($('campQuale'), QUALI, quale, k => { quale = k; disegna(); });
          elenco($('campLega'), dati[quale], true);
        }

        /* Da dove arrivano questi numeri va detto, e va detto se sono
           vecchi: il giorno che eLudo non risponde, chi guarda deve
           capire perche la classifica non si muove. */
        $('campNota').hidden = false;
        $('campNota').textContent = dati.fresco === false
          ? 'eLudo non risponde: questi sono gli ultimi dati buoni, letti ' + quando(dati.letto) + '.'
          : 'Letto da eLudo ' + quando(dati.letto) + '. Nessun numero è scritto a mano: se lì manca un risultato, manca anche qui.';
      }

      const cifra = (v, e) =>
        '<div class="camp-cifra"><b>' + esc(String(v)) + '</b><span>' + esc(e) + '</span></div>';

      /* "poco fa" invece dell'ora esatta: di una classifica interessa
         quanto e fresca, non a che minuto e stata letta. */
      function quando(iso) {
        const min = Math.round((Date.now() - Date.parse(iso)) / 60000);
        if (!Number.isFinite(min)) return 'chissà quando';
        if (min < 2) return 'adesso';
        if (min < 60) return min + ' minuti fa';
        const ore = Math.round(min / 60);
        if (ore < 24) return ore === 1 ? 'un\'ora fa' : ore + ' ore fa';
        const gg = Math.round(ore / 24);
        return gg === 1 ? 'ieri' : gg + ' giorni fa';
      }

      function righello(box, voci, acceso, quandoTocca) {
        box.textContent = '';
        voci.forEach(([k, eti]) => {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'conv-chip';
          b.textContent = eti;
          b.setAttribute('aria-pressed', String(k === acceso));
          b.addEventListener('click', () => quandoTocca(k));
          box.appendChild(b);
        });
      }

      function classifica() {
        const box = $('campCls');
        box.textContent = '';

        const t = document.createElement('table');
        const testa = document.createElement('thead');
        testa.innerHTML = '<tr><th></th><th>Squadra</th><th>G</th>' +
          '<th class="via">V</th><th class="via">N</th><th class="via">P</th>' +
          '<th class="via">GF</th><th class="via">GS</th><th>DR</th><th>Pt</th></tr>';
        const corpo = document.createElement('tbody');

        dati.classifica.forEach(r => {
          const tr = document.createElement('tr');
          if (r.noi) tr.className = 'noi';
          [[r.pos, ''], [r.squadra, ''], [r.giocate, ''],
           [r.v, 'via'], [r.n, 'via'], [r.p, 'via'], [r.gf, 'via'], [r.gs, 'via'],
           [(r.dr > 0 ? '+' : '') + r.dr, ''], [r.punti, 'pt']].forEach(([v, c]) => {
            const td = document.createElement('td');
            if (c) td.className = c;
            td.textContent = v;
            tr.appendChild(td);
          });
          corpo.appendChild(tr);
        });

        t.append(testa, corpo);
        box.appendChild(t);
      }

      function elenco(box, voci, conSquadra) {
        box.textContent = '';
        rosaPronta.then(() => {
          box.textContent = '';
          voci.forEach(p => {
            const g = trovaGiocatore(p.nome);

            const riga = document.createElement('div');
            riga.className = 'camp-riga' + (conSquadra && p.nostro ? ' nostro' : '');

            const faccia = document.createElement('div');
            faccia.className = 'pres-faccia' + (g ? ' con-foto' : '');
            if (g) {
              const foto = document.createElement('i');
              foto.style.backgroundImage = "url('./immagini/" + g.img + "')";
              faccia.appendChild(foto);
            }
            const iniziale = document.createElement('span');
            iniziale.textContent = (p.nome || '?').charAt(0).toUpperCase();
            faccia.appendChild(iniziale);

            const nome = document.createElement('div');
            nome.className = 'camp-nome';
            /* Chi ha una scheda lo si chiama come lo chiamiamo noi: su
               eLudo puo essere rimasto un nome vecchio, e nel nostro
               sito le persone hanno un nome solo. Gli avversari
               restano com'e scritto li, che e l'unico che abbiamo. */
            nome.textContent = (p.posto ? p.posto + '. ' : '') + (g ? g.nick : p.nome);
            const sotto = document.createElement('span');
            sotto.className = 'camp-sotto';
            sotto.textContent = conSquadra
              ? p.squadra
              : p.partite + (p.partite === 1 ? ' partita' : ' partite');
            nome.appendChild(sotto);

            const dati2 = document.createElement('div');
            dati2.className = 'camp-dati';
            [[p.gol, 'gol', p.gol ? 'oro' : ''],
             [p.assist, 'ass', ''],
             [p.voto, 'voto', p.voto >= 7.5 ? 'verde' : '']].forEach(([v, e, cl]) => {
              const d = document.createElement('div');
              d.className = 'camp-dato' + (cl ? ' ' + cl : '');
              const b = document.createElement('b');
              b.textContent = (v === null || v === undefined) ? '—' : v;
              const i = document.createElement('i');
              i.textContent = e;
              d.append(b, i);
              dati2.appendChild(d);
            });

            riga.append(faccia, nome, dati2);
            box.appendChild(riga);
          });
        });
      }

      return { apri, chiudi };
    })();

    /* ---- avvio pigro ---- */

    document.addEventListener('area:aperta', async () => {
      /* Gia dentro: non si rifa l'accesso, si rilegge quel che si sta
         guardando. Tornare sulla tab e a tutti gli effetti riaprire
         l'app, e deve mostrare le cose come stanno adesso. */
      if (avviata) { rinfresca(); return; }
      avviata = true;
      if (modoAdmin()) vestiDaAdmin();
      const r = await api('sessione');

      if (r.ok && r.dati.utente) return entra(r.dati.utente);

      /* Chi si e registrato ha gia una sessione, anche se non e ancora
         approvato: invece del modulo di accesso gli si dice a che
         punto e. Il giorno che l'admin approva, la stessa sessione
         diventa buona e la volta dopo entra senza rifare niente. */
      if (r.ok && r.dati.stato === 'in-attesa')
        return avviso('⏳', 'Richiesta ancora in attesa',
          'Ti riconosciamo già: appena un amministratore approva la tua richiesta entri da solo, senza rifare l’accesso.');

      schermata('arOspite');
    });
  })();

  /* ---------- AVVIO -------------------------------------------- */

  const iniziale = (typeof window.__TAB_INIZIALE__ === 'string' && window.__TAB_INIZIALE__)
    || DA_PERCORSO[percorso()] || 'home';
  // la edge function comunica 'noi' per la rosa: allineo i nomi
  mostra(iniziale === 'noi' ? 'rosa' : (iniziale === 'trofei' ? 'albo' : iniziale), false);
  rivela();

})();
