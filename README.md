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

## Deploy to Render (one click)

Host MyCFOPro on the web so anyone can visit it without running `npm start` on their computer.

**Click this link** (sign in to Render with GitHub when asked):

**[Deploy MyCFOPro on Render](https://render.com/deploy?repo=https://github.com/BenWalker21/MyCFOPro)**

Or use the button:

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/BenWalker21/MyCFOPro)

### Steps

1. Click the link above. If Render asks you to sign in, choose **GitHub** and approve access.
2. Render shows a preview of what it will create from `render.yaml`. Click **Apply**.
3. When prompted, paste your **OpenAI API key** (`OPENAI_API_KEY`). Render auto-generates `SESSION_SECRET`.
4. Wait a few minutes for the build to finish (first deploy can take 5–10 minutes).
5. Open the URL Render gives you (for example `https://mycfopro.onrender.com`).

### If the link does not open correctly

Use the manual path instead:

1. Go to **[dashboard.render.com](https://dashboard.render.com)** and sign in with GitHub.
2. Click **New +** → **Blueprint**.
3. Connect the **BenWalker21/MyCFOPro** repo if it is not already connected.
4. Leave the branch as **main** and click **Apply**.
5. Enter your **OpenAI API key** when prompted.

### Important notes

- **Starter plan** (~$7/month) is required so user accounts and saved company data persist on a disk. Without the disk, sign-in data resets on each deploy.
- After deploy, you can add or change environment variables in the Render dashboard under **Environment**.
- The live app must be served by the server — do not upload `index.html` alone to a static host.

On the Financial Analysis page, choose the statement type before uploading:

- Income Statement (P&L)
- Balance Sheet
- Statement of Cash Flows
- AR Summary (Aging)
- AP Balance (Aging)
