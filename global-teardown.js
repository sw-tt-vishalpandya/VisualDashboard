const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

module.exports = async function globalTeardown() {
  try {
    const reportsDir = path.resolve(__dirname, 'test-results', 'reports');
    if (!fs.existsSync(reportsDir)) {
      console.log('No per-worker reports found. Skipping merge.');
      return;
    }

    const files = fs.readdirSync(reportsDir);
    const pageResults = [];
    const statusResults = [];
    const redirectResults = [];
    const spellResults = [];
    let redirectReportWasRun = false;
    let spellReportWasRun = false;
    const redirectHeaders = [
      'Source Page URL',
      'Anchor Text',
      'Original href URL',
      'Final Destination URL',
      'Status Code',
      'Is Redirected?',
      'Validation Status',
      'Remarks'
    ];

    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const filePath = path.join(reportsDir, file);
      if (file.startsWith('link-redirect-results-')) {
        redirectReportWasRun = true;
      }
      if (file.startsWith('spell-check-results-')) {
        spellReportWasRun = true;
      }
      let data;
      try {
        data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } catch (e) {
        console.warn('Skipping invalid JSON file', filePath);
        continue;
      }

      // Heuristic: Check for specific fields to distinguish result types
      // Status code results have 'StatusCode' and 'Page'
      // Page load results have 'Page Load Time (sec)' and 'URL'
      // Link redirect results have 'Original href URL' and 'Is Redirected?'
      if (Array.isArray(data) && data.length > 0) {
        const firstItem = data[0];
        if (firstItem.hasOwnProperty('Misspelled Words') && firstItem.hasOwnProperty('Suggested Corrections')) {
          // Spell check test results
          spellResults.push(...data);
        } else if (firstItem.hasOwnProperty('Is Redirected?') || firstItem.hasOwnProperty('Is redirected?')) {
          // Link redirect test results
          redirectResults.push(...data);
        } else if (firstItem.hasOwnProperty('StatusCode')) {
          // Status code test results
          statusResults.push(...data);
        } else if (firstItem.hasOwnProperty('Page Load Time (sec)') || firstItem.hasOwnProperty('URL')) {
          // Page load test results
          pageResults.push(...data);
        }
      }
    }

    // Ensure output dir (excelReport at root)
    const outDir = path.resolve(__dirname, 'excelReport');
    fs.mkdirSync(outDir, { recursive: true });

    if (pageResults.length > 0) {
      const worksheet = XLSX.utils.json_to_sheet(pageResults);
      XLSX.utils.sheet_add_aoa(worksheet, [Object.keys(pageResults[0])], { origin: 'A1' });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, worksheet, 'Page Load Report');
      const outPath = path.join(outDir, 'page-load-report.xlsx');
      XLSX.writeFile(wb, outPath);
      console.log('Merged page load report saved to', outPath);
    } else {
      console.log('No page load results to merge');
    }

    if (statusResults.length > 0) {
      const worksheet = XLSX.utils.json_to_sheet(statusResults);
      XLSX.utils.sheet_add_aoa(worksheet, [Object.keys(statusResults[0])], { origin: 'A1' });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, worksheet, 'Status Report');
      const outPath = path.join(outDir, 'status-code-report.xlsx');
      XLSX.writeFile(wb, outPath);
      console.log('Merged status code report saved to', outPath);
    } else {
      console.log('No status results to merge');
    }

    if (redirectResults.length > 0 || redirectReportWasRun) {
      const worksheet = redirectResults.length > 0
        ? XLSX.utils.json_to_sheet(redirectResults, { header: redirectHeaders })
        : XLSX.utils.aoa_to_sheet([redirectHeaders]);
      XLSX.utils.sheet_add_aoa(worksheet, [redirectHeaders], { origin: 'A1' });
      worksheet['!cols'] = [
        { wch: 70 },
        { wch: 35 },
        { wch: 70 },
        { wch: 70 },
        { wch: 18 },
        { wch: 16 },
        { wch: 18 },
        { wch: 45 }
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, worksheet, 'Link Redirect Report');
      const outPath = path.join(outDir, 'link-redirect-report.xlsx');
      XLSX.writeFile(wb, outPath);
      console.log('Merged link redirect report saved to', outPath);
    } else {
      console.log('No link redirect results to merge');
    }

    if (spellResults.length > 0 || spellReportWasRun) {
      const spellHeaders = ['Page URL', 'Misspelled Words', 'Suggested Corrections', 'Status'];
      const worksheet = spellResults.length > 0
        ? XLSX.utils.json_to_sheet(spellResults, { header: spellHeaders })
        : XLSX.utils.aoa_to_sheet([spellHeaders]);
      XLSX.utils.sheet_add_aoa(worksheet, [spellHeaders], { origin: 'A1' });
      worksheet['!cols'] = [{ wch: 70 }, { wch: 60 }, { wch: 80 }, { wch: 12 }];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, worksheet, 'Spell Check Report');
      const outPath = path.join(outDir, 'spell-check-report.xlsx');
      XLSX.writeFile(wb, outPath);
      console.log('Merged spell check report saved to', outPath);
    } else {
      console.log('No spell check results to merge');
    }

    // Optional: remove per-worker JSON files
    // files.forEach(f => { if (f.endsWith('.json')) fs.unlinkSync(path.join(reportsDir, f)); });
  } catch (err) {
    console.error('Error during global teardown merge:', err);
    process.exitCode = 1;
  }
};
