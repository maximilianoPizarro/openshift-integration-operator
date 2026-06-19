(function () {
  'use strict';

  var SITE_VERSION = 'v0.8.2';
  var SITE_CHART_VERSION = '0.8.2';
  var SITE_RELEASES_URL =
    'https://github.com/maximilianoPizarro/openshift-integration-operator/releases/tag/' + SITE_VERSION;

  var SITE_LINKS = {
    operatorHub: 'https://operatorhub.io/operator/openshift-integration-operator',
    artifactHub: 'https://artifacthub.io/packages/helm/openshift-integration-operator/openshift-integration-operator',
    artifactHubSecurity: 'https://artifacthub.io/packages/helm/openshift-integration-operator/openshift-integration-operator?tab=security-report',
    securityDashboard: 'security.html',
    github: 'https://github.com/maximilianoPizarro/openshift-integration-operator'
  };

  function mastheadHtml() {
    return (
      '<header class="site-masthead" role="banner">' +
        '<div class="site-masthead__brand">' +
          '<button type="button" class="site-masthead__toggle" aria-label="Toggle navigation menu" aria-expanded="false" aria-controls="site-nav">' +
            '<span class="site-masthead__toggle-icon" aria-hidden="true"></span>' +
          '</button>' +
          '<a class="site-masthead__logo" href="index.html">' +
            '<img src="assets/logo.png" alt="" width="28" height="28">' +
            '<span>OpenShift Integration Operator</span>' +
          '</a>' +
        '</div>' +
        '<nav class="site-masthead__nav" id="site-nav" aria-label="Primary">' +
          '<ul class="site-masthead__nav-list">' +
            '<li><a class="site-masthead__nav-link" href="index.html">Home</a></li>' +
            '<li><a class="site-masthead__nav-link" href="try-it-now.html">Try It Now</a></li>' +
            '<li><a class="site-masthead__nav-link" href="quickstart.html">Quick Start</a></li>' +
            '<li><a class="site-masthead__nav-link" href="architecture.html">Architecture</a></li>' +
            '<li><a class="site-masthead__nav-link" href="ready-flows.html">Ready Flows</a></li>' +
            '<li class="nav-dropdown">' +
              '<a class="site-masthead__nav-link" href="#" data-nav-dropdown>Tools ▾</a>' +
              '<ul class="nav-dropdown-menu">' +
                '<li><a href="worker-selector.html">Worker Image Selector</a></li>' +
                '<li><a href="yaml-generator.html">CR YAML Generator</a></li>' +
                '<li><a href="examples-catalog.html">Examples Catalog</a></li>' +
                '<li><a href="security.html">Security Report</a></li>' +
                '<li><a href="operations.html">Operations</a></li>' +
                '<li><a href="troubleshooting.html">Troubleshooting</a></li>' +
              '</ul>' +
            '</li>' +
            '<li class="nav-dropdown">' +
              '<a class="site-masthead__nav-link" href="#" data-nav-dropdown>About ▾</a>' +
              '<ul class="nav-dropdown-menu">' +
                '<li><a href="comparison.html">Comparison</a></li>' +
                '<li><a href="migrating-from-camel-k.html">Migrate</a></li>' +
                '<li><a href="faq.html">FAQ</a></li>' +
                '<li><a href="changelog.html">Changelog</a></li>' +
                '<li><a href="contributing.html">Contribute</a></li>' +
              '</ul>' +
            '</li>' +
          '</ul>' +
        '</nav>' +
      '</header>'
    );
  }

  function footerHtml() {
    return (
      '<footer class="site-footer">' +
        '<div class="container">' +
          '<p>Built by <a href="https://github.com/maximilianoPizarro"><strong>maximilianoPizarro</strong></a></p>' +
          '<nav class="site-footer__links" aria-label="Footer">' +
            '<a href="index.html">Home</a>' +
            '<a href="try-it-now.html">Try It Now</a>' +
            '<a href="quickstart.html">Guide</a>' +
            '<a href="architecture.html">Architecture</a>' +
            '<a href="ready-flows.html">Ready Flows</a>' +
            '<a href="examples-catalog.html">Examples Catalog</a>' +
            '<a href="comparison.html">Comparison</a>' +
            '<a href="worker-selector.html">Tools</a>' +
            '<a href="faq.html">FAQ</a>' +
            '<a href="contributing.html">Contribute</a>' +
            '<a href="' + SITE_LINKS.github + '" target="_blank" rel="noopener noreferrer">GitHub</a>' +
            '<a href="security.html">Security</a>' +
            '<a href="' + SITE_LINKS.operatorHub + '" target="_blank" rel="noopener noreferrer">OperatorHub</a>' +
            '<a href="' + SITE_LINKS.artifactHub + '" target="_blank" rel="noopener noreferrer">Artifact Hub</a>' +
            '<a href="' + SITE_LINKS.artifactHubSecurity + '" target="_blank" rel="noopener noreferrer">Security report</a>' +
          '</nav>' +
          '<p>Licensed under the <a href="https://www.apache.org/licenses/LICENSE-2.0">Apache License 2.0</a>.</p>' +
        '</div>' +
      '</footer>'
    );
  }

  function currentPage() {
    var path = window.location.pathname.split('/').pop() || 'index.html';
    if (path === '' || path === '/') return 'index';
    return path.replace('.html', '');
  }

  function injectSiteChrome() {
    var mastheadSlot = document.getElementById('site-masthead');
    if (mastheadSlot && !mastheadSlot.querySelector('.site-masthead')) {
      mastheadSlot.innerHTML = mastheadHtml();
    }
    var footerSlot = document.getElementById('site-footer');
    if (footerSlot && !footerSlot.querySelector('.site-footer')) {
      footerSlot.innerHTML = footerHtml();
    }
  }

  function initDropdowns(header) {
    header.querySelectorAll('[data-nav-dropdown]').forEach(function (trigger) {
      trigger.addEventListener('click', function (e) {
        e.preventDefault();
        trigger.parentElement.classList.toggle('is-open');
      });
    });
    header.querySelectorAll('.nav-dropdown > .site-masthead__nav-link[href="#"]').forEach(function (trigger) {
      if (trigger.hasAttribute('data-nav-dropdown')) return;
      trigger.addEventListener('click', function (e) {
        e.preventDefault();
        trigger.parentElement.classList.toggle('is-open');
      });
    });
  }

  function initMasthead() {
    injectSiteChrome();

    var nav = document.getElementById('site-nav');
    var toggle = document.querySelector('.site-masthead__toggle');
    var header = document.querySelector('.site-masthead');
    if (!nav || !toggle || !header) return;

    var activePage = currentPage();
    nav.querySelectorAll('.site-masthead__nav-link[href]').forEach(function (link) {
      var href = link.getAttribute('href');
      if (!href || href === '#') return;
      if (href === activePage + '.html' || (activePage === 'index' && href === 'index.html')) {
        link.classList.add('is-active');
        link.setAttribute('aria-current', 'page');
      }
    });

    initDropdowns(header);

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

  function initToc() {
    var tocLinks = document.querySelectorAll('.home-toc a');
    if (tocLinks.length === 0) return;

    var sections = Array.from(tocLinks).map(function(link) {
      return document.querySelector(link.getAttribute('href'));
    }).filter(Boolean);

    function updateActiveToc() {
      var scrollPosition = window.scrollY + 100;

      var currentSection = null;
      sections.forEach(function(section) {
        if (section.offsetTop <= scrollPosition) {
          currentSection = section;
        }
      });

      if (currentSection) {
        tocLinks.forEach(function(link) {
          link.classList.remove('is-active');
          if (link.getAttribute('href') === '#' + currentSection.id) {
            link.classList.add('is-active');
          }
        });
      }
    }

    window.addEventListener('scroll', updateActiveToc, { passive: true });
    updateActiveToc();
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

    links.forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        img.src = this.href;
        modal.classList.add('is-open');
      });
    });

    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeModal();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal.classList.contains('is-open')) closeModal();
    });
  }

  function initCopyButtons() {
    document.querySelectorAll('pre').forEach(function (pre) {
      if (!pre.textContent.trim() || pre.querySelector('.copy-btn')) return;

      var btn = document.createElement('button');
      btn.className = 'copy-btn';
      btn.textContent = 'Copy';
      btn.setAttribute('aria-label', 'Copy code to clipboard');

      btn.addEventListener('click', function () {
        var code = pre.querySelector('code') ? pre.querySelector('code').innerText : pre.innerText;
        navigator.clipboard.writeText(code).then(function () {
          btn.textContent = 'Copied!';
          btn.classList.add('copied');
          setTimeout(function () {
            btn.textContent = 'Copy';
            btn.classList.remove('copied');
          }, 2000);
        });
      });

      pre.appendChild(btn);
    });
  }

  function injectVersionBadges() {
    document.querySelectorAll('.badge--version, [data-site-version-badge]').forEach(function (el) {
      el.textContent = SITE_VERSION;
      if (el.tagName === 'A') {
        el.setAttribute('href', SITE_RELEASES_URL);
      }
    });

    document.querySelectorAll('[data-version-inject]').forEach(function (el) {
      var template = el.getAttribute('data-version-inject') || el.textContent;
      el.textContent = template
        .replace(/\{\{SITE_VERSION\}\}/g, SITE_VERSION)
        .replace(/\{\{SITE_CHART_VERSION\}\}/g, SITE_CHART_VERSION);
    });

    document.querySelectorAll('pre code[data-version-inject]').forEach(function (el) {
      el.innerHTML = el.innerHTML
        .replace(/v0\.\d+\.\d+/g, SITE_VERSION)
        .replace(/openshift-integration-operator-\d+\.\d+\.\d+/g,
          'openshift-integration-operator-' + SITE_CHART_VERSION);
    });
  }

  function boot() {
    initMasthead();
    injectVersionBadges();
    initLightbox();
    initCopyButtons();
    initToc();
  }

  window.SITE_VERSION = SITE_VERSION;
  window.SITE_CHART_VERSION = SITE_CHART_VERSION;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
