// Verifies Playwright browsers and installs them ONLY when missing/stale.
// Streams progress, times out (never hangs), and retries with backoff.
//
// Called two ways:
//   1. `node scripts/preflight.js`  -> from launch.bat, up-front visible setup
//   2. require('./scripts/preflight').ensureBrowsers({ onLog })  -> lazily from
//      server.js so the FIRST verification a user runs performs a one-time,
//      progress-streamed install instead of surfacing the raw npx banner.
const path = require('path');
const { spawn } = require('child_process');
const { checkBrowsers } = require('./check-browsers');

const ROOT = path.join(__dirname, '..');
const INSTALL_TIMEOUT_MS = 10 * 60 * 1000; // hard ceiling so the app can't hang
const MAX_ATTEMPTS = 3;

// Install chromium ONLY — the four checks (loadTime/statusCode/linkRedirect/
// spellCheck) all run on Chromium, so downloading firefox+webkit is wasted
// time and bandwidth.
//
// NOTE: we deliberately do NOT set PLAYWRIGHT_BROWSERS_PATH here, so both the
// check and the install use the same (default) location, matching install.bat.
// When you later package to Electron/exe, set PLAYWRIGHT_BROWSERS_PATH=0 in
// BOTH this spawn and the check so browsers live in node_modules and ship with
// the bundle.
function installBrowsers({ onLog }) {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['playwright', 'install', 'chromium'], {
      cwd: ROOT,
      shell: true,
      env: { ...process.env },
    });

    let settled = false;
    const done = (fn, arg) => { if (!settled) { settled = true; clearTimeout(timer); fn(arg); } };

    const timer = setTimeout(() => {
      child.kill();
      done(reject, new Error('Install timed out after 10 min — check network/proxy.'));
    }, INSTALL_TIMEOUT_MS);

    child.stdout.on('data', d => onLog(d.toString().trimEnd()));
    child.stderr.on('data', d => onLog(d.toString().trimEnd()));
    child.on('error', err => done(reject, err));
    child.on('close', code =>
      code === 0 ? done(resolve) : done(reject, new Error(`Install process exited with code ${code}`))
    );
  });
}

function hint(reason) {
  const r = String(reason).toLowerCase();
  if (/etimedout|econnreset|enotfound|network|proxy|socket/.test(r))
    return 'Network/proxy issue. If behind a corporate proxy, set HTTPS_PROXY then retry.';
  if (/eacces|eperm|denied|permission/.test(r))
    return 'Permission issue. Try "Run as Administrator" or use a user-writable folder.';
  return 'If a corporate antivirus removed the download, allow this app folder in your AV settings.';
}

async function ensureBrowsers({ onLog = console.log } = {}) {
  const status = checkBrowsers();
  if (status.installed) { onLog('✅ Browser ready.'); return true; }

  onLog(`⚙️  One-time setup: installing Chromium (reason: ${status.reason})…`);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await installBrowsers({ onLog });
      // Trust-but-verify: exit code 0 is not enough (AV can silently quarantine
      // the binary after a "successful" download).
      const verified = checkBrowsers();
      if (verified.installed) { onLog('✅ Setup complete. Browser ready.'); return true; }
      throw new Error(`post-install verification failed (${verified.reason})`);
    } catch (err) {
      onLog(`❌ Attempt ${attempt}/${MAX_ATTEMPTS} failed: ${err.message}`);
      onLog(`   Hint: ${hint(err.message)}`);
      if (attempt === MAX_ATTEMPTS) throw err;
      const backoffMs = 2000 * 2 ** (attempt - 1); // 2s, 4s
      onLog(`⏳ Retrying in ${backoffMs / 1000}s…`);
      await new Promise(r => setTimeout(r, backoffMs));
    }
  }
  return false;
}

module.exports = { ensureBrowsers };

// launch.bat entry point: exit non-zero so the .bat can surface a failure.
if (require.main === module) {
  ensureBrowsers()
    .then(() => process.exit(0))
    .catch(err => { console.error(`\n[preflight] FAILED: ${err.message}`); process.exit(1); });
}
