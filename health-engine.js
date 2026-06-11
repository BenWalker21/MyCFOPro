// ── COMPANY HEALTH TRACKER ───────────────────────────────────────────
const HEALTH_STORAGE_KEY = 'mycfopro_health_v1';

const HEALTH_METRICS = [
  { id: 'healthScore', label: 'Health Score', unit: 'score', format: v => Math.round(v) + '/100', goalUnit: 'score', higherBetter: true },
  { id: 'revenue', label: 'Revenue', unit: 'currency', format: v => fc(v), goalUnit: '$', higherBetter: true },
  { id: 'grossMargin', label: 'Gross Margin', unit: 'percent', format: v => fp(v), goalUnit: '%', higherBetter: true },
  { id: 'netMargin', label: 'Net Margin', unit: 'percent', format: v => fp(v), goalUnit: '%', higherBetter: true },
  { id: 'netIncome', label: 'Net Income', unit: 'currency', format: v => fc(v), goalUnit: '$', higherBetter: true },
  { id: 'opMargin', label: 'Operating Margin', unit: 'percent', format: v => fp(v), goalUnit: '%', higherBetter: true }
];

const HEALTH_CHART_METRICS = [
  { id: 'grossMargin', label: 'Gross Margin %', color: '#0f2570', format: v => fp(v) },
  { id: 'netMargin', label: 'Net Margin %', color: '#22c55e', format: v => fp(v) },
  { id: 'revenue', label: 'Revenue', color: '#1a4480', format: v => fc(v), yAxis: 'currency' },
  { id: 'netIncome', label: 'Net Income', color: '#4ade80', format: v => fc(v), yAxis: 'currency' },
  { id: 'healthScore', label: 'Health Score', color: '#0a1628', format: v => Math.round(v) + '/100' }
];

let healthStore = null;
let healthCharts = { score: null, metrics: null };
let healthPeriodMonths = 6;
let healthSelectedChartMetrics = ['grossMargin', 'netMargin', 'netIncome'];

function loadHealthStore() {
  if (typeof loadCompanyStore === 'function') {
    healthStore = loadCompanyStore().health;
    if (!healthStore.goals) healthStore.goals = defaultHealthGoals();
    if (!Array.isArray(healthStore.entries)) healthStore.entries = [];
    return healthStore;
  }
  try {
    const raw = localStorage.getItem(HEALTH_STORAGE_KEY);
    healthStore = raw ? JSON.parse(raw) : createEmptyHealthStore();
  } catch {
    healthStore = createEmptyHealthStore();
  }
  if (!healthStore.goals) healthStore.goals = defaultHealthGoals();
  if (!Array.isArray(healthStore.entries)) healthStore.entries = [];
  return healthStore;
}

function createEmptyHealthStore() {
  return { company: '', goals: defaultHealthGoals(), entries: [] };
}

function defaultHealthGoals() {
  return {
    revenue: null,
    grossMargin: null,
    netMargin: null,
    netIncome: null,
    healthScore: null,
    opMargin: null
  };
}

function saveHealthStore() {
  if (typeof persistHealthSlice === 'function') {
    persistHealthSlice(healthStore);
    return;
  }
  localStorage.setItem(HEALTH_STORAGE_KEY, JSON.stringify(healthStore));
}

function parsePeriodToMonthKey(period) {
  if (!period) return null;
  const text = String(period).trim();
  const iso = text.match(/\b(20\d{2})[-/](\d{1,2})\b/);
  if (iso) return `${iso[1]}-${String(iso[2]).padStart(2, '0')}`;

  const monthNames = ['january','february','march','april','may','june','july','august','september','october','november','december'];
  const shortNames = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  const lower = text.toLowerCase();
  const yearMatch = lower.match(/\b(20\d{2})\b/);
  if (!yearMatch) return null;
  const year = yearMatch[1];
  for (let i = 0; i < monthNames.length; i++) {
    if (lower.includes(monthNames[i]) || new RegExp('\\b' + shortNames[i] + '\\b').test(lower)) {
      return `${year}-${String(i + 1).padStart(2, '0')}`;
    }
  }
  return null;
}

