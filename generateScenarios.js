const fs = require('fs');
const path = require('path');
const axios = require('axios');
const xml2js = require('xml2js');
const { exec, spawn } = require('child_process');

const mode = process.argv[2] || 'test';
const baseUrl = 'https://www.softwebsolutions.com';
const sitemapUrl = `${baseUrl}/sitemap.xml`;

const BATCH_SIZE = 50;
const BATCH_DIR_PATTERN = /^batch_(\d+)$/;

// ------------------ SOURCE OF TRUTH ------------------
// Add or remove paths here to control which pages are visually tested.
// Each path must exist in the sitemap — missing ones are automatically skipped.
const pages = [
  "/",
  "/about-softweb-solutions/",
  "/adaptive-ai-development-company/",
  "/agentforce-consulting-services/",
  "/agentic-ai-services/",
  "/ai-agent-development-company/",
  "/ai-anomaly-detection/",
  "/ai-automation-testing-services/",
  "/ai-chatbot-development-company/",
  "/ai-consulting-services/",
  "/ai-defect-detection-visual-inspection/",
  "/ai-development-services/",
  "/ai-powered-inventory-management/",
  "/ai-prompt-engineering-services/",
  "/aiops-solutions/",
  "/application-managed-services/",
  "/automated-data-capture-solutions/",
  "/automated-quality-control-inspection-with-ai/",
  "/autonomous-ai-agents-development/",
  "/aws-cloud-migration-services/",
  "/aws-data-analytics-consulting/",
  "/aws-sagemaker-consulting-services/",
  "/aws-services/",
  "/azure-ai-services/",
  "/azure-cloud-service/",
  "/azure-consulting-services/",
  "/azure-data-services/",
  "/azure-devops-consulting-services/",
  "/big-data-services/",
  "/business-intelligence-consulting/",
  "/business-process-automation-services/",
  "/client-testimonial/",
  "/cloud-application-development-services/",
  "/cloud-consulting-services/",
  "/cloud-managed-services/",
  "/cloud-migration-services/",
  "/cloud-transformation-services/",
  "/computer-vision/",
  "/custom-net-development-services/",
  "/custom-software-development/",
  "/customer-care-bot-development/",
  "/customer-data-platform/",
  "/dashboard-development-services/",
  "/data-analytics-banking-dashboard/",
  "/data-analytics-finance-dashboard/",
  "/data-analytics-services/",
  "/data-engineering-consulting-services/",
  "/data-governance-services/",
  "/data-integration-services/",
  "/data-managed-services/",
  "/data-migration-services/",
  "/data-pipeline-automation-services/",
  "/data-science-development/",
  "/data-visualization-consulting/",
  "/databricks-consulting-services/",
  "/decision-intelligence-system/",
  "/deep-learning-solutions/",
  "/defect-detection-in-packaging/",
  "/devops-consulting-services/",
  "/digital-process-automation-services/",
  "/digital-supply-chain-solutions/",
  "/digital-supply-chain/",
  "/digital-transformation-consulting/",
  "/edge-ai-solutions/",
  "/enterprise-app-development/",
  "/enterprise-data-management-services/",
  "/enterprise-data-warehouse/",
  "/fabric-consulting-services/",
  "/face-recognition-services/",
  "/finance-industry/",
  "/flutter-app-development-services/",
  "/front-end-development/",
  "/full-stack-development-company/",
  "/generative-ai-consulting-services/",
  "/hybrid-cloud-services/",
  "/image-annotation-services/",
  "/image-processing-services/",
  "/industries/",
  "/intelligent-automation-services/",
  "/intelligent-document-processing-solutions/",
  "/intelligent-forecasting-services/",
  "/intelligent-video-analytics-solutions/",
  "/intelligent-virtual-assistant/",
  "/inventory-analytics-dashboards/",
  "/large-language-model-development/",
  "/legacy-application-modernization/",
  "/llmops-services/",
  "/machine-learning-consulting/",
  "/machine-learning-services/",
  "/machine-monitoring-system/",
  "/managed-services-provider/",
  "/manufacturing-industry/",
  "/microservices/",
  "/microsoft-365-consulting-services/",
  "/microsoft-consulting-services/",
  "/microsoft-copilot-studio-consulting/",
  "/microsoft-hololens-app-development-company/",
  "/microsoft-viva-consulting/",
  "/mlops-consulting-services/",
  "/mobile-app-development/",
  "/mulesoft-consulting-services/",
  "/multicloud-managed-services/",
  "/natural-language-processing-services/",
  "/net-maui-development-services/",
  "/nodejs-application-development/",
  "/partner-relationship-management/",
  "/power-automate-consulting/",
  "/power-bi-consulting-services/",
  "/power-bi-oee-dashboards/",
  "/power-platform-consulting-services/",
  "/powerapps-consulting-services/",
  "/predictive-analytics-services/",
  "/product-engineering-service/",
  "/product-information-management-system/",
  "/production-line-monitoring-solution/",
  "/python-development-services/",
  "/quality-inspection-in-manufacturing/",
  "/rag-as-a-service/",
  "/react-native-app-development-services/",
  "/reactjs-development-services/",
  "/recommendation-system-development-services/",
  "/salesforce-ai-consulting/",
  "/salesforce-cloud-services/",
  "/salesforce-commerce-cloud-services/",
  "/salesforce-consulting-services/",
  "/salesforce-data-cloud-services/",
  "/salesforce-development-services/",
  "/salesforce-experience-cloud-services/",
  "/salesforce-implementation-services/",
  "/salesforce-integration-services/",
  "/salesforce-migration-services/",
  "/salesforce-revenue-cloud-advanced/",
  "/salesforce-revenue-cloud-services/",
  "/salesforce-sales-cloud-services/",
  "/semiconductor/",
  "/sharepoint-consulting-services/",
  "/simple-reflex-ai-agents/",
  "/sitecore-implementation/",
  "/sitecore-managed-services/",
  "/snowflake-consulting-services/",
  "/solutions/",
  "/supply-chain-automation-solution/",
  "/supply-chain-bot-development/",
  "/supply-chain/",
  "/surface-defect-detection/",
  "/tableau-consulting-services/",
  "/vision-based-eol-detection/",
  "/wafer-defect-detection/",
  "/web-application-development/",
  "/wordpress-development-services/",
  "/portfolio/"
];

