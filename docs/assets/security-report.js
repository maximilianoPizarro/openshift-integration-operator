(function () {
  'use strict';

  var AH_PACKAGE_API =
    'https://artifacthub.io/api/v1/packages/helm/openshift-integration-operator/openshift-integration-operator';
  var AH_PACKAGE_WEB =
    'https://artifacthub.io/packages/helm/openshift-integration-operator/openshift-integration-operator';

  /** Expected images — must stay in sync with helm Chart.yaml artifacthub.io/images */
  var IMAGE_CATALOG = [
    {
      group: 'Platform',
      description: 'Operator control plane and OpenShift Console dynamic plugin',
      images: [
        { name: 'operator', repo: 'openshift-integration-operator', role: 'OLM / Helm operator' },
        { name: 'console-plugin', repo: 'integration-console-plugin', role: 'Console UI' },
      ],
    },
    {
      group: 'Ephemeral workers',
      description: 'Tiered Camel Quarkus workers selected by route components (Quick Try / ephemeral mode)',
      images: [
        { name: 'camel-worker-core', repo: 'camel-worker-core', role: 'Timer, log, direct, seda' },
        { name: 'camel-worker-messaging', repo: 'camel-worker-messaging', role: 'Kafka, JMS, AMQP' },
        { name: 'camel-worker-http', repo: 'camel-worker-http', role: 'HTTP, REST, JSON' },
        { name: 'camel-worker-data', repo: 'camel-worker-data', role: 'SQL, JDBC, MongoDB' },
        { name: 'camel-worker-cloud', repo: 'camel-worker-cloud', role: 'AWS, Azure, GCP' },
        { name: 'camel-worker-ai', repo: 'camel-worker-ai', role: 'MCP, LangChain4j, AI' },
        { name: 'camel-worker-full', repo: 'camel-worker-full', role: 'Full component set' },
        { name: 'camel-yaml-worker', repo: 'camel-yaml-worker', role: 'YAML-only routes (legacy)' },
      ],
    },
    {
      group: 'Testing',
      description: 'Camel test runner for IntegrationFlow test jobs',
      images: [
        { name: 'camel-test-runner', repo: 'camel-test-runner', role: 'CAMEL_TEST integration type' },
      ],
    },
  ];

  function quayImage(repo, tag) {
    return 'quay.io/maximilianopizarro/' + repo + ':' + tag;
  }

  function emptyCounts() {
    return { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, UNKNOWN: 0 };
  }

  function countSeverities(trivyReport) {
    var counts = emptyCounts();
    if (!trivyReport || !trivyReport.Results) return counts;
    trivyReport.Results.forEach(function (result) {
      (result.Vulnerabilities || []).forEach(function (v) {
        var s = String(v.Severity || 'UNKNOWN').toUpperCase();
        if (counts[s] !== undefined) counts[s]++;
        else counts.UNKNOWN++;
      });
    });
    return counts;
  }

  function sumCounts(rows) {
    var total = emptyCounts();
    rows.forEach(function (row) {
      Object.keys(total).forEach(function (k) {
        total[k] += row.counts[k] || 0;
      });
    });
    return total;
  }

  function severityCell(count, severity) {
    if (!count) return '<td class="sec-sev sec-sev--empty" data-severity="' + severity + '">—</td>';
    return '<td class="sec-sev sec-sev--' + severity.toLowerCase() + '" data-severity="' + severity + '">' + count + '</td>';
  }

  function fetchJson(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  function resolveLatestVersion() {
    return fetchJson('index.yaml').then(function (index) {
      var entries = index.entries && index.entries['openshift-integration-operator'];
      if (!entries || !entries.length) throw new Error('No chart versions in index.yaml');
      return entries[0].version;
    });
  }

  function loadReport(version) {
    return fetchJson(AH_PACKAGE_API + '/' + version).then(function (pkg) {
      var packageId = pkg.package_id;
      if (!packageId) throw new Error('Package not found on Artifact Hub');
      return fetchJson(
        'https://artifacthub.io/api/v1/packages/' + packageId + '/' + version + '/security-report'
      ).then(function (report) {
        return {
          version: version,
          packageId: packageId,
          summary: pkg.security_report_summary || null,
          scannedAt: pkg.security_report_created_at || null,
          report: report || {},
          listedImages: pkg.containers_images || [],
        };
      });
    });
  }

  function findReportForImage(reportByImage, repo, tag) {
    var needle = '/' + repo + ':' + tag;
    var key = Object.keys(reportByImage).find(function (k) {
      return k.indexOf(needle) !== -1;
    });
    return key ? reportByImage[key] : null;
  }

  function formatScanTime(ts) {
    if (!ts) return '—';
    try {
      return new Date(ts * 1000).toLocaleString();
    } catch (e) {
      return '—';
    }
  }

  function renderSummaryBar(label, counts) {
    var total = counts.CRITICAL + counts.HIGH + counts.MEDIUM + counts.LOW + counts.UNKNOWN;
    return (
      '<div class="sec-summary-card">' +
        '<div class="sec-summary-card__label">' + label + '</div>' +
        '<div class="sec-summary-card__total">' + total + ' <span>findings</span></div>' +
        '<div class="sec-summary-card__breakdown">' +
          '<span class="sec-pill sec-pill--critical">Critical ' + counts.CRITICAL + '</span>' +
          '<span class="sec-pill sec-pill--high">High ' + counts.HIGH + '</span>' +
          '<span class="sec-pill sec-pill--medium">Medium ' + counts.MEDIUM + '</span>' +
          '<span class="sec-pill sec-pill--low">Low ' + counts.LOW + '</span>' +
        '</div>' +
      '</div>'
    );
  }

  function renderPage(data) {
    var tag = 'v' + data.version;
    var reportByImage = data.report || {};
    var rows = [];
    var listedNames = (data.listedImages || []).map(function (c) { return c.name; });

    IMAGE_CATALOG.forEach(function (section) {
      section.images.forEach(function (img) {
        var fullImage = quayImage(img.repo, tag);
        var trivy = findReportForImage(reportByImage, img.repo, tag);
        var counts = trivy ? countSeverities(trivy) : emptyCounts();
        var status = trivy ? 'scanned' : (listedNames.indexOf(img.name) >= 0 ? 'pending' : 'not-listed');
        rows.push({
          group: section.group,
          name: img.name,
          role: img.role,
          image: fullImage,
          counts: counts,
          status: status,
        });
      });
    });

    var totals = sumCounts(rows.filter(function (r) { return r.status === 'scanned'; }));
    var metaEl = document.getElementById('sec-meta');
    var summaryEl = document.getElementById('sec-summary');
    var tablesEl = document.getElementById('sec-tables');
    var statusEl = document.getElementById('sec-status');

    if (statusEl) statusEl.hidden = true;

    if (metaEl) {
      metaEl.innerHTML =
        '<p>Chart version <strong>' + data.version + '</strong> · Image tag <code>' + tag + '</code> · ' +
        'Scanned on Artifact Hub: <strong>' + formatScanTime(data.scannedAt) + '</strong> · ' +
        '<a href="' + AH_PACKAGE_WEB + '/' + data.version + '?tab=security-report" target="_blank" rel="noopener noreferrer">Open full report on Artifact Hub ↗</a></p>';
    }

    if (summaryEl) {
      summaryEl.innerHTML =
        renderSummaryBar('Combined (scanned images)', totals) +
        (data.summary
          ? renderSummaryBar('Artifact Hub package summary', {
              CRITICAL: data.summary.critical || 0,
              HIGH: data.summary.high || 0,
              MEDIUM: data.summary.medium || 0,
              LOW: data.summary.low || 0,
              UNKNOWN: data.summary.unknown || 0,
            })
          : '');
    }

    if (!tablesEl) return;

    var html = '';
    IMAGE_CATALOG.forEach(function (section) {
      var sectionRows = rows.filter(function (r) { return r.group === section.group; });
      html +=
        '<section class="doc-section">' +
          '<h2>' + section.group + '</h2>' +
          '<p class="section-lead">' + section.description + '</p>' +
          '<div class="table-scroll">' +
            '<table class="sec-table">' +
              '<thead><tr>' +
                '<th>Image</th><th>Role</th><th>Critical</th><th>High</th><th>Medium</th><th>Low</th><th>Status</th>' +
              '</tr></thead><tbody>';

      sectionRows.forEach(function (row) {
        var statusLabel =
          row.status === 'scanned' ? '<span class="sec-status sec-status--ok">Scanned</span>' :
          row.status === 'pending' ? '<span class="sec-status sec-status--pending">Awaiting Trivy scan</span>' :
          '<span class="sec-status sec-status--warn">Not in chart annotation</span>';

        html +=
          '<tr>' +
            '<td><code class="sec-image-ref">' + row.image + '</code></td>' +
            '<td>' + row.role + '</td>' +
            severityCell(row.counts.CRITICAL, 'CRITICAL') +
            severityCell(row.counts.HIGH, 'HIGH') +
            severityCell(row.counts.MEDIUM, 'MEDIUM') +
            severityCell(row.counts.LOW, 'LOW') +
            '<td>' + statusLabel + '</td>' +
          '</tr>';
      });

      html += '</tbody></table></div></section>';
    });

    tablesEl.innerHTML = html;
  }

  function showError(message) {
    var statusEl = document.getElementById('sec-status');
    if (statusEl) {
      statusEl.hidden = false;
      statusEl.className = 'pf-v5-c-alert pf-m-warning sec-alert';
      statusEl.innerHTML =
        '<div class="pf-v5-c-alert__icon"><i class="pf-icon pf-icon-warning-triangle"></i></div>' +
        '<div class="pf-v5-c-alert__title">' + message + '</div>';
    }
  }

  function init() {
    var versionSelect = document.getElementById('sec-version');
    var refreshBtn = document.getElementById('sec-refresh');

    function refresh(selectedVersion) {
      var statusEl = document.getElementById('sec-status');
      if (statusEl) {
        statusEl.hidden = false;
        statusEl.className = 'sec-loading';
        statusEl.textContent = 'Loading vulnerability data from Artifact Hub…';
      }
      document.getElementById('sec-summary').innerHTML = '';
      document.getElementById('sec-tables').innerHTML = '';

      var versionPromise = selectedVersion
        ? Promise.resolve(selectedVersion)
        : resolveLatestVersion();

      versionPromise
        .then(function (version) {
          if (versionSelect && !selectedVersion) versionSelect.value = version;
          return loadReport(version);
        })
        .then(renderPage)
        .catch(function (err) {
          showError(
            'Could not load the security report (' + err.message + '). ' +
            'New chart versions can take up to an hour to appear on Artifact Hub. ' +
            'View the <a href="' + AH_PACKAGE_WEB + '?tab=security-report">Artifact Hub security tab</a> directly.'
          );
        });
    }

    resolveLatestVersion()
      .then(function (latest) {
        if (!versionSelect) return refresh(latest);
        return fetchJson(AH_PACKAGE_API + '/' + latest).then(function (pkg) {
          var versions = (pkg.available_versions || []).map(function (v) { return v.version; });
          if (versions.indexOf(latest) < 0) versions.unshift(latest);
          versionSelect.innerHTML = versions.slice(0, 8).map(function (v) {
            return '<option value="' + v + '">' + v + '</option>';
          }).join('');
          versionSelect.value = latest;
          versionSelect.addEventListener('change', function () {
            refresh(versionSelect.value);
          });
          refresh(latest);
        });
      })
      .catch(function () { refresh(); });

    if (refreshBtn) {
      refreshBtn.addEventListener('click', function () {
        refresh(versionSelect ? versionSelect.value : null);
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
