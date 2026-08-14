# E2E tests

Playwright test that drives a real Chromium browser through the full inspection
flow: log in → upload a before/after image pair → wait for processing →
review the results overlay → download the PDF report → confirm the case
shows up in Inspection History.

The scenario is deterministic: the ML service's mock `/predict` endpoint
always returns `changes_detected: true` with exactly 2 bounding boxes (see
`ml-service/app.py`), so the test asserts on those exact numbers rather than
"something happened."

## One-time setup

```bash
cd e2e
npm install
npx playwright install --with-deps chromium
```

## Every run

**1. Start the stack** (Postgres via Docker, plus the seeded test user):

```bash
./scripts/start-stack.sh
```

This needs Docker running. It's safe to re-run - both the Postgres
container and the seed script are idempotent.

**2. Run the test:**

```bash
npm test
```

This single command starts the backend (:3000), frontend (:5173) and
ml-service (:8000) for you (see the `webServer` array in
`playwright.config.js`) and then runs the test against them. First run of
the ml-service step requires its Python venv to already exist:

```bash
cd ../ml-service
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

**3. View the report** (screenshots/video/trace on failure):

```bash
npm run report
```

## Test user

Seeded by `backend/seed.js` (idempotent - `ON CONFLICT DO NOTHING`):

| Email                       | Password      | Role      |
|------------------------------|---------------|-----------|
| yair@medlab.hit.ac.il        | password123   | inspector |

## Division of labor (per the delivery-phase action list)

- **Backend/setup owner (Yair):** this config, the fixtures, the stack
  script, and keeping the test passing as backend responses change.
- **Selectors (Neta):** the test locates elements by their current visible
  text/placeholders/roles (e.g. `getByPlaceholder('Enter your email')`,
  `getByRole('button', { name: 'Submit Images' })`). If a copy change or
  restructure in `frontend/src/pages/*.jsx` breaks a locator, please update
  it directly in `tests/full-inspection-flow.spec.js` rather than adding a
  second selector convention - one source of truth for "what the UI says"
  keeps this from silently drifting out of sync with the real app.

## Troubleshooting

- **`webServer` times out on the ml-service:** the venv isn't created yet, or
  `uvicorn` isn't on PATH inside it - activate the venv and run
  `pip install -r requirements.txt` first (see above).
- **Login fails with "Invalid credentials":** the seed script hasn't run, or
  it ran against a different Postgres than the one the backend is using -
  re-run `./scripts/start-stack.sh` and check `backend/.env` matches
  `docker-compose.yml`.
- **`docker compose` command not found:** install Docker Desktop (or the
  Docker Engine + Compose plugin on Linux); older Docker installs may need
  `docker-compose` (with a hyphen) instead.
