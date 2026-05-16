import { chromium } from 'playwright';

const executablePath = '/Users/srinithi/Library/Caches/ms-playwright/chromium_headless_shell-1200/chrome-headless-shell-mac-arm64/chrome-headless-shell';

const browser = await chromium.launch({ headless: true, executablePath });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await context.newPage();

await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

const connectButton = page.getByRole('button', { name: 'Connect Local Session' });
if (await connectButton.count()) {
  await page.getByLabel('Local Username').fill('admin');
  await page.getByLabel('Local Password').fill('admin');
  await connectButton.click();
  await page.waitForTimeout(1800);
}

await page.screenshot({ path: '../docs/screenshots/dashboard.png', fullPage: true });

await page.goto('http://localhost:3000/patients', { waitUntil: 'networkidle' });
await page.screenshot({ path: '../docs/screenshots/patients.png', fullPage: true });

await page.goto('http://localhost:3000/extractions', { waitUntil: 'networkidle' });
await page.screenshot({ path: '../docs/screenshots/extractions.png', fullPage: true });

await browser.close();
console.log('Screenshots captured');
