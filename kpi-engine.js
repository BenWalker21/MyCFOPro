// ── KPI LIBRARY + CALCULATOR + HEALTH TRACKING ───────────────────────

const KPI_CATEGORIES = ['All', 'Profitability', 'Liquidity', 'Efficiency', 'Leverage', 'Growth'];

const KPI_DEFS = [
  {
    id: 'grossMargin', cat: 'Profitability', catColor: '#22c55e', catBg: '#dcfce7',
    name: 'Gross Margin', formula: 'Gross Profit ÷ Revenue × 100',
    desc: 'Percentage of revenue left after direct costs. Core signal of pricing and delivery efficiency.',
    benchmark: 'Services 50–70% · Retail 25–35%',
    unit: 'percent', higherBetter: true, good: 38, warn: 25,
    inputs: [
      { key: 'revenue', label: 'Revenue ($)', type: 'currency' },
      { key: 'grossProfit', label: 'Gross Profit ($)', type: 'currency' }
    ],
    calc: v => v.revenue > 0 ? (v.grossProfit / v.revenue) * 100 : null
  },
  {
    id: 'netMargin', cat: 'Profitability', catColor: '#22c55e', catBg: '#dcfce7',
    name: 'Net Profit Margin', formula: 'Net Income ÷ Revenue × 100',
    desc: 'What percentage of revenue becomes actual profit after all expenses.',
    benchmark: 'Healthy: 8–15%',
    unit: 'percent', higherBetter: true, good: 8, warn: 3,
    inputs: [
      { key: 'revenue', label: 'Revenue ($)', type: 'currency' },
      { key: 'netIncome', label: 'Net Income ($)', type: 'currency' }
    ],
    calc: v => v.revenue > 0 ? (v.netIncome / v.revenue) * 100 : null
  },
  {
    id: 'ebitdaMargin', cat: 'Profitability', catColor: '#22c55e', catBg: '#dcfce7',
    name: 'EBITDA Margin', formula: 'EBITDA ÷ Revenue × 100',
    desc: 'Operating profitability before interest, taxes, depreciation, and amortization.',
    benchmark: 'Strong: 15%+',
    unit: 'percent', higherBetter: true, good: 15, warn: 8,
    inputs: [
      { key: 'revenue', label: 'Revenue ($)', type: 'currency' },
      { key: 'ebitda', label: 'EBITDA ($)', type: 'currency' }
    ],
    calc: v => v.revenue > 0 ? (v.ebitda / v.revenue) * 100 : null
  },
  {
    id: 'roa', cat: 'Profitability', catColor: '#22c55e', catBg: '#dcfce7',
    name: 'Return on Assets', formula: 'Net Income ÷ Total Assets × 100',
    desc: 'How efficiently assets generate profit.',
    benchmark: 'Good: 5%+ · Excellent: 10%+',
    unit: 'percent', higherBetter: true, good: 5, warn: 2,
    inputs: [
      { key: 'netIncome', label: 'Net Income ($)', type: 'currency' },
      { key: 'totalAssets', label: 'Total Assets ($)', type: 'currency' }
    ],
    calc: v => v.totalAssets > 0 ? (v.netIncome / v.totalAssets) * 100 : null
  },
  {
    id: 'currentRatio', cat: 'Liquidity', catColor: '#0f2570', catBg: '#e8eef6',
    name: 'Current Ratio', formula: 'Current Assets ÷ Current Liabilities',
    desc: 'Can you cover short-term bills? Above 1.0 means yes.',
    benchmark: 'Healthy: 1.5–2.0',
    unit: 'ratio', higherBetter: true, good: 1.5, warn: 1.0,
    inputs: [
      { key: 'currentAssets', label: 'Current Assets ($)', type: 'currency' },
      { key: 'currentLiabilities', label: 'Current Liabilities ($)', type: 'currency' }
    ],
    calc: v => v.currentLiabilities > 0 ? v.currentAssets / v.currentLiabilities : null
  },
  {
    id: 'cashRunway', cat: 'Liquidity', catColor: '#0f2570', catBg: '#e8eef6',
    name: 'Cash Runway', formula: 'Cash ÷ Monthly Burn Rate',
    desc: 'Months you can operate at current burn without new cash.',
    benchmark: 'Target: 6+ months',
    unit: 'months', higherBetter: true, good: 6, warn: 3,
    inputs: [
      { key: 'cash', label: 'Cash on Hand ($)', type: 'currency' },
      { key: 'monthlyBurn', label: 'Monthly Burn ($)', type: 'currency' }
    ],
    calc: v => v.monthlyBurn > 0 ? v.cash / v.monthlyBurn : null
  },
  {
    id: 'quickRatio', cat: 'Liquidity', catColor: '#0f2570', catBg: '#e8eef6',
    name: 'Quick Ratio', formula: '(Cash + AR) ÷ Current Liabilities',
    desc: 'Stricter liquidity test — excludes inventory.',
    benchmark: 'Healthy: 1.0+',
    unit: 'ratio', higherBetter: true, good: 1.0, warn: 0.8,
    inputs: [
      { key: 'cash', label: 'Cash ($)', type: 'currency' },
      { key: 'ar', label: 'Accounts Receivable ($)', type: 'currency' },
      { key: 'currentLiabilities', label: 'Current Liabilities ($)', type: 'currency' }
    ],
    calc: v => v.currentLiabilities > 0 ? (v.cash + v.ar) / v.currentLiabilities : null
  },
  {
    id: 'dso', cat: 'Efficiency', catColor: '#1a4480', catBg: '#e8eef6',
    name: 'Days Sales Outstanding', formula: 'AR ÷ (Revenue ÷ 365)',
    desc: 'Average days to collect from customers. Lower is better.',
    benchmark: 'Typical: 30–45 days',
    unit: 'days', higherBetter: false, good: 45, warn: 60,
    inputs: [
      { key: 'ar', label: 'Accounts Receivable ($)', type: 'currency' },
      { key: 'revenue', label: 'Annual Revenue ($)', type: 'currency' }
    ],
    calc: v => v.revenue > 0 ? v.ar / (v.revenue / 365) : null
  },
  {
    id: 'inventoryTurnover', cat: 'Efficiency', catColor: '#1a4480', catBg: '#e8eef6',
    name: 'Inventory Turnover', formula: 'COGS ÷ Average Inventory',
    desc: 'How often inventory sells through in a year.',
    benchmark: 'Higher is generally better',
    unit: 'times', higherBetter: true, good: 6, warn: 3,
    inputs: [
      { key: 'cogs', label: 'COGS ($)', type: 'currency' },
      { key: 'avgInventory', label: 'Average Inventory ($)', type: 'currency' }
    ],
    calc: v => v.avgInventory > 0 ? v.cogs / v.avgInventory : null
  },
  {
    id: 'apDays', cat: 'Efficiency', catColor: '#1a4480', catBg: '#e8eef6',
    name: 'Accounts Payable Days', formula: 'AP ÷ (COGS ÷ 365)',
    desc: 'Average days to pay suppliers.',
    benchmark: 'Typical: 30–60 days',
    unit: 'days', higherBetter: true, good: 45, warn: 20,
    inputs: [
      { key: 'ap', label: 'Accounts Payable ($)', type: 'currency' },
      { key: 'cogs', label: 'Annual COGS ($)', type: 'currency' }
    ],
    calc: v => v.cogs > 0 ? v.ap / (v.cogs / 365) : null
  },
  {
    id: 'revenuePerEmployee', cat: 'Efficiency', catColor: '#1a4480', catBg: '#e8eef6',
    name: 'Revenue per Employee', formula: 'Revenue ÷ Employees',
    desc: 'Productivity per team member.',
    benchmark: 'Services: $100K–200K/employee',
    unit: 'currency', higherBetter: true, good: 150000, warn: 80000,
    inputs: [
      { key: 'revenue', label: 'Annual Revenue ($)', type: 'currency' },
      { key: 'employees', label: 'Number of Employees', type: 'number' }
    ],
    calc: v => v.employees > 0 ? v.revenue / v.employees : null
  },
  {
    id: 'debtToEquity', cat: 'Leverage', catColor: '#0a1628', catBg: '#e8eef6',
    name: 'Debt-to-Equity Ratio', formula: 'Total Debt ÷ Total Equity',
    desc: 'How much you owe vs owner investment.',
    benchmark: 'Healthy: below 2.0',
    unit: 'ratio', higherBetter: false, good: 1.5, warn: 2.5,
    inputs: [
      { key: 'totalDebt', label: 'Total Debt ($)', type: 'currency' },
      { key: 'totalEquity', label: 'Total Equity ($)', type: 'currency' }
    ],
    calc: v => v.totalEquity > 0 ? v.totalDebt / v.totalEquity : null
  },
  {
    id: 'debtRatio', cat: 'Leverage', catColor: '#0a1628', catBg: '#e8eef6',
    name: 'Debt Ratio', formula: 'Total Liabilities ÷ Total Assets × 100',
    desc: 'Share of assets financed by debt.',
    benchmark: 'Healthy: below 50%',
    unit: 'percent', higherBetter: false, good: 50, warn: 80,
    inputs: [
      { key: 'totalLiabilities', label: 'Total Liabilities ($)', type: 'currency' },
      { key: 'totalAssets', label: 'Total Assets ($)', type: 'currency' }
    ],
    calc: v => v.totalAssets > 0 ? (v.totalLiabilities / v.totalAssets) * 100 : null
  },
  {
    id: 'interestCoverage', cat: 'Leverage', catColor: '#0a1628', catBg: '#e8eef6',
    name: 'Interest Coverage Ratio', formula: 'EBIT ÷ Interest Expense',
    desc: 'Can earnings cover interest payments?',
    benchmark: 'Healthy: 3.0+',
    unit: 'ratio', higherBetter: true, good: 3, warn: 1.5,
    inputs: [
      { key: 'ebit', label: 'EBIT / Operating Income ($)', type: 'currency' },
      { key: 'interestExpense', label: 'Interest Expense ($)', type: 'currency' }
    ],
    calc: v => v.interestExpense > 0 ? v.ebit / v.interestExpense : null
  },
  {
    id: 'revenueGrowth', cat: 'Growth', catColor: '#22c55e', catBg: '#dcfce7',
    name: 'Revenue Growth Rate', formula: '(Current − Prior) ÷ Prior × 100',
    desc: 'Year-over-year or period-over-period revenue momentum.',
    benchmark: 'Strong: 15–25% YoY',
    unit: 'percent', higherBetter: true, good: 15, warn: 0,
    inputs: [
      { key: 'currentRevenue', label: 'Current Period Revenue ($)', type: 'currency' },
      { key: 'priorRevenue', label: 'Prior Period Revenue ($)', type: 'currency' }
    ],
    calc: v => v.priorRevenue > 0 ? ((v.currentRevenue - v.priorRevenue) / v.priorRevenue) * 100 : null
  },
  {
    id: 'cac', cat: 'Growth', catColor: '#22c55e', catBg: '#dcfce7',
    name: 'Customer Acquisition Cost', formula: 'Sales & Marketing Spend ÷ New Customers',
    desc: 'Cost to win one new customer.',
    benchmark: 'Target LTV at least 3× CAC',
    unit: 'currency', higherBetter: false, good: 500, warn: 1500,
    inputs: [
      { key: 'marketingSpend', label: 'Sales & Marketing Spend ($)', type: 'currency' },
      { key: 'newCustomers', label: 'New Customers', type: 'number' }
    ],
    calc: v => v.newCustomers > 0 ? v.marketingSpend / v.newCustomers : null
  },
  {
    id: 'ltv', cat: 'Growth', catColor: '#22c55e', catBg: '#dcfce7',
    name: 'Customer Lifetime Value', formula: 'Avg Purchase × Frequency × Lifespan (years)',
    desc: 'Expected total revenue from one customer relationship.',
    benchmark: 'Higher is better — track trend',
    unit: 'currency', higherBetter: true, good: 3000, warn: 1000,
    inputs: [
      { key: 'avgPurchase', label: 'Avg Purchase ($)', type: 'currency' },
      { key: 'frequency', label: 'Purchases per Year', type: 'number' },
      { key: 'lifespan', label: 'Avg Customer Lifespan (years)', type: 'number' }
    ],
    calc: v => v.avgPurchase * v.frequency * v.lifespan
  }
];

