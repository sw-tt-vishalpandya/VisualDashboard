import { test, Page } from "@playwright/test";
import * as XLSX from "xlsx";
import * as path from "path";
import * as fs from "fs";

// Base URL
const BASE_URL = "https://www.softwebsolutions.com";

// Store results globally
const results: { Page: string; StatusCode: number | string; Status: string }[] = [];

// Calculate total URLs across all menus
const servicesURLs = [
	"/digital-transformation-consulting/",
	"/business-process-automation-services/",
	"/product-engineering-service/",
	"/enterprise-app-development/",
	"/custom-software-development/",
	"/legacy-application-modernization/",
	"/devops-consulting-services/",
	"/full-stack-development-company/",
	"/ai-automation-testing-services/",
	"/data-analytics-services/",
	"/data-visualization-consulting/",
	"/data-engineering-consulting-services/",
	"/snowflake-consulting-services/",
	"/data-science-development/",
	"/business-intelligence-consulting/",
	"/cloud-consulting-services/",
	"/cloud-migration-services/",
	"/multicloud-managed-services/",
	"/ai-consulting-services/",
	"/agentic-ai-services/",
	"/edge-ai-solutions/",
	"/generative-ai-consulting-services/",
	"/computer-vision/",
	"/machine-learning-services/",
	"/ai-agent-development-company",
	"/needle/manufacturing/",
	"/needle/finance/",
];

const technologyURLs = [
	"/microsoft-consulting-services/",
	"/fabric-consulting-services/",
	"/microsoft-copilot-studio-consulting/",
	"/microsoft-365-consulting-services/",
	"/net-maui-development-services/",
	"/power-platform-consulting-services/",
	"/microsoft-power-apps-development/",
	"/power-automate-consulting/",
	"/power-bi-consulting-services/",
	"/azure-consulting-services/",
	"/databricks-consulting-services/",
	"/azure-data-services/",
	"/azure-cloud-service/",
	"/azure-ai-services/",
	"/aws-services/",
	"/aws-cloud-migration-services/",
	"/aws-data-analytics-consulting/",
	"/aws-sagemaker-consulting-services/",
	"/salesforce-consulting-services/",
	"/salesforce-development-services/",
	"/salesforce-migration-services/",
	"/salesforce-implementation-services/",
	"/salesforce-ai-consulting/",
];

const industriesURLs = [
	"/supply-chain/",
	"/manufacturing-industry/",
	"/semiconductor/",
	"/telecom-industry/",
	"/finance-industry/",
];

const ourWorkURLs = ["/portfolio/"];

const companyURLs = ["/about-softweb-solutions/", "/client-testimonial/", "/resources/"];

const TOTAL_URLS = servicesURLs.length + technologyURLs.length + industriesURLs.length + ourWorkURLs.length + companyURLs.length;

// Emit total count for progress bar
console.log(`📊 TOTAL_URLS:${TOTAL_URLS}`);

// =======================
// Status Check Helper
// =======================
async function checkStatus(page: Page, url: string) {
	try {
		const response = await page.goto(url, {
			waitUntil: "domcontentloaded",
			timeout: 30000,
		});

		const status = response?.status();

		console.log("\n🔍 URL:", url);
		console.log("📡 Status Code:", status);

		if (!response) {
			console.log("❌ FAIL: No response");
			results.push({
				Page: url,
				StatusCode: "No Response",
				Status: "FAIL",
			});
			return;
		}

		if (status! >= 400) {
			console.log(`❌ FAIL: ${status}`);
			results.push({
				Page: url,
				StatusCode: status!,
				Status: "FAIL",
			});
		} else {
			console.log(`✅ PASS: ${status}`);
			results.push({
				Page: url,
				StatusCode: status!,
				Status: "PASS",
			});
		}
	} catch (error: any) {
		console.log("\n🔍 URL:", url);
		console.log("❌ FAIL: Exception");
		console.log("⚠️ Error:", error.message);

		results.push({
			Page: url,
			StatusCode: "Error",
			Status: "FAIL",
		});
	}
}

// =======================
// SERVICES TEST
// =======================
test("Services Menu", async ({ page }) => {
	for (const path of servicesURLs) {
		await checkStatus(page, BASE_URL + path);
	}
});

// =======================
// TECHNOLOGY TEST
// =======================
test("Technology Menu", async ({ page }) => {
	for (const path of technologyURLs) {
		await checkStatus(page, BASE_URL + path);
	}
});

// =======================
// INDUSTRIES TEST
// =======================
test("Industries Menu", async ({ page }) => {
	for (const path of industriesURLs) {
		await checkStatus(page, BASE_URL + path);
	}
});

// =======================
// OUR WORK
// =======================
test("Our Work Menu", async ({ page }) => {
	for (const path of ourWorkURLs) {
		await checkStatus(page, BASE_URL + path);
	}
});

// =======================
// COMPANY
// =======================
test("Company Menu", async ({ page }) => {
	for (const path of companyURLs) {
		await checkStatus(page, BASE_URL + path);
	}
});

// =======================
// AFTER ALL TESTS → CREATE EXCEL
// =======================
test.afterAll(async () => {
	// Per-worker JSON output (will be merged in global teardown)
	const reportsDir = path.resolve(__dirname, "../test-results/reports");
	fs.mkdirSync(reportsDir, { recursive: true });
	const filePath = path.join(reportsDir, `statuscode-results-${process.pid}.json`);

	fs.writeFileSync(filePath, JSON.stringify(results, null, 2));
	console.log("\n📁 Per-worker JSON created at:", filePath);
});
