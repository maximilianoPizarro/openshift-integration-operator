(function () {
  'use strict';

  var NAV_ITEMS = [
    { href: 'index.html', label: 'Home', page: 'index' },
    { href: 'architecture.html', label: 'Architecture', page: 'architecture' },
    { href: 'quickstart.html', label: 'Guide', page: 'quickstart' },
    { href: 'ai-models-and-mcp.html', label: 'AI & MCP', page: 'ai-models-and-mcp' },
    { href: 'migrating-from-camel-k.html', label: 'Migrate', page: 'migrating-from-camel-k' },
    { href: 'operations.html', label: 'Operations', page: 'operations' },
    { href: 'examples-catalog.html', label: 'Examples', page: 'examples-catalog' },
    { href: 'ready-flows.html', label: 'Ready Flows', page: 'ready-flows' },
    { href: 'contributing.html', label: 'Contribute', page: 'contributing' },
    { href: 'https://github.com/maximilianoPizarro/openshift-integration-operator', label: 'GitHub', external: true }
  ];

  var HOME_ANCHORS = [
    { href: '#who-is-this-for', label: 'Audience' },
    { href: '#ephemeral', label: 'Quick Try' },
    { href: '#comparison', label: 'Compare' },
    { href: '#features', label: 'Features' },
    { href: '#screenshots', label: 'Screenshots' }
  ];

  function currentPage() {
    var path = window.location.pathname.split('/').pop() || 'index.html';
    if (path === '' || path === '/') return 'index';
    return path.replace('.html', '');
  }

  function buildNavLink(item, activePage) {
    var li = document.createElement('li');
    var a = document.createElement('a');
    a.className = 'site-masthead__nav-link';
    a.href = item.href;
    a.textContent = item.label;

    if (item.external) {
      a.classList.add('site-masthead__nav-link--external');
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    } else if (item.page === activePage) {
      a.classList.add('is-active');
      a.setAttribute('aria-current', 'page');
    }

    li.appendChild(a);
    return li;
  }

  function initMasthead() {
    var nav = document.getElementById('site-nav');
    var toggle = document.querySelector('.site-masthead__toggle');
    var header = document.querySelector('.site-masthead');
    if (!nav || !toggle || !header) return;

    // Set active link
    var activePage = currentPage();
    var links = nav.querySelectorAll('.site-masthead__nav-link');
    links.forEach(function(link) {
      var href = link.getAttribute('href');
      if (href === activePage + '.html' || (activePage === 'index' && href === 'index.html')) {
        link.classList.add('is-active');
        link.setAttribute('aria-current', 'page');
      }
    });

    // Mobile toggle
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
    });

    document.addEventListener('click', function (e) {
      if (!header.contains(e.target) && nav.classList.contains('is-open')) {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth > 1100 && nav.classList.contains('is-open')) {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }


  function initLightbox() {
    var links = document.querySelectorAll('.lightbox-link');
    if (links.length === 0) return;

    var modal = document.createElement('div');
    modal.className = 'lightbox-modal';
    modal.innerHTML = '<button class="lightbox-close" aria-label="Close">&times;</button><img src="" alt="">';
    document.body.appendChild(modal);

    var img = modal.querySelector('img');
    var closeBtn = modal.querySelector('.lightbox-close');

    function closeModal() {
      modal.classList.remove('is-open');
      img.src = '';
    }

    links.forEach(function(link) {
      link.addEventListener('click', function(e) {
        e.preventDefault();
        img.src = this.href;
        modal.classList.add('is-open');
      });
    });

    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', function(e) {
      if (e.target === modal) closeModal();
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && modal.classList.contains('is-open')) closeModal();
    });
  }


  function initCopyButtons() {
    var blocks = document.querySelectorAll('pre');
    blocks.forEach(function(pre) {
      // Only add copy button if it contains a code block or text
      if (!pre.textContent.trim()) return;
      
      var btn = document.createElement('button');
      btn.className = 'copy-btn';
      btn.textContent = 'Copy';
      btn.setAttribute('aria-label', 'Copy code to clipboard');
      
      btn.addEventListener('click', function() {
        var code = pre.querySelector('code') ? pre.querySelector('code').innerText : pre.innerText;
        navigator.clipboard.writeText(code).then(function() {
          btn.textContent = 'Copied!';
          btn.classList.add('copied');
          setTimeout(function() {
            btn.textContent = 'Copy';
            btn.classList.remove('copied');
          }, 2000);
        });
      });
      
      pre.appendChild(btn);
    });
  }

  function initFooter() {
    var placeholder = document.getElementById('site-footer');
    if (!placeholder) return;

    var footer = document.createElement('footer');
    footer.className = 'site-footer';
    footer.innerHTML =
      '<div class="container">' +
        '<p>Built by <a href="https://github.com/maximilianoPizarro"><strong>maximilianoPizarro</strong></a></p>' +
        '<nav class="site-footer__links" aria-label="Footer">' +
          '<a href="index.html">Home</a>' +
          '<a href="architecture.html">Architecture</a>' +
          '<a href="quickstart.html">Guide</a>' +
          '<a href="ai-models-and-mcp.html">AI &amp; MCP</a>' +
          '<a href="operations.html">Operations</a>' +
          '<a href="examples-catalog.html">Examples (250+)</a>' +
          '<a href="ready-flows.html">Ready Flows (250+)</a>' +
          '<a href="contributing.html">Contribute</a>' +
          '<a href="https://github.com/maximilianoPizarro/openshift-integration-operator" target="_blank" rel="noopener noreferrer">GitHub</a>' +
          '<a href="https://artifacthub.io/packages/search?repo=openshift-integration-operator" target="_blank" rel="noopener noreferrer">Artifact Hub</a>' +
        '</nav>' +
        '<p>Licensed under the <a href="https://www.apache.org/licenses/LICENSE-2.0">Apache License 2.0</a>.</p>' +
      '</div>';

    placeholder.replaceWith(footer);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initMasthead();
      initLightbox();
      initCopyButtons();
      initFooter();
    });
  } else {
    initMasthead();
    initLightbox();
    initCopyButtons();
    initFooter();
  }
})();