let kpiActiveCategory = 'All';
let kpiSearchQuery = '';
let kpiInputCache = {};

function initKpiPage() {
  ensureHealthKpiStructure();
  if (!Object.keys(kpiInputCache).length) prefillKpiInputsFromFinancials(false);
  renderKpiPage();
}

function ensureHealthKpiStructure() {
  if (typeof loadHealthStore !== 'function') return;
  loadHealthStore();
  if (!Array.isArray(healthStore.trackedKpiIds)) healthStore.trackedKpiIds = [];
  if (!healthStore.kpiSnapshots) healthStore.kpiSnapshots = {};
}

function getKpiPrefillMap() {
  const d = typeof currentData !== 'undefined' && currentData ? currentData : null;
  const latest = typeof loadCompanyStore === 'function' ? loadCompanyStore()?.latest?.financials : null;
  const src = d || latest || {};
  const monthlyBurn = src.opex ? src.opex / 12 : (src.netIncome < 0 ? Math.abs(src.netIncome) / 12 : 0);

  return {
    revenue: src.revenue || 0,
    grossProfit: src.grossProfit || (src.revenue - (src.cogs || 0)) || 0,
    netIncome: src.netIncome || 0,
    ebitda: src.opIncome || src.ebit || ((src.netIncome || 0) + (src.interestExpense || 0) + (src.depreciation || 0)),
    totalAssets: src.totalAssets || 0,
    currentAssets: src.currentAssets || 0,
    currentLiabilities: src.currentLiabilities || 0,
    cash: src.cash || src.endingCash || 0,
    ar: src.accountsReceivable || 0,
    ap: src.accountsPayable || 0,
    cogs: src.cogs || 0,
    avgInventory: src.inventory || 0,
    totalDebt: src.longTermDebt || src.totalLiabilities || 0,
    totalEquity: src.totalEquity || 0,
    totalLiabilities: src.totalLiabilities || 0,
    interestExpense: src.interestExpense || 0,
    ebit: src.opIncome || src.ebit || 0,
    monthlyBurn: monthlyBurn || 0,
    currentRevenue: src.revenue || 0,
    priorRevenue: 0,
    marketingSpend: src.marketing || 0,
    newCustomers: 0,
    employees: 0,
    avgPurchase: 0,
    frequency: 0,
    lifespan: 0
  };
}