// ------------------ FETCH SITEMAP ------------------
async function fetchSitemap() {
  console.log('📥 Fetching sitemap...');

  const { data } = await axios.get(sitemapUrl);
  const parsed = await xml2js.parseStringPromise(data);

  let urls = [];

  if (parsed.urlset?.url) {
    urls = parsed.urlset.url.map(u => u.loc[0]);
  } else if (parsed.sitemapindex?.sitemap) {
    console.log('🔁 Sitemap index detected. Fetching child sitemaps...');

    const sitemapLinks = parsed.sitemapindex.sitemap.map(s => s.loc[0]);

    for (const link of sitemapLinks) {
      try {
        const { data: childData } = await axios.get(link);
        const childParsed = await xml2js.parseStringPromise(childData);

        if (childParsed.urlset?.url) {
          urls.push(...childParsed.urlset.url.map(u => u.loc[0]));
        }
      } catch (err) {
        console.log(`❌ Failed child sitemap: ${link}`);
      }
    }
  }

  console.log(`✅ Total sitemap URLs: ${urls.length}`);
  return urls;
}

// ------------------ FILTER ------------------
function filterPagesFromSitemap(allUrls) {
  const sitemapPaths = allUrls.map(url => url.replace(baseUrl, ''));

  const validPages = pages.filter(page => sitemapPaths.includes(page));
  const missingPages = pages.filter(page => !sitemapPaths.includes(page));

  console.log(`✅ Valid pages: ${validPages.length}`);
  console.log(`⚠️ Missing pages: ${missingPages.length}`);

  if (missingPages.length > 0) {
    console.log('Missing pages:', missingPages);
  }

  return validPages;
}

