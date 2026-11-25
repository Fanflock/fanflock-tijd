/* Fanflock Tijd — gedeelde helpers (gebruikt door alle pagina's)
 *
 * Datamodel per kaart (Trello pluginData, card / shared, sleutel "tt"):
 * {
 *   v: 1,                       // schemaversie
 *   b: 480 | null,              // begroot budget in minuten
 *   m: ["memberId", ...],       // ledenlijst; entries verwijzen via index (scheelt ruimte)
 *   r: { memberId: { s: startMs, n: "notitie" } },   // lopende timers
 *   e: [[ledenIndex, startInMinutenSindsEpoch, minuten, "notitie"], ...]
 * }
 * Trello staat max. 4096 tekens per kaart/scope toe, dus het formaat is bewust compact.
 */
(function (root) {
  'use strict';

  var KEY = 'tt';
  var SETTINGS_KEY = 'ttSettings';
  var MAX_CHARS = 4000;
  var NOTE_MAX = 60;

  function normalize(d) {
    d = d || {};
    var r = {};
    if (d.r && typeof d.r === 'object') {
      Object.keys(d.r).forEach(function (id) {
        var v = d.r[id];
        if (typeof v === 'number') r[id] = { s: v, n: '' };
        else if (v && typeof v.s === 'number') r[id] = { s: v.s, n: v.n || '' };
      });
    }
    return {
      v: 1,
      b: typeof d.b === 'number' && d.b > 0 ? d.b : null,
      m: Array.isArray(d.m) ? d.m : [],
      r: r,
      e: Array.isArray(d.e) ? d.e : []
    };
  }

  function load(t, scope) {
    return t.get(scope || 'card', 'shared', KEY, null).then(normalize);
  }

  function size(d) { return JSON.stringify(d).length; }
  function usage(d) { return size(d) / MAX_CHARS; }

  // Lees-wijzig-schrijf zo kort mogelijk achter elkaar, zodat collega's elkaar niet overschrijven.
  function update(t, mutate) {
    return load(t).then(function (d) {
      var result = mutate(d);
      if (size(d) > MAX_CHARS) {
        var err = new Error('Deze kaart zit vol (Trello-limiet). Verwijder oude regels of maak een vervolgkaart.');
        err.code = 'FULL';
        throw err;
      }
      return t.set('card', 'shared', KEY, d).then(function () {
        return { data: d, result: result };
      });
    });
  }

  function cleanNote(n) {
    return String(n || '').replace(/\s+/g, ' ').trim().slice(0, NOTE_MAX);
  }

  function memberIdx(d, id) {
    var i = d.m.indexOf(id);
    if (i < 0) { d.m.push(id); i = d.m.length - 1; }
    return i;
  }

  function isRunning(d, memberId) { return !!d.r[memberId]; }
  function anyRunning(d) { return Object.keys(d.r).length > 0; }

  function startTimer(d, memberId, note, now) {
    if (d.r[memberId]) return false;
    d.r[memberId] = { s: now, n: cleanNote(note) };
    return true;
  }

  // Geeft het aantal geregistreerde minuten terug (min. 1), of null als er geen timer liep.
  function stopTimer(d, memberId, note, now) {
    var run = d.r[memberId];
    if (!run) return null;
    var min = Math.max(1, Math.round((now - run.s) / 60000));
    delete d.r[memberId];
    d.e.push([memberIdx(d, memberId), Math.floor(run.s / 60000), min, cleanNote(note || run.n)]);
    return min;
  }

  function addEntry(d, memberId, startMs, minutes, note) {
    d.e.push([memberIdx(d, memberId), Math.floor(startMs / 60000), Math.round(minutes), cleanNote(note)]);
  }

  function entryKey(e) { return e[0] + '|' + e[1] + '|' + e[2] + '|' + (e[3] || ''); }

  function removeEntry(d, key) {
    for (var i = 0; i < d.e.length; i++) {
      if (entryKey(d.e[i]) === key) { d.e.splice(i, 1); return true; }
    }
    return false;
  }

  // Entries als leesbare objecten
  function entries(d) {
    return d.e.map(function (e) {
      return { key: entryKey(e), member: d.m[e[0]] || null, start: e[1] * 60000, min: e[2], note: e[3] || '' };
    });
  }

  // Totaal in minuten. opts: { from, to, memberId, includeRunning, now }
  function total(d, opts) {
    opts = opts || {};
    var sum = 0;
    entries(d).forEach(function (e) {
      if (opts.memberId && e.member !== opts.memberId) return;
      if (opts.from != null && e.start < opts.from) return;
      if (opts.to != null && e.start >= opts.to) return;
      sum += e.min;
    });
    if (opts.includeRunning) {
      var now = opts.now || Date.now();
      Object.keys(d.r).forEach(function (id) {
        if (opts.memberId && id !== opts.memberId) return;
        sum += Math.max(0, Math.floor((now - d.r[id].s) / 60000));
      });
    }
    return sum;
  }

  // --- Opmaak ---
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function fmt(min) {
    min = Math.round(min || 0);
    return Math.floor(min / 60) + ':' + pad(min % 60);
  }
  function fmtClock(ms) {
    var s = Math.max(0, Math.floor(ms / 1000));
    return Math.floor(s / 3600) + ':' + pad(Math.floor(s / 60) % 60) + ':' + pad(s % 60);
  }
  function fmtDecimal(min) { return (Math.round(min / 60 * 100) / 100).toFixed(2).replace('.', ','); }
  function fmtMoney(amount) {
    return '€ ' + amount.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }
  var DAYS = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
  var MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  function fmtDate(ms) {
    var d = new Date(ms);
    return DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()];
  }
  function isoDate(ms) {
    var d = new Date(ms);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  // "2026-11-25" -> lokale tijd 12:00 (middag voorkomt tijdzone-verschuivingen)
  function parseIsoDate(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    if (!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3], 12, 0, 0).getTime();
  }

  // Accepteert: 1:30 · 1,5 · 1.5 · 1u30 · 1h30 · 2u · 1,5u · 45m · 45min
  function parseDuration(s) {
    if (s == null) return null;
    s = String(s).trim().toLowerCase().replace(/\s+/g, '');
    var m, min = null;
    if ((m = /^(\d+):([0-5]?\d)$/.exec(s))) min = +m[1] * 60 + +m[2];
    else if ((m = /^(\d+)[uh](\d{1,2})?m?$/.exec(s))) min = +m[1] * 60 + (m[2] ? +m[2] : 0);
    else if ((m = /^(\d+)m(in)?$/.exec(s))) min = +m[1];
    else if ((m = /^(\d+(?:[.,]\d+)?)[uh]?$/.exec(s))) min = Math.round(parseFloat(m[1].replace(',', '.')) * 60);
    if (min == null || min <= 0 || min > 24 * 60 * 31) return null;
    return min;
  }

  // Periodes voor het overzicht (week start op maandag)
  function periodRange(key, now) {
    var d = new Date(now || Date.now());
    var y = d.getFullYear(), mo = d.getMonth();
    var startOfDay = new Date(y, mo, d.getDate()).getTime();
    switch (key) {
      case 'today': return { from: startOfDay, to: startOfDay + 864e5 };
      case 'week': {
        var dow = (d.getDay() + 6) % 7;
        var from = new Date(y, mo, d.getDate() - dow).getTime();
        return { from: from, to: new Date(y, mo, d.getDate() - dow + 7).getTime() };
      }
      case 'lastweek': {
        var dow2 = (d.getDay() + 6) % 7;
        return { from: new Date(y, mo, d.getDate() - dow2 - 7).getTime(), to: new Date(y, mo, d.getDate() - dow2).getTime() };
      }
      case 'month': return { from: new Date(y, mo, 1).getTime(), to: new Date(y, mo + 1, 1).getTime() };
      case 'lastmonth': return { from: new Date(y, mo - 1, 1).getTime(), to: new Date(y, mo, 1).getTime() };
      default: return { from: null, to: null };
    }
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function memberMap(members) {
    var map = {};
    (members || []).forEach(function (m) { map[m.id] = m.fullName || m.username || 'Onbekend'; });
    return map;
  }
  function firstName(name) { return String(name || 'Onbekend').split(' ')[0]; }

  var api = {
    KEY: KEY, SETTINGS_KEY: SETTINGS_KEY, MAX_CHARS: MAX_CHARS, NOTE_MAX: NOTE_MAX,
    normalize: normalize, load: load, update: update, size: size, usage: usage,
    isRunning: isRunning, anyRunning: anyRunning, startTimer: startTimer, stopTimer: stopTimer,
    addEntry: addEntry, removeEntry: removeEntry, entries: entries, total: total,
    fmt: fmt, fmtClock: fmtClock, fmtDecimal: fmtDecimal, fmtMoney: fmtMoney, fmtDate: fmtDate,
    isoDate: isoDate, parseIsoDate: parseIsoDate, parseDuration: parseDuration,
    periodRange: periodRange, escapeHtml: escapeHtml, memberMap: memberMap, firstName: firstName
  };

  root.TT = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
