// ── P&L DASHBOARD CONFIG ─────────────────────────────────────────────
let dashboardConfigState = null;

const DASHBOARD_PRESETS = [
  { id: 'owner', name: 'Owner overview', desc: 'Full picture — metrics, charts, and narrative' },
  { id: 'profit', name: 'Profit focus', desc: 'Margins, net income, and benchmark comparisons' },
  { id: 'cost', name: 'Cost control', desc: 'Operating expenses and where money is going' },
  { id: 'board', name: 'Board ready', desc: 'Clean scorecard for lenders or advisors' },
  { id: 'minimal', name: 'Minimal', desc: 'Just the essentials — quick read' }
];

const DASHBOARD_METRIC_CATALOG = [
  { id: 'revenue', name: 'Revenue', desc: 'Total income for the period' },
  { id: 'grossProfit', name: 'Gross profit', desc: 'Revenue minus direct costs' },
  { id: 'grossMargin', name: 'Gross margin', desc: 'Profit after COGS as % of revenue' },
  { id: 'netIncome', name: 'Net income', desc: 'Bottom-line profit' },
  { id: 'netMargin', name: 'Net margin', desc: 'Profit kept as % of revenue' },
  { id: 'opIncome', name: 'Operating income', desc: 'Profit before interest and other' },
  { id: 'opex', name: 'Total OpEx', desc: 'Operating expense total' },
  { id: 'healthScore', name: 'Health score', desc: 'Overall financial health rating' }
];

const DASHBOARD_CHART_CATALOG = [
  { id: 'revenueLines', name: 'Revenue by service line', desc: 'Where income comes from' },
  { id: 'waterfall', name: 'Profit waterfall', desc: 'Revenue through to net income' },
  { id: 'opexBreakdown', name: 'Expense breakdown', desc: 'Operating cost distribution' },
  { id: 'marginBenchmark', name: 'Margin vs benchmark', desc: 'Your margins vs industry norms' }
];

const DASHBOARD_SECTION_CATALOG = [
  { id: 'findings', name: 'Key findings', desc: 'Strengths, risks, and watch items' },
  { id: 'actions', name: 'Action plan', desc: 'Prioritized recommendations' },
  { id: 'summary', name: 'CFO summary', desc: 'Executive narrative overview' }
];

const PRESET_CONFIGS = {
  owner: {
    metrics: ['revenue', 'grossProfit', 'grossMargin', 'netIncome', 'netMargin', 'opIncome', 'opex', 'healthScore'],
    charts: ['revenueLines', 'waterfall', 'opexBreakdown', 'marginBenchmark'],
    sections: ['findings', 'actions', 'summary']
  },
  profit: {
    metrics: ['revenue', 'grossProfit', 'grossMargin', 'netIncome', 'netMargin', 'healthScore'],
    charts: ['waterfall', 'marginBenchmark'],
    sections: ['findings', 'summary']
  },
  cost: {
    metrics: ['revenue', 'opex', 'opIncome', 'netIncome', 'healthScore'],
    charts: ['opexBreakdown', 'waterfall'],
    sections: ['findings', 'actions']
  },
  board: {
    metrics: ['revenue', 'grossMargin', 'netMargin', 'netIncome', 'healthScore'],
    charts: ['revenueLines', 'marginBenchmark'],
    sections: ['findings', 'actions', 'summary']
  },
  minimal: {
    metrics: ['revenue', 'netIncome', 'healthScore'],
    charts: ['waterfall'],
    sections: ['summary']
  }
};

function listToToggleMap(ids, catalog) {
  const map = {};
  catalog.forEach(item => { map[item.id] = ids.includes(item.id); });
  return map;
}

function getDefaultDashboardConfig() {
  const preset = PRESET_CONFIGS.owner;
  return {
    preset: 'owner',
    metrics: listToToggleMap(preset.metrics, DASHBOARD_METRIC_CATALOG),
    charts: listToToggleMap(preset.charts, DASHBOARD_CHART_CATALOG),
    sections: listToToggleMap(preset.sections, DASHBOARD_SECTION_CATALOG)
  };
}

function configFromPreset(presetId) {
  const preset = PRESET_CONFIGS[presetId] || PRESET_CONFIGS.owner;
  return {
    preset: PRESET_CONFIGS[presetId] ? presetId : 'owner',
    metrics: listToToggleMap(preset.metrics, DASHBOARD_METRIC_CATALOG),
    charts: listToToggleMap(preset.charts, DASHBOARD_CHART_CATALOG),
    sections: listToToggleMap(preset.sections, DASHBOARD_SECTION_CATALOG)
  };
}

function normalizeDashboardConfig(raw) {
  const base = getDefaultDashboardConfig();
  if (!raw || typeof raw !== 'object') return base;

  const preset = typeof raw.preset === 'string' && PRESET_CONFIGS[raw.preset] ? raw.preset : 'custom';
  const merged = preset !== 'custom' ? configFromPreset(preset) : { ...base, preset: 'custom' };

  ['metrics', 'charts', 'sections'].forEach(key => {
    if (raw[key] && typeof raw[key] === 'object') {
      Object.keys(merged[key]).forEach(id => {
        if (typeof raw[key][id] === 'boolean') merged[key][id] = raw[key][id];
      });
    }
  });

  if (preset === 'custom') merged.preset = 'custom';
  return merged;
}

