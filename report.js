/* Fanflock Tijd — urenoverzicht voor het hele board */
/* global TrelloPowerUp, TT */
(function () {
  'use strict';

  var t = TrelloPowerUp.iframe();
  var cards = [];     // [{ id, name, url, listName, data }]
  var names = {};
  var rate = null;
  var currentRows = [];

  function $(id) { return document.getElementById(id); }
  function esc(s) { return TT.escapeHtml(s); }

  function range() {
    var p = $('period').value;
    if (p !== 'custom') return TT.periodRange(p);
    var f = TT.parseIsoDate($('from').value), to = TT.parseIsoDate($('to').value);
    return { from: f != null ? f - 12 * 36e5 : null, to: to != null ? to + 12 * 36e5 : null };
  }

  function loadAll() {
    return Promise.all([
      t.board('members'),
      t.lists('id', 'name'),
      t.cards('id', 'name', 'idList', 'url'),
      t.get('board', 'shared', TT.SETTINGS_KEY, {})
    ]).then(function (r) {
      names = TT.memberMap(r[0].members);
      var lists = {};
      r[1].forEach(function (l) { lists[l.id] = l.name; });
      rate = r[3] && r[3].rate ? r[3].rate : null;

      // Kaartdata ophalen: t.get accepteert een kaart-ID als scope
      return Promise.all(r[2].map(function (c) {
        return TT.load(t, c.id).then(function (d) {
          return { id: c.id, name: c.name, url: c.url, listName: lists[c.idList] || '', data: d };
        });
      }));
    }).then(function (all) {
      cards = all.filter(function (c) { return c.data.e.length || TT.anyRunning(c.data) || c.data.b; });
      fillFilters();
      render();
    });
  }

  function fillFilters() {
    var prevMember = $('member').value, prevList = $('list').value;
    var mem = {}, lst = {};
    cards.forEach(function (c) {
      lst[c.listName] = 1;
      c.data.m.forEach(function (id) { mem[id] = 1; });
      Object.keys(c.data.r).forEach(function (id) { mem[id] = 1; });
    });
    $('member').innerHTML = '<option value="">Iedereen</option>' + Object.keys(mem)
      .sort(function (a, b) { return (names[a] || '').localeCompare(names[b] || ''); })
      .map(function (id) { return '<option value="' + esc(id) + '">' + esc(names[id] || 'Onbekend') + '</option>'; }).join('');
    $('list').innerHTML = '<option value="">Alle lijsten</option>' + Object.keys(lst).sort()
      .map(function (n) { return '<option>' + esc(n) + '</option>'; }).join('');
    // Na een verversing de gekozen filters behouden
    $('member').value = prevMember;
    $('list').value = prevList;
  }

  function render() {
    var rg = range();
    var memberId = $('member').value || null;
    var listName = $('list').value;
    var showMoney = !!rate;
    Array.prototype.forEach.call(document.querySelectorAll('[data-money]'), function (el) {
      el.classList.toggle('hidden', !showMoney);
    });

    var rows = [], byMember = {}, cardRows = [], live = [];
    var totalPeriod = 0;

    cards.forEach(function (c) {
      if (listName && c.listName !== listName) return;
      var period = TT.total(c.data, { from: rg.from, to: rg.to, memberId: memberId });
      var all = TT.total(c.data, { memberId: memberId, includeRunning: true });

      TT.entries(c.data).forEach(function (e) {
        if (memberId && e.member !== memberId) return;
        if (rg.from != null && e.start < rg.from) return;
        if (rg.to != null && e.start >= rg.to) return;
        rows.push({ start: e.start, member: e.member, card: c, min: e.min, note: e.note });
        byMember[e.member] = (byMember[e.member] || 0) + e.min;
      });
      Object.keys(c.data.r).forEach(function (id) {
        if (memberId && id !== memberId) return;
        live.push({ member: id, card: c, since: c.data.r[id].s });
      });

      totalPeriod += period;
      if (period > 0 || (!rg.from && all > 0) || c.data.b) {
        cardRows.push({ card: c, period: period, all: all, budget: c.data.b });
      }
    });

    rows.sort(function (a, b) { return b.start - a.start; });
    cardRows.sort(function (a, b) { return b.period - a.period || b.all - a.all; });
    currentRows = rows;

    // KPI's
    var overBudget = cardRows.filter(function (r) { return r.budget && r.all > r.budget; }).length;
    var kpis = [
      ['Uren in periode', TT.fmt(totalPeriod)],
      ['Kaarten met uren', String(cardRows.filter(function (r) { return r.period > 0; }).length)],
      ['Over budget', String(overBudget)]
    ];
    if (showMoney) kpis.splice(1, 0, ['Waarde (à ' + TT.fmtMoney(rate) + ')', TT.fmtMoney(totalPeriod / 60 * rate)]);
    $('kpis').innerHTML = kpis.map(function (k) { return '<div class="kpi"><b>' + esc(k[1]) + '</b><span>' + esc(k[0]) + '</span></div>'; }).join('');

    // Lopende timers
    $('liveWrap').classList.toggle('hidden', !live.length);
    $('live').innerHTML = live.map(function (l) {
      return '<tr><td>▶ ' + esc(names[l.member] || 'Onbekend') + '</td><td><a href="' + esc(l.card.url) + '" target="_blank">' +
        esc(l.card.name) + '</a></td><td class="num">' + TT.fmtClock(Date.now() - l.since) + '</td><td class="muted">sinds ' +
        TT.fmtDate(l.since) + ' ' + new Date(l.since).toTimeString().slice(0, 5) + '</td></tr>';
    }).join('');

    // Per kaart
    $('byCard').innerHTML = cardRows.map(function (r) {
      var pct = r.budget ? Math.round(r.all / r.budget * 100) : null;
      return '<tr class="' + (pct > 100 ? 'over' : '') + '"><td><a href="' + esc(r.card.url) + '" target="_blank">' + esc(r.card.name) +
        '</a></td><td>' + esc(r.card.listName) + '</td><td class="num">' + TT.fmt(r.period) + '</td><td class="num">' + TT.fmt(r.all) +
        '</td><td class="num">' + (r.budget ? TT.fmt(r.budget) : '–') + '</td><td class="num pct">' + (pct != null ? pct + '%' : '–') +
        '</td>' + (showMoney ? '<td class="num">' + TT.fmtMoney(r.period / 60 * rate) + '</td>' : '') + '</tr>';
    }).join('') || '<tr><td colspan="7" class="muted">Geen uren in deze periode.</td></tr>';

    // Per medewerker
    $('byMember').innerHTML = Object.keys(byMember).sort(function (a, b) { return byMember[b] - byMember[a]; }).map(function (id) {
      return '<tr><td>' + esc(names[id] || 'Onbekend') + '</td><td class="num">' + TT.fmt(byMember[id]) + '</td>' +
        (showMoney ? '<td class="num">' + TT.fmtMoney(byMember[id] / 60 * rate) + '</td>' : '') + '</tr>';
    }).join('') || '<tr><td colspan="3" class="muted">–</td></tr>';

    // Alle regels
    $('rows').innerHTML = rows.map(function (r) {
      return '<tr><td>' + TT.fmtDate(r.start) + '</td><td>' + esc(names[r.member] || 'Onbekend') + '</td><td>' + esc(r.card.name) +
        '</td><td class="num">' + TT.fmt(r.min) + '</td><td>' + esc(r.note) + '</td></tr>';
    }).join('') || '<tr><td colspan="5" class="muted">–</td></tr>';

    $('loading').classList.add('hidden');
    $('out').classList.remove('hidden');
  }

  // --- Export ---
  function table(sep) {
    var head = ['Datum', 'Medewerker', 'Kaart', 'Lijst', 'Uren', 'Notitie'];
    if (rate) head.push('Bedrag');
    var lines = [head];
    currentRows.forEach(function (r) {
      var line = [TT.isoDate(r.start), names[r.member] || 'Onbekend', r.card.name, r.card.listName, TT.fmtDecimal(r.min), r.note];
      if (rate) line.push((r.min / 60 * rate).toFixed(2).replace('.', ','));
      lines.push(line);
    });
    return lines.map(function (l) {
      return l.map(function (v) {
        v = String(v == null ? '' : v);
        if (sep === '\t') return v.replace(/[\t\n]/g, ' ');
        return /[";\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
      }).join(sep);
    }).join('\n');
  }

  $('copy').addEventListener('click', function () {
    var text = table('\t');
    var done = function () { $('copied').classList.remove('hidden'); setTimeout(function () { $('copied').classList.add('hidden'); }, 4000); };
    var fallback = function () {
      var ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { /* niets */ }
      document.body.removeChild(ta);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
    else fallback();
  });

  $('csv').addEventListener('click', function () {
    // ; als scheidingsteken + BOM, zodat Nederlandse Excel het direct goed opent
    var blob = new Blob(['﻿' + table(';')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'uren-' + TT.isoDate(Date.now()) + '.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  });

  // --- Filters ---
  $('period').addEventListener('change', function () {
    var custom = this.value === 'custom';
    $('fromWrap').classList.toggle('hidden', !custom);
    $('toWrap').classList.toggle('hidden', !custom);
    if (custom && !$('from').value) {
      var m = TT.periodRange('month');
      $('from').value = TT.isoDate(m.from);
      $('to').value = TT.isoDate(Date.now());
    }
    render();
  });
  ['from', 'to', 'member', 'list'].forEach(function (id) { $(id).addEventListener('change', render); });

  t.render(function () { return loadAll(); });
})();
