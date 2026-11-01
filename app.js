(function () {
  'use strict';

  var R = window.PauseRules, D = window.Demo;
  var MAX = R.MAX_LEN;

  function $(s, root) { return (root || document).querySelector(s); }
  function $$(s, root) { return Array.prototype.slice.call((root || document).querySelectorAll(s)); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  var ICONS = {
    shield: '<path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6z"/>',
    alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 114 2c-.9.6-1.5 1.1-1.5 2.2M12 17h.01"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
    home: '<path d="M3 11l9-8 9 8v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z"/>',
    scan: '<path d="M4 8V5a1 1 0 011-1h3M16 4h3a1 1 0 011 1v3M20 16v3a1 1 0 01-1 1h-3M8 20H5a1 1 0 01-1-1v-3"/><circle cx="12" cy="12" r="3.5"/><path d="M14.6 14.6L17 17"/>',
    chart: '<path d="M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-3"/>',
    phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 012-2h9"/>',
    play: '<path d="M7 4l13 8-13 8z"/>',
    up: '<path d="M7 11v9H4v-9zM7 11l4-8a2 2 0 012 2v4h5.5a2 2 0 012 2.3l-1 6A2 2 0 0117.5 20H7"/>',
    down: '<path d="M7 13V4H4v9zM7 13l4 8a2 2 0 002-2v-4h5.5a2 2 0 002-2.3l-1-6A2 2 0 0017.5 4H7"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    cpu: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>'
  };

  function icon(name) {
    var t = document.createElement('template');
    t.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';
    return t.content.firstChild;
  }
  function hydrate(root) {
    $$('[data-icon]', root).forEach(function (el) { if (!el.firstChild) el.appendChild(icon(el.getAttribute('data-icon'))); });
  }

  function h(tag, props) {
    var el = document.createElement(tag);
    Object.keys(props || {}).forEach(function (k) {
      var v = props[k];
      if (v === false || v == null) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.indexOf('on') === 0) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v);
    });
    for (var i = 2; i < arguments.length; i++) {
      var kids = [].concat(arguments[i]);
      kids.forEach(function (c) {
        if (c == null || c === false) return;
        el.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
      });
    }
    return el;
  }

  var toastTimer;
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 4200);
  }

  var LEVEL_UI = {
    high:       { cls: 'high', icon: 'alert',  label: 'Высокий риск' },
    suspicious: { cls: 'warn', icon: 'eye',    label: 'Есть признаки' },
    none_found: { cls: 'info', icon: 'search', label: 'Признаков не найдено' },
    uncertain:  { cls: 'unk',  icon: 'help',   label: 'Недостаточно данных' }
  };
  var SEV_RU = { critical: 'критичный', strong: 'сильный', weak: 'слабый' };
  var ENGINE_RU = { 'rules+ai': 'Правила + ИИ', rules: 'Только правила', local: 'Локально, без сервера' };

  var KEY = 'pause.v1';
  function loadDb() {
    try {
      var d = JSON.parse(localStorage.getItem(KEY));
      if (d && Array.isArray(d.events)) {
        return { events: d.events.slice(-200), fb: { up: +(d.fb && d.fb.up) || 0, down: +(d.fb && d.fb.down) || 0 } };
      }
    } catch (e) {  }
    return { events: [], fb: { up: 0, down: 0 } };
  }
  var db = loadDb();
  function saveDb() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {  } }
  function fmtTime(t) {
    var d = new Date(t), now = new Date();
    var hm = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    return d.toDateString() === now.toDateString() ? 'Сегодня, ' + hm : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) + ', ' + hm;
  }

  var health = { server: false, ai: false };

  function loadHealth() {
    var cfg = window.PAUSE_CONFIG || {};
    health = { server: true, ai: /^https:\/\//.test(cfg.AI_URL || '') };
    renderStatus();
    return Promise.resolve();
  }

  function aiStatusText() {
    if (health.ai) return 'подключён';
    return 'не подключён';
  }

  function renderStatus() {
    var dot = $('#aiDot');
    dot.className = 'dot ' + (health.ai ? 'on' : 'off');
    $('#aiPillText').textContent = health.ai ? 'ИИ подключён' : 'только правила';

    var chips = $('#statusChips');
    chips.replaceChildren(
      h('span', { class: 'chip' }, h('i', { class: 'dot on' }), 'Правила: ', h('b', { text: 'активны' })),
      h('span', { class: 'chip' }, h('i', { class: 'dot ' + (health.ai ? 'on' : 'off') }), 'ИИ: ', h('b', { text: aiStatusText() })),
      h('span', { class: 'chip' }, h('i', { class: 'dot on' }), 'Текст: ', h('b', { text: 'не сохраняется' }))
    );

    $('#modeText').textContent = health.ai
      ? 'Правила проверяют сразу, ИИ подключается по кнопке «Проверить».'
      : 'Сейчас работают правила. ИИ не подключён.';
    if ($('#view-dash').classList.contains('is-active')) renderDash();
  }

  function go(view, opts) {
    $$('.view').forEach(function (v) { v.classList.toggle('is-active', v.id === 'view-' + view); });
    $$('[data-nav]').forEach(function (b) { b.classList.toggle('is-active', b.getAttribute('data-nav') === view); });
    if (history.replaceState) history.replaceState(null, '', '#' + view);
    window.scrollTo({ top: 0 });
    if (view === 'home') renderJournal();
    if (view === 'dash') renderDash();
    if (opts && opts.voice) setTimeout(toggleMic, 300);
  }

  function renderJournal() {
    var box = $('#journal');
    var evs = db.events.slice(-5).reverse();
    $('#journalCount').textContent = db.events.length ? 'всего: ' + db.events.length : '';
    box.replaceChildren();
    if (!evs.length) {
      box.appendChild(h('p', { class: 'empty', text: 'Пока пусто. Проверьте сообщение, и запись появится здесь.' }));
      return;
    }
    evs.forEach(function (e) {
      var ui = LEVEL_UI[e.level] || LEVEL_UI.uncertain;
      var what = (e.types || []).map(function (t) { return R.TYPES[t] ? R.TYPES[t].label : ''; }).filter(Boolean).slice(0, 2).join(' · ') || 'признаков не найдено';
      box.appendChild(h('div', { class: 'j-item' },
        h('span', { class: 'j-ic ' + ui.cls }, icon(ui.icon)),
        h('div', { class: 'j-main' }, h('b', { text: ui.label }), h('span', { class: 'muted', text: what })),
        h('time', { class: 'muted', text: fmtTime(e.t) })
      ));
    });
  }

  var ta = $('#msg');
  var lastCrit = '';

  function onInput() {
    $('#count').textContent = ta.value.length + ' / ' + MAX;
    clearTimeout(onInput.t);
    onInput.t = setTimeout(liveAnalyze, 160);
  }

  function liveAnalyze() {
    var box = $('#liveChips'), alertBox = $('#liveAlert');
    box.replaceChildren();
    if (!ta.value.trim()) { alertBox.hidden = true; lastCrit = ''; return; }
    var a = R.analyze(ta.value);
    var types = R.typesOf(a.signals);
    if (!types.length) box.appendChild(h('span', { class: 'lchip muted-chip', text: 'Пока ничего подозрительного' }));
    types.forEach(function (t) { box.appendChild(h('span', { class: 'lchip sev-' + R.TYPES[t].sev, text: R.TYPES[t].label })); });

    var crit = a.signals.filter(function (s) { return s.sev === 'critical' && s.quote; }).pop();
    if (crit) {
      var q = crit.quote.length > 90 ? crit.quote.slice(0, 90) + '…' : crit.quote;
      alertBox.replaceChildren(icon('alert'), h('div', {}, h('b', { text: 'Опасная фраза' }), h('div', { text: '«' + q + '»' })));
      alertBox.hidden = false;
      if (lastCrit !== crit.quote) { lastCrit = crit.quote; if (navigator.vibrate && (listening || demoRunning)) navigator.vibrate(180); }
    } else { alertBox.hidden = true; lastCrit = ''; }
  }

  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var rec = null, listening = false, manualStop = false, micDenied = false, voiceBase = '';

  function setListening(on) {
    listening = on;
    $('#micBtn').classList.toggle('on', on);
    $('#waves').classList.toggle('on', on);
    $('#micLabel').textContent = on ? 'Слушаю… нажмите, чтобы остановить' : 'Нажмите и говорите';
    var mi = $('#micIcon'); mi.replaceChildren(icon(on ? 'stop' : 'mic'));
  }

  function toggleMic() {
    if (!SR) { toast('Этот браузер не умеет записывать голос. Попробуйте Chrome или Safari.'); return; }
    if (listening) { manualStop = true; try { rec.stop(); } catch (e) {  } return; }
    startMic();
  }

  function startMic() {
    stopDemo();
    manualStop = false; micDenied = false;
    voiceBase = ta.value.trim(); if (voiceBase) voiceBase += ' ';
    rec = new SR();
    rec.lang = 'ru-RU'; rec.interimResults = true; rec.continuous = true;
    rec.onresult = function (e) {
      var fin = '', interim = '';
      for (var i = 0; i < e.results.length; i++) {
        var r = e.results[i];
        if (r.isFinal) fin += r[0].transcript + ' '; else interim += r[0].transcript;
      }
      ta.value = (voiceBase + fin + interim).slice(0, MAX);
      onInput();
    };
    rec.onerror = function (e) {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        micDenied = true; manualStop = true;
        toast('Нет доступа к микрофону. Разрешите его в настройках браузера.');
      } else if (e.error !== 'no-speech' && e.error !== 'aborted') {
        toast('Ошибка записи голоса: ' + e.error);
      }
    };
    rec.onend = function () {
      if (listening && !manualStop) {
        voiceBase = ta.value.trim() + ' ';
        try { rec.start(); return; } catch (e) {  }
      }
      setListening(false);
      if (manualStop && !micDenied && ta.value.trim().length >= 3) runCheck();
    };
    try { rec.start(); setListening(true); } catch (e) { toast('Не удалось включить микрофон.'); }
  }

  var demoToken = 0, demoRunning = false;

  function buildDemoChips() {
    var row = $('#demoRow');
    D.SCENARIOS.forEach(function (sc) {
      row.appendChild(h('button', { class: 'chip', type: 'button', onclick: function () { startDemo(sc); } },
        icon(sc.kind === 'call' ? 'phone' : 'play'), sc.label));
    });
  }

  function speak(line, token) {
    return new Promise(function (resolve) {
      var u = new SpeechSynthesisUtterance(line);
      u.lang = 'ru-RU'; u.rate = 1.02;
      var v = (speechSynthesis.getVoices() || []).filter(function (x) { return /^ru/i.test(x.lang); })[0];
      if (v) u.voice = v;
      var done = false;
      function fin() { if (!done) { done = true; resolve(); } }
      u.onend = fin; u.onerror = fin;
      setTimeout(fin, line.length * 95 + 3500);
      if (token !== demoToken) return fin();
      speechSynthesis.speak(u);
    });
  }

  async function typeLine(line, token) {
    var words = line.split(' ');
    for (var i = 0; i < words.length; i++) {
      if (token !== demoToken) return;
      ta.value = (ta.value ? ta.value + ' ' : '') + words[i];
      onInput();
      await sleep(85);
    }
  }

  function stopDemo() {
    demoToken++; demoRunning = false;
    $('#stopDemo').hidden = true;
    if ('speechSynthesis' in window) speechSynthesis.cancel();
  }

  async function startDemo(sc) {
    if (listening) { manualStop = true; micDenied = true; try { rec.stop(); } catch (e) {  } }
    stopDemo();
    ta.value = ''; onInput();
    $('#result').replaceChildren(placeholder());
    if (sc.kind === 'text') {
      ta.value = sc.text; onInput();
      await runCheck();
      return;
    }
    var token = ++demoToken;
    demoRunning = true; $('#stopDemo').hidden = false;
    var tts = $('#ttsToggle').checked && 'speechSynthesis' in window;
    for (var i = 0; i < sc.lines.length; i++) {
      if (token !== demoToken) return;
      if (tts) { ta.value = (ta.value ? ta.value + ' ' : '') + sc.lines[i]; onInput(); await speak(sc.lines[i], token); }
      else { await typeLine(sc.lines[i], token); }
      await sleep(350);
    }
    if (token !== demoToken) return;
    demoRunning = false; $('#stopDemo').hidden = true;
    await runCheck();
  }

  function placeholder() {
    return h('div', { class: 'placeholder' }, icon('shield'),
      h('p', { text: 'Здесь появится результат проверки.' }));
  }

  function loadingView() {
    return h('div', { class: 'card loading' },
      h('div', { class: 'scanner' }, icon('scan')),
      h('b', { text: 'Проверяем…' }),
      h('p', { class: 'muted small', text: 'Это займёт пару секунд' }));
  }

  function localVerdict(text) {
    var a = R.analyze(text);
    var v = R.verdict(a.signals, a.words);
    v.text = a.text; v.signals = a.signals; v.urls = a.urls; v.engine = 'local';
    return v;
  }

  var checking = false;
  async function runCheck() {
    var text = ta.value.trim();
    if (!text) { toast('Вставьте текст или продиктуйте сообщение.'); return; }
    if (checking) return;
    if (Date.now() - (runCheck.last || 0) < 2500) { toast('Подождите пару секунд перед следующей проверкой.'); return; }
    runCheck.last = Date.now();
    checking = true;
    var btn = $('#checkBtn'); btn.disabled = true;
    $('#result').replaceChildren(loadingView());
    var t0 = performance.now();
    var data;
    try {

      var base = R.analyze(text);
      var signals = base.signals, engine = 'rules', ai = null, aiError = null;

      if (health.ai) {
        try {
          ai = await window.PauseAI.ask(window.PauseAI.maskPII(base.text));
          signals = R.mergeAI(base.text, signals, ai.signals);
          engine = 'rules+ai';
        } catch (e) { aiError = e.code || 'ai_failed'; }
      }

      var v = R.verdict(signals, base.words);
      data = Object.assign({}, v, { text: base.text, signals: signals, urls: base.urls, engine: engine, aiError: aiError,
        aiSummary: ai ? ai.summary : '', aiUncertainty: ai ? ai.uncertainty : '', ms: Math.round(performance.now() - t0) });
    } catch (err) {
      data = localVerdict(text);
      data.notice = 'Что-то пошло не так — показан результат локальных правил.';
      data.ms = Math.round(performance.now() - t0);
    }
    await sleep(Math.max(0, 650 - (performance.now() - t0)));
    db.events.push({ t: Date.now(), level: data.level, types: R.typesOf(data.signals), ms: data.ms || 0, engine: data.engine });
    db.events = db.events.slice(-200); saveDb();
    renderResult(data);
    checking = false; btn.disabled = false;
    if (window.matchMedia('(max-width: 999px)').matches) $('#result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function buildHighlight(text, signals) {
    var rank = { critical: 3, strong: 2, weak: 1 };
    var spans = signals.filter(function (s) { return s.end > s.start; })
      .map(function (s) { return { a: s.start, b: s.end, sev: s.sev }; })
      .sort(function (x, y) { return x.a - y.a || y.b - x.b; });
    var merged = [];
    spans.forEach(function (sp) {
      var last = merged[merged.length - 1];
      if (last && sp.a < last.b) { last.b = Math.max(last.b, sp.b); if (rank[sp.sev] > rank[last.sev]) last.sev = sp.sev; }
      else merged.push({ a: sp.a, b: sp.b, sev: sp.sev });
    });
    var frag = document.createDocumentFragment(), pos = 0;
    merged.forEach(function (sp) {
      if (sp.a > pos) frag.appendChild(document.createTextNode(text.slice(pos, sp.a)));
      frag.appendChild(h('mark', { class: 'm-' + sp.sev, text: text.slice(sp.a, sp.b) }));
      pos = sp.b;
    });
    if (pos < text.length) frag.appendChild(document.createTextNode(text.slice(pos)));
    return frag;
  }

  function explanationText(d) {
    var lines = ['PAUSE: ' + d.title, d.summary, ''];
    if (d.signals.length) {
      lines.push('Что найдено:');
      d.signals.forEach(function (s) { lines.push('— ' + (R.TYPES[s.type] ? R.TYPES[s.type].label : s.type) + (s.quote ? ': «' + s.quote.slice(0, 100) + '»' : '')); });
      lines.push('');
    }
    lines.push('Что делать:');
    d.actions.forEach(function (a, i) { lines.push((i + 1) + '. ' + a); });
    lines.push('', d.limitation, '(Проверено в прототипе PAUSE — это не гарантия безопасности.)');
    return lines.join('\n');
  }

  function renderResult(d) {
    var ui = LEVEL_UI[d.level] || LEVEL_UI.uncertain;
    var sevRank = { critical: 0, strong: 1, weak: 2 };
    var sigs = d.signals.slice().sort(function (a, b) { return sevRank[a.sev] - sevRank[b.sev] || a.start - b.start; });

    var res = h('div', { class: 'res' });

    res.appendChild(h('div', { class: 'level ' + ui.cls },
      h('div', { class: 'level-ic' }, icon(ui.icon)),
      h('div', {}, h('div', { class: 'level-label', text: ui.label }), h('h3', { text: d.title }), h('p', { text: d.summary })),
      h('div', { class: 'meta' },
        h('span', { class: 'chip' }, icon('cpu'), ENGINE_RU[d.engine] || d.engine),
        d.ms ? h('span', { class: 'chip', text: d.ms + ' мс' }) : null)
    ));

    if (d.notice) res.appendChild(h('div', { class: 'notice', text: d.notice }));
    else if (d.aiError) res.appendChild(h('div', { class: 'notice', text: 'ИИ сейчас не ответил, результат построен по правилам.' }));

    if (sigs.length) {

      var groups = [], byType = {};
      sigs.forEach(function (s) {
        var g = byType[s.type];
        if (!g) { g = byType[s.type] = { type: s.type, sev: s.sev, sources: [], quotes: [], why: s.why }; groups.push(g); }
        if (g.sources.indexOf(s.source) < 0) g.sources.push(s.source);
        if (s.quote && g.quotes.length < 3) g.quotes.push(s.quote.length > 140 ? s.quote.slice(0, 140) + '…' : s.quote);
      });
      var list = h('div', { class: 'sigs' });
      groups.forEach(function (g) {
        list.appendChild(h('div', { class: 'sig sev-' + g.sev },
          h('div', { class: 'sig-top' },
            h('b', { text: R.TYPES[g.type] ? R.TYPES[g.type].label : g.type }),
            g.sources.map(function (src) { return h('span', { class: 'badge ' + (src === 'ai' ? 'ai' : 'rule'), text: src === 'ai' ? 'ИИ' : 'Правило' }); }),
            h('span', { class: 'sevtag', text: SEV_RU[g.sev] })),
          g.quotes.map(function (q) { return h('blockquote', { class: 'quote', text: '«' + q + '»' }); }),
          h('p', { class: 'why', text: g.why })));
      });
      res.appendChild(h('div', { class: 'block' }, h('h4', { text: 'Что мы нашли' }), list));

      var hl = h('div', { class: 'hl' }); hl.appendChild(buildHighlight(d.text, d.signals));
      res.appendChild(h('div', { class: 'block' }, h('h4', { text: 'Текст с подсветкой' }), hl));
    }

    if (d.aiSummary) {
      res.appendChild(h('div', { class: 'block' }, h('h4', { text: 'Пояснение ИИ' }),
        h('p', { class: 'ai-sum' }, d.aiSummary, d.aiUncertainty ? h('small', { text: 'Что нельзя проверить по тексту: ' + d.aiUncertainty }) : null)));
    }

    if (d.urls && d.urls.length) {
      var ul = h('div', { class: 'urls' });
      d.urls.slice(0, 4).forEach(function (u) {
        var note = u.reasons.length ? u.reasons.join('; ') : (u.official ? 'Домен совпадает с официальным по списку MVP. Это не гарантия: проверьте, как вы получили ссылку.' : 'Явных структурных признаков нет, но домен нам неизвестен — это не значит, что он безопасен.');
        ul.appendChild(h('div', { class: 'u' }, h('code', { text: u.host }), h('div', { class: 'muted', text: note })));
      });
      res.appendChild(h('div', { class: 'block' }, h('h4', { text: 'Ссылки (не открывались)' }), ul));
    }

    var steps = h('ol', { class: 'steps' });
    d.actions.forEach(function (a) { steps.appendChild(h('li', { text: a })); });
    var act = h('div', { class: 'block' }, h('h4', { text: 'Что делать сейчас' }), steps);
    if (d.tips && d.tips.length) {
      var tips = h('div', { class: 'tips' });
      d.tips.forEach(function (t) { tips.appendChild(h('div', { text: '• ' + t })); });
      act.appendChild(tips);
    }
    res.appendChild(act);

    res.appendChild(h('p', { class: 'limit', text: d.limitation }));

    var actions = h('div', { class: 'res-actions' });
    actions.appendChild(h('button', { class: 'btn ghost', type: 'button', onclick: function () {
      var txt = explanationText(d);
      (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function () { toast('Объяснение скопировано — можно отправить близкому.'); }, function () { toast('Не удалось скопировать — выделите текст вручную.'); });
    } }, icon('copy'), 'Скопировать объяснение'));
    if (d.level === 'high') actions.appendChild(h('a', { class: 'btn ghost', href: 'tel:1000' }, icon('phone'), 'Позвонить 1000'));
    var fb = h('div', { class: 'fb' }, h('span', { text: 'Помогло понять, что делать?' }));
    function vote(up) {
      if (up) db.fb.up++; else db.fb.down++;
      saveDb(); fb.replaceChildren(h('span', { text: 'Спасибо за оценку!' }));
    }
    fb.appendChild(h('button', { type: 'button', 'aria-label': 'Помогло', onclick: function () { vote(true); } }, icon('up')));
    fb.appendChild(h('button', { type: 'button', 'aria-label': 'Не помогло', onclick: function () { vote(false); } }, icon('down')));
    actions.appendChild(fb);
    res.appendChild(actions);

    $('#result').replaceChildren(res);
  }

  function renderDash() {
    var evs = db.events, total = evs.length;
    var high = evs.filter(function (e) { return e.level === 'high'; }).length;
    var times = evs.map(function (e) { return e.ms; }).filter(Boolean).sort(function (a, b) { return a - b; });
    var med = times.length ? times[Math.floor(times.length / 2)] : null;
    var votes = db.fb.up + db.fb.down;

    function stat(val, label) { return h('div', { class: 'stat' }, h('b', { text: String(val) }), h('span', { text: label })); }
    $('#stats').replaceChildren(
      stat(total, 'проверок за всё время'),
      stat(high, 'с высоким риском'),
      stat(med ? med + ' мс' : '—', 'обычное время проверки'),
      stat(votes ? db.fb.up + ' из ' + votes : '—', 'оценили как полезное')
    );

    var counts = {};
    evs.forEach(function (e) { (e.types || []).forEach(function (t) { counts[t] = (counts[t] || 0) + 1; }); });
    var keys = Object.keys(counts).filter(function (t) { return R.TYPES[t]; }).sort(function (a, b) { return counts[b] - counts[a]; }).slice(0, 7);
    var bars = $('#bars'); bars.replaceChildren();
    if (!keys.length) bars.appendChild(h('p', { class: 'empty', text: 'Пока пусто. Сделайте пару проверок.' }));
    var maxC = keys.length ? counts[keys[0]] : 1;
    keys.forEach(function (t) {
      var fill = h('div', { class: 'bar-fill ' + R.TYPES[t].sev });
      bars.appendChild(h('div', { class: 'bar' },
        h('div', { class: 'bar-top' }, h('span', { text: R.TYPES[t].label }), h('b', { text: String(counts[t]) })),
        h('div', { class: 'bar-track' }, fill)));
      requestAnimationFrame(function () { fill.style.width = Math.round(counts[t] / maxC * 100) + '%'; });
    });

    var steps = [
      ['scan', 'Ввод', 'Текст или голос', true],
      ['lock', 'Очистка', 'Лимит 2000 символов, скрываем номера карт и телефоны', true],
      ['shield', 'Правила', 'Работают всегда', true],
      ['cpu', 'ИИ', health.ai ? 'Подключён' : 'Не подключён, работают правила', health.ai],
      ['layers', 'Проверка ответа', 'Отбрасываем лишнее и выдуманное', true],
      ['alert', 'Результат', 'Один из четырёх уровней', true]
    ];
    $('#pipe').replaceChildren.apply($('#pipe'), steps.map(function (s) {
      return h('div', { class: 'pstep' + (s[3] ? '' : ' off') }, h('span', {}, icon(s[0])), h('div', {}, h('b', { text: s[1] }), h('small', { text: s[2] })));
    }));

    $('#privacy').replaceChildren.apply($('#privacy'), [
      'Текст сообщений нигде не сохраняется.',
      'В браузере остаются только уровень риска, время и типы признаков.',
      'В ИИ уходит текст без номеров карт, телефонов и кодов.',
      'Ключа ИИ на сайте нет: он хранится отдельно, на сервере-посреднике.',
      'Сайт защищён политикой CSP, лимитом на ввод и паузой между проверками.'
    ].map(function (t) { return h('li', { text: t }); }));
  }

  function runSelfTest() {
    var tp = 0, fp = 0, fn = 0, tn = 0, exact = 0, fails = [];
    D.TESTS.forEach(function (t, i) {
      var a = R.analyze(t.text), v = R.verdict(a.signals, a.words);
      var expPos = t.expect === 'high' || t.expect === 'suspicious';
      var gotPos = v.level === 'high' || v.level === 'suspicious';
      if (expPos && gotPos) tp++; else if (!expPos && gotPos) fp++; else if (expPos && !gotPos) fn++; else tn++;
      if (v.level === t.expect) exact++; else fails.push('#' + (i + 1) + ': ждали «' + t.expect + '», получили «' + v.level + '»');
    });
    function pct(x) { return isFinite(x) ? Math.round(x * 100) + '%' : '—'; }
    var prec = tp / (tp + fp), rec_ = tp / (tp + fn), f1 = 2 * prec * rec_ / (prec + rec_);
    function metric(v, l) { return h('div', { class: 'metric' }, h('b', { text: v }), h('span', { text: l })); }
    var out = $('#testOut');
    out.replaceChildren.apply(out, [
      h('p', { class: 'small', text: 'Результат совпал с ожидаемым: ' + exact + ' из ' + D.TESTS.length + ' примеров.' }),
      h('div', { class: 'metrics' },
        metric(pct(prec), 'Precision'), metric(pct(rec_), 'Recall'), metric(pct(f1), 'F1'),
        metric(pct(fn / (tp + fn)), 'Доля пропусков'), metric(pct(fp / (fp + tn)), 'False positive rate'), metric(tp + '/' + fp + '/' + fn + '/' + tn, 'TP/FP/FN/TN')),
      fails.length ? h('div', { class: 'fails', text: fails.join(' · ') }) : null,
      h('p', { class: 'micro', text: 'Примеров мало, и правила подбирались под них. Это проверка работы кода, а не оценка точности.' })
    ].filter(Boolean));
  }

  function init() {
    hydrate(document);

    var waves = $('#waves');
    for (var i = 0; i < 28; i++) { var b = document.createElement('i'); b.style.animationDelay = ((i * 73) % 900) / 1000 + 's'; waves.appendChild(b); }
    buildDemoChips();
    $('#result').appendChild(placeholder());

    document.addEventListener('click', function (e) {
      var nav = e.target.closest('[data-nav]'); if (nav) { go(nav.getAttribute('data-nav')); return; }
      var g = e.target.closest('[data-go]'); if (g) { go(g.getAttribute('data-go'), { voice: g.hasAttribute('data-voice') }); }
    });
    $('#micBtn').addEventListener('click', toggleMic);
    $('#checkBtn').addEventListener('click', runCheck);
    $('#clearBtn').addEventListener('click', function () { stopDemo(); ta.value = ''; onInput(); $('#result').replaceChildren(placeholder()); ta.focus(); });
    $('#stopDemo').addEventListener('click', stopDemo);
    ta.addEventListener('input', onInput);
    ta.addEventListener('keydown', function (e) { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') runCheck(); });

    $('#runTest').addEventListener('click', runSelfTest);
    $('#wipe').addEventListener('click', function () { db = { events: [], fb: { up: 0, down: 0 } }; saveDb(); renderDash(); renderJournal(); toast('Локальные данные очищены.'); });

    var sos = $('#sos');
    $('#openSos').addEventListener('click', function () { sos.hidden = false; });
    $('#closeSos').addEventListener('click', function () { sos.hidden = true; });
    sos.addEventListener('click', function (e) { if (e.target === sos) sos.hidden = true; });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') sos.hidden = true; });

    var start = (location.hash || '').replace('#', '');
    go(['home', 'check', 'dash'].indexOf(start) > -1 ? start : 'home');
    renderStatus();
    loadHealth();
    if ('speechSynthesis' in window) speechSynthesis.getVoices();
  }

  init();
})();
