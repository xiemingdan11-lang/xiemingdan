import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { chromium } from "playwright";

const targetUrl = process.env.LIVE_LOGIN_URL || "https://live.douyin.com/";
const outputFile = process.env.LIVE_CAPTURE_STORAGE_STATE || path.join(process.cwd(), "secrets", "douyin-storage-state.json");
const executablePath = process.env.LIVE_CAPTURE_CHROMIUM_EXECUTABLE || "";

await mkdir(path.dirname(outputFile), { recursive: true });

const browser = await chromium.launch({
  headless: false,
  executablePath: executablePath || undefined
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1080 },
  storageState: existsSync(outputFile) ? outputFile : undefined
});
const page = await context.newPage();
await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 60000 });

const rl = readline.createInterface({ input, output });
await rl.question("Finish login/verification in the browser, then press Enter here to save login state...");
rl.close();

await context.storageState({ path: outputFile });
await browser.close();
console.log(`Login state saved: ${outputFile}`);