function prefillKpiInputsFromFinancials(showNotice) {
  const map = getKpiPrefillMap();
  const hasData = map.revenue > 0 || map.totalAssets > 0 || map.cash > 0;
  KPI_DEFS.forEach(kpi => {
    if (!kpiInputCache[kpi.id]) kpiInputCache[kpi.id] = {};
    kpi.inputs.forEach(inp => {
      if (map[inp.key] !== undefined && map[inp.key] !== 0) {
        kpiInputCache[kpi.id][inp.key] = map[inp.key];
      }
    });
  });
  if (showNotice && hasData) {
    const el = document.getElementById('kpi-prefill-status');
    if (el) {
      el.textContent = 'Filled from your latest financial upload.';
      window.setTimeout(() => { el.textContent = ''; }, 3000);
    }
  }
  renderKpiPage();
}

function parseKpiInputValue(raw) {
  if (raw === '' || raw === null || raw === undefined) return 0;
  const n = parseFloat(String(raw).replace(/[$,%\s,]/g, ''));
  return isNaN(n) ? 0 : n;
}

function getKpiInputValues(kpiId) {
  const kpi = KPI_DEFS.find(k => k.id === kpiId);
  if (!kpi) return {};
  const values = {};
  kpi.inputs.forEach(inp => {
    const el = document.getElementById(`kpi-input-${kpiId}-${inp.key}`);
    if (el) values[inp.key] = parseKpiInputValue(el.value);
    else values[inp.key] = parseKpiInputValue(kpiInputCache[kpiId]?.[inp.key]);
  });
  return values;
}

