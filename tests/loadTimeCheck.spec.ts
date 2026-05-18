// ***** Pages performance Testing *****//

import { test } from "@playwright/test";
import * as XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";

const inputFilePath = path.resolve(__dirname, "PriorityPagesList.xlsx");

// Output File name (Like: page-load-report-2026-04-17_14-35-22.xlsx)
const now = new Date();

// Per-worker JSON output (will be merged in global teardown)
const reportsDir = path.resolve(__dirname, "../test-results/reports");
fs.mkdirSync(reportsDir, { recursive: true });
const outputFilePath = path.join(reportsDir, `page-load-results-${process.pid}.json`);
const workbook = XLSX.readFile(inputFilePath);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const urlList = (XLSX.utils.sheet_to_json(sheet) as { URL?: string; URLs?: string }[])
	.map((row) => ({ URL: row.URLs || row.URL || "" }))
	.filter((row) => row.URL);
const results: any[] = [];

// Emit total count for progress bar
console.log(`📊 TOTAL_URLS:${urlList.length}`);

// =======================
// TESTS
// =======================
for (const { URL } of urlList) {
	test(`Measure load time for: ${URL}`, async ({ page }) => {
		test.setTimeout(60000);

		const startTime = new Date();

		// Emit URL log for progress tracking
		console.log("\n🔍 URL:", URL);

		try {
			await page.goto(URL, { waitUntil: "load", timeout: 30000 });
			const endTime = new Date();

			// ✅ Convert ms → seconds
			const totalTimeSec = (endTime.getTime() - startTime.getTime()) / 1000;

			console.log(`✅ Success: ${totalTimeSec.toFixed(2)} sec`);

			results.push({
				URL,
				"Page Load Time (sec)": Number(totalTimeSec.toFixed(2)), // ✅ updated
				"Start Time": startTime.toLocaleString(),
				"End Time": endTime.toLocaleString(),
				Status: "Success",
			});
		} catch (error: unknown) {
			console.log(`❌ Failed: ${error}`);

			results.push({
				URL,
				"Page Load Time (sec)": null, // ✅ updated
				"Start Time": startTime.toLocaleString(),
				"End Time": new Date().toLocaleString(),
				Status: "Failed",
			});
		}
	});
}

// =======================
// SAFE WRITE FUNCTION
// =======================
function writeWithRetry(workbook: XLSX.WorkBook, path: string, retries = 3) {
	for (let i = 0; i < retries; i++) {
		try {
			XLSX.writeFile(workbook, path);
			return;
		} catch (err: any) {
			if (err.code === "EBUSY") {
				console.log(`⏳ File busy, retrying... (${i + 1})`);

				const wait = Date.now() + 1000;
				while (Date.now() < wait) {}
			} else {
				throw err;
			}
		}
	}

	throw new Error("❌ File is locked. Please close Excel/WPS.");
}

// =======================
// AFTER ALL TESTS
// =======================
test.afterAll(() => {
	const columns = [
		"URL",
		"Page Load Time (sec)", // ✅ updated
		"Start Time",
		"End Time",
		"Status",
	];

	const newSheet = XLSX.utils.json_to_sheet(results, {
		header: columns,
	});

	XLSX.utils.sheet_add_aoa(newSheet, [columns], { origin: "A1" });

	// ✅ Optional: column width
	newSheet["!cols"] = [{ wch: 60 }, { wch: 22 }, { wch: 25 }, { wch: 25 }, { wch: 15 }];

	const newWorkbook = XLSX.utils.book_new();
	XLSX.utils.book_append_sheet(newWorkbook, newSheet, "Report");

	// Write per-worker JSON results (safe for parallel runs)
	fs.writeFileSync(outputFilePath, JSON.stringify(results, null, 2));

	console.log(`📊 Per-worker JSON saved at: ${outputFilePath}`);
});