function monthKeyToLabel(monthKey) {
  if (!monthKey) return '';
  const [y, m] = monthKey.split('-').map(Number);
  if (!y || !m) return monthKey;
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function defaultMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function extractHealthSnapshot(data) {
  const type = data.statementType || 'income_statement';
  const healthScore = typeof calcHealthScore === 'function' ? calcHealthScore(data) : calcHealthPL(data);
  const snapshot = {
    statementType: type,
    company: data.company || '',
    period: data.period || '',
    healthScore,
    revenue: data.revenue || 0,
    grossProfit: data.grossProfit || 0,
    grossMargin: data.grossMargin || 0,
    netIncome: data.netIncome || 0,
    netMargin: data.netMargin || 0,
    opMargin: data.opMargin || 0,
    opex: data.opex || 0,
    payroll: data.payroll || 0,
    payrollPct: data.payrollPct || 0,
    cash: data.cash || data.endingCash || null,
    currentRatio: data.currentRatio || null
  };

  if (type === 'balance_sheet') {
    snapshot.totalAssets = data.totalAssets || 0;
    snapshot.workingCapital = data.workingCapital || 0;
  }
  return snapshot;
}

function upsertHealthEntry(monthKey, data, filename) {
  loadHealthStore();
  const snapshot = extractHealthSnapshot(data);
  const label = monthKeyToLabel(monthKey);
  const existingIdx = healthStore.entries.findIndex(e => e.monthKey === monthKey);

  const entry = {
    id: existingIdx >= 0 ? healthStore.entries[existingIdx].id : `h-${Date.now()}`,
    monthKey,
    monthLabel: label,
    company: snapshot.company || healthStore.company || '',
    statementType: snapshot.statementType,
    filename: filename || data.filename || '',
    uploadedAt: new Date().toISOString(),
    metrics: snapshot
  };

  if (entry.company) healthStore.company = entry.company;
  if (existingIdx >= 0) healthStore.entries[existingIdx] = entry;
  else healthStore.entries.push(entry);

  healthStore.entries.sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  saveHealthStore();
  return entry;
}

function deleteHealthEntry(monthKey) {
  loadHealthStore();
  healthStore.entries = healthStore.entries.filter(e => e.monthKey !== monthKey);
  saveHealthStore();
  renderHealthPage();
}

function getSortedEntries(limitMonths) {
  loadHealthStore();
  let entries = [...healthStore.entries].sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  if (limitMonths && limitMonths > 0) entries = entries.slice(-limitMonths);
  return entries;
}

function calcGrowth(current, prior, higherBetter = true) {
  if (prior === null || prior === undefined || current === null || current === undefined) return null;
  if (prior === 0) return current > 0 ? 100 : 0;
  const pct = ((current - prior) / Math.abs(prior)) * 100;
  return pct;
}

function growthClass(pct, higherBetter = true) {
  if (pct === null) return 'neutral';
  const good = higherBetter ? pct >= 0 : pct <= 0;
  if (Math.abs(pct) < 0.5) return 'neutral';
  return good ? 'up' : 'down';
}

function formatGrowth(pct) {
  if (pct === null) return '—';
  const sign = pct > 0 ? '+' : '';
  return sign + pct.toFixed(1) + '%';
}

function goalProgress(current, goal, higherBetter = true) {
  if (goal === null || goal === undefined || goal === '') return null;
  const g = Number(goal);
  if (!g) return null;
  if (higherBetter) return Math.min(100, Math.round((current / g) * 100));
  return Math.min(100, Math.round((g / Math.max(current, 0.01)) * 100));
}

function initHealthPage() {
  loadHealthStore();
  initHealthUploadDropzone();
  renderHealthPage();
}

function initHealthUploadDropzone() {
  const zone = document.getElementById('health-dropzone');
  const input = document.getElementById('health-file');
  if (!zone || !input) return;

  ['dragenter', 'dragover'].forEach(evt => zone.addEventListener(evt, e => {
    e.preventDefault();
    zone.classList.add('dragover');
  }));
  ['dragleave', 'drop'].forEach(evt => zone.addEventListener(evt, e => {
    e.preventDefault();
    zone.classList.remove('dragover');
  }));
  zone.addEventListener('drop', e => {
    if (!e.dataTransfer.files?.length) return;
    input.files = e.dataTransfer.files;
    handleHealthFile({ target: input });
  });

  const monthInput = document.getElementById('health-month');
  if (monthInput && !monthInput.value) monthInput.value = defaultMonthKey();
}

function setHealthStatus(msg, tone) {
  const el = document.getElementById('health-upload-status');
  if (!el) return;
  el.textContent = msg || '';
  el.className = 'health-upload-status' + (tone ? ' ' + tone : '');
}

function handleHealthFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  const monthInput = document.getElementById('health-month');
  const monthKey = monthInput?.value || defaultMonthKey();
  if (!monthKey) {
    alert('Please select the month this report covers.');
    return;
  }

  setHealthStatus('Reading ' + file.name + '…', 'pending');
  const name = file.name.toLowerCase();

  const onRows = rows => {
    try {
      const data = parseFinancialRows(rows, file.name, 'income_statement');
      if (!data.revenue && data.statementType === 'income_statement') {
        setHealthStatus('Could not find revenue in this file. Try an Income Statement export.', 'error');
        return;
      }
      const parsedMonth = parsePeriodToMonthKey(data.period);
      const finalMonth = monthInput?.value || parsedMonth || monthKey;
      upsertHealthEntry(finalMonth, data, file.name);
      if (parsedMonth && monthInput && monthInput.value !== parsedMonth) {
        setHealthStatus(`Saved for ${monthKeyToLabel(finalMonth)} (file period: ${data.period || 'not detected'}).`, 'success');
      } else {
        setHealthStatus(`Saved ${monthKeyToLabel(finalMonth)} successfully.`, 'success');
      }
      renderHealthPage();
      document.getElementById('health-file').value = '';
    } catch (err) {
      console.error(err);
      setHealthStatus('Could not parse this file. Try CSV or Excel from QuickBooks/Xero.', 'error');
    }
  };

  if (name.endsWith('.csv')) {
    const reader = new FileReader();
    reader.onload = ev => onRows(parseCSV(ev.target.result));
    reader.readAsText(file);
  } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const reader = new FileReader();
    reader.onload = ev => {
      const wb = XLSX.read(ev.target.result, { type: 'binary', cellFormula: false, cellNF: false, cellStyles: false });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });
      const rows = raw.map(r => {
        const label = String(r[0] || '').trim();
        let val = '';
        for (let i = 1; i < r.length; i++) {
          const v = r[i];
          if (typeof v === 'number') { val = v; break; }
          if (typeof v === 'string' && v.trim()) {
            const n = parseFloat(v.replace(/[$,]/g, ''));
            if (!isNaN(n)) { val = n; break; }
          }
        }
        return [label, val];
      });
      onRows(rows);
    };
    reader.readAsBinaryString(file);
  } else {
    setHealthStatus('Upload Excel (.xlsx) or CSV for monthly tracking.', 'error');
  }
}

