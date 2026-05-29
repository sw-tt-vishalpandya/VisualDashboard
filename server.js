const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');
const readline = require('readline');
const fs = require('fs');
const XLSX = require('xlsx');

const app = express();

const runningProcesses = {
  reference: null,
  test: null,
  'broken-links': null,
  frontend: null
};

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const PORT = 3001;
const visualUrlsFilePath = path.join(__dirname, 'tests', 'PriorityPagesList.xlsx');
const pageVerificationUrlsFilePath = path.join(__dirname, 'tests', 'PageVerificationUrls.xlsx');
const baselineRunFilePath = path.join(__dirname, 'history.json');

// ---------------- HEALTH ----------------
app.get('/', (req, res) => {
  res.send('✅ Backend running');
});

function isValidUrl(value) {
  try {
    const parsed = new URL(String(value).trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function validateVisualUrlsWorkbook(workbook) {
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  const rows = sheet ? XLSX.utils.sheet_to_json(sheet, { defval: '' }) : [];

  if (!rows.length || !Object.prototype.hasOwnProperty.call(rows[0], 'URLs')) {
    return {
      valid: false,
      urls: [],
      errors: ['Excel file must contain a header column named "URLs".'],
      duplicates: [],
      invalidUrls: []
    };
  }

  const urls = rows
    .map((row, index) => ({
      row: index + 2,
      value: String(row.URLs || '').trim()
    }));

  const invalidUrls = urls.filter(item => !isValidUrl(item.value));
  const counts = urls.filter(item => item.value).reduce((acc, item) => {
    const key = item.value.toLowerCase();
    acc[key] = acc[key] || { url: item.value, rows: [] };
    acc[key].rows.push(item.row);
    return acc;
  }, {});
  const duplicates = Object.values(counts).filter(item => item.rows.length > 1);
  const errors = [];

  if (urls.length === 0) {
    errors.push('Excel file must contain at least one URL under the "URLs" column.');
  }
  if (invalidUrls.length > 0) {
    errors.push(`Invalid URLs found: ${invalidUrls.map(item => `${item.value || '(blank)'} (row ${item.row})`).join(', ')}`);
  }
  if (duplicates.length > 0) {
    errors.push(`Duplicate URLs found: ${duplicates.map(item => `${item.url} (rows ${item.rows.join(', ')})`).join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    urls: urls.map(item => item.value),
    errors,
    duplicates,
    invalidUrls
  };
}

function validateVisualUrlsFile() {
  if (!fs.existsSync(visualUrlsFilePath)) {
    return {
      valid: false,
      urls: [],
      errors: ['Upload PriorityPagesList.xlsx before running Visual Testing.'],
      duplicates: [],
      invalidUrls: []
    };
  }

  const workbook = XLSX.readFile(visualUrlsFilePath);
  return validateVisualUrlsWorkbook(workbook);
}

function validatePageUrlsWorkbook(workbook) {
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  const rows = sheet ? XLSX.utils.sheet_to_json(sheet, { defval: '' }) : [];
  const urlColumn = rows.length && Object.prototype.hasOwnProperty.call(rows[0], 'URLs') ? 'URLs' : 'URL';

  if (!rows.length || !Object.prototype.hasOwnProperty.call(rows[0], urlColumn)) {
    return {
      valid: false,
      urls: [],
      errors: ['Excel file must contain a header column named "URLs" or "URL".'],
      duplicates: [],
      invalidUrls: []
    };
  }

  const urls = rows
    .map((row, index) => ({
      row: index + 2,
      value: String(row[urlColumn] || '').trim()
    }));

  const invalidUrls = urls.filter(item => !isValidUrl(item.value));
  const counts = urls.filter(item => item.value).reduce((acc, item) => {
    const key = item.value.toLowerCase();
    acc[key] = acc[key] || { url: item.value, rows: [] };
    acc[key].rows.push(item.row);
    return acc;
  }, {});
  const duplicates = Object.values(counts).filter(item => item.rows.length > 1);
  const errors = [];

  if (urls.length === 0) {
    errors.push('Excel file must contain at least one URL.');
  }
  if (invalidUrls.length > 0) {
    errors.push(`Invalid URLs found: ${invalidUrls.map(item => `${item.value || '(blank)'} (row ${item.row})`).join(', ')}`);
  }
  if (duplicates.length > 0) {
    errors.push(`Duplicate URLs found: ${duplicates.map(item => `${item.url} (rows ${item.rows.join(', ')})`).join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    urls: urls.map(item => item.value),
    errors,
    duplicates,
    invalidUrls
  };
}

function validatePageUrlsFile() {
  if (!fs.existsSync(pageVerificationUrlsFilePath)) {
    return {
      valid: false,
      urls: [],
      errors: ['Upload PageVerificationUrls.xlsx before running Page Verification.'],
      duplicates: [],
      invalidUrls: []
    };
  }

  const workbook = XLSX.readFile(pageVerificationUrlsFilePath);
  return validatePageUrlsWorkbook(workbook);
}

function formatIstTimestamp(isoTimestamp) {
  if (!isoTimestamp) return '';

  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) return '';

  return `${new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }).format(date)} IST`;
}

function readBaselineHistory() {
  if (!fs.existsSync(baselineRunFilePath)) return [];

  try {
    const history = JSON.parse(fs.readFileSync(baselineRunFilePath, 'utf8'));
    return Array.isArray(history) ? history : [];
  } catch (err) {
    console.error('Could not read baseline history:', err.message);
    return [];
  }
}

function getLatestBaselineArtifactRun() {
  const basePath = path.join(__dirname, 'backstop_data');
  const latest = {
    time: 0,
    path: ''
  };

  function scanDirectory(dirPath, isInReferenceDir = false) {
    if (!fs.existsSync(dirPath)) return;

    let entries = [];
    try {
      entries = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch (err) {
      console.error('Could not scan baseline artifacts:', err.message);
      return;
    }

    entries.forEach(entry => {
      const entryPath = path.join(dirPath, entry.name);
      const inReferenceDir = isInReferenceDir || entry.name === 'bitmaps_reference';

      if (entry.isDirectory()) {
        scanDirectory(entryPath, inReferenceDir);
        return;
      }

      if (!inReferenceDir || !entry.isFile()) return;

      try {
        const stats = fs.statSync(entryPath);
        const modifiedTime = stats.mtime.getTime();
        if (modifiedTime > latest.time) {
          latest.time = modifiedTime;
          latest.path = entryPath;
        }
      } catch (err) {
        console.error('Could not read baseline artifact timestamp:', err.message);
      }
    });
  }

  scanDirectory(basePath);

  if (!latest.time) return null;

  return {
    mode: 'reference',
    status: '',
    time: new Date(latest.time).toISOString(),
    source: 'artifacts',
    artifactPath: latest.path
  };
}

function getLastBaselineRun() {
  const latestHistory = readBaselineHistory()
    .filter(item => item.mode === 'reference' && item.time)
    .sort((a, b) => new Date(b.time) - new Date(a.time))[0];
  const latestArtifact = getLatestBaselineArtifactRun();
  const candidates = [latestHistory, latestArtifact].filter(item => item && item.time);
  const latest = candidates.sort((a, b) => new Date(b.time) - new Date(a.time))[0];

  if (!latest) {
    return {
      lastBaseLineRunUtc: '',
      lastBaseLineRunIst: ''
    };
  }

  return {
    lastBaseLineRunUtc: latest.time,
    lastBaseLineRunIst: formatIstTimestamp(latest.time),
    status: latest.status || '',
    source: latest.source || 'history'
  };
}

function saveBaselineRun(status = 'PASS') {
  const time = new Date().toISOString();
  const history = readBaselineHistory();
  const entry = {
    id: Date.now(),
    mode: 'reference',
    status,
    time
  };

  history.push(entry);
  fs.writeFileSync(baselineRunFilePath, JSON.stringify(history, null, 2));

  return {
    ...entry,
    lastBaseLineRunUtc: time,
    lastBaseLineRunIst: formatIstTimestamp(time)
  };
}

app.get('/baseline-run/status', (req, res) => {
  res.json(getLastBaselineRun());
});

// ---------------- VISUAL URL EXCEL UPLOAD ----------------
app.post('/upload-visual-urls', (req, res) => {
  const { fileName, fileData } = req.body || {};

  if (!fileName || !String(fileName).toLowerCase().endsWith('.xlsx')) {
    return res.status(400).json({ error: 'Only .xlsx files are allowed.' });
  }

  if (!fileData) {
    return res.status(400).json({ error: 'No file data received.' });
  }

  try {
    const buffer = Buffer.from(fileData, 'base64');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const validation = validateVisualUrlsWorkbook(workbook);

    if (!validation.valid) {
      return res.status(400).json(validation);
    }

    fs.mkdirSync(path.dirname(visualUrlsFilePath), { recursive: true });
    fs.writeFileSync(visualUrlsFilePath, buffer);

    return res.json({
      status: 'success',
      message: `Uploaded ${validation.urls.length} URL(s).`,
      count: validation.urls.length,
      filePath: '/tests/PriorityPagesList.xlsx'
    });
  } catch (err) {
    return res.status(400).json({ error: `Could not read Excel file: ${err.message}` });
  }
});

app.get('/visual-urls/status', (req, res) => {
  try {
    const validation = validateVisualUrlsFile();
    res.status(validation.valid ? 200 : 404).json({
      ...validation,
      count: validation.urls.length,
      filePath: '/tests/PriorityPagesList.xlsx'
    });
  } catch (err) {
    res.status(400).json({ error: `Could not read Excel file: ${err.message}` });
  }
});

// ---------------- PAGE VERIFICATION URL EXCEL UPLOAD ----------------
app.post('/upload-page-urls', (req, res) => {
  const { fileName, fileData } = req.body || {};

  if (!fileName || !String(fileName).toLowerCase().endsWith('.xlsx')) {
    return res.status(400).json({ error: 'Only .xlsx files are allowed.' });
  }

  if (!fileData) {
    return res.status(400).json({ error: 'No file data received.' });
  }

  try {
    const buffer = Buffer.from(fileData, 'base64');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const validation = validatePageUrlsWorkbook(workbook);

    if (!validation.valid) {
      return res.status(400).json(validation);
    }

    fs.mkdirSync(path.dirname(pageVerificationUrlsFilePath), { recursive: true });
    fs.writeFileSync(pageVerificationUrlsFilePath, buffer);

    return res.json({
      status: 'success',
      message: `Uploaded ${validation.urls.length} page URL(s).`,
      count: validation.urls.length,
      filePath: '/tests/PageVerificationUrls.xlsx'
    });
  } catch (err) {
    return res.status(400).json({ error: `Could not read Excel file: ${err.message}` });
  }
});

app.get('/page-urls/status', (req, res) => {
  try {
    const validation = validatePageUrlsFile();
    res.status(validation.valid ? 200 : 404).json({
      ...validation,
      count: validation.urls.length,
      filePath: '/tests/PageVerificationUrls.xlsx'
    });
  } catch (err) {
    res.status(400).json({ error: `Could not read Excel file: ${err.message}` });
  }
});

// ---------------- LOG STREAM ----------------
const clients = [];

app.get('/logs', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  clients.push(res);

  req.on('close', () => {
    clients.splice(clients.indexOf(res), 1);
  });
});

function sendLog(message) {
  clients.forEach(client => {
    client.write(`data: ${message}\n\n`);
  });
}

// ================ RUN TEST (with integrated cleanup) ================
app.post('/run-test', (req, res) => {
  const mode = req.body.mode || 'test';
  const parallel = true;
  const urlValidation = validateVisualUrlsFile();

  if (!urlValidation.valid) {
    return res.status(400).json({
      error: 'Visual Testing URL file is not valid.',
      ...urlValidation
    });
  }

  let viewports = (req.body.viewports || [])
    .filter(v => v.label && v.width > 0 && v.height > 0)
    .map(v => ({
      label: v.label,
      width: Number(v.width),
      height: Number(v.height)
    }));

  if (viewports.length === 0) {
    console.log('⚠️ No valid viewports, using default');
    viewports = [{ label: 'desktop', width: 1366, height: 768 }];
  }

  // ===== CLEANUP BEFORE EXECUTION =====
  console.log(`🧹 Cleaning up old ${mode} data...`);
  cleanupBatchData(mode);
  sendLog(`🧹 Cleaned up old ${mode} data`);

  const configPath = path.join(__dirname, 'backstop.json');
  const config = JSON.parse(fs.readFileSync(configPath));
  config.viewports = viewports;
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  console.log('✅ Viewports:', viewports);
  sendLog(`📱 Viewports: ${JSON.stringify(viewports)}`);
  sendLog(`🚀 Starting ${mode}...`);

  if (!parallel || viewports.length === 1) {
    const child = spawn('node', ['generateScenarios.js', mode], {
      cwd: __dirname,
      shell: true
    });

    const rl = readline.createInterface({ input: child.stdout });
    rl.on('line', (line) => { console.log(line); sendLog(line); });
    child.stderr.on('data', (data) => { sendLog(data.toString()); });
    child.on('close', (code) => {
      if (mode === 'reference') {
        const baselineRun = saveBaselineRun(code === 0 ? 'PASS' : 'FAIL');
        sendLog('BASELINE_RUN_COMPLETED:' + baselineRun.lastBaseLineRunIst);
      }
      sendLog('PROCESS_COMPLETED');
    });
    return res.json({ status: 'started' });
  }

  (async () => {
    try {
      const config = JSON.parse(fs.readFileSync(configPath));
      config.viewports = viewports;
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      const child = spawn('node', ['generateScenarios.js', mode], {
        cwd: __dirname,
        shell: true
      });

      runningProcesses[mode] = child;

      const rl = readline.createInterface({ input: child.stdout, terminal: false });
      rl.on('line', (line) => { console.log(line); sendLog(line); });
      child.stderr.on('data', (data) => { sendLog(data.toString()); });
      child.on('close', (code) => {
        if (mode === 'reference') {
          const baselineRun = saveBaselineRun(code === 0 ? 'PASS' : 'FAIL');
          sendLog('BASELINE_RUN_COMPLETED:' + baselineRun.lastBaseLineRunIst);
        }
        runningProcesses[mode] = null;
        sendLog('PROCESS_COMPLETED');
      });

    } catch (err) {
      console.error(err);
      sendLog(`ERROR: ${err.message}`);
      sendLog('PROCESS_COMPLETED');
    }
  })();

  res.json({ status: 'started' });
});

// ---------------- TERMINATE ----------------
app.post('/terminate', (req, res) => {
  const mode = req.body.mode;
  const proc = runningProcesses[mode];

  if (!proc) return res.json({ message: 'No running process' });

  proc.kill('SIGINT');
  runningProcesses[mode] = null;
  sendLog(`🛑 ${mode} terminated`);
  sendLog('PROCESS_COMPLETED');

  res.json({ message: `${mode} stopped` });
});

// ================ CLEANUP HELPER ================
function cleanupBatchData(mode) {
  const basePath = path.join(__dirname, 'backstop_data');
  const batchDirPattern = /^batch_\d+$/;
  
  try {
    if (mode === 'reference') {
      // A fresh baseline owns the dynamic batch folders, so remove only generated batch_N folders.
      const batchDirs = fs.existsSync(basePath)
        ? fs.readdirSync(basePath).filter(f => batchDirPattern.test(f))
        : [];

      batchDirs.forEach(batchDir => {
        const batchPath = path.join(basePath, batchDir);
        fs.rmSync(batchPath, { recursive: true, force: true });
        console.log(`✅ Cleaned: ${batchDir}/`);
      });

      // Remove stale generated batch configs so the next baseline has only current batches.
      fs.readdirSync(__dirname)
        .filter(file => /^backstop_batch_\d+\.json$/.test(file))
        .forEach(file => {
          fs.rmSync(path.join(__dirname, file), { force: true });
          console.log(`✅ Cleaned: ${file}`);
        });

      // Also clear legacy root Backstop folders when present.
      const refPath = path.join(basePath, 'bitmaps_reference');
      const testPath = path.join(basePath, 'bitmaps_test');

      if (fs.existsSync(refPath)) {
        fs.rmSync(refPath, { recursive: true, force: true });
        console.log('✅ Cleaned: bitmaps_reference/');
      }
      if (fs.existsSync(testPath)) {
        fs.rmSync(testPath, { recursive: true, force: true });
        console.log('✅ Cleaned: bitmaps_test/');
      }
    } else if (mode === 'test') {
      // Clean test phase data only; preserve references and generated batch metadata/configs.
      const testPath = path.join(basePath, 'bitmaps_test');
      if (fs.existsSync(testPath)) {
        fs.rmSync(testPath, { recursive: true, force: true });
        console.log('✅ Cleaned: bitmaps_test/');
      }
      
      const batchDirs = fs.existsSync(basePath)
        ? fs.readdirSync(basePath).filter(f => batchDirPattern.test(f))
        : [];

      batchDirs.forEach(batchDir => {
        const batchTestPath = path.join(basePath, batchDir, 'bitmaps_test');
        if (fs.existsSync(batchTestPath)) {
          fs.rmSync(batchTestPath, { recursive: true, force: true });
          console.log(`✅ Cleaned: ${batchDir}/bitmaps_test/`);
        }
      });
    }
  } catch (err) {
    console.error(`❌ Cleanup error (${mode}):`, err.message);
  }
}

function cleanupPageVerificationReports(script) {
  const reportConfig = {
    'tests/loadTimeCheck.spec.ts': {
      jsonPrefix: 'page-load-results-',
      excelFile: 'page-load-report.xlsx'
    },
    'tests/statusCodeCheck.spec.ts': {
      jsonPrefix: 'statuscode-results-',
      excelFile: 'status-code-report.xlsx'
    },
    'tests/linkRedirectCheck.spec.ts': {
      jsonPrefix: 'link-redirect-results-',
      excelFile: 'link-redirect-report.xlsx'
    },
    'tests/spellCheck.spec.ts': {
      jsonPrefix: 'spell-check-results-',
      excelFile: 'spell-check-report.xlsx'
    }
  };

  const config = reportConfig[script];
  if (!config) return;

  const reportsDir = path.join(__dirname, 'test-results', 'reports');
  if (fs.existsSync(reportsDir)) {
    fs.readdirSync(reportsDir)
      .filter(file => file.startsWith(config.jsonPrefix) && file.endsWith('.json'))
      .forEach(file => fs.rmSync(path.join(reportsDir, file), { force: true }));
  }

  fs.rmSync(path.join(__dirname, 'excelReport', config.excelFile), { force: true });
}

// ================ DELETE BACKSTOP DATA (DEPRECATED - kept for backward compatibility) ================
app.post('/delete-data', (req, res) => {
  const { type } = req.body;
  const basePath = path.join(__dirname, 'backstop_data');
  let folderPath = '';

  if (type === 'reference') {
    folderPath = path.join(basePath, 'bitmaps_reference');
  } else if (type === 'test') {
    folderPath = path.join(basePath, 'bitmaps_test');
  } else {
    return res.status(400).json({ error: 'Invalid type' });
  }

  if (!fs.existsSync(folderPath)) {
    return res.json({ status: 'warning', message: `${type} folder not found` });
  }

  fs.rm(folderPath, { recursive: true, force: true }, (err) => {
    if (err) return res.status(500).json({ status: 'error', message: 'Delete failed' });
    return res.json({ status: 'success', message: `${type} deleted successfully` });
  });
});

// ---------------- REPORT ----------------
app.use('/report', express.static(path.join(__dirname, 'backstop_data')));

// ---------------- RUN BROKEN LINK SCRIPTS ----------------
app.post('/run-broken-links', (req, res) => {
  const script = req.body.script;
  const urlValidation = validatePageUrlsFile();

  console.log('Running Playwright script:', script);
  if (!script) return res.status(400).json({ error: 'Script name is required' });
  if (!urlValidation.valid) {
    return res.status(400).json({
      error: 'Page Verification URL file is not valid.',
      ...urlValidation
    });
  }

  cleanupPageVerificationReports(script);
  sendLog(`🔍 Running Broken Link Script: ${script}\n`);

  const child = spawn('npx', ['playwright', 'test', script], {
    cwd: __dirname,
    shell: true
  });

  runningProcesses['broken-links'] = child;

  const rl = readline.createInterface({ input: child.stdout });
  rl.on('line', (line) => { console.log(line); sendLog(line); });
  child.stderr.on('data', (data) => { const msg = data.toString(); console.error(msg); sendLog(`❌ ${msg}`); });
  child.on('close', () => { sendLog('\n🏁 PROCESS_COMPLETED'); });
  child.on('error', (err) => { console.error(err); sendLog(`❌ ERROR: ${err.message}`); sendLog('PROCESS_COMPLETED'); });

  res.json({ status: 'started' });
});

// ---------------- DOWNLOAD XLSX REPORT ----------------
function handleReportDownload(req, res, headOnly = false) {
  const requestedType = String(req.query.type || '').trim().toLowerCase();
  const reportAliases = {
    'load-time': 'load-time',
    'loadtime': 'load-time',
    'page-load': 'load-time',
    'status-code': 'status-code',
    'statuscode': 'status-code',
    'link-redirect': 'link-redirect',
    'linkredirect': 'link-redirect',
    'redirect': 'link-redirect',
    'spell-check': 'spell-check',
    'spellcheck': 'spell-check',
    'spell': 'spell-check'
  };
  const type = reportAliases[requestedType] || requestedType;

  const reportMap = {
    'load-time':   path.join(__dirname, 'excelReport', 'page-load-report.xlsx'),
    'status-code': path.join(__dirname, 'excelReport', 'status-code-report.xlsx'),
    'link-redirect': path.join(__dirname, 'excelReport', 'link-redirect-report.xlsx'),
    'spell-check': path.join(__dirname, 'excelReport', 'spell-check-report.xlsx')
  };

  const filePath = reportMap[type];

  if (!filePath) {
    return res.status(400).json({ error: 'Invalid report type. Use load-time, status-code, link-redirect, or spell-check.' });
  }

  if (!fs.existsSync(filePath)) {
    const reportLabels = {
      'load-time': 'Load Time',
      'status-code': 'Status Code',
      'link-redirect': 'Anchor Link Redirect',
      'spell-check': 'Spell Check'
    };
    return res.status(404).json({
      error: `Report not found. Run the ${reportLabels[type] || type} check first.`
    });
  }

  const fileName = {
    'load-time': 'page-load-report.xlsx',
    'status-code': 'status-code-report.xlsx',
    'link-redirect': 'link-redirect-report.xlsx',
    'spell-check': 'spell-check-report.xlsx'
  }[type];

  if (headOnly) {
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.sendStatus(200);
  }

  res.download(filePath, fileName, (err) => {
    if (err) {
      console.error('Download error:', err);
      if (!res.headersSent) res.status(500).json({ error: 'Failed to download report' });
    }
  });
}

app.head('/download-report', (req, res) => {
  handleReportDownload(req, res, true);
});

app.get('/download-report', (req, res) => {
  handleReportDownload(req, res);
});

// ---------------- RESTART SERVER ----------------
// The server responds 200 then exits — the start wrapper (start.bat / start.sh)
// detects the exit and immediately relaunches node server.js.
app.post('/restart-server', (req, res) => {
  console.log('🔄 Server restart requested via UI...');
  res.json({ status: 'restarting' });

  // Give response time to flush before exiting
  setTimeout(() => {
    console.log('🔄 Exiting for restart...');
    process.exit(0); // wrapper script catches this and restarts
  }, 300);
});

// ---------------- RESTART FRONTEND ----------------
// Kills any running React dev server process, then spawns a fresh one
// from the visual-dashboard directory.
app.post('/restart-frontend', (req, res) => {
  console.log('🔄 Frontend restart requested via UI...');

  // Kill existing frontend process if tracked
  if (runningProcesses.frontend) {
    try {
      runningProcesses.frontend.kill('SIGTERM');
    } catch (e) {
      console.warn('Could not kill previous frontend process:', e.message);
    }
    runningProcesses.frontend = null;
  }

  const frontendDir = path.join(__dirname, 'visual-dashboard');

  // Spawn new React dev server — detached so it survives independently
  const frontendProcess = spawn('npm', ['start'], {
    cwd: frontendDir,
    shell: true,
    detached: false,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  runningProcesses.frontend = frontendProcess;

  frontendProcess.stdout.on('data', (data) => {
    console.log('[React]', data.toString().trim());
  });

  frontendProcess.stderr.on('data', (data) => {
    console.error('[React err]', data.toString().trim());
  });

  frontendProcess.on('close', (code) => {
    console.log(`[React] process exited with code ${code}`);
    runningProcesses.frontend = null;
  });

  frontendProcess.on('error', (err) => {
    console.error('[React] spawn error:', err.message);
    runningProcesses.frontend = null;
  });

  res.json({ status: 'restarting' });
});

// ---------------- START ----------------
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
