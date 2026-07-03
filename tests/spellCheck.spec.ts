import { test } from "@playwright/test";
import * as XLSX from "xlsx";
import * as path from "path";
import * as fs from "fs";

const nspell = require("nspell");

const inputFilePath = path.resolve(__dirname, "PageVerificationUrls.xlsx");
const ignoreWordsPath = path.resolve(__dirname, "../ignore-words.txt");
const dictionaryDir = path.resolve(__dirname, "../node_modules/dictionary-en");
const dictionary = {
	aff: fs.readFileSync(path.join(dictionaryDir, "index.aff")),
	dic: fs.readFileSync(path.join(dictionaryDir, "index.dic")),
};
const spell = nspell(dictionary);

const workbook = XLSX.readFile(inputFilePath);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const urlList = (XLSX.utils.sheet_to_json(sheet) as { URL?: string; URLs?: string }[])
	.map((row) => row.URLs || row.URL || "")
	.filter((url) => url);

type SpellReportRow = {
	"Page URL": string;
	"Misspelled Words": string;
	"Suggested Corrections": string;
	Status: "Pass" | "Fail";
};

const results: SpellReportRow[] = [];
const reportsDir = path.resolve(__dirname, "../test-results/reports");
fs.mkdirSync(reportsDir, { recursive: true });
const outputFilePath = path.join(reportsDir, `spell-check-results-${process.pid}.json`);

const defaultIgnoredWords = [
	"api",
	"apis",
	"app",
	"apps",
	"ai",
	"ml",
	"genai",
	"agentic",
	"iot",
	"qa",
	"ui",
	"ux",
	"saas",
	"crm",
	"html",
	"css",
	"js",
	"json",
	"xlsx",
	"http",
	"https",
	"url",
	"urls",
	"seo",
	"cdn",
	"svg",
	"webp",
	"png",
	"jpg",
	"jpeg",
	"pdf",
	"aws",
	"azure",
	"databricks",
	"snowflake",
	"salesforce",
	"mulesoft",
	"microsoft",
	"copilot",
	"fabric",
	"devops",
	"python",
	"javascript",
	"typescript",
	"react",
	"playwright",
	"softweb",
	"softwebsolutions",
	"avnet",
	"linkedin",
	"youtube",
	"multicloud",
	"maui",
	"iotconnect",
	"needle",
	"oee",
	"plc",
	"plcs",
	"llm",
	"llms",
	"gui",
	"faqs",
	"openai",
	"langchain",
	"numpy",
	"plotly",
	"pytorch",
	"tensorflow",
	"codebase",
	"codebases",
	"customizable",
	"scalable",
];

function loadIgnoredWords() {
	const fileWords = fs.existsSync(ignoreWordsPath)
		? fs.readFileSync(ignoreWordsPath, "utf8")
			.split(/\r?\n/)
			.map((line) => line.trim())
			.filter((line) => line && !line.startsWith("#"))
		: [];

	return [...defaultIgnoredWords, ...fileWords];
}

for (const word of loadIgnoredWords()) {
	spell.add(word);
	spell.add(word.toLowerCase());
}

function cleanText(text: string) {
	return text
		.replace(/https?:\/\/\S+/gi, " ")
		.replace(/\bwww\.\S+/gi, " ")
		.replace(/\b[\w.+-]+@[\w.-]+\.\w+\b/g, " ")
		.replace(/&[a-z]+;/gi, " ");
}

// IMPORTANT: do NOT lowercase here. Hunspell/nspell dictionaries are
// case-sensitive for capitalized entries (proper nouns like "American",
// "Microsoft", "English", acronyms like "API"). Lowercasing before the lookup
// makes spell.correct() return false for all of them -> false "misspelled".
// Case folding is handled correctly by isSpelledCorrectly() instead.
function normalizeWord(word: string) {
	return word
		.replace(/^['-]+|['-]+$/g, "")   // strip surrounding quotes/hyphens
		.replace(/['’]s$/i, "");          // strip possessive: company's -> company
}

// Case-aware correctness check. nspell accepts a capitalized form of a
// lowercase dictionary word (so "The" matches "the"), but NOT the lowercase
// form of a capital-only word. So we check the original case first, then fall
// back to lowercase only for sentence-initial capitalization.
function isSpelledCorrectly(word: string) {
	if (spell.correct(word)) return true;
	const lower = word.toLowerCase();
	if (lower !== word && spell.correct(lower)) return true;
	return false;
}

function shouldIgnoreWord(word: string) {
	if (!word || word.length < 3) return true;
	if (/\d/.test(word)) return true;
	if (/[^a-z'-]/i.test(word)) return true;
	if (/^[a-z]$/i.test(word)) return true;
	if (/([a-z])\1{3,}/i.test(word)) return true;
	if (word.includes("-")) {
		const parts = word.split("-").filter(Boolean);
		if (parts.length > 1 && parts.every((part) => shouldIgnoreWord(part) || isSpelledCorrectly(part))) {
			return true;
		}
	}
	return false;
}

function findMisspellings(text: string) {
	const words = cleanText(text).match(/[A-Za-z][A-Za-z'-]*/g) || [];
	const misspellings = new Map<string, string[]>();

	for (const rawWord of words) {
		const word = normalizeWord(rawWord);
		if (shouldIgnoreWord(word)) continue;
		if (isSpelledCorrectly(word)) continue;

		// Dedupe case-insensitively so "Company"/"company" don't both appear.
		const key = word.toLowerCase();
		if (!misspellings.has(key)) {
			misspellings.set(key, spell.suggest(word).slice(0, 5));
		}
	}

	return misspellings;
}

test("Spell Check", async ({ page }) => {
	test.setTimeout(600000);
	console.log(`TOTAL_URLS:${urlList.length}`);

	for (const url of urlList) {
		console.log("\nURL:", url);

		try {
			const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
			await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});

			if (!response || response.status() >= 400) {
				results.push({
					"Page URL": url,
					"Misspelled Words": "",
					"Suggested Corrections": "",
					Status: "Fail",
				});
				console.log("Status: Fail");
				continue;
			}

			const visibleText = await page.locator("body").evaluate((body) => (body as HTMLElement).innerText || "");
			const misspellings = findMisspellings(visibleText);
			const misspelledWords = [...misspellings.keys()].sort();

			results.push({
				"Page URL": url,
				"Misspelled Words": misspelledWords.join(", "),
				"Suggested Corrections": misspelledWords
					.map((word) => `${word}: ${(misspellings.get(word) || []).join("/") || "No suggestion"}`)
					.join("; "),
				Status: misspelledWords.length > 0 ? "Fail" : "Pass",
			});

			console.log("Misspelled Words:", misspelledWords.length);
			console.log("Status:", misspelledWords.length > 0 ? "Fail" : "Pass");
		} catch (error: any) {
			results.push({
				"Page URL": url,
				"Misspelled Words": "",
				"Suggested Corrections": "",
				Status: "Fail",
			});
			console.log("Status: Fail");
			console.log("Error:", error.message);
		}
	}
});

test.afterAll(() => {
	fs.writeFileSync(outputFilePath, JSON.stringify(results, null, 2));
	console.log("\nPer-worker JSON created at:", outputFilePath);
});
