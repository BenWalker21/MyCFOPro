# MyCFOPro

AI-backed prototype for MyCFOPro.AI, an AI CFO platform for small businesses.

## What is included

- A marketing homepage for the AI CFO product
- Financial statement upload for CSV, Excel, and PDF exports
- CFO-style analysis reports with charts and action items
- KPI library, company health dashboard, CEO slide deck preview, and Clara advisor UI
- Optional secure AI backend for generated CFO reports and Clara chat

## Open the static demo

Open `index.html` directly in a browser. File upload, charts, KPI pages, the slide deck, and local Clara fallback responses work without a server.

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

4. Open:

   ```text
   http://localhost:3000
   ```

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