function saveCurrentAnalysisToHealth() {
  if (!currentData) {
    alert('Upload a financial report on the Financial Analysis page first, or upload directly here.');
    return;
  }
  const monthInput = document.getElementById('health-month');
  const monthKey = monthInput?.value || parsePeriodToMonthKey(currentData.period) || defaultMonthKey();
  upsertHealthEntry(monthKey, currentData, currentData.filename || 'Financial Analysis');
  setHealthStatus(`Added ${monthKeyToLabel(monthKey)} from your latest analysis.`, 'success');
  renderHealthPage();
}

function saveAnalysisToHealthFromReport(data) {
  if (!data || data.statementType !== 'income_statement') return;
  const monthKey = parsePeriodToMonthKey(data.period) || defaultMonthKey();
  upsertHealthEntry(monthKey, data, data.filename || 'Financial Analysis');
  showHealthSaveBanner(monthKey);
}

function showHealthSaveBanner(monthKey) {
  const banner = document.getElementById('health-save-banner');
  if (!banner) return;
  banner.style.display = 'flex';
  banner.innerHTML = `
    <span>📈 This month was added to <strong>Company Health</strong> (${monthKeyToLabel(monthKey)}).</span>
    <button class="btn-outline" style="padding:6px 12px;font-size:12px" onclick="goPage('health', document.querySelectorAll('.nav-link')[5])">View trends →</button>
    <button style="background:none;border:none;color:var(--ink-3);cursor:pointer;font-size:18px;line-height:1" onclick="this.closest('#health-save-banner').style.display='none'">×</button>`;
}

