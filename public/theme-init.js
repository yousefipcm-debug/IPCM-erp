// Applied before the app renders so there is no flash of the wrong theme.
(function () {
  try {
    var t = localStorage.getItem('arcis-theme');
    var dark = t ? t === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (dark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
