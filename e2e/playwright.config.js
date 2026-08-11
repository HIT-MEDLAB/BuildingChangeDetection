// @ts-check
const path = require('path');
const { defineConfig, devices } = require('@playwright/test');

// Invoke the venv's own python directly (venv/bin/python on macOS/Linux,
// venv\Scripts\python.exe on Windows) instead of "activating" a shell -
// activation needs a real POSIX shell (bash -lc ...), which breaks under
// plain Windows/WSL interop ("execvpe(/bin/bash) failed"). Calling the venv
// interpreter directly works the same way on every platform.
const isWindows = process.platform === 'win32';
const venvPython = isWindows
  ? path.join('.venv', 'Scripts', 'python.exe')
  : path.join('.venv', 'bin', 'python');

/**
 * E2E config for the Municipal Illegal Construction Detection System.
 *
 * Prerequisites (see scripts/start-stack.sh / README.md):
 *   - Postgres running and migrated (docker compose up -d, from the repo root)
 *   - backend/.env and frontend/.env created from their .env.example files
 *   - ml-service Python venv created with requirements.txt installed
 *   - The seed test user exists (node backend/seed.js)
 *
 * Given the above, `npm test` from this folder boots backend, frontend and
 * ml-service itself (see `webServer` below) and runs the full flow against
 * them.
 */
module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: false, // the tests share one seeded user/DB - keep them sequential
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Boots all three application services. Postgres is NOT started here -
  // start it first with scripts/start-stack.sh (or `docker compose up -d`).
  webServer: [
    {
      command: 'npm run dev',
      cwd: '../backend',
      url: 'http://localhost:3000/health',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: 'npm run dev -- --port 5173 --strictPort',
      cwd: '../frontend',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: `"${venvPython}" -m uvicorn app:app --port 8000`,
      cwd: '../ml-service',
      url: 'http://localhost:8000/health',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});
