/* ARCIS — iOS phone layer (≤900px)
   Non-destructive: it NEVER moves, clones or replaces a DOM node, so every
   input, select and event handler in the app keeps working and keeps focus
   while you type. It only (a) stamps each cell with its column label so CSS
   can stack tables into iOS cards, and (b) mirrors the panel's primary
   action into a sticky bottom bar.
   Switches: window.ARCIS_MOBILE = true | false (force on / off). */
(function () {
  'use strict';
  var MQ = window.matchMedia('(max-width: 900px)');
  var timer = null, observer = null;
  var WIDE = 12; // more columns than this stays a scrollable table

  function on() {
    if (window.ARCIS_MOBILE === false) return false;
    if (window.ARCIS_MOBILE === true) return true;
    return MQ.matches;
  }
  function typing() {
    var a = document.activeElement;
    return !!a && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName);
  }
  function txt(el) { return (el.textContent || '').trim(); }

  function stamp(table) {
    var heads = Array.prototype.map.call(table.querySelectorAll('thead th'), txt);
    if (heads.length > WIDE) table.setAttribute('data-ios-wide', '1');
    var rows = table.querySelectorAll('tbody tr, tr');
    Array.prototype.forEach.call(rows, function (tr) {
      Array.prototype.forEach.call(tr.children, function (td, i) {
        if (td.tagName !== 'TD') return;
        var label = heads[i] || '';
        if (label && td.getAttribute('data-ios-label') !== label) {
          td.setAttribute('data-ios-label', label);
        }
        var t = txt(td);
        var empty = (!t || t === '—' || t === '-' || t === '·') &&
                    !td.querySelector('input, select, button, svg, .badge');
        td.classList.toggle('ios-empty', empty);
      });
    });
    table.setAttribute('data-ios', '1');
  }

  function actionBar() {
    var bar = document.getElementById('ios-action-bar');
    var panel = document.querySelector('.panel.active') || document.querySelector('.panel');
    var btn = panel && panel.querySelector('.btn-primary:not(.ios-skip)');
    if (!btn || !on()) { if (bar) bar.remove(); return; }
    var label = txt(btn) || 'Valider';
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'ios-action-bar';
      bar.innerHTML = '<button type="button" class="ios-action-btn"></button>';
      document.body.appendChild(bar);
    }
    var proxy = bar.firstChild;
    if (bar.dataset.label !== label) {
      bar.dataset.label = label;
      proxy.textContent = label;
      proxy.onclick = function () { btn.click(); };
    }
  }

  function run() {
    if (!on() || typing()) return;
    try {
      var tables = document.querySelectorAll('.panel table');
      Array.prototype.forEach.call(tables, stamp);
      actionBar();
    } catch (e) { /* cosmetic layer: never break the app */ }
  }

  function schedule() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(function () { timer = null; run(); }, 120);
  }

  function boot() {
    document.documentElement.classList.toggle('ios-mode', on());
    if (on()) {
      run();
      if (!observer) {
        observer = new MutationObserver(function (muts) {
          if (typing()) return;                   // never rebuild mid-typing
          for (var i = 0; i < muts.length; i++) {
            var t = muts[i].target;
            if (t && t.closest && t.closest('#ios-action-bar')) continue;
            return schedule();
          }
        });
        observer.observe(document.body, { childList: true, subtree: true });
      }
    } else {
      if (observer) { observer.disconnect(); observer = null; }
      var bar = document.getElementById('ios-action-bar');
      if (bar) bar.remove();
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  MQ.addEventListener ? MQ.addEventListener('change', boot) : MQ.addListener(boot);
  // re-stamp after navigation, and once a field is left
  document.addEventListener('click', function (e) {
    if (e.target.closest('.mobile-nav-btn, .nav-btn, .module-btn, .mobile-nav')) setTimeout(boot, 80);
  }, true);
  document.addEventListener('focusout', function () { setTimeout(schedule, 150); }, true);
  window.ARCIS_MOBILE_REFRESH = boot;
})();
