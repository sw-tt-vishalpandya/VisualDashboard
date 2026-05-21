import { test, Page, APIRequestContext } from "@playwright/test";
import * as XLSX from "xlsx";
import * as path from "path";
import * as fs from "fs";

const inputFilePath = path.resolve(__dirname, "PageVerificationUrls.xlsx");
const workbook = XLSX.readFile(inputFilePath);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const pageUrls = (XLSX.utils.sheet_to_json(sheet) as { URL?: string; URLs?: string }[])
	.map((row) => row.URLs || row.URL || "")
	.filter((url) => url);

type AnchorLink = {
	anchorText: string;
	originalHref: string;
	resolvedUrl: string;
	skipReason: string;
};

type SourcePageScan = {
	anchors: AnchorLink[];
	statusCode: number | string;
	finalUrl: string;
	error?: string;
};

type ValidationResult = {
	finalUrl: string;
	statusCode: number | string;
	isRedirected: boolean;
	validationStatus: "PASS" | "FAIL" | "SKIPPED";
	remarks: string;
};

type RedirectReportRow = {
	"Source Page URL": string;
	"Anchor Text": string;
	"Original href URL": string;
	"Final Destination URL": string;
	"Status Code": number | string;
	"Is Redirected?": string;
	"Validation Status": string;
	"Remarks": string;
};

const results: RedirectReportRow[] = [];
const validationCache = new Map<string, ValidationResult>();
const reportsDir = path.resolve(__dirname, "../test-results/reports");
fs.mkdirSync(reportsDir, { recursive: true });
const outputFilePath = path.join(reportsDir, `link-redirect-results-${process.pid}.json`);

const blankReportRow: RedirectReportRow = {
	"Source Page URL": "",
	"Anchor Text": "",
	"Original href URL": "",
	"Final Destination URL": "",
	"Status Code": "",
	"Is Redirected?": "",
	"Validation Status": "",
	"Remarks": "",
};

function buildSourcePageFailureRow(sourcePageUrl: string, scan: SourcePageScan): RedirectReportRow {
	return {
		"Source Page URL": sourcePageUrl,
		"Anchor Text": "",
		"Original href URL": sourcePageUrl,
		"Final Destination URL": scan.finalUrl || sourcePageUrl,
		"Status Code": scan.statusCode,
		"Is Redirected?": "[ ]",
		"Validation Status": "FAIL",
		"Remarks": scan.error || `Source page returned HTTP ${scan.statusCode}. Anchor validation was not run.`,
	};
}

function resolveHref(rawHref: string, sourcePageUrl: string) {
	const href = rawHref.trim();

	if (!href) {
		return { resolvedUrl: "", skipReason: "Empty href" };
	}

	if (href.startsWith("#")) {
		return { resolvedUrl: "", skipReason: "Same-page anchor fragment skipped" };
	}

	const lowerHref = href.toLowerCase();
	if (
		lowerHref.startsWith("javascript:") ||
		lowerHref.startsWith("mailto:") ||
		lowerHref.startsWith("tel:") ||
		lowerHref.startsWith("sms:") ||
		lowerHref.startsWith("data:")
	) {
		return { resolvedUrl: "", skipReason: `Unsupported link protocol: ${href.split(":")[0]}` };
	}

	try {
		const parsed = new URL(href, sourcePageUrl);
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
			return { resolvedUrl: "", skipReason: `Unsupported link protocol: ${parsed.protocol.replace(":", "")}` };
		}
		parsed.hash = "";
		return { resolvedUrl: parsed.toString(), skipReason: "" };
	} catch {
		return { resolvedUrl: "", skipReason: "Invalid href URL" };
	}
}

function normalizeForComparison(url: string) {
	try {
		const parsed = new URL(url);
		parsed.hash = "";
		return parsed.toString();
	} catch {
		return url;
	}
}

function resolveRedirectLocation(currentUrl: string, locationHeader: string) {
	try {
		const parsed = new URL(locationHeader, currentUrl);
		parsed.hash = "";
		return parsed.toString();
	} catch {
		return "";
	}
}