function setHealthPeriod(months, btn) {
  healthPeriodMonths = months;
  document.querySelectorAll('#page-health .period-tab').forEach(tab => tab.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderHealthCharts();
  updateHealthPeriodLabel();
}

function updateHealthPeriodLabel() {
  const sub = document.getElementById('health-score-sub');
  if (!sub) return;
  const label = healthPeriodMonths === 0 ? 'All recorded months' : `Last ${healthPeriodMonths} months`;
  sub.textContent = label;
}

function toggleHealthChartMetric(id) {
  const idx = healthSelectedChartMetrics.indexOf(id);
  if (idx >= 0) {
    if (healthSelectedChartMetrics.length <= 1) return;
    healthSelectedChartMetrics.splice(idx, 1);
  } else if (healthSelectedChartMetrics.length < 3) {
    healthSelectedChartMetrics.push(id);
  } else {
    healthSelectedChartMetrics.shift();
    healthSelectedChartMetrics.push(id);
  }
  document.querySelectorAll('.health-metric-chip').forEach(chip => {
    chip.classList.toggle('active', healthSelectedChartMetrics.includes(chip.dataset.metric));
  });
  renderHealthCharts();
}

function saveHealthGoals() {
  loadHealthStore();
  HEALTH_METRICS.forEach(m => {
    const input = document.getElementById('goal-' + m.id);
    if (!input) return;
    const val = input.value.trim();
    healthStore.goals[m.id] = val === '' ? null : Number(val);
  });
  saveHealthStore();
  renderHealthGoals();
  renderHealthSummaryCards();
  const status = document.getElementById('health-goals-status');
  if (status) {
    status.textContent = 'Goals saved.';
    window.setTimeout(() => { status.textContent = ''; }, 2000);
  }
}

function renderHealthPage() {
  loadHealthStore();
  const hasData = healthStore.entries.length > 0;
  const empty = document.getElementById('health-empty-hint');
  const content = document.getElementById('health-data-content');
  if (empty) empty.style.display = hasData ? 'none' : 'block';
  if (content) content.style.display = hasData ? 'block' : 'none';

  const badge = document.getElementById('health-status-badge');
  if (badge) {
    if (!hasData) {
      badge.textContent = 'Upload your first month to start tracking';
      badge.className = 'health-status-badge pending';
    } else {
      const latest = healthStore.entries[healthStore.entries.length - 1];
      badge.textContent = `${healthStore.entries.length} month${healthStore.entries.length === 1 ? '' : 's'} tracked · Latest: ${latest.monthLabel}`;
      badge.className = 'health-status-badge active';
    }
  }

  renderHealthSummaryCards();
  renderHealthGoals();
  renderHealthCharts();
  renderHealthHistory();
  updateHealthPeriodLabel();
}

function renderHealthSummaryCards() {
  const grid = document.getElementById('health-summary-grid');
  if (!grid) return;
  const entries = getSortedEntries();
  if (!entries.length) {
    grid.innerHTML = '';
    return;
  }

  const latest = entries[entries.length - 1];
  const prior = entries.length > 1 ? entries[entries.length - 2] : null;

  grid.innerHTML = HEALTH_METRICS.map(m => {
    const cur = latest.metrics[m.id];
    const prev = prior ? prior.metrics[m.id] : null;
    const growth = prior ? calcGrowth(cur, prev, m.higherBetter) : null;
    const gClass = growthClass(growth, m.higherBetter);
    const goal = healthStore.goals[m.id];
    const progress = goalProgress(cur, goal, m.higherBetter);

    return `<div class="health-kpi-card">
      <div class="health-kpi-label">${m.label}</div>
      <div class="health-kpi-value">${m.format(cur ?? 0)}</div>
      <div class="health-kpi-meta">
        ${growth !== null ? `<span class="health-kpi-change ${gClass}">${formatGrowth(growth)} vs prior month</span>` : '<span class="health-kpi-change neutral">First month recorded</span>'}
        ${progress !== null ? `<span class="health-kpi-goal">${progress}% of goal</span>` : ''}
      </div>
    </div>`;
  }).join('');
}

function renderHealthGoals() {
  const panel = document.getElementById('health-goals-grid');
  if (!panel) return;
  panel.innerHTML = HEALTH_METRICS.map(m => {
    const val = healthStore.goals[m.id];
    const placeholder = m.unit === 'percent' ? 'e.g. 38' : m.unit === 'score' ? 'e.g. 75' : 'e.g. 50000';
    return `<label class="health-goal-field">
      <span class="health-goal-label">${m.label} target</span>
      <div class="health-goal-input-wrap">
        ${m.goalUnit === '$' ? '<span class="health-goal-prefix">$</span>' : ''}
        <input type="number" id="goal-${m.id}" value="${val ?? ''}" placeholder="${placeholder}" step="any">
        ${m.goalUnit === '%' || m.goalUnit === 'score' ? `<span class="health-goal-suffix">${m.goalUnit === 'score' ? '/100' : '%'}</span>` : ''}
      </div>
    </label>`;
  }).join('');
}

function renderHealthCharts() {
  const entries = getSortedEntries(healthPeriodMonths || undefined);
  const scoreCanvas = document.getElementById('health-chart');
  const metricsCanvas = document.getElementById('metrics-chart');
  if (!scoreCanvas || !metricsCanvas) return;

  if (healthCharts.score) { healthCharts.score.destroy(); healthCharts.score = null; }
  if (healthCharts.metrics) { healthCharts.metrics.destroy(); healthCharts.metrics = null; }

  if (!entries.length) return;

  const labels = entries.map(e => e.monthLabel);
  const latestScore = entries[entries.length - 1].metrics.healthScore;
  const goalScore = healthStore.goals.healthScore;

  healthCharts.score = new Chart(scoreCanvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Health Score',
          data: entries.map(e => e.metrics.healthScore),
          borderColor: '#0f2570',
          backgroundColor: 'rgba(15,37,112,0.08)',
          tension: 0.35,
          fill: true,
          pointBackgroundColor: '#0f2570',
          pointRadius: 5,
          pointHoverRadius: 7
        },
        {
          label: 'Benchmark',
          data: labels.map(() => 65),
          borderColor: '#22c55e',
          borderDash: [6, 4],
          tension: 0,
          fill: false,
          pointRadius: 0
        },
        ...(goalScore ? [{
          label: 'Your goal',
          data: labels.map(() => goalScore),
          borderColor: '#b45309',
          borderDash: [3, 3],
          tension: 0,
          fill: false,
          pointRadius: 0
        }] : [])
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { font: { size: 12 } } } },
      scales: { y: { min: Math.max(0, Math.min(...entries.map(e => e.metrics.healthScore)) - 15), max: 100, ticks: { callback: v => v + '/100' } } }
    }
  });

  const metricDefs = HEALTH_CHART_METRICS.filter(m => healthSelectedChartMetrics.includes(m.id));
  const hasCurrency = metricDefs.some(m => m.yAxis === 'currency');

  healthCharts.metrics = new Chart(metricsCanvas, {
    type: 'line',
    data: {
      labels,
      datasets: metricDefs.map(m => ({
        label: m.label,
        data: entries.map(e => e.metrics[m.id]),
        borderColor: m.color,
        tension: 0.35,
        fill: false,
        pointRadius: 4,
        yAxisID: m.yAxis === 'currency' ? 'y1' : 'y'
      }))
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { font: { size: 12 } } } },
      scales: {
        y: {
          position: 'left',
          ticks: {
            callback: v => (typeof v === 'number' && Math.abs(v) >= 1000) ? '$' + (v / 1000).toFixed(0) + 'K' : v + (metricDefs.some(m => m.id.includes('Margin') || m.id === 'healthScore') ? '' : '')
          }
        },
        ...(hasCurrency ? {
          y1: {
            position: 'right',
            grid: { drawOnChartArea: false },
            ticks: { callback: v => '$' + Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 }) }
          }
        } : {})
      }
    }
  });

  document.querySelectorAll('.health-metric-chip').forEach(chip => {
    chip.classList.toggle('active', healthSelectedChartMetrics.includes(chip.dataset.metric));
  });
}

