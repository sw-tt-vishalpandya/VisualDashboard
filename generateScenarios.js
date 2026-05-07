const fs = require('fs');
const path = require('path');
const axios = require('axios');
const xml2js = require('xml2js');
const { exec, spawn } = require('child_process');

const mode = process.argv[2] || 'test';
const baseUrl = 'https://www.softwebsolutions.com';
const sitemapUrl = `${baseUrl}/sitemap.xml`;

const BATCH_SIZE = 50;

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
  "/wordpress-development-services/"
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
const pageName = cleanPath(path);

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

// ------------------ RUN BACKSTOP ------------------
function runBackstopBatch(scenarios, batchIndex) {
  return new Promise((resolve) => {
    delete require.cache[require.resolve('./backstop.json')];
    const config = require('./backstop.json');

    config.scenarios = scenarios;

    // Log every URL being tested so frontend console shows them
    console.log(`\n📋 Batch ${batchIndex + 1} URLs:`);
    scenarios.forEach((s, i) => {
      console.log(`  ${i + 1}. 🌐 TESTING_URL: ${s.url}`);
    });
    console.log('');

    fs.writeFileSync('backstop.json', JSON.stringify(config, null, 2));

    console.log(`Running batch ${batchIndex + 1}`);
    console.log(`BATCH_START:${batchIndex + 1}`);

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
      if (code !== 0) {
        console.log(`⚠️ Batch ${batchIndex + 1} completed with differences`);
      } else {
        console.log(`✅ Batch ${batchIndex + 1} completed`);
      }
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
    await runBackstopBatch(scenarios, i);
  }
}

// ------------------ MAIN ------------------
(async () => {
  try {
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

    console.log('🎉 All batches completed!');
    console.log('PROCESS_COMPLETED');

  } catch (err) {
    console.error('❌ Script failed:', err.message);
  }
})();