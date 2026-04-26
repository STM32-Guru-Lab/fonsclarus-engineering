// FonsClarus — Lightweight copy button for code blocks
(function () {
  'use strict';

  function addCopyButtons() {
    var codeBlocks = document.querySelectorAll('.highlight, pre');

    codeBlocks.forEach(function (block) {
      // Avoid adding duplicate buttons
      if (block.querySelector('.copy-button')) return;

      var button = document.createElement('button');
      button.className = 'copy-button';
      button.textContent = 'Copy';

      button.addEventListener('click', function () {
        var code = block.querySelector('code');
        var text = code ? code.textContent : block.textContent;

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () {
            button.textContent = 'Copied!';
            button.classList.add('copy-button--copied');
            setTimeout(function () {
              button.textContent = 'Copy';
              button.classList.remove('copy-button--copied');
            }, 2000);
          });
        } else {
          // Fallback for older browsers
          var ta = document.createElement('textarea');
          ta.value = text;
          ta.style.position = 'fixed';
          ta.style.left = '-9999px';
          document.body.appendChild(ta);
          ta.select();
          try {
            document.execCommand('copy');
            button.textContent = 'Copied!';
            button.classList.add('copy-button--copied');
            setTimeout(function () {
              button.textContent = 'Copy';
              button.classList.remove('copy-button--copied');
            }, 2000);
          } catch (e) {}
          document.body.removeChild(ta);
        }
      });

      block.style.position = 'relative';
      block.appendChild(button);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addCopyButtons);
  } else {
    addCopyButtons();
  }
})();