async function collectAnchorLinks(page: Page, sourcePageUrl: string): Promise<SourcePageScan> {
	const response = await page.goto(sourcePageUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
	const sourceStatus = response?.status() || "No Response";
	const finalUrl = page.url();

	if (!response) {
		return {
			anchors: [],
			statusCode: sourceStatus,
			finalUrl,
			error: "Source page did not return a response. Anchor validation was not run.",
		};
	}

	if (response.status() >= 400) {
		return {
			anchors: [],
			statusCode: response.status(),
			finalUrl,
		};
	}

	await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});

	const anchors = await page.locator("a").evaluateAll((links) =>
		links.map((link) => ({
			anchorText: (link.textContent || "").replace(/\s+/g, " ").trim(),
			originalHref: link.getAttribute("href") || "",
		}))
	);

	return {
		anchors: anchors.map((anchor) => {
		const resolved = resolveHref(anchor.originalHref, sourcePageUrl);
		return {
			anchorText: anchor.anchorText || "(no anchor text)",
			originalHref: anchor.originalHref,
			resolvedUrl: resolved.resolvedUrl,
			skipReason: resolved.skipReason,
		};
	}),
		statusCode: sourceStatus,
		finalUrl,
	};
}

async function validateResolvedUrl(request: APIRequestContext, originalUrl: string): Promise<ValidationResult> {
	if (validationCache.has(originalUrl)) {
		return validationCache.get(originalUrl)!;
	}

	const redirectCodes: number[] = [];
	let currentUrl = originalUrl;
	let finalUrl = originalUrl;
	let firstStatus: number | string = "Not Checked";
	let finalStatus: number | string = "Not Checked";
	let remarks = "";
	let validationStatus: "PASS" | "FAIL" = "PASS";
	const maxRedirects = 10;

	try {
		for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
			const response = await request.get(currentUrl, {
				failOnStatusCode: false,
				maxRedirects: 0,
				timeout: 20000,
			});

			const status = response.status();
			if (firstStatus === "Not Checked") {
				firstStatus = status;
			}
			finalStatus = status;
			finalUrl = currentUrl;
			const location = response.headers().location;

			if (status >= 300 && status < 400 && location) {
				redirectCodes.push(status);
				const nextUrl = resolveRedirectLocation(currentUrl, location);

				if (!nextUrl) {
					validationStatus = "FAIL";
					remarks = "Redirect location header is invalid";
					break;
				}

				if (normalizeForComparison(nextUrl) === normalizeForComparison(currentUrl)) {
					validationStatus = "FAIL";
					remarks = "Redirect loop detected";
					finalUrl = nextUrl;
					break;
				}

				currentUrl = nextUrl;
				finalUrl = nextUrl;
				continue;
			}

			if (status >= 400) {
				validationStatus = "FAIL";
				remarks = `Broken link returned HTTP ${status}`;
			} else if (redirectCodes.length > 0) {
				remarks = `Redirect chain: ${[...redirectCodes, status].join(" -> ")}`;
			} else {
				remarks = "No redirect";
			}
			break;
		}

		if (redirectCodes.length > maxRedirects) {
			validationStatus = "FAIL";
			remarks = `Exceeded ${maxRedirects} redirects`;
		}
	} catch (error: any) {
		if (firstStatus === "Not Checked") {
			firstStatus = "Error";
		}
		finalStatus = "Error";
		validationStatus = "FAIL";
		remarks = error.message || "Request failed";
	}

	const reportedStatus = redirectCodes.length > 0 ? redirectCodes[0] : firstStatus;
	const isRedirected =
		reportedStatus === 200 ||
		reportedStatus === 301 ||
		redirectCodes.length > 0 ||
		normalizeForComparison(finalUrl) !== normalizeForComparison(originalUrl);
	if (isRedirected && reportedStatus === 200 && remarks === "No redirect") {
		remarks = "Redirected correctly with HTTP 200";
	} else if (isRedirected && reportedStatus === 301 && redirectCodes.length === 0) {
		remarks = "Redirected correctly with HTTP 301";
	} else if (isRedirected && redirectCodes.length > 0) {
		remarks = `Redirected correctly. ${remarks}`;
	}

	const result: ValidationResult = {
		finalUrl,
		statusCode: reportedStatus,
		isRedirected,
		validationStatus,
		remarks,
	};

	validationCache.set(originalUrl, result);
	return result;
}

