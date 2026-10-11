// Pixel UI is the single interface. This control only changes its light/dark palette.
(function () {
  const KEY = 'tasked_theme';
  function get() {
    try { return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light'; }
    catch (e) { return 'light'; }
  }
  function paintBtn() {
    const dark = document.documentElement.dataset.theme !== 'light';
    document.querySelectorAll('[data-theme-btn]').forEach((button) => {
      button.innerHTML = `<i data-icon="${dark ? 'sun' : 'moon'}"></i>`;
      button.title = dark ? 'Включить светлую тему' : 'Включить тёмную тему';
      button.setAttribute('aria-label', button.title);
      if (window.paintIcons) paintIcons(button);
    });
  }
  function apply(theme) {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.style = 'pixel';
    try { localStorage.setItem(KEY, theme); localStorage.removeItem('tasked_style'); } catch (e) {}
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === 'dark' ? '#111711' : '#f4f1df';
    paintBtn();
  }
  window.toggleTheme = () => apply(get() === 'dark' ? 'light' : 'dark');
  function init() { apply(get()); if (window.paintIcons) paintIcons(document); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();

