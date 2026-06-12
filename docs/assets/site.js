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
    var placeholder = document.getElementById('site-masthead');
    if (!placeholder) return;

    var activePage = currentPage();
    var isHome = activePage === 'index';

    var header = document.createElement('header');
    header.className = 'site-masthead';
    header.setAttribute('role', 'banner');

    var brand = document.createElement('div');
    brand.className = 'site-masthead__brand';

    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'site-masthead__toggle';
    toggle.setAttribute('aria-label', 'Toggle navigation menu');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', 'site-nav');
    toggle.innerHTML = '<span class="site-masthead__toggle-icon" aria-hidden="true"></span>';

    var logo = document.createElement('a');
    logo.className = 'site-masthead__logo';
    logo.href = 'index.html';
    logo.innerHTML =
      '<img src="assets/logo.png" alt="" width="28" height="28">' +
      '<span>OpenShift Integration Operator</span>';

    brand.appendChild(toggle);
    brand.appendChild(logo);

    var nav = document.createElement('nav');
    nav.className = 'site-masthead__nav';
    nav.id = 'site-nav';
    nav.setAttribute('aria-label', 'Primary');

    var list = document.createElement('ul');
    list.className = 'site-masthead__nav-list';

    NAV_ITEMS.forEach(function (item) {
      list.appendChild(buildNavLink(item, activePage));
    });

    if (isHome) {
      HOME_ANCHORS.forEach(function (item) {
        var li = document.createElement('li');
        var a = document.createElement('a');
        a.className = 'site-masthead__nav-link';
        a.href = item.href;
        a.textContent = item.label;
        li.appendChild(a);
        list.appendChild(li);
      });
    }

    nav.appendChild(list);
    header.appendChild(brand);
    header.appendChild(nav);

    placeholder.replaceWith(header);

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
          '<a href="examples-catalog.html">Examples (255)</a>' +
          '<a href="ready-flows.html">Ready Flows (200+)</a>' +
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
      initFooter();
    });
  } else {
    initMasthead();
    initFooter();
  }
})();
