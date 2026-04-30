(function() {
  'use strict';

  var openBtn = document.getElementById('search-toggle');
  var modal = document.getElementById('search-modal');
  var closeBtn = document.getElementById('search-close');
  var pagefindUI = null;
  var pagefindLoaded = false;

  function initPagefind() {
    if (pagefindUI) return;
    if (typeof PagefindUI === 'undefined') return;
    pagefindUI = new PagefindUI({
      element: '#search-widget',
      pageSize: 10,
      showImages: false,
      showSubResults: true,
      excerptLength: 30,
      resetStyles: true
    });
  }

  function showFallback() {
    var widget = document.getElementById('search-widget');
    if (!widget || pagefindUI) return;
    widget.innerHTML = '<p style="padding:2rem 0;text-align:center;color:var(--color-text-secondary);">'
      + 'Pagefind-Suche ist nur im producktiven Build verfügbar.<br>'
      + '<span style="font-size:0.875rem;">Starte <code>npx pagefind --source public</code> nach dem Hugo-Build.</span>'
      + '</p>';
  }

  function openSearch() {
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    // Pagefind lazy laden – nur einmal versuchen
    if (!pagefindLoaded) {
      pagefindLoaded = true;
      var script = document.createElement('script');
      script.src = '/pagefind/pagefind-ui.js';
      script.onload = function() {
        setTimeout(initPagefind, 100);
        // Wenn nach 5s kein UI da ist, Fallback anzeigen
        setTimeout(function() {
          if (!pagefindUI) showFallback();
        }, 5000);
      };
      script.onerror = function() {
        showFallback();
      };
      document.head.appendChild(script);
    }

    // Fokus auf Pagefind-Suchfeld (sobald vorhanden)
    setTimeout(function() {
      var input = document.querySelector('.pagefind-ui__search-input');
      if (input) input.focus();
    }, 400);
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