function formatKpiResult(kpi, value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  if (kpi.unit === 'percent') return fp(value);
  if (kpi.unit === 'currency') return fc(value);
  if (kpi.unit === 'days') return value.toFixed(0) + ' days';
  if (kpi.unit === 'months') return value.toFixed(1) + ' mo';
  if (kpi.unit === 'times') return value.toFixed(1) + '×';
  return value.toFixed(2);
}

function evaluateKpiStatus(kpi, value) {
  if (value === null || Number.isNaN(value)) return 'neutral';
  if (kpi.higherBetter) {
    if (value >= kpi.good) return 'good';
    if (value >= kpi.warn) return 'warn';
    return 'bad';
  }
  if (value <= kpi.good) return 'good';
  if (value <= kpi.warn) return 'warn';
  return 'bad';
}

function calculateKpi(kpiId) {
  const kpi = KPI_DEFS.find(k => k.id === kpiId);
  if (!kpi) return null;
  const values = getKpiInputValues(kpiId);
  kpiInputCache[kpiId] = values;
  return kpi.calc(values);
}

function renderKpiPage() {
  const grid = document.getElementById('kpi-grid');
  if (!grid) return;

  let list = KPI_DEFS;
  if (kpiActiveCategory !== 'All') list = list.filter(k => k.cat === kpiActiveCategory);
  if (kpiSearchQuery) {
    const q = kpiSearchQuery.toLowerCase();
    list = list.filter(k => k.name.toLowerCase().includes(q) || k.desc.toLowerCase().includes(q));
  }

  grid.innerHTML = list.map(kpi => {
    const values = kpiInputCache[kpi.id] || {};
    const result = kpi.calc(Object.fromEntries(kpi.inputs.map(i => [i.key, parseKpiInputValue(values[i.key])])));
    const status = evaluateKpiStatus(kpi, result);
    const tracked = isKpiTracked(kpi.id);
    const statusLabel = status === 'good' ? 'On track' : status === 'warn' ? 'Watch' : status === 'bad' ? 'Needs attention' : '';

    return `<div class="kpi-card kpi-card-calc" id="kpi-card-${kpi.id}">
      <span class="kpi-cat" style="background:${kpi.catBg};color:${kpi.catColor}">${kpi.cat}</span>
      <div class="kpi-name-row">
        <div class="kpi-name">${escapeHtml(kpi.name)}</div>
        ${tracked ? '<span class="kpi-tracked-badge">Tracked</span>' : ''}
      </div>
      <div class="kpi-formula">${escapeHtml(kpi.formula)}</div>
      <div class="kpi-desc">${escapeHtml(kpi.desc)}</div>
      <div class="kpi-calc-panel">
        <div class="kpi-calc-inputs">
          ${kpi.inputs.map(inp => `
            <label class="kpi-calc-field">
              <span>${escapeHtml(inp.label)}</span>
              <input type="text" id="kpi-input-${kpi.id}-${inp.key}" value="${values[inp.key] ? formatKpiInputDisplay(inp, values[inp.key]) : ''}" placeholder="0" oninput="onKpiInputChange('${kpi.id}')">
            </label>`).join('')}
        </div>
        <div class="kpi-result-row">
          <div class="kpi-result-block kpi-status-${status}">
            <div class="kpi-result-label">Your result</div>
            <div class="kpi-result-value" id="kpi-result-${kpi.id}">${formatKpiResult(kpi, result)}</div>
            ${statusLabel ? `<div class="kpi-result-status">${statusLabel}</div>` : ''}
          </div>
          <div class="kpi-track-col">
            <label class="kpi-month-field">
              <span>Track for month</span>
              <input type="month" id="kpi-month-${kpi.id}" value="${defaultMonthKey()}">
            </label>
            <button class="btn-blue kpi-track-btn" onclick="trackKpiToHealth('${kpi.id}')">${tracked ? 'Update tracker' : 'Add to Company Health'}</button>
          </div>
        </div>
      </div>
      <div class="kpi-benchmark"><strong>Benchmark:</strong> ${escapeHtml(kpi.benchmark)}</div>
    </div>`;
  }).join('');
}

