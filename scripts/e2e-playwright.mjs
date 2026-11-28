import fs from 'node:fs';
import path from 'node:path';
import { spawn, execSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const playwright = require('playwright');

function findBrowserExecutable() {
  const localAppData = process.env.LOCALAPPDATA || '';
  const candidates = [
    path.join(localAppData, 'ms-playwright', 'chromium_headless_shell-1234', 'chrome-headless-shell-win64', 'chrome-headless-shell.exe'),
    path.join(localAppData, 'ms-playwright', 'chromium-1234', 'chrome-win64', 'chrome.exe'),
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  return candidates.find((p) => p && fs.existsSync(p));
}

const port = 3199;
const baseUrl = `http://127.0.0.1:${port}`;

const child = spawn(process.execPath, ['server.js'], {
  env: {
    ...process.env,
    PORT: String(port),
    NODE_ENV: 'production',
    DATABASE_URL: '',
    NEON_DATABASE_URL: '',
    NVIDIA_API_KEY: '',
    GEMINI_API_KEY: '',
    DISABLE_RATE_LIMIT: 'true',
  },
  stdio: 'pipe',
});

async function waitForHealth() {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`${baseUrl}/api/health`);
      if (r.ok) return;
    } catch {
      // Wait for server bind
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('Server did not start in time for E2E test.');
}

let browser;
try {
  await waitForHealth();
  const executablePath = findBrowserExecutable();
  browser = await playwright.chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  // 1. Load landing page & measure initial load timing
  const navStart = Date.now();
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  const initialLoadMs = Date.now() - navStart;
  const perfTiming = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    return nav
      ? {
          domContentLoadedMs: Math.round(nav.domContentLoadedEventEnd),
          loadEventMs: Math.round(nav.loadEventEnd),
        }
      : null;
  });
  await page.getByRole('button', { name: 'Register' }).click();
  const suffix = Date.now();
  await page.fill('#auth-fullname', 'Adv. E2E Counsel');
  await page.fill('#auth-org', 'E2E Legal Chambers');
  await page.fill('#auth-email', `e2e_${suffix}@chambers.in`);
  await page.fill('#auth-password', 'SecurePass@2026');
  await page.getByRole('button', { name: /Create Account & Launch/i }).click();

  // 2. Verify Workspace loads Overview
  await page.getByText('Chambers Operational Overview').waitFor({ timeout: 10000 });

  // 3. Create a new Matter
  await page.getByRole('button', { name: 'New Matter' }).click();
  await page.fill('#m-title', 'E2E Test Matter v. State');
  await page.fill('#m-code', `E2E-${suffix}`);
  await page.fill('#m-client', 'E2E Petitioner');
  await page.fill('#m-opp', 'State Respondent');
  await page.fill('#m-forum', 'High Court of Delhi');
  await page.fill('#m-facts', 'Application u/s 438 CrPC and Section 420 IPC.');
  await page.getByRole('dialog').getByRole('button', { name: 'Create Matter' }).click();
  await page.getByRole('heading', { name: 'E2E Test Matter v. State' }).waitFor({ timeout: 8000 });

  // 4. Navigate to Document Vault & process pasted exhibit
  await page.getByRole('button', { name: 'Document Vault' }).click();
  await page.fill('#vault-paste', 'FIR dated 2026-01-12 for Rs. 5,00,000 under Section 420 IPC.');
  await page.getByRole('button', { name: /Process & Index Document/i }).click();
  await page.getByText(/Annexure_/i).first().waitFor({ timeout: 10000 });

  // 5. Navigate to Legal Research
  await page.getByRole('button', { name: 'Legal Research' }).click();
  await page.fill('#research-query', 'Scope of anticipatory bail under Section 482 BNSS');
  await page.getByRole('button', { name: /Generate Real-Time Response/i }).click();
  await page.getByText(/IRAC Legal Memorandum/i).first().waitFor({ timeout: 25000 });

  // 6. Navigate to Judiciary Forms & generate Sec 63 BSA form
  await page.getByRole('button', { name: 'Judiciary Forms' }).click();
  await page.getByRole('button', { name: /Generate Court-Ready Form/i }).click();
  await page.getByText(/Saved to Matter Drafts/i).first().waitFor({ timeout: 25000 });

  // 7. Navigate to Legal Drafting, edit & save draft
  await page.getByRole('button', { name: 'Legal Drafting' }).click();
  await page.getByRole('button', { name: 'Save Draft' }).click();
  await page.getByText(/Saved "/i).first().waitFor({ timeout: 8000 });

  // 8. Navigate to Matters & Cases and pin Limitation deadline
  await page.getByRole('button', { name: 'Matters & Cases' }).click();
  await page.getByRole('button', { name: /Pin Deadline to Matter/i }).click();
  await page.getByText(/Pinned limitation deadline/i).waitFor({ timeout: 8000 });

  // 9. Navigate to Case Intelligence, Corporate Intelligence & Analytics
  await page.getByRole('button', { name: 'Case Intelligence' }).click();
  await page.getByText('Case Intelligence & Multi-Agent Orchestrator').waitFor();

  await page.getByRole('button', { name: 'Corporate Intelligence' }).click();
  await page.getByText('Corporate Intelligence & MCA Compliance').waitFor();

  await page.getByRole('button', { name: 'Analytics' }).click();
  await page.getByText('Legal Productivity Analytics').waitFor();

  // 10. Sign Out
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.getByText('Sign In to Chambers').waitFor({ timeout: 8000 });

  if (pageErrors.length > 0) {
    throw new Error(`Uncaught browser page errors detected: ${pageErrors.join('; ')}`);
  }

  console.log(
    JSON.stringify({
      status: 'PASSED',
      initialLoadMs,
      perfTiming,
      uncaughtPageErrors: pageErrors.length,
    })
  );
} finally {
  if (browser) await browser.close();
  child.kill('SIGTERM');
}
