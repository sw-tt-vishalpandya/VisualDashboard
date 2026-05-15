const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');
const readline = require('readline');
const fs = require('fs');

const app = express();

const runningProcesses = {
  reference: null,
  test: null,
  'broken-links': null,
  frontend: null
};

app.use(cors());
app.use(express.json());

const PORT = 3001;

// ---------------- HEALTH ----------------
app.get('/', (req, res) => {
  res.send('✅ Backend running');
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
    child.on('close', () => { sendLog('\n🏁 PROCESS_COMPLETED'); });
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
      child.on('close', () => { sendLog('PROCESS_COMPLETED'); });

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

  console.log('Running Playwright script:', script);
  if (!script) return res.status(400).json({ error: 'Script name is required' });

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
app.get('/download-report', (req, res) => {
  const { type } = req.query;

  const reportMap = {
    'load-time':   path.join(__dirname, 'excelReport', 'page-load-report.xlsx'),
    'status-code': path.join(__dirname, 'excelReport', 'status-code-report.xlsx')
  };

  const filePath = reportMap[type];

  if (!filePath) {
    return res.status(400).json({ error: 'Invalid report type. Use load-time or status-code.' });
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({
      error: `Report not found. Run the ${type === 'load-time' ? 'Load Time' : 'Status Code'} check first.`
    });
  }

  const fileName = type === 'load-time' ? 'page-load-report.xlsx' : 'status-code-report.xlsx';

  res.download(filePath, fileName, (err) => {
    if (err) {
      console.error('Download error:', err);
      if (!res.headersSent) res.status(500).json({ error: 'Failed to download report' });
    }
  });
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