function formatKpiInputDisplay(inp, val) {
  if (!val) return '';
  if (inp.type === 'currency') return Math.round(val).toLocaleString('en-US');
  return String(val);
}

function onKpiInputChange(kpiId) {
  const kpi = KPI_DEFS.find(k => k.id === kpiId);
  const values = getKpiInputValues(kpiId);
  kpiInputCache[kpiId] = values;
  const result = kpi.calc(values);
  const status = evaluateKpiStatus(kpi, result);
  const statusLabel = status === 'good' ? 'On track' : status === 'warn' ? 'Watch' : status === 'bad' ? 'Needs attention' : '';
  const el = document.getElementById('kpi-result-' + kpiId);
  if (el) el.textContent = formatKpiResult(kpi, result);
  const block = el?.closest('.kpi-result-block');
  if (block) {
    block.className = 'kpi-result-block kpi-status-' + status;
    let statusEl = block.querySelector('.kpi-result-status');
    if (statusLabel) {
      if (!statusEl) {
        statusEl = document.createElement('div');
        statusEl.className = 'kpi-result-status';
        block.appendChild(statusEl);
      }
      statusEl.textContent = statusLabel;
    } else if (statusEl) {
      statusEl.remove();
    }
  }
}

function setKpiCategory(cat, btn) {
  kpiActiveCategory = cat;
  document.querySelectorAll('.kpi-cat-tab').forEach(t => t.classList.toggle('active', t === btn));
  renderKpiPage();
}