// ------------------ CHUNK ------------------
function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}
function cleanPath(p) {
  if (!p || typeof p !== 'string') {
    return 'unknown';
  }

  return p
    .replace(/^\/|\/$/g, '')  
    .replace(/\//g, '-')      
    || 'home';
}

// ------------------ SCENARIOS ------------------
function generateScenarios(pagesBatch) {
  return pagesBatch.flatMap(pagePath => {

    const pageName = cleanPath(pagePath);
    const fullUrl = baseUrl + pagePath;

    return [
      {
        label: `${pageName}_Full_Page`,
        url: fullUrl,
        delay: 15000,
        selectors: ["document"],
        misMatchThreshold: 0.1,
        requireSameDimensions: true
      },
      // {
      //   label: `${pageName}_Header`,
      //   url: fullUrl,
      //   selectors: ["header"],
      //   delay: 1000,
      //   misMatchThreshold: 0.15
      // },
      // {
      //   label: `${pageName}_Menu`,
      //   url: fullUrl,
      //   selectors: ["nav"],
      //   delay: 1000,
      //   misMatchThreshold: 0.15
      // }
    ];
  });
}

function toReportPath(htmlReportDir, targetPath) {
  return path.relative(htmlReportDir, targetPath).replace(/\\/g, '/');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function findLatestBackstopReport(batchDir) {
  const testDir = path.join(batchDir, 'bitmaps_test');
  if (!fs.existsSync(testDir)) {
    return null;
  }

  return fs.readdirSync(testDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => path.join(testDir, entry.name, 'report.json'))
    .filter(reportPath => fs.existsSync(reportPath))
    .map(reportPath => ({ reportPath, mtimeMs: fs.statSync(reportPath).mtimeMs }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs)[0]?.reportPath || null;
}

function readBatchMetadata(backstopDataDir, batchNumber) {
  const metadataPath = path.join(backstopDataDir, 'batch_reports', `batch-${batchNumber}.json`);
  if (!fs.existsSync(metadataPath)) {
    return {};
  }

  try {
    return JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  } catch {
    return {};
  }
}

function collectBatchReportItems(backstopDataDir, htmlReportDir) {
  if (!fs.existsSync(backstopDataDir)) {
    return [];
  }

  return fs.readdirSync(backstopDataDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && BATCH_DIR_PATTERN.test(entry.name))
    .map(entry => {
      const batchNumber = Number(entry.name.match(BATCH_DIR_PATTERN)[1]);
      return {
        batchNumber,
        batchDir: path.join(backstopDataDir, entry.name),
        latestReportPath: findLatestBackstopReport(path.join(backstopDataDir, entry.name)),
        metadata: readBatchMetadata(backstopDataDir, batchNumber)
      };
    })
    .filter(batch => batch.latestReportPath)
    .sort((a, b) => a.batchNumber - b.batchNumber)
    .flatMap(batch => {
      const report = JSON.parse(fs.readFileSync(batch.latestReportPath, 'utf8'));
      const batchHtmlReportDir = path.join(batch.batchDir, 'html_report');
      const reportTimestamp = path.basename(path.dirname(batch.latestReportPath));
      const executionTimestamp = batch.metadata.timestamp || reportTimestamp;

      return (report.tests || []).map(test => {
        const pair = test.pair || {};
        const referencePath = pair.reference
          ? path.resolve(batchHtmlReportDir, pair.reference)
          : null;
        const testPath = pair.test
          ? path.resolve(batchHtmlReportDir, pair.test)
          : null;
        const diffPath = pair.diffImage
          ? path.resolve(batchHtmlReportDir, pair.diffImage)
          : null;

        return {
          batchNumber: batch.batchNumber,
          batchName: `batch_${batch.batchNumber}`,
          executionTimestamp,
          reportTimestamp,
          status: test.status || 'unknown',
          label: pair.label || '',
          url: pair.url || '',
          selector: pair.selector || '',
          viewportLabel: pair.viewportLabel || '',
          misMatchPercentage: pair.diff?.misMatchPercentage || '0.00',
          reference: referencePath && fs.existsSync(referencePath) ? toReportPath(htmlReportDir, referencePath) : '',
          test: testPath && fs.existsSync(testPath) ? toReportPath(htmlReportDir, testPath) : '',
          diff: diffPath && fs.existsSync(diffPath) ? toReportPath(htmlReportDir, diffPath) : ''
        };
      });
    });
}

function renderImageCell(src, alt) {
  if (!src) {
    return '<div class="missing">Not generated</div>';
  }

  return `<a href="${escapeHtml(src)}" target="_blank" rel="noreferrer"><img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}"></a>`;
}

function buildConsolidatedReportHtml(items, generatedAt) {
  const batches = [...new Set(items.map(item => item.batchNumber))].sort((a, b) => a - b);
  const total = items.length;
  const failed = items.filter(item => item.status !== 'pass').length;
  const passed = total - failed;
  const reportData = JSON.stringify({ generatedAt, items }).replace(/</g, '\\u003c');

  const batchSummary = batches.map(batchNumber => {
    const batchItems = items.filter(item => item.batchNumber === batchNumber);
    const batchFailed = batchItems.filter(item => item.status !== 'pass').length;
    const batchPassed = batchItems.length - batchFailed;
    return `<div class="summary-card batch-card" data-batch="${batchNumber}"><span>batch_${batchNumber}</span><strong>${batchItems.length}</strong><small>${batchPassed} passed · ${batchFailed} failed</small></div>`;
  }).join('\n');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Consolidated Visual Report</title>
  <style>
    body { margin: 0; font-family: Arial, sans-serif; background: #f4f6f8; color: #1f2933; }
    header.page { background: #12324a; color: #fff; padding: 24px 32px; }
    header.page h1 { margin: 0 0 8px; font-size: 28px; }
    header.page p { margin: 0; opacity: .88; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; padding: 20px 32px; }
    .summary-card { background: #fff; border: 1px solid #d9e2ec; border-radius: 8px; padding: 14px; }
    .batch-card.active { border-color: #1769aa; box-shadow: 0 0 0 2px rgba(23, 105, 170, .14); }
    .summary-card span, .summary-card small { display: block; color: #52606d; }
    .summary-card strong { display: block; font-size: 24px; margin: 6px 0; }
    .controls { display: flex; align-items: end; gap: 16px; padding: 0 32px 20px; flex-wrap: wrap; }
    .controls label { display: block; margin-bottom: 6px; font-size: 13px; font-weight: 700; color: #334e68; }
    .controls select { min-width: 220px; padding: 10px 12px; border: 1px solid #bcccdc; border-radius: 6px; background: #fff; color: #1f2933; }
    .batch-details { color: #52606d; line-height: 1.5; }
    main { padding: 0 32px 32px; }
    .result { background: #fff; border: 1px solid #d9e2ec; border-left: 6px solid #2f855a; border-radius: 8px; margin-bottom: 18px; overflow: hidden; }
    .result.fail { border-left-color: #c53030; }
    .result header { display: flex; justify-content: space-between; gap: 16px; padding: 16px; border-bottom: 1px solid #e6edf3; }
    .result h2 { margin: 4px 0; font-size: 18px; }
    .result a { color: #1769aa; word-break: break-all; }
    .meta { color: #52606d; font-size: 13px; }
    .status { text-align: right; min-width: 180px; }
    .status strong, .status span { display: block; margin-bottom: 4px; }
    .images { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; padding: 16px; }
    .images section { border: 1px solid #e6edf3; border-radius: 8px; overflow: hidden; background: #f8fafc; }
    .images h3 { margin: 0; padding: 10px 12px; font-size: 14px; background: #eef2f7; }
    .images img { display: block; width: 100%; max-height: 520px; object-fit: contain; background: #fff; }
    .missing { min-height: 140px; display: flex; align-items: center; justify-content: center; color: #7b8794; }
    .empty { background: #fff; border: 1px solid #d9e2ec; border-radius: 8px; padding: 20px; color: #52606d; }
    @media (max-width: 900px) {
      .result header, .images { grid-template-columns: 1fr; display: grid; }
      .status { text-align: left; }
    }
  </style>
</head>
<body>
  <header class="page">
    <h1>Consolidated Visual Report</h1>
    <p>Generated ${escapeHtml(generatedAt)} · ${total} comparisons · ${passed} passed · ${failed} failed · ${batches.length} batches</p>
  </header>
  <section class="summary">
    <div class="summary-card"><span>Total Comparisons</span><strong>${total}</strong><small>Across all batches</small></div>
    <div class="summary-card"><span>Passed</span><strong>${passed}</strong><small>Within threshold</small></div>
    <div class="summary-card"><span>Failed</span><strong>${failed}</strong><small>Needs review</small></div>
    ${batchSummary}
  </section>
  <section class="controls">
    <div>
      <label for="batchSelect">Select Batch</label>
      <select id="batchSelect"></select>
    </div>
    <div class="batch-details" id="batchDetails"></div>
  </section>
  <main id="results">
    <div class="empty">No batch test reports found yet.</div>
  </main>
  <script type="application/json" id="reportData">${reportData}</script>
  <script>
    const reportData = JSON.parse(document.getElementById('reportData').textContent);
    const items = reportData.items || [];
    const select = document.getElementById('batchSelect');
    const details = document.getElementById('batchDetails');
    const results = document.getElementById('results');
    const batches = [...new Set(items.map(item => item.batchNumber))].sort((a, b) => a - b);

    function escapeHtml(value) {
      return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function imageCell(src, alt) {
      if (!src) return '<div class="missing">Not generated</div>';
      return '<a href="' + escapeHtml(src) + '" target="_blank" rel="noreferrer"><img src="' + escapeHtml(src) + '" alt="' + escapeHtml(alt) + '"></a>';
    }

    function renderBatch(batchNumber) {
      const batchItems = items.filter(item => item.batchNumber === Number(batchNumber));
      const failed = batchItems.filter(item => item.status !== 'pass').length;
      const passed = batchItems.length - failed;
      const timestamp = batchItems[0]?.executionTimestamp || 'N/A';

      document.querySelectorAll('.batch-card').forEach(card => {
        card.classList.toggle('active', card.dataset.batch === String(batchNumber));
      });

      details.innerHTML = '<strong>batch_' + escapeHtml(batchNumber) + '</strong><br>' +
        batchItems.length + ' comparisons · ' + passed + ' passed · ' + failed + ' failed<br>' +
        'Execution timestamp: ' + escapeHtml(timestamp);

      if (!batchItems.length) {
        results.innerHTML = '<div class="empty">No report data found for this batch.</div>';
        return;
      }

      results.innerHTML = batchItems.map(item => (
        '<article class="result ' + (item.status === 'pass' ? 'pass' : 'fail') + '">' +
          '<header>' +
            '<div>' +
              '<div class="meta">' + escapeHtml(item.batchName || ('batch_' + item.batchNumber)) + ' · ' + escapeHtml(item.viewportLabel) + ' · ' + escapeHtml(item.selector) + '</div>' +
              '<h2>' + escapeHtml(item.label) + '</h2>' +
              '<a href="' + escapeHtml(item.url) + '" target="_blank" rel="noreferrer">' + escapeHtml(item.url) + '</a>' +
            '</div>' +
            '<div class="status">' +
              '<strong>' + escapeHtml(String(item.status).toUpperCase()) + '</strong>' +
              '<span>' + escapeHtml(item.misMatchPercentage) + '% mismatch</span>' +
              '<span>' + escapeHtml(item.executionTimestamp) + '</span>' +
            '</div>' +
          '</header>' +
          '<div class="images">' +
            '<section><h3>Reference Image</h3>' + imageCell(item.reference, item.label + ' reference') + '</section>' +
            '<section><h3>Test Image</h3>' + imageCell(item.test, item.label + ' test') + '</section>' +
            '<section><h3>Diff Image</h3>' + imageCell(item.diff, item.label + ' diff') + '</section>' +
          '</div>' +
        '</article>'
      )).join('');
    }

    batches.forEach(batchNumber => {
      const option = document.createElement('option');
      option.value = String(batchNumber);
      option.textContent = 'batch_' + batchNumber;
      select.appendChild(option);
    });

    select.addEventListener('change', event => renderBatch(event.target.value));

    if (batches.length) {
      select.value = String(batches[0]);
      renderBatch(batches[0]);
    } else {
      select.disabled = true;
      details.textContent = 'No executed batches found.';
    }
  </script>
</body>
</html>`;
}

function generateConsolidatedReport() {
  const backstopDataDir = path.join(process.cwd(), 'backstop_data');
  const htmlReportDir = path.join(backstopDataDir, 'html_report');
  fs.mkdirSync(htmlReportDir, { recursive: true });

  const generatedAt = new Date().toISOString();
  const items = collectBatchReportItems(backstopDataDir, htmlReportDir);
  const reportJsonPath = path.join(htmlReportDir, 'Visual-Report.json');
  const reportHtmlPath = path.join(htmlReportDir, 'Visual-Report.html');

  fs.writeFileSync(reportJsonPath, JSON.stringify({ generatedAt, total: items.length, items }, null, 2));
  fs.writeFileSync(reportHtmlPath, buildConsolidatedReportHtml(items, generatedAt));

  console.log(`📊 Consolidated report JSON: ${reportJsonPath}`);
  console.log(`📊 Consolidated report HTML: ${reportHtmlPath}`);
}

// ------------------ RUN BACKSTOP ------------------
// Enhanced with batch-specific directory isolation
function runBackstopBatch(scenarios, batchIndex, totalBatches) {
  return new Promise((resolve) => {
    const batchNumber = batchIndex + 1;

    // Setup isolated batch directories
    const backstopDataDir = path.join(process.cwd(), 'backstop_data');
    const batchDir = path.join(backstopDataDir, `batch_${batchNumber}`);
    const sharedEngineScriptsDir = path.join(backstopDataDir, 'engine_scripts');

    // Create batch-specific directory structure
    const dirsToCreate = [
      batchDir,
      path.join(batchDir, 'bitmaps_reference'),
      path.join(batchDir, 'bitmaps_test'),
      path.join(batchDir, 'html_report'),
      path.join(batchDir, 'ci_report')
    ];

    dirsToCreate.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    if (!fs.existsSync(sharedEngineScriptsDir)) {
      throw new Error(`Backstop engine scripts folder not found: ${sharedEngineScriptsDir}`);
    }

    console.log(`📁 Batch ${batchNumber} directory: ${batchDir}`);

    // Load and configure backstop.json
    delete require.cache[require.resolve('./backstop.json')];
    let config = require('./backstop.json');

    // Configure paths to point to batch-specific directories
    config.paths = {
      bitmaps_reference: path.join(batchDir, 'bitmaps_reference'),
      bitmaps_test: path.join(batchDir, 'bitmaps_test'),
      engine_scripts: sharedEngineScriptsDir,
      html_report: path.join(batchDir, 'html_report'),
      ci_report: path.join(batchDir, 'ci_report')
    };

    config.scenarios = scenarios;
    config.report = ['CI'];

    // Log every URL being tested so frontend console shows them
    console.log(`\n📋 Batch ${batchNumber} URLs (${scenarios.length} total):`);
    scenarios.forEach((s, i) => {
      console.log(`  ${i + 1}. 🌐 TESTING_URL: ${s.url}`);
    });
    console.log('');

    // Write batch-specific config file for reference
    const batchConfigPath = path.join(process.cwd(), `backstop_batch_${batchNumber}.json`);
    fs.writeFileSync(batchConfigPath, JSON.stringify(config, null, 2));
    
    // Update main backstop.json for BackstopJS execution
    fs.writeFileSync('backstop.json', JSON.stringify(config, null, 2));

    console.log(`▶️  Running batch ${batchNumber} of ${totalBatches} (${scenarios.length} scenarios)`);
    console.log(`BATCH_START:${batchNumber}`);

    // Use spawn instead of exec for real-time stdout streaming
    // exec buffers all output until process exits — SCENARIO > lines arrive too late
    // spawn streams line by line so progress bar updates as each scenario runs
    const backstop = spawn('backstop', [mode], {
      shell: true,
      cwd: process.cwd()
    });

    backstop.stdout.on('data', (data) => {
      process.stdout.write(data);
    });

    backstop.stderr.on('data', (data) => {
      process.stderr.write(data);
    });

    backstop.on('close', (code) => {
      // Save batch metadata for aggregation
      const batchMetadata = {
        batchNumber,
        scenarioCount: scenarios.length,
        status: code === 0 ? 'success' : 'completed_with_differences',
        timestamp: new Date().toISOString(),
        mode: mode,
        batchDir: batchDir,
        urls: scenarios.map(s => s.url)
      };

      const batchReportsDir = path.join(backstopDataDir, 'batch_reports');
      if (!fs.existsSync(batchReportsDir)) {
        fs.mkdirSync(batchReportsDir, { recursive: true });
      }

      const metadataPath = path.join(batchReportsDir, `batch-${batchNumber}.json`);
      fs.writeFileSync(metadataPath, JSON.stringify(batchMetadata, null, 2));

      if (code !== 0) {
        console.log(`⚠️ Batch ${batchNumber} completed with differences`);
      } else {
        console.log(`✅ Batch ${batchNumber} completed successfully`);
      }
      console.log(`📊 Batch metadata saved: ${metadataPath}`);
      resolve();
    });

    backstop.on('error', (err) => {
      console.error(`❌ Backstop spawn error: ${err.message}`);
      resolve();
    });
  });
}

// ------------------ RUN SEQUENTIAL ------------------
async function runSequentially(batches) {
  for (let i = 0; i < batches.length; i++) {
    const scenarios = generateScenarios(batches[i]);
    await runBackstopBatch(scenarios, i, batches.length);
  }
}

// ------------------ MAIN ------------------
(async () => {
  try {
    if (mode === 'report-only') {
      generateConsolidatedReport();
      console.log('PROCESS_COMPLETED');
      return;
    }

    const allUrls = await fetchSitemap();

    const filteredPages = filterPagesFromSitemap(allUrls);

    if (filteredPages.length === 0) {
      throw new Error('❌ No valid pages found');
    }

    const batches = chunkArray(filteredPages, BATCH_SIZE);

    // Total scenarios = pages × scenarios-per-page (1 active) × viewports (set in backstop.json)
    // Frontend listens for this to calculate realistic progress
    const backstopConfig = JSON.parse(require('fs').readFileSync('./backstop.json', 'utf8'));
    const viewportCount = backstopConfig.viewports ? backstopConfig.viewports.length : 1;
    const scenariosPerPage = 1; // only _Full_Page active; update if Header/Menu uncommented
    const totalScenarios = filteredPages.length * scenariosPerPage * viewportCount;
    console.log(`TOTAL_SCENARIOS:${totalScenarios}`);
    console.log(`📦 Total batches: ${batches.length}`);

    await runSequentially(batches);
    if (mode === 'test') {
      generateConsolidatedReport();
    }

    console.log('🎉 All batches completed!');
    console.log('PROCESS_COMPLETED');

  } catch (err) {
    console.error('❌ Script failed:', err.message);
  }
})();
