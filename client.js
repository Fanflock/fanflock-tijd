/* Fanflock Tijd — connector: vertelt Trello welke knoppen en badges de Power-Up toont */
/* global TrelloPowerUp, TT */
(function () {
  'use strict';

  var BASE = window.location.href.replace(/[^/]*(\?.*)?$/, '');
  var ICON = BASE + 'icon.svg';
  var ICON_WHITE = BASE + 'icon-white.svg';

  function openTimer(t) {
    return t.popup({ title: 'Tijdregistratie', url: './card.html', height: 480 });
  }

  // Bepaalt tekst + kleur van de badge op basis van de kaartdata
  function badgeInfo(d) {
    var running = TT.anyRunning(d);
    var spent = TT.total(d, { includeRunning: true });
    if (!running && spent === 0 && !d.b) return null;

    var color = null;
    if (running) color = 'green';
    else if (d.b && spent > d.b) color = 'red';
    else if (d.b && spent >= d.b * 0.8) color = 'yellow';

    return {
      text: (running ? '▶ ' : '') + TT.fmt(spent) + (d.b ? ' / ' + TT.fmt(d.b) : ''),
      color: color,
      icon: color ? ICON_WHITE : ICON
    };
  }

  TrelloPowerUp.initialize({
    'card-buttons': function () {
      return [{ icon: ICON, text: 'Tijd', callback: openTimer }];
    },

    // Badge op de voorkant van de kaart; ververst elke 30 sec als er een timer loopt
    'card-badges': function (t) {
      return TT.load(t).then(function (d) {
        if (!badgeInfo(d)) return [];
        return [{
          dynamic: function () {
            return TT.load(t).then(function (d2) {
              var b = badgeInfo(d2) || { text: '' };
              b.refresh = TT.anyRunning(d2) ? 30 : 300;
              return b;
            });
          }
        }];
      });
    },

    // Badge in de geopende kaart (klikbaar)
    'card-detail-badges': function (t) {
      return TT.load(t).then(function (d) {
        var b = badgeInfo(d);
        return [{
          title: 'Tijd',
          text: b ? b.text : 'Start',
          color: b ? b.color : null,
          callback: openTimer
        }];
      });
    },

    // Overzichtje op de achterkant van de kaart, alleen als er iets is geregistreerd
    'card-back-section': function (t) {
      return TT.load(t).then(function (d) {
        if (!d.e.length && !TT.anyRunning(d) && !d.b) return;
        return {
          title: 'Tijdregistratie',
          icon: ICON,
          content: { type: 'iframe', url: t.signUrl('./section.html'), height: 140 }
        };
      });
    },

    'board-buttons': function () {
      return [{
        icon: { dark: ICON_WHITE, light: ICON },
        text: 'Urenoverzicht',
        callback: function (t) {
          return t.modal({ title: 'Urenoverzicht', url: './report.html', fullscreen: true });
        }
      }];
    },

    'show-settings': function (t) {
      return t.popup({ title: 'Instellingen tijdregistratie', url: './settings.html', height: 220 });
    }
  }, { appName: 'Fanflock Tijd' });
})();
