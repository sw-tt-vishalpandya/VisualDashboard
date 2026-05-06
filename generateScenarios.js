const fs = require('fs');
const path = require('path');
const axios = require('axios');
const xml2js = require('xml2js');
const { exec } = require('child_process');

const mode = process.argv[2] || 'test';
const baseUrl = 'https://www.softwebsolutions.com';
const sitemapUrl = `${baseUrl}/sitemap.xml`;

const BATCH_SIZE = 50;

// ------------------ LOAD PAGES FROM EXCEL ------------------
// Reads URLs from ./tests/PriorityPagesList.xlsx (single "URL" column)
// Strips baseUrl to get path only e.g. https://www.softwebsolutions.com/about/ → /about/
const XLSX = require('xlsx');
const inputFilePath = path.resolve(__dirname, 'tests', 'PriorityPagesList.xlsx');

if (!fs.existsSync(inputFilePath)) {
  console.error(`❌ Excel file not found at: ${inputFilePath}`);
  process.exit(1);
}

const workbook = XLSX.readFile(inputFilePath);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const xlsxRows = XLSX.utils.sheet_to_json(sheet);

const pages = xlsxRows
  .map(row => {
    const url = row['URL'] || row['url'] || Object.values(row)[0] || '';
    return url.toString().trim().replace(baseUrl, '') || '/';
  })
  .filter(p => p.length > 0);

console.log(`📋 Loaded ${pages.length} pages from PriorityPagesList.xlsx`);

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

    fs.writeFileSync('backstop.json', JSON.stringify(config, null, 2));

    console.log(`Running batch ${batchIndex + 1}`);
    console.log(`BATCH_START:${batchIndex + 1}`);

    exec(`backstop ${mode}`, (err, stdout, stderr) => {
      console.log(stdout);
      console.error(stderr);

      if (err) {
        console.log(`⚠️ Batch ${batchIndex + 1} completed with differences`);
      } else {
        console.log(`✅ Batch ${batchIndex + 1} completed`);
      }

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