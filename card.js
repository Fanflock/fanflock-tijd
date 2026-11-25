/* Fanflock Tijd — popup op de kaart */
/* global TrelloPowerUp, TT */
(function () {
  'use strict';

  var t = TrelloPowerUp.iframe();
  var me = null;          // { id, fullName }
  var names = {};         // memberId -> naam
  var state = null;       // kaartdata
  var busy = false;
  var pendingDelete = null;

  function $(id) { return document.getElementById(id); }

  function showMsg(text, isError) {
    var el = $('msg');
    el.textContent = text || '';
    el.classList.toggle('hidden', !text);
    el.classList.toggle('err', !!isError);
    t.sizeTo('#content');
  }

  function run(fn) {
    if (busy) return;
    busy = true;
    showMsg('');
    return Promise.resolve()
      .then(fn)
      .catch(function (err) { showMsg(err.message || 'Er ging iets mis.', true); })
      .then(function () { busy = false; renderDynamic(); });
  }

  function save(mutate) {
    return TT.update(t, mutate).then(function (res) { state = res.data; return res.result; });
  }

  // --- Rendering ---
  function renderClock() {
    var timer = $('timer');
    var mine = state && state.r[me.id];
    timer.classList.toggle('running', !!mine);
    $('clock').textContent = TT.fmtClock(mine ? Date.now() - mine.s : 0);
    var btn = $('toggle');
    btn.textContent = mine ? 'Stop' : 'Start';
    btn.classList.toggle('mod-primary', !mine);
    btn.classList.toggle('stop', !!mine);
  }

  function renderDynamic() {
    if (!state || !me) return;
    renderClock();

    // Totalen
    var spent = TT.total(state, { includeRunning: true });
    var html = '<div><b>' + TT.fmt(spent) + '</b> uur';
    if (state.b) {
      var pct = Math.round(spent / state.b * 100);
      var cls = pct > 100 ? 'red' : pct >= 80 ? 'yellow' : '';
      html += ' van ' + TT.fmt(state.b) + ' begroot (' + pct + '%)</div>' +
        '<div class="bar ' + cls + '"><span style="width:' + Math.min(100, pct) + '%"></span></div>';
    } else {
      html += '</div>';
    }

    // Per persoon + wie er nu aan werkt
    var perMember = {};
    TT.entries(state).forEach(function (e) { perMember[e.member] = (perMember[e.member] || 0) + e.min; });
    Object.keys(state.r).forEach(function (id) { if (!(id in perMember)) perMember[id] = 0; });
    var chips = Object.keys(perMember).map(function (id) {
      var live = !!state.r[id];
      var min = TT.total(state, { memberId: id, includeRunning: true });
      return '<span class="chip' + (live ? ' live' : '') + '">' + (live ? '▶ ' : '') +
        TT.escapeHtml(TT.firstName(names[id])) + ' ' + TT.fmt(min) + '</span>';
    });
    if (chips.length) html += '<div class="chips" style="margin-top:6px">' + chips.join('') + '</div>';
    $('summary').innerHTML = html;

    // Laatste 10 regels
    var list = TT.entries(state).sort(function (a, b) { return b.start - a.start; }).slice(0, 10);
    $('list').innerHTML = list.map(function (e) {
      var own = e.member === me.id;
      var label = TT.fmtDate(e.start) + ' · ' + TT.firstName(names[e.member]) + (e.note ? ' · ' + e.note : '');
      return '<li><span class="dur">' + TT.fmt(e.min) + '</span>' +
        '<span class="what" title="' + TT.escapeHtml(label) + '">' + TT.escapeHtml(label) + '</span>' +
        (own ? '<button class="del' + (pendingDelete === e.key ? ' confirm' : '') + '" data-key="' +
          TT.escapeHtml(e.key) + '">' + (pendingDelete === e.key ? 'Zeker?' : '✕') + '</button>' : '') +
        '</li>';
    }).join('') || '<li class="muted">Nog niets geregistreerd.</li>';

    if (TT.usage(state) > 0.8) {
      showMsg('Deze kaart nadert de opslaglimiet van Trello (' + Math.round(TT.usage(state) * 100) +
        '%). Maak voor nieuw werk een vervolgkaart.');
    }
    t.sizeTo('#content');
  }

  // --- Acties ---
  $('toggle').addEventListener('click', function () {
    run(function () {
      var now = Date.now();
      var note = $('note').value;
      if (state.r[me.id]) {
        return save(function (d) { return TT.stopTimer(d, me.id, note, now); }).then(function (min) {
          $('note').value = '';
          if (min) t.alert({ message: TT.fmt(min) + ' geregistreerd', duration: 3, display: 'success' });
        });
      }
      return save(function (d) { return TT.startTimer(d, me.id, note, now); });
    });
  });

  $('add').addEventListener('click', function () {
    run(function () {
      var min = TT.parseDuration($('dur').value);
      if (!min) throw new Error('Vul een geldige duur in, bijv. 1:30 of 1,5.');
      var day = TT.parseIsoDate($('date').value) || Date.now();
      var note = $('note').value;
      return save(function (d) { TT.addEntry(d, me.id, day, min, note); }).then(function () {
        $('dur').value = '';
        $('note').value = '';
        t.alert({ message: TT.fmt(min) + ' toegevoegd', duration: 3, display: 'success' });
      });
    });
  });

  $('saveBudget').addEventListener('click', function () {
    run(function () {
      var raw = $('budget').value.trim();
      var min = raw === '' ? null : TT.parseDuration(raw);
      if (raw !== '' && !min) throw new Error('Vul het budget in uren in, bijv. 16 of 7,5.');
      return save(function (d) { d.b = min; }).then(function () {
        t.alert({ message: min ? 'Budget: ' + TT.fmt(min) + ' uur' : 'Budget verwijderd', duration: 3 });
      });
    });
  });

  $('list').addEventListener('click', function (ev) {
    var btn = ev.target.closest('.del');
    if (!btn) return;
    var key = btn.getAttribute('data-key');
    if (pendingDelete !== key) { pendingDelete = key; renderDynamic(); return; }
    pendingDelete = null;
    run(function () { return save(function (d) { return TT.removeEntry(d, key); }); });
  });

  ['dur', 'note'].forEach(function (id) {
    $(id).addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') $(id === 'dur' ? 'add' : 'toggle').click();
    });
  });

  // --- Init ---
  $('date').value = TT.isoDate(Date.now());

  Promise.all([t.member('id', 'fullName'), t.board('members')]).then(function (r) {
    me = r[0];
    names = TT.memberMap(r[1].members);
    names[me.id] = names[me.id] || me.fullName;
  }).then(function () {
    // t.render wordt opnieuw aangeroepen zodra iemand de kaartdata wijzigt
    t.render(function () {
      return TT.load(t).then(function (d) {
        state = d;
        if (document.activeElement !== $('budget')) $('budget').value = d.b ? TT.fmtDecimal(d.b) : '';
        var mine = d.r[me.id];
        if (mine && mine.n && !$('note').value) $('note').value = mine.n;
        renderDynamic();
      });
    });
  });

  setInterval(function () { if (state && me) renderClock(); }, 1000);
})();
