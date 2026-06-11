# MyCFOPro

AI-backed prototype for MyCFOPro.AI, an AI CFO platform for small businesses.

## Open the app (latest code)

**Run the server first**, then open:

### [http://localhost:3000](http://localhost:3000)

### Windows — easiest way

1. **Double-click `Open MyCFOPro.bat`** in the project folder  
2. Your browser opens automatically to the latest `index.html` and all connected features

Or in a terminal:

```bash
npm start
```

The browser should open on its own. If not, click the link above or double-click **`MyCFOPro.url`** (only works while the server is running).

> **Do not** double-click `index.html` in File Explorer — that skips the server and breaks Clara, AI, auth, and cloud sync. Always use **http://localhost:3000**.

> **Ignore** `MyCFOPro-v4 (5).html` — that is an old backup. The live app is **`index.html`**, served via the server above.

### Get the latest branch

```bash
git fetch origin
git checkout cursor/polish-trust-c2d3
git pull origin cursor/polish-trust-c2d3
npm install
npm start
```

## What is included

- A marketing homepage for the AI CFO product
- Financial statement upload for CSV, Excel, and PDF exports
- CFO-style analysis reports with charts and action items
- KPI library with calculators, company health dashboard, CEO slide deck, and Clara advisor
- Optional secure AI backend for generated CFO reports and Clara chat
- Accounts and cloud sync when running via `npm start`

## Run with real AI analysis

Use the Node server when you want AI-generated CFO reports and Clara chat. API keys stay on the server and are never exposed in the browser.

1. Copy the example environment file:

   ```bash
   cp .env.example .env
   ```

2. Add either `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` to `.env`.

3. Start the app:

   ```bash
   npm start
   ```

4. Open **[http://localhost:3000](http://localhost:3000)** (opens automatically on Windows/Mac/Linux).

When the backend is configured, uploaded financials first show an instant local preview, then the AI CFO engine replaces the report summary, findings, and action plan with generated analysis.

## Connected CFO workspace

Uploads are remembered across the app in your browser:

- **Financial Analysis** — latest report and AI findings
- **Company Health** — monthly history and goals
- **Slide Deck** — auto-built from your latest income statement
- **Clara (CFO Advisor)** — knows your numbers and month-over-month changes

Return anytime and use **View saved report** on the Financial Analysis page to pick up where you left off.

## Accounts and cloud sync

When you run `npm start`, MyCFOPro includes built-in sign-in and cloud sync:

1. Click **Sign in** or **Create account** in the nav
2. Your connected CFO workspace (reports, health history, deck memory) saves to the server
3. Sign in on any browser or device to restore your data

User accounts and company data are stored in `./data/` on the server. Set `SESSION_SECRET` in `.env` before production deployment.

Without signing in, data still works locally in your browser (same as before).

On the Financial Analysis page, choose the statement type before uploading:

- Income Statement (P&L)
- Balance Sheet
- Statement of Cash Flows
- AR Summary (Aging)
- AP Balance (Aging)
