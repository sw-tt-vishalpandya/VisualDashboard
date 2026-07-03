// Pure detection — no install side effects.
// Reused by preflight.js (launcher) and server.js (lazy guard) so there is a
// SINGLE source of truth for "are the Playwright browsers ready?".
//
// Why not glob the ms-playwright folder? Browser binaries are pinned to the
// installed @playwright/test version. chromium.executablePath() returns the
// path for the EXACT build this version expects, so a version drift (floating
// ^ range upgraded but browsers not re-installed) is correctly detected as
// "missing" instead of a false "installed".
const fs = require('fs');

function checkBrowsers() {
  try {
    const { chromium } = require('@playwright/test');
    const exePath = chromium.executablePath(); // version-specific, honors PLAYWRIGHT_BROWSERS_PATH
    if (exePath && fs.existsSync(exePath)) {
      return { installed: true, reason: 'ok', exePath };
    }
    return { installed: false, reason: 'missing-binary', exePath: exePath || null };
  } catch (err) {
    // Thrown when the browser type was never registered/downloaded, or the
    // package can't resolve. Either way: not ready.
    return { installed: false, reason: `resolver-failed: ${err.message}`, exePath: null };
  }
}

module.exports = { checkBrowsers };

// Allow `node scripts/check-browsers.js` for a quick manual/CI probe.
if (require.main === module) {
  const status = checkBrowsers();
  console.log(JSON.stringify(status, null, 2));
  process.exit(status.installed ? 0 : 1);
}