function filterKpiSearch(q) {
  kpiSearchQuery = q.trim();
  renderKpiPage();
}

function isKpiTracked(kpiId) {
  ensureHealthKpiStructure();
  return healthStore.trackedKpiIds.includes(kpiId);
}

function trackKpiToHealth(kpiId) {
  const kpi = KPI_DEFS.find(k => k.id === kpiId);
  if (!kpi) return;
  const value = calculateKpi(kpiId);
  if (value === null || Number.isNaN(value)) {
    alert('Enter valid numbers to calculate this KPI first.');
    return;
  }

  const monthEl = document.getElementById('kpi-month-' + kpiId);
  const monthKey = monthEl?.value || defaultMonthKey();

  ensureHealthKpiStructure();
  if (!healthStore.trackedKpiIds.includes(kpiId)) {
    healthStore.trackedKpiIds.push(kpiId);
  }
  if (!healthStore.kpiSnapshots[monthKey]) healthStore.kpiSnapshots[monthKey] = {};
  healthStore.kpiSnapshots[monthKey][kpiId] = {
    value,
    label: kpi.name,
    unit: kpi.unit,
    updatedAt: new Date().toISOString()
  };

  const entryIdx = healthStore.entries.findIndex(e => e.monthKey === monthKey);
  if (entryIdx >= 0) {
    if (!healthStore.entries[entryIdx].customKpis) healthStore.entries[entryIdx].customKpis = {};
    healthStore.entries[entryIdx].customKpis[kpiId] = value;
  } else {
    healthStore.entries.push({
      id: 'kpi-' + monthKey + '-' + Date.now(),
      monthKey,
      monthLabel: monthKeyToLabel(monthKey),
      company: healthStore.company || '',
      statementType: 'kpi_manual',
      filename: 'KPI calculator',
      uploadedAt: new Date().toISOString(),
      metrics: { healthScore: 0, revenue: 0, grossMargin: 0, netMargin: 0, netIncome: 0, opMargin: 0 },
      customKpis: { [kpiId]: value }
    });
    healthStore.entries.sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  }

  saveHealthStore();
  renderKpiPage();
  if (typeof renderTrackedKpisPanel === 'function') renderTrackedKpisPanel();

  const status = document.getElementById('kpi-track-status');
  if (status) {
    status.textContent = `${kpi.name} saved to ${monthKeyToLabel(monthKey)} on Company Health.`;
    window.setTimeout(() => { status.textContent = ''; }, 3500);
  }
}