function loadDashboardConfigFromStore() {
  if (typeof loadCompanyStore === 'function') {
    loadCompanyStore();
    if (companyStore.dashboardConfig) {
      dashboardConfigState = normalizeDashboardConfig(companyStore.dashboardConfig);
      return dashboardConfigState;
    }
    if (companyStore.dashboardPref && PRESET_CONFIGS[companyStore.dashboardPref]) {
      dashboardConfigState = configFromPreset(companyStore.dashboardPref);
      companyStore.dashboardConfig = dashboardConfigState;
      if (typeof saveCompanyStore === 'function') saveCompanyStore();
      return dashboardConfigState;
    }
  }
  if (!dashboardConfigState) dashboardConfigState = getDefaultDashboardConfig();
  return dashboardConfigState;
}

function saveDashboardConfigToStore() {
  if (typeof loadCompanyStore !== 'function' || !dashboardConfigState) return;
  loadCompanyStore();
  companyStore.dashboardConfig = {
    preset: dashboardConfigState.preset,
    metrics: { ...dashboardConfigState.metrics },
    charts: { ...dashboardConfigState.charts },
    sections: { ...dashboardConfigState.sections }
  };
  companyStore.dashboardPref = dashboardConfigState.preset === 'custom' ? 'owner' : dashboardConfigState.preset;
  saveCompanyStore();
}

function getActiveDashboardConfig() {
  return loadDashboardConfigFromStore();
}

function isDashboardMetricEnabled(id) {
  const cfg = getActiveDashboardConfig();
  return cfg.metrics[id] !== false;
}

function isDashboardChartEnabled(id) {
  const cfg = getActiveDashboardConfig();
  return cfg.charts[id] !== false;
}

function isDashboardSectionEnabled(id) {
  const cfg = getActiveDashboardConfig();
  return cfg.sections[id] !== false;
}

function applyDashboardPreset(presetId) {
  if (!PRESET_CONFIGS[presetId]) return;
  dashboardConfigState = configFromPreset(presetId);
  saveDashboardConfigToStore();
  renderDashboardCustomizePanel();
  if (typeof currentData !== 'undefined' && currentData) applyDashboardToReport();
}

function toggleDashboardItem(group, id, enabled) {
  if (!dashboardConfigState) loadDashboardConfigFromStore();
  if (!dashboardConfigState[group] || dashboardConfigState[group][id] === undefined) return;
  dashboardConfigState[group][id] = enabled;
  dashboardConfigState.preset = 'custom';
  saveDashboardConfigToStore();
  syncDashboardOptionStyles();
  updateDashboardPresetButtons();
}

function syncDashboardOptionStyles() {
  document.querySelectorAll('.dashboard-option').forEach(el => {
    const input = el.querySelector('input');
    el.classList.toggle('selected', input && input.checked);
  });
}

function updateDashboardPresetButtons() {
  const cfg = getActiveDashboardConfig();
  document.querySelectorAll('[data-dashboard-preset]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.dashboardPreset === cfg.preset);
  });
}

