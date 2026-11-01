(function (root) {
  'use strict';

  var Rules = root.PauseRules;

  function maskPII(t) {
    return t
      .replace(/\b(?:\d[ -]?){13,19}\b/g, '[НОМЕР_КАРТЫ]')
      .replace(/(?:\+7|8)[\s(-]*\d{3}[\s)-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}/g, '[ТЕЛЕФОН]')
      .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[EMAIL]')
      .replace(/\b\d{4}\s?\d{6}\b/g, '[ПАСПОРТ]')
      .replace(/(код[а-яё]*\W{0,12})\d{3,8}\b/gi, '$1[КОД]');
  }

  function fail(code) {
    var e = new Error(code);
    e.code = code;
    return e;
  }

  function parseJson(content) {
    var clean = String(content || '').replace(/```json|```/gi, '').trim();
    var a = clean.indexOf('{'), b = clean.lastIndexOf('}');
    if (a < 0 || b <= a) throw fail('bad_format');
    return JSON.parse(clean.slice(a, b + 1));
  }

  async function ask(maskedText) {
    var cfg = root.PAUSE_CONFIG || {};
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, Number(cfg.AI_TIMEOUT_MS) || 12000);
    var resp;
    try {
      resp = await fetch(cfg.AI_URL, {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: maskedText })
      });
    } catch (e) {
      throw fail(e.name === 'AbortError' ? 'timeout' : 'network');
    } finally {
      clearTimeout(timer);
    }
    if (!resp.ok) throw fail('http_' + resp.status);
    var data = await resp.json();
    var p = parseJson(data && data.content);
    return {
      signals: Array.isArray(p.signals) ? p.signals.slice(0, 8).map(function (s) {
        return { type: String(s && s.type || ''), quote: String(s && s.quote || ''), why: String(s && s.why || '') };
      }) : [],
      summary: Rules.cleanNote(p.summary).slice(0, 300),
      uncertainty: Rules.cleanNote(p.uncertainty).slice(0, 200)
    };
  }

  root.PauseAI = { ask: ask, maskPII: maskPII };
})(self);