function buildReportRow(sourcePageUrl: string, anchor: AnchorLink, validation: ValidationResult): RedirectReportRow {
	return {
		"Source Page URL": sourcePageUrl,
		"Anchor Text": anchor.anchorText,
		"Original href URL": anchor.originalHref,
		"Final Destination URL": validation.finalUrl,
		"Status Code": validation.statusCode,
		"Is Redirected?": validation.isRedirected ? "[x]" : "[ ]",
		"Validation Status": validation.validationStatus,
		"Remarks": validation.remarks,
	};
}

test("Anchor Link Redirect Check", async ({ page, request }) => {
	test.setTimeout(900000);

	const anchorsByPage = new Map<string, AnchorLink[]>();
	const sourcePageFailures: RedirectReportRow[] = [];
	let totalAnchors = 0;

	for (const sourcePageUrl of pageUrls) {
		console.log("\nScanning Page:", sourcePageUrl);

		try {
			const scan = await collectAnchorLinks(page, sourcePageUrl);

			if (scan.error || typeof scan.statusCode === "number" && scan.statusCode >= 400) {
				console.log("Source Page Status:", scan.statusCode);
				console.log("Page Scan Failed:", scan.error || `Source page returned HTTP ${scan.statusCode}`);
				sourcePageFailures.push(buildSourcePageFailureRow(sourcePageUrl, scan));
				anchorsByPage.set(sourcePageUrl, []);
				continue;
			}

			anchorsByPage.set(sourcePageUrl, scan.anchors);
			totalAnchors += scan.anchors.length;
			console.log(`Anchor Tags Found: ${scan.anchors.length}`);
		} catch (error: any) {
			console.log("Page Scan Failed:", error.message);
			sourcePageFailures.push(buildSourcePageFailureRow(sourcePageUrl, {
				anchors: [],
				statusCode: "Error",
				finalUrl: sourcePageUrl,
				error: `Could not open source page: ${error.message}`,
			}));
			anchorsByPage.set(sourcePageUrl, []);
		}
	}

	console.log(`TOTAL_URLS:${totalAnchors}`);

	for (const [sourcePageUrl, anchors] of anchorsByPage) {
		const sourceRows: RedirectReportRow[] = [];
		const sourceFailure = sourcePageFailures.find(row => row["Source Page URL"] === sourcePageUrl);

		if (sourceFailure) {
			results.push(sourceFailure);
			results.push(blankReportRow);
			continue;
		}

		for (const anchor of anchors) {
			console.log("\nSource Page:", sourcePageUrl);
			console.log("Anchor Text:", anchor.anchorText);
			console.log("Original href:", anchor.originalHref || "(empty)");

			if (anchor.skipReason) {
				console.log("Validation Status: SKIPPED");
				console.log("Remarks:", anchor.skipReason);
				continue;
			}

			const validation = await validateResolvedUrl(request, anchor.resolvedUrl);

			console.log("Final Destination URL:", validation.finalUrl);
			console.log("Status Code:", validation.statusCode);
			console.log("Redirected:", validation.isRedirected ? "Yes" : "No");
			console.log("Validation Status:", validation.validationStatus);
			console.log("Remarks:", validation.remarks);

			sourceRows.push(buildReportRow(sourcePageUrl, anchor, validation));
		}

		if (sourceRows.length > 0) {
			results.push(...sourceRows);
			results.push(blankReportRow);
		}
	}
});

test.afterAll(() => {
	fs.writeFileSync(outputFilePath, JSON.stringify(results, null, 2));
	console.log("\nPer-worker JSON created at:", outputFilePath);
});