function renderHealthHistory() {
  const tbody = document.getElementById('health-history-body');
  if (!tbody) return;
  const entries = [...healthStore.entries].sort((a, b) => b.monthKey.localeCompare(a.monthKey));

  if (!entries.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="health-history-empty">No months uploaded yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = entries.map(e => {
    const m = e.metrics;
    return `<tr>
      <td><strong>${escapeHtml(e.monthLabel)}</strong></td>
      <td>${Math.round(m.healthScore)}/100</td>
      <td>${fc(m.revenue)}</td>
      <td>${fp(m.grossMargin)}</td>
      <td>${fp(m.netMargin)}</td>
      <td>${fc(m.netIncome)}</td>
      <td class="health-history-file">${escapeHtml(e.filename || '—')}</td>
      <td><button class="health-history-delete" onclick="deleteHealthEntry('${e.monthKey}')" title="Remove">×</button></td>
    </tr>`;
  }).join('');
}

function clearHealthData() {
  if (!confirm('Remove all stored Company Health data? This cannot be undone.')) return;
  if (typeof clearCompanyMemory === 'function') {
    clearCompanyMemory();
    return;
  }
  healthStore = createEmptyHealthStore();
  saveHealthStore();
  renderHealthPage();
  setHealthStatus('All health history cleared.', 'success');
}
