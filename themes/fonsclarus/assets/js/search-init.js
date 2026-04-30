(function() {
  'use strict';

  var openBtn = document.getElementById('search-toggle');
  var modal = document.getElementById('search-modal');
  var closeBtn = document.getElementById('search-close');
  var pagefindUI = null;

  function initPagefind() {
    if (pagefindUI) return;
    pagefindUI = new PagefindUI({
      element: '#search-widget',
      pageSize: 10,
      showImages: false,
      showSubResults: true,
      excerptLength: 30,
      resetStyles: true
    });
  }

  function openSearch() {
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    // Pagefind lazy laden, falls noch nicht geschehen
    if (!pagefindUI) {
      var script = document.createElement('script');
      script.src = '/pagefind/pagefind-ui.js';
      script.onload = function() {
        setTimeout(initPagefind, 100);
      };
      document.head.appendChild(script);
    }
    // Fokus ins Suchfeld
    setTimeout(function() {
      var input = document.querySelector('.pagefind-ui__search-input');
      if (input) input.focus();
    }, 300);
  }

  function closeSearch() {
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  if (openBtn) {
    openBtn.addEventListener('click', openSearch);
  }
  if (closeBtn) {
    closeBtn.addEventListener('click', closeSearch);
  }

  // Escape schließt das Modal
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeSearch();
  });

  // Klick auf Overlay schließt das Modal
  if (modal) {
    modal.addEventListener('click', function(e) {
      if (e.target === modal || e.target.classList.contains('search-modal__overlay')) {
        closeSearch();
      }
    });
  }
})();