function renderDashboardCustomizePanel() {
  const wrap = document.getElementById('dashboard-customize');
  if (!wrap) return;
  loadDashboardConfigFromStore();
  const cfg = dashboardConfigState;

  const presetBtns = DASHBOARD_PRESETS.map(p => `
    <button type="button" class="dashboard-preset-btn ${cfg.preset === p.id ? 'active' : ''}" data-dashboard-preset="${p.id}" onclick="applyDashboardPreset('${p.id}')">
      <span class="dashboard-preset-name">${p.name}</span>
      <span class="dashboard-preset-desc">${p.desc}</span>
    </button>`).join('');

  const metricOpts = DASHBOARD_METRIC_CATALOG.map(item => {
    const checked = cfg.metrics[item.id] !== false;
    return `<label class="dashboard-option ${checked ? 'selected' : ''}" data-dashboard-group="metrics">
      <input type="checkbox" ${checked ? 'checked' : ''} onchange="toggleDashboardItem('metrics','${item.id}',this.checked)">
      <span><span class="dashboard-option-name">${item.name}</span><span class="dashboard-option-desc">${item.desc}</span></span>
    </label>`;
  }).join('');

  const chartOpts = DASHBOARD_CHART_CATALOG.map(item => {
    const checked = cfg.charts[item.id] !== false;
    return `<label class="dashboard-option ${checked ? 'selected' : ''}" data-dashboard-group="charts">
      <input type="checkbox" ${checked ? 'checked' : ''} onchange="toggleDashboardItem('charts','${item.id}',this.checked)">
      <span><span class="dashboard-option-name">${item.name}</span><span class="dashboard-option-desc">${item.desc}</span></span>
    </label>`;
  }).join('');

  const sectionOpts = DASHBOARD_SECTION_CATALOG.map(item => {
    const checked = cfg.sections[item.id] !== false;
    return `<label class="dashboard-option ${checked ? 'selected' : ''}" data-dashboard-group="sections">
      <input type="checkbox" ${checked ? 'checked' : ''} onchange="toggleDashboardItem('sections','${item.id}',this.checked)">
      <span><span class="dashboard-option-name">${item.name}</span><span class="dashboard-option-desc">${item.desc}</span></span>
    </label>`;
  }).join('');

  wrap.innerHTML = `
    <div class="dashboard-customize-head">
      <div>
        <div class="dashboard-customize-title">Customize your P&amp;L dashboard</div>
        <div class="dashboard-customize-sub">Pick a starting layout or choose exactly what each business sees — saved to your account.</div>
      </div>
      <div class="dashboard-customize-actions">
        <button type="button" class="btn-outline dashboard-toggle-btn" onclick="toggleDashboardCustomizePanel()" style="font-size:12px;padding:8px 14px">${wrap.dataset.open === '1' ? 'Hide options' : 'Show options'}</button>
        <button type="button" class="btn-blue" onclick="applyDashboardToReport()" style="font-size:12px;padding:8px 14px" id="dashboard-apply-btn">Update dashboard</button>
      </div>
    </div>
    <div class="dashboard-customize-body" id="dashboard-customize-body" style="display:${wrap.dataset.open === '1' ? 'block' : 'none'}">
      <div class="dashboard-preset-row">${presetBtns}</div>
      <div class="dashboard-group-label">Metric cards</div>
      <div class="dashboard-option-grid">${metricOpts}</div>
      <div class="dashboard-group-label">Charts</div>
      <div class="dashboard-option-grid">${chartOpts}</div>
      <div class="dashboard-group-label">Report sections</div>
      <div class="dashboard-option-grid">${sectionOpts}</div>
      <div class="dashboard-customize-foot" id="dashboard-customize-status"></div>
    </div>`;

  const applyBtn = document.getElementById('dashboard-apply-btn');
  if (applyBtn) applyBtn.style.display = currentData ? 'inline-flex' : 'none';
}

function toggleDashboardCustomizePanel(forceOpen) {
  const wrap = document.getElementById('dashboard-customize');
  if (!wrap) return;
  const open = forceOpen === true ? true : forceOpen === false ? false : wrap.dataset.open !== '1';
  wrap.dataset.open = open ? '1' : '0';
  const body = document.getElementById('dashboard-customize-body');
  if (body) body.style.display = open ? 'block' : 'none';
  const toggleBtn = wrap.querySelector('.dashboard-toggle-btn');
  if (toggleBtn) toggleBtn.textContent = open ? 'Hide options' : 'Show options';
  if (open) wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function applyDashboardToReport() {
  if (typeof currentData !== 'undefined' && currentData) {
    renderReport(currentData);
    if (window.latestAIReport && typeof applyAIReport === 'function') {
      applyAIReport(window.latestAIReport, null, null);
    }
    const status = document.getElementById('dashboard-customize-status');
    if (status) {
      status.textContent = 'Dashboard updated with your selections.';
      window.setTimeout(() => { status.textContent = ''; }, 2500);
    }
    return;
  }
  if (typeof showToast === 'function') {
    showToast('Upload a P&L first — your layout is saved and will apply to the next report.');
  }
}

function applyDashboardVisibility(d) {
  const type = d?.statementType || 'income_statement';
  if (type !== 'income_statement') return;

  const cfg = getActiveDashboardConfig();
  const metricsEl = document.getElementById('rpt-metrics');
  if (metricsEl) metricsEl.style.display = Object.values(cfg.metrics).some(Boolean) ? '' : 'none';

  const chartMap = {
    revenueLines: 'rpt-chart-area-revenue',
    waterfall: 'rpt-chart-area-waterfall',
    opexBreakdown: 'rpt-chart-area-opex',
    marginBenchmark: 'rpt-chart-area-benchmark'
  };
  Object.entries(chartMap).forEach(([id, elId]) => {
    const el = document.getElementById(elId);
    if (el) el.style.display = cfg.charts[id] !== false ? '' : 'none';
  });

  const chartsGrid = document.querySelector('.rpt-charts-grid');
  if (chartsGrid) {
    const anyChart = Object.values(cfg.charts).some(Boolean);
    chartsGrid.style.display = anyChart ? '' : 'none';
  }

  const sectionMap = {
    findings: 'rpt-section-findings',
    actions: 'rpt-section-actions',
    summary: 'rpt-summary-box'
  };
  Object.entries(sectionMap).forEach(([id, elId]) => {
    const el = document.getElementById(elId);
    if (el) el.style.display = cfg.sections[id] !== false ? '' : 'none';
  });
}

function filterPLMetrics(metrics) {
  return metrics.filter(m => !m.id || isDashboardMetricEnabled(m.id));
}
