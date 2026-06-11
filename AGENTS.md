# MyCFOPro

## Cursor Cloud specific instructions

### What this is
A single-file, fully client-side static web app: `MyCFOPro-v4 (5).html`. There is **no build system, no package manager, no backend, and no installable dependencies**. Third-party libraries (Chart.js, SheetJS/xlsx, pdf.js) load from CDNs at runtime, so internet access is needed for charts and spreadsheet/PDF parsing.

### Running it (development)
Serve the repo root over HTTP and open the file in a browser:

```
python3 -m http.server 8000
# then open: http://localhost:8000/MyCFOPro-v4%20(5).html
```

Gotcha: the filename contains a space and parentheses, so the URL must be percent-encoded as `MyCFOPro-v4%20(5).html`. Opening via the directory listing at `http://localhost:8000/` also works.

### Core functionality
The main feature is the **financial analysis engine**: from the landing page click "Analyze my financials free", then upload a Profit & Loss / Balance Sheet file (`.csv`, `.xlsx`/`.xls`, or `.pdf`). The app parses it client-side and renders metrics (revenue, gross/net margin, etc.) and charts. All parsing/rendering happens in the browser — no server round-trip.

CSV/P&L format expected: rows of `Label,Value` (e.g. `Total Income,1250000`, `Net Income,210000`). The parser matches common QuickBooks/Xero/Wave label variants.

### Chatbot ("Clara")
The in-app chatbot calls `https://api.anthropic.com/v1/messages` directly from the browser with no API key. This is expected to fail (auth/CORS) and is **not** part of core functionality — it does not block testing the analysis feature.

### Lint / test / build
There are no lint, test, or build configurations in this repo. The only "run" step is serving the static file as above.
