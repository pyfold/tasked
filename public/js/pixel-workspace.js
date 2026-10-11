/* Tasked responsive workspace: accessible mobile navigation. */
(() => {
  'use strict';
  const sidebar = document.querySelector('.sidebar');
  const header = document.querySelector('.topbar');
  if (!sidebar || !header) return;
  const narrow = window.matchMedia('(max-width: 860px)');
  sidebar.id = 'taskedNavigation';
  const trigger = document.createElement('button');
  trigger.className = 'pixel-menu-trigger';
  trigger.type = 'button';
  trigger.setAttribute('aria-controls', sidebar.id);
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-label', 'Открыть разделы');
  trigger.innerHTML = '<span aria-hidden="true">☰</span>';
  const actions = header.querySelector('.top-actions');
  header.insertBefore(trigger, actions);
  const closer = document.createElement('button');
  closer.className = 'pixel-menu-close btn';
  closer.type = 'button';
  closer.textContent = 'Закрыть разделы ×';
  sidebar.prepend(closer);
  const backdrop = document.createElement('button');
  backdrop.type = 'button';
  backdrop.className = 'pixel-menu-backdrop';
  backdrop.tabIndex = -1;
  backdrop.setAttribute('aria-label', 'Закрыть разделы');
  document.body.append(backdrop);
  const lang = header.querySelector('.lang-switch');
  const marker = document.createComment('language switch desktop position');
  if (lang) lang.before(marker);
  let previous = null;
  const label = (ru, kk) => document.documentElement.lang === 'kk' ? kk : ru;
  function localize() {
    const open = document.body.classList.contains('pixel-nav-open');
    trigger.setAttribute('aria-label', open ? label('Закрыть разделы','Бөлімдерді жабу') : label('Открыть разделы','Бөлімдерді ашу'));
    closer.textContent = label('Закрыть разделы ×','Бөлімдерді жабу ×');
    backdrop.setAttribute('aria-label',label('Закрыть разделы','Бөлімдерді жабу'));
    if(open) sidebar.setAttribute('aria-label',label('Разделы Tasked','Tasked бөлімдері'));
  }
  new MutationObserver(localize).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  function setOpen(open) {
    document.body.classList.toggle('pixel-nav-open', open);
    trigger.setAttribute('aria-expanded', String(open));
    localize();
    if (narrow.matches) sidebar.inert = !open;
    if (open) {
      previous = document.activeElement;
      sidebar.setAttribute('role', 'dialog');
      sidebar.setAttribute('aria-modal', 'true');
      sidebar.setAttribute('aria-label', label('Разделы Tasked','Tasked бөлімдері'));
      sidebar.getBoundingClientRect(); // Flush visibility before transferring keyboard focus.
      closer.focus({preventScroll:true});
      requestAnimationFrame(() => {
        if (document.body.classList.contains('pixel-nav-open')) closer.focus();
      });
      setTimeout(() => {
        if (document.body.classList.contains('pixel-nav-open') && !sidebar.contains(document.activeElement)) closer.focus();
      }, 190);
    } else {
      sidebar.removeAttribute('role');
      sidebar.removeAttribute('aria-modal');
      if (previous && narrow.matches) previous.focus();
    }
  }
  function responsive() {
    setOpen(false);
    if (lang) {
      if (narrow.matches) sidebar.insertBefore(lang, closer.nextSibling);
      else marker.after(lang);
    }
    sidebar.inert = narrow.matches;
  }
  trigger.addEventListener('click', () => setOpen(!document.body.classList.contains('pixel-nav-open')));
  closer.addEventListener('click', () => setOpen(false));
  backdrop.addEventListener('click', () => setOpen(false));
  sidebar.addEventListener('click', event => {
    if (event.target.closest('.side-item') && narrow.matches) setOpen(false);
  });
  document.addEventListener('keydown', event => {
    if (!document.body.classList.contains('pixel-nav-open')) return;
    if (event.key === 'Escape') { event.preventDefault(); setOpen(false); }
    if (event.key === 'Tab') {
      const items = [...sidebar.querySelectorAll('button,a,input,select,[tabindex="0"]')].filter(e => !e.disabled && e.getClientRects().length);
      const first = items[0], last = items[items.length - 1];
      if (!sidebar.contains(document.activeElement)) { event.preventDefault(); first.focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  narrow.addEventListener('change', responsive);
  responsive();
})();

