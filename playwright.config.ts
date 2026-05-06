import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	timeout: 600_000,
	retries: 0,
  testDir: "./tests",
  workers: 4,
  fullyParallel: true,

	// ✅ Clean report every run
	reporter: [
		["list"],
		[
			"html",
			{
				outputFolder: "playwright-report",
				open: "always", // always open report
			},
		],
	],

	// ✅ Automatically delete old report
	outputDir: "test-results",

	// globalSetup: "./global-setup.ts",
	globalTeardown: "./global-teardown.js",

	use: {
		browserName: "chromium",
		headless: true,
		viewport: null,
		ignoreHTTPSErrors: true,

		actionTimeout: 15000,
		navigationTimeout: 30000,

		trace: "retain-on-failure",
		screenshot: "only-on-failure",
		video: "retain-on-failure",

		launchOptions: {
			args: ["--start-maximized"],
		},
	},

 projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
