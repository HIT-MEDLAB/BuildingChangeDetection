const { test, expect } = require('@playwright/test');
const path = require('path');

// Seeded by backend/seed.js (idempotent - see scripts/start-stack.sh).
const TEST_USER = {
  email: 'yair@medlab.hit.ac.il',
  password: 'password123',
};

const BEFORE_IMAGE = path.join(__dirname, '..', 'fixtures', 'before.png');
const AFTER_IMAGE = path.join(__dirname, '..', 'fixtures', 'after.png');

/**
 * Full happy-path inspection flow, mirroring the demo script:
 *   log in -> upload a before/after pair -> processing -> results with the
 *   processed overlay -> download the PDF report -> find the case in history.
 *
 * The ML service's mock /predict endpoint always returns
 * changes_detected: true with exactly 2 bounding boxes (see ml-service/app.py)
 * and a fixed confidence, so the assertions below are deterministic - this
 * is not a flaky-by-nature test.
 *
 * NOTE for Neta: the selectors below use the visible text / placeholders /
 * roles that already exist in Login.jsx, Upload.jsx, Results.jsx and
 * History.jsx. If any of these change (copy edits, restructuring), please
 * update the matching locator here rather than adding a parallel selector
 * scheme - keeping one source of truth for "what the UI actually says"
 * avoids this test silently drifting from the real app.
 */
test('inspector can log in, upload, review results, download the report, and find the case in history', async ({ page }) => {
  // ---- 1. Log in ----
  await page.goto('/login');
  await page.getByPlaceholder('Enter your email').fill(TEST_USER.email);
  await page.getByPlaceholder('Enter your password').fill(TEST_USER.password);
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page).toHaveURL(/\/upload$/);

  // ---- 2. Upload a before/after image pair ----
  await expect(page.getByRole('heading', { name: 'Upload Inspection Images' })).toBeVisible();

  const fileInputs = page.locator('input[type="file"]');
  await expect(fileInputs).toHaveCount(2);
  await fileInputs.nth(0).setInputFiles(BEFORE_IMAGE); // "1. Upload Before Image"
  await fileInputs.nth(1).setInputFiles(AFTER_IMAGE);  // "2. Upload After Image"

  const submitButton = page.getByRole('button', { name: 'Submit Images' });
  await expect(submitButton).toBeEnabled();
  await submitButton.click();

  // ---- 3. Processing -> auto-redirects to Results once the backend
  //         finishes calling the ML service and saving the result ----
  await page.waitForURL(/\/results\/\d+$/, { timeout: 30_000 });

  // ---- 4. Results screen shows the detected changes overlaid on the
  //         processed "after" image ----
  await expect(page.getByRole('heading', { name: 'Results Screen' })).toBeVisible();
  await expect(page.getByText('Changes detected: 2')).toBeVisible();
  await expect(
    page.getByText('Suspicious areas are highlighted in red on the after image.')
  ).toBeVisible();

  // The two mock bounding boxes should render as overlay rectangles.
  const detectedBoxes = page.locator('.red-box');
  await expect(detectedBoxes).toHaveCount(2);

  // ---- 5. Download the PDF report ----
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /Download Summary Report/ }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^inspection-\d+-summary-report\.pdf$/);

  // ---- 6. Find the case in Inspection History ----
  await page.goto('/history');
  await expect(page.getByRole('heading', { name: 'Inspection History' })).toBeVisible();

  // The new case is a fresh "under review" + "changes detected" inspection,
  // which is priority 1 under the default "Priority First" sort - so it is
  // always the first row, regardless of how much older history exists.
  const firstRow = page.locator('table.history-table tbody tr').first();
  await expect(firstRow).toBeVisible();
  await expect(firstRow.getByText('Change Detected')).toBeVisible();
  await expect(firstRow.getByText('Under Review')).toBeVisible();
});
