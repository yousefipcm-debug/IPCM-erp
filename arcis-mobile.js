/* ARCIS — iOS mobile layer (≤900px only)
   Turns the desktop panels into a native-feeling phone app:
   every data table becomes a grouped list of cells, interactive
   controls are moved (not cloned) into each cell so handlers survive,
   and the panel's primary action becomes a sticky bottom bar.
   Disable at runtime with window.ARCIS_MOBILE = false. */
(function () {
  'use strict';
  var MQ = window.matchMedia('(max-width: 900px)');
  var raf = null, observer = null;

  function on() {
    if (window.ARCIS_MOBILE === false) return false;   // force off
    if (window.ARCIS_MOBILE === true) return true;     // force on (testing on desktop)
    return MQ.matches;
  }
  function txt(el) { return (el.textContent || '').trim(); }
  function isNum(s) { return /[0-9]/.test(s) && /^[\s0-9.,%+\u2212\u2013\-\u00a0DAjh/]*$/.test(s); }

  function interactive(tr) {
    return tr.querySelectorAll('button, input, select, textarea, a[onclick], a[href]:not([href^="#"])');
  }

  function buildRow(tr, heads) {
    var cells = Array.prototype.slice.call(tr.children);
    if (!cells.length) return null;

    var row = document.createElement('div');
    row.className = 'ios-row';

    var main = document.createElement('div');
    main.className = 'ios-row-main';

    // title = first text cell; trailing value = last numeric cell
    var title = txt(cells[0]) || '—';
    var tail = '', tailHtml = '';
    var last = cells[cells.length - 1];
    if (cells.length > 1 && (isNum(txt(last)) || last.querySelector('.badge, .pill'))) {
      tailHtml = last.innerHTML; tail = txt(last);
      cells.pop();
    }
    var metaParts = [];
    for (var i = 1; i < cells.length; i++) {
      var t = txt(cells[i]);
      if (!t || t === '—' || t === '·') continue;
      var label = heads[i] ? heads[i] + ' ' : '';
      metaParts.push(isNum(t) && label ? label + t : t);
    }

    var t1 = document.createElement('div');
    t1.className = 'ios-row-title';
    t1.textContent = title;
    main.appendChild(t1);
    if (metaParts.length) {
      var t2 = document.createElement('div');
      t2.className = 'ios-row-meta';
      t2.textContent = metaParts.join(' · ');
      main.appendChild(t2);
    }
    row.appendChild(main);

    if (tailHtml) {
      var v = document.createElement('div');
      v.className = 'ios-row-value' + (/^\s*[\u2212\u2013-]/.test(tail) ? ' ios-neg' : '');
      v.innerHTML = tailHtml;
      row.appendChild(v);
    }

    // move live controls across so their listeners keep working
    var ctrls = interactive(tr);
    if (ctrls.length) {
      var box = document.createElement('div');
      box.className = 'ios-row-actions';
      Array.prototype.forEach.call(ctrls, function (c) { box.appendChild(c); });
      row.appendChild(box);
    }
    return row;
  }

  function transformTable(table) {
    var heads = Array.prototype.map.call(table.querySelectorAll('thead th'), txt);
    var body = table.querySelector('tbody') || table;
    var trs = Array.prototype.filter.call(body.querySelectorAll('tr'), function (tr) {
      return tr.querySelector('td');
    });
    if (!trs.length) return;

    var list = document.createElement('div');
    list.className = 'ios-list';
    list.setAttribute('data-ios-list', '1');

    trs.forEach(function (tr) {
      var r = buildRow(tr, heads);
      if (r) list.appendChild(r);
    });

    table.setAttribute('data-ios', '1');
    table.classList.add('ios-hidden');
    var host = table.closest('.tbl-wrap') || table.parentNode;
    host.parentNode.insertBefore(list, host.nextSibling);
  }

  function hoistPrimary() {
    var bar = document.getElementById('ios-action-bar');
    var panel = document.querySelector('.panel.active');
    if (!panel) { if (bar) bar.remove(); return; }
    var btn = panel.querySelector('.btn-primary:not(.ios-skip)');
    if (!btn) { if (bar) bar.remove(); return; }
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'ios-action-bar';
      document.body.appendChild(bar);
    }
    var label = txt(btn) || 'Valider';
    if (bar.dataset.label === label) return;
    bar.dataset.label = label;
    bar.innerHTML = '';
    var proxy = document.createElement('button');
    proxy.type = 'button';
    proxy.className = 'ios-action-btn';
    proxy.textContent = label;
    proxy.addEventListener('click', function () { btn.click(); });
    bar.appendChild(proxy);
    btn.classList.add('ios-hoisted');
  }

  function run() {
    if (!on()) return;
    try {
      document.querySelectorAll('.panel table:not([data-ios])').forEach(transformTable);
      hoistPrimary();
    } catch (e) { /* never break the app for a cosmetic layer */ }
  }

  function schedule() {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(function () { raf = null; run(); });
  }

  function teardown() {
    document.querySelectorAll('[data-ios-list]').forEach(function (n) { n.remove() });
    document.querySelectorAll('table[data-ios]').forEach(function (t) {
      t.removeAttribute('data-ios'); t.classList.remove('ios-hidden');
    });
    document.querySelectorAll('.ios-hoisted').forEach(function (b) { b.classList.remove('ios-hoisted') });
    var bar = document.getElementById('ios-action-bar');
    if (bar) bar.remove();
  }

  function boot() {
    document.documentElement.classList.toggle('ios-mode', on());
    if (on()) {
      run();
      if (!observer) {
        observer = new MutationObserver(schedule);
        observer.observe(document.body, { childList: true, subtree: true });
      }
    } else {
      if (observer) { observer.disconnect(); observer = null; }
      teardown();
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  MQ.addEventListener ? MQ.addEventListener('change', boot) : MQ.addListener(boot);
  document.addEventListener('click', function (e) {
    if (e.target.closest('.mobile-nav-btn, .nav-btn, .module-btn')) setTimeout(boot, 60);
  }, true);
  window.ARCIS_MOBILE_REFRESH = boot;
})();
