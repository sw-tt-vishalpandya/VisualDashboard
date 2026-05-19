import { test, Page } from "@playwright/test";
import * as XLSX from "xlsx";
import * as path from "path";
import * as fs from "fs";

const inputFilePath = path.resolve(__dirname, "PageVerificationUrls.xlsx");
const workbook = XLSX.readFile(inputFilePath);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const urlList = (XLSX.utils.sheet_to_json(sheet) as { URL?: string; URLs?: string }[])
	.map((row) => row.URLs || row.URL || "")
	.filter((url) => url);

const results: { Page: string; StatusCode: number | string; Status: string }[] = [];

console.log(`TOTAL_URLS:${urlList.length}`);

async function checkStatus(page: Page, url: string) {
	try {
		const response = await page.goto(url, {
			waitUntil: "domcontentloaded",
			timeout: 30000,
		});

		const status = response?.status();

		console.log("\nURL:", url);
		console.log("Status Code:", status);

		if (!response) {
			console.log("FAIL: No response");
			results.push({
				Page: url,
				StatusCode: "No Response",
				Status: "FAIL",
			});
			return;
		}

		if (status! >= 400) {
			console.log(`FAIL: ${status}`);
			results.push({
				Page: url,
				StatusCode: status!,
				Status: "FAIL",
			});
		} else {
			console.log(`PASS: ${status}`);
			results.push({
				Page: url,
				StatusCode: status!,
				Status: "PASS",
			});
		}
	} catch (error: any) {
		console.log("\nURL:", url);
		console.log("FAIL: Exception");
		console.log("Error:", error.message);

		results.push({
			Page: url,
			StatusCode: "Error",
			Status: "FAIL",
		});
	}
}

test("Status Code Check", async ({ page }) => {
	for (const url of urlList) {
		await checkStatus(page, url);
	}
});

test.afterAll(async () => {
	const reportsDir = path.resolve(__dirname, "../test-results/reports");
	fs.mkdirSync(reportsDir, { recursive: true });
	const filePath = path.join(reportsDir, `statuscode-results-${process.pid}.json`);

	fs.writeFileSync(filePath, JSON.stringify(results, null, 2));
	console.log("\nPer-worker JSON created at:", filePath);
});