function getTrackedKpiTrend(kpiId) {
  ensureHealthKpiStructure();
  const points = [];
  Object.keys(healthStore.kpiSnapshots || {}).sort().forEach(monthKey => {
    const snap = healthStore.kpiSnapshots[monthKey][kpiId];
    if (snap) points.push({ monthKey, monthLabel: monthKeyToLabel(monthKey), value: snap.value });
  });
  return points;
}

function renderTrackedKpisPanel() {
  const panel = document.getElementById('health-tracked-kpis');
  if (!panel) return;

  ensureHealthKpiStructure();
  const ids = healthStore.trackedKpiIds || [];
  if (!ids.length) {
    panel.style.display = 'none';
    return;
  }

  panel.style.display = 'block';
  panel.innerHTML = `
    <div class="hca-header" style="margin-bottom:0.75rem">
      <div>
        <div class="hca-title">Tracked KPIs</div>
        <div class="hca-sub">Added from the KPI Library calculator — updated each month you save</div>
      </div>
      <button class="btn-outline" style="font-size:12px;padding:8px 14px" onclick="goPage('kpi', document.querySelectorAll('.nav-link')[3])">Manage KPIs →</button>
    </div>
    <div class="health-tracked-kpi-grid">
      ${ids.map(id => {
        const kpi = KPI_DEFS.find(k => k.id === id);
        if (!kpi) return '';
        const trend = getTrackedKpiTrend(id);
        const latest = trend[trend.length - 1];
        const prior = trend.length > 1 ? trend[trend.length - 2] : null;
        const delta = latest && prior ? latest.value - prior.value : null;
        const deltaClass = delta === null ? 'neutral' : (kpi.higherBetter ? (delta >= 0 ? 'up' : 'down') : (delta <= 0 ? 'up' : 'down'));
        const status = latest ? evaluateKpiStatus(kpi, latest.value) : 'neutral';
        const statusLabel = status === 'good' ? 'On track' : status === 'warn' ? 'Watch' : status === 'bad' ? 'Needs attention' : '';
        return `<div class="health-tracked-kpi-card kpi-status-${status}">
          <div class="health-tracked-kpi-head">
            <div class="health-kpi-label">${escapeHtml(kpi.name)}</div>
            <button type="button" class="health-kpi-remove" title="Stop tracking" onclick="removeTrackedKpi('${id}')">×</button>
          </div>
          <div class="health-kpi-value">${latest ? formatKpiResult(kpi, latest.value) : '—'}</div>
          <div class="health-kpi-meta">
            ${latest ? `<span class="health-kpi-change neutral">${escapeHtml(latest.monthLabel)}</span>` : '<span class="health-kpi-change neutral">Not recorded yet</span>'}
            ${statusLabel ? `<span class="health-kpi-change ${status === 'good' ? 'up' : status === 'warn' ? 'neutral' : 'down'}">${statusLabel}</span>` : ''}
            ${delta !== null ? `<span class="health-kpi-change ${deltaClass}">${delta >= 0 ? '+' : ''}${kpi.unit === 'percent' ? delta.toFixed(1) + ' pts' : kpi.unit === 'currency' ? fc(delta) : delta.toFixed(2)} vs prior</span>` : ''}
          </div>
        </div>`;
      }).join('')}
    </div>`;
}

function removeTrackedKpi(kpiId) {
  const kpi = KPI_DEFS.find(k => k.id === kpiId);
  const name = kpi?.name || 'this KPI';
  if (!confirm(`Stop tracking ${name}? Past monthly values will stay in history.`)) return;
  ensureHealthKpiStructure();
  healthStore.trackedKpiIds = healthStore.trackedKpiIds.filter(id => id !== kpiId);
  saveHealthStore();
  renderTrackedKpisPanel();
  renderKpiPage();
}

// Legacy alias for index.html
const KPIS = KPI_DEFS;
function buildKPIs() { initKpiPage(); }
