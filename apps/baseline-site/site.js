(function () {
  var LANG_KEY = 'intdeck-baseline-lang';
  var THEME_KEY = 'intdeck-baseline-theme';
  var root = document.documentElement;

  function systemLang() {
    var langs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'en'];
    for (var i = 0; i < langs.length; i++) {
      if (/^zh/i.test(langs[i])) return 'zh';
    }
    return 'en';
  }

  function readLang() {
    try {
      var saved = localStorage.getItem(LANG_KEY);
      if (saved === 'zh' || saved === 'en') return saved;
    } catch (e) {}
    return systemLang();
  }

  function readTheme() {
    try {
      var saved = localStorage.getItem(THEME_KEY);
      if (saved === 'dark' || saved === 'light') return saved;
    } catch (e) {}
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    root.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (e) {}
  }

  function applyLang(lang) {
    var dict = window.INTDECK_BASELINE_I18N && window.INTDECK_BASELINE_I18N[lang];
    if (!dict) return;

    root.lang = lang === 'zh' ? 'zh-CN' : 'en';
    document.title = dict.pageTitle;

    var meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', dict.metaDescription);

    document.querySelectorAll('[data-i18n-attr]').forEach(function (el) {
      var spec = el.getAttribute('data-i18n-attr');
      spec.split(';').forEach(function (pair) {
        var idx = pair.indexOf(':');
        if (idx === -1) return;
        var key = pair.slice(0, idx).trim();
        var attr = pair.slice(idx + 1).trim();
        if (dict[key] != null) el.setAttribute(attr, dict[key]);
      });
    });

    var themeBtn = document.getElementById('theme-toggle');
    if (themeBtn && dict.themeToggle) themeBtn.setAttribute('aria-label', dict.themeToggle);

    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      if (dict[key] != null) el.textContent = dict[key];
    });

    document.querySelectorAll('[data-i18n-html]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-html');
      if (dict[key] != null) el.innerHTML = dict[key];
    });

    var langBtn = document.getElementById('lang-toggle');
    if (langBtn) {
      langBtn.textContent = dict.langToggle;
      langBtn.setAttribute('aria-label', lang === 'zh' ? 'Switch to English' : '切换到中文');
    }

    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch (e) {}
  }

  var currentLang = readLang();
  var currentTheme = readTheme();
  applyTheme(currentTheme);
  applyLang(currentLang);

  document.getElementById('theme-toggle').addEventListener('click', function () {
    currentTheme = root.classList.contains('dark') ? 'light' : 'dark';
    applyTheme(currentTheme);
  });

  document.getElementById('lang-toggle').addEventListener('click', function () {
    currentLang = currentLang === 'zh' ? 'en' : 'zh';
    applyLang(currentLang);
  });

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
    try {
      if (localStorage.getItem(THEME_KEY)) return;
    } catch (err) {}
    currentTheme = e.matches ? 'dark' : 'light';
    applyTheme(currentTheme);
  });
})();
