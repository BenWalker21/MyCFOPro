// ── UNIFIED COMPANY STORE (connected flow memory) ────────────────────
const COMPANY_STORE_KEY = 'mycfopro_company_v1';
const LEGACY_HEALTH_KEY = 'mycfopro_health_v1';

let companyStore = null;

function createEmptyCompanyStore() {
  return {
    version: 1,
    company: '',
    lastUpdated: null,
    latest: null,
    reportsByType: {},
    dashboardPref: 'owner',
    history: [],
    health: {
      company: '',
      goals: defaultHealthGoalsStore(),
      entries: [],
      trackedKpiIds: [],
      kpiSnapshots: {}
    },
    deck: { optionsState: {} }
  };
}

function defaultHealthGoalsStore() {
  return {
    revenue: null,
    grossMargin: null,
    netMargin: null,
    netIncome: null,
    healthScore: null,
    opMargin: null
  };
}

function loadCompanyStore() {
  if (companyStore) return companyStore;
  try {
    const raw = localStorage.getItem(COMPANY_STORE_KEY);
    companyStore = raw ? JSON.parse(raw) : createEmptyCompanyStore();
  } catch {
    companyStore = createEmptyCompanyStore();
  }
  normalizeCompanyStore();
  migrateLegacyHealthIntoStore();
  return companyStore;
}

function normalizeCompanyStore() {
  if (!companyStore.health) companyStore.health = { company: '', goals: defaultHealthGoalsStore(), entries: [] };
  if (!companyStore.health.goals) companyStore.health.goals = defaultHealthGoalsStore();
  if (!Array.isArray(companyStore.health.entries)) companyStore.health.entries = [];
  if (!Array.isArray(companyStore.health.trackedKpiIds)) companyStore.health.trackedKpiIds = [];
  if (!companyStore.health.kpiSnapshots) companyStore.health.kpiSnapshots = {};
  if (!Array.isArray(companyStore.history)) companyStore.history = [];
  if (!companyStore.deck) companyStore.deck = { optionsState: {} };
  if (!companyStore.reportsByType) companyStore.reportsByType = {};
  if (companyStore.latest?.financials) {
    const legacyType = companyStore.latest.statementType || companyStore.latest.financials.statementType || 'income_statement';
    if (!companyStore.reportsByType[legacyType]) {
      companyStore.reportsByType[legacyType] = { ...companyStore.latest };
    }
  }
}

function getSavedReportForType(statementType) {
  loadCompanyStore();
  const type = statementType || 'income_statement';
  return companyStore.reportsByType?.[type] || null;
}

function saveReportForType(financials, aiReport) {
  loadCompanyStore();
  const d = trimFinancialsForStore(financials);
  if (!d) return null;
  const type = d.statementType || 'income_statement';
  const monthKey = parsePeriodToMonthKey(d.period) || defaultMonthKey();
  const entry = {
    financials: d,
    aiReport: aiReport ? trimAIReportForStore(aiReport) : (companyStore.reportsByType?.[type]?.aiReport || null),
    statementType: type,
    monthKey,
    monthLabel: monthKeyToLabel(monthKey),
    filename: d.filename || '',
    uploadedAt: new Date().toISOString()
  };
  companyStore.reportsByType[type] = entry;
  companyStore.latest = entry;
  return entry;
}

function migrateLegacyHealthIntoStore() {
  if (companyStore.health.entries.length) return;
  try {
    const legacy = localStorage.getItem(LEGACY_HEALTH_KEY);
    if (!legacy) return;
    const old = JSON.parse(legacy);
    if (old.entries?.length) companyStore.health.entries = old.entries;
    if (old.goals) companyStore.health.goals = old.goals;
    if (old.company) companyStore.company = old.company;
    saveCompanyStore();
  } catch { /* ignore */ }
}

function saveCompanyStore() {
  companyStore.lastUpdated = new Date().toISOString();
  localStorage.setItem(COMPANY_STORE_KEY, JSON.stringify(companyStore));
  if (typeof pushCompanyToCloud === 'function') pushCompanyToCloud(false);
}

function persistHealthSlice(healthData) {
  loadCompanyStore();
  companyStore.health = healthData;
  if (healthData.company) companyStore.company = healthData.company;
  saveCompanyStore();
}

function trimFinancialsForStore(d) {
  if (!d) return null;
  const keys = [
    'filename', 'company', 'period', 'statementType', 'revenue', 'cogs', 'grossProfit',
    'opex', 'opIncome', 'netIncome', 'grossMargin', 'netMargin', 'opMargin',
    'payroll', 'payrollPct', 'rent', 'marketing', 'interestExpense', 'hasBalanceSheet',
    'totalAssets', 'totalLiabilities', 'totalEquity', 'currentAssets', 'currentLiabilities',
    'cash', 'accountsReceivable', 'accountsPayable', 'workingCapital', 'currentRatio',
    'operatingCashFlow', 'investingCashFlow', 'financingCashFlow', 'netCashChange', 'endingCash',
    'totalBalance', 'overdueBalance', 'overduePct'
  ];
  const out = {};
  keys.forEach(k => { if (d[k] !== undefined) out[k] = d[k]; });
  ['serviceRevenue', 'serviceCogs', 'expenseItems', 'assetItems', 'liabilityItems', 'topCounterparties'].forEach(k => {
    if (Array.isArray(d[k])) out[k] = d[k].slice(0, 15);
  });
  if (d.agingBuckets) out.agingBuckets = d.agingBuckets;
  return out;
}

function trimAIReportForStore(report) {
  if (!report) return null;
  return {
    summary: report.summary || '',
    findings: (report.findings || []).slice(0, 8),
    actions: (report.actions || []).slice(0, 8),
    questions: (report.questions || []).slice(0, 5)
  };
}

function getHealthScoreForData(d) {
  if (!d) return 0;
  return typeof calcHealthScore === 'function' ? calcHealthScore(d) : calcHealthPL(d);
}

function buildHistorySnapshot(d) {
  const monthKey = parsePeriodToMonthKey(d.period) || defaultMonthKey();
  return {
    id: 'snap-' + monthKey + '-' + Date.now(),
    monthKey,
    monthLabel: monthKeyToLabel(monthKey),
    statementType: d.statementType || 'income_statement',
    company: d.company || '',
    filename: d.filename || '',
    uploadedAt: new Date().toISOString(),
    healthScore: getHealthScoreForData(d),
    revenue: d.revenue || 0,
    grossMargin: d.grossMargin || 0,
    netMargin: d.netMargin || 0,
    netIncome: d.netIncome || 0
  };
}

function recordCompanyUpload(financials, aiReport) {
  loadCompanyStore();
  const d = trimFinancialsForStore(financials);
  if (!d) return;

  const monthKey = parsePeriodToMonthKey(d.period) || defaultMonthKey();
  if (d.company) companyStore.company = d.company;

  saveReportForType(financials, aiReport);

  const snap = buildHistorySnapshot(d);
  companyStore.history = companyStore.history.filter(h => !(h.monthKey === snap.monthKey && h.statementType === snap.statementType));
  companyStore.history.push(snap);
  companyStore.history.sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  if (companyStore.history.length > 48) companyStore.history = companyStore.history.slice(-48);

  saveCompanyStore();
  syncGlobalsFromStore();
  runConnectedPipeline(d, companyStore.reportsByType[d.statementType || 'income_statement']?.aiReport || null);
}

function updateCompanyAIReport(report) {
  loadCompanyStore();
  const type = companyStore.latest?.statementType || companyStore.latest?.financials?.statementType || 'income_statement';
  if (!companyStore.reportsByType?.[type]) return;
  companyStore.reportsByType[type].aiReport = trimAIReportForStore(report);
  companyStore.latest = companyStore.reportsByType[type];
  companyStore.lastUpdated = new Date().toISOString();
  saveCompanyStore();
  syncGlobalsFromStore();
  if (companyStore.reportsByType[type].financials) {
    runConnectedPipeline(companyStore.reportsByType[type].financials, companyStore.reportsByType[type].aiReport);
  }
}

function syncGlobalsFromStore() {
  loadCompanyStore();
  const activeType = typeof getStatementType === 'function' ? getStatementType() : 'income_statement';
  const saved = getSavedReportForType(activeType) || companyStore.latest;
  if (saved?.financials) {
    currentData = { ...saved.financials };
    window.latestAIReport = saved.aiReport || null;
  }
}

function runConnectedPipeline(d, aiReport) {
  if (!d) return;

  syncClaraWithFullContext(d, aiReport);

  if ((d.statementType || 'income_statement') === 'income_statement') {
    if (typeof upsertHealthEntry === 'function') {
      const monthKey = parsePeriodToMonthKey(d.period) || defaultMonthKey();
      upsertHealthEntry(monthKey, d, d.filename || 'Financial Analysis');
    }
    if (typeof buildDeck === 'function') buildDeck(d);
  }

  if (typeof renderHealthPage === 'function') renderHealthPage();
  if (typeof renderConnectedFlowPanel === 'function') renderConnectedFlowPanel();
  if (typeof updateNavCompanyBadge === 'function') updateNavCompanyBadge();
  if (typeof updateHeroFromStore === 'function') updateHeroFromStore();
}

function syncClaraWithFullContext(d, aiReport) {
  if (typeof syncClaraWithData === 'function') syncClaraWithData(d);

  loadCompanyStore();
  const entries = [...(companyStore.health.entries || [])].sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  const prior = entries.length > 1 ? entries[entries.length - 2] : null;
  const latest = entries.length ? entries[entries.length - 1] : null;
  const topAction = aiReport?.actions?.[0]?.title || (typeof buildReportActions === 'function' ? buildReportActions(d)[0]?.title : '');

  let memory = `\nCompany memory (${companyStore.company || d.company || 'this business'}):\n`;
  memory += `- Months tracked: ${entries.length}\n`;
  if (latest) memory += `- Latest period on file: ${latest.monthLabel} (health ${Math.round(latest.metrics?.healthScore || getHealthScoreForData(d))}/100)\n`;
  if (prior && latest) {
    const hs = (latest.metrics?.healthScore || 0) - (prior.metrics?.healthScore || 0);
    const rev = prior.metrics?.revenue ? ((latest.metrics?.revenue - prior.metrics.revenue) / Math.abs(prior.metrics.revenue) * 100) : null;
    if (hs) memory += `- Health score change vs prior month: ${hs > 0 ? '+' : ''}${hs.toFixed(0)} pts\n`;
    if (rev !== null) memory += `- Revenue change vs prior month: ${rev > 0 ? '+' : ''}${rev.toFixed(1)}%\n`;
  }
  if (topAction) memory += `- Current top priority action: ${topAction}\n`;
  if (aiReport?.summary) memory += `- Latest CFO summary: ${aiReport.summary.slice(0, 400)}\n`;

  window.claraContext = (window.claraContext || '') + memory;
}

function getConnectedFlowSummary() {
  loadCompanyStore();
  const latest = companyStore.latest;
  if (!latest?.financials) return null;

  const d = latest.financials;
  const entries = [...(companyStore.health.entries || [])].sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  const curEntry = entries.find(e => e.monthKey === latest.monthKey) || entries[entries.length - 1];
  const priorEntry = entries.length > 1 ? entries[entries.length - 2] : null;
  const h = getHealthScoreForData(d);
  const healthDelta = curEntry && priorEntry ? Math.round((curEntry.metrics?.healthScore || h) - (priorEntry.metrics?.healthScore || 0)) : null;

  const slideCount = typeof deckSlideItems !== 'undefined' && deckSlideItems.length
    ? deckSlideItems.length
    : 9;

  return {
    company: companyStore.company || d.company || 'Your business',
    monthLabel: latest.monthLabel,
    monthKey: latest.monthKey,
    statementType: latest.statementType,
    healthScore: h,
    healthDelta,
    monthsTracked: entries.length,
    slideCount,
    topAction: latest.aiReport?.actions?.[0]?.title || (typeof buildReportActions === 'function' ? buildReportActions(d)[0]?.title : ''),
    revenue: d.revenue,
    grossMargin: d.grossMargin,
    netIncome: d.netIncome,
    hasAI: !!latest.aiReport?.summary
  };
}

function buildConnectedNarrative(summary) {
  if (!summary) return '';
  const parts = [];
  parts.push(`${summary.company} · ${summary.monthLabel} is saved across your CFO workspace.`);

  if (summary.healthDelta !== null && summary.monthsTracked > 1) {
    if (summary.healthDelta > 0) parts.push(`Health score improved ${summary.healthDelta} points since last month.`);
    else if (summary.healthDelta < 0) parts.push(`Health score dipped ${Math.abs(summary.healthDelta)} points — worth a closer look.`);
    else parts.push('Health score held steady vs last month.');
  } else if (summary.monthsTracked === 1) {
    parts.push('First month recorded — upload again next month to unlock trend comparisons.');
  }

  if (summary.statementType === 'income_statement') {
    parts.push(`Your CEO deck has ${summary.slideCount} slides ready, and Clara knows these numbers.`);
  }

  if (summary.topAction) parts.push(`Top priority: ${summary.topAction}`);

  return parts.join(' ');
}

function renderConnectedFlowPanel() {
  const panel = document.getElementById('connected-flow-panel');
  if (!panel) return;

  const summary = getConnectedFlowSummary();
  if (!summary) {
    panel.style.display = 'none';
    return;
  }

  panel.style.display = 'block';
  const deltaHtml = summary.healthDelta === null
    ? '<span class="cf-card-note">First month</span>'
    : `<span class="cf-card-delta ${summary.healthDelta >= 0 ? 'up' : 'down'}">${summary.healthDelta >= 0 ? '+' : ''}${summary.healthDelta} pts</span>`;

  panel.innerHTML = `
    <div class="cf-head">
      <div>
        <div class="cf-eyebrow">Connected CFO workspace</div>
        <div class="cf-title">Everything remembered for ${escapeHtml(summary.company)}</div>
        <div class="cf-sub">${escapeHtml(buildConnectedNarrative(summary))}</div>
      </div>
      <div class="cf-sync-badge">${typeof isSignedIn === 'function' && isSignedIn() ? '● Cloud synced' : '● Saved on this device'}</div>
    </div>
    <div class="cf-grid">
      <div class="cf-card">
        <div class="cf-card-label">Analysis report</div>
        <div class="cf-card-value">${escapeHtml(summary.monthLabel)}</div>
        <div class="cf-card-note">${summary.hasAI ? 'AI CFO report saved' : 'Local report saved'}</div>
      </div>
      <div class="cf-card">
        <div class="cf-card-label">Company Health</div>
        <div class="cf-card-value">${summary.healthScore}/100</div>
        ${deltaHtml}
        <div class="cf-card-note">${summary.monthsTracked} month${summary.monthsTracked === 1 ? '' : 's'} tracked</div>
      </div>
      <div class="cf-card ${summary.statementType === 'income_statement' ? '' : 'cf-card-muted'}">
        <div class="cf-card-label">CEO slide deck</div>
        <div class="cf-card-value">${summary.statementType === 'income_statement' ? summary.slideCount + ' slides' : '—'}</div>
        <div class="cf-card-note">${summary.statementType === 'income_statement' ? 'PowerPoint ready' : 'Income statement builds deck'}</div>
      </div>
      <div class="cf-card">
        <div class="cf-card-label">Clara advisor</div>
        <div class="cf-card-value">Updated</div>
        <div class="cf-card-note">Knows your latest numbers</div>
      </div>
    </div>
    <div class="cf-actions">
      <button class="btn-blue" style="font-size:12px;padding:8px 14px" onclick="goPage('health', document.querySelectorAll('.nav-link')[4])">View health trends →</button>
      <button class="btn-outline" style="font-size:12px;padding:8px 14px" onclick="goPage('slides', document.querySelectorAll('.nav-link')[2])">Open slide deck →</button>
      <button class="btn-outline" style="font-size:12px;padding:8px 14px" onclick="goPage('bot', document.querySelectorAll('.nav-link')[3])">Ask Clara →</button>
    </div>`;

  const banner = document.getElementById('health-save-banner');
  if (banner) banner.style.display = 'none';
}

function renderWelcomeBackBanner() {
  const banner = document.getElementById('welcome-back-banner');
  if (!banner) return;

  loadCompanyStore();
  const activeType = typeof getStatementType === 'function' ? getStatementType() : 'income_statement';
  const saved = getSavedReportForType(activeType);
  if (!saved?.financials) {
    banner.style.display = 'none';
    return;
  }

  const cfg = typeof STATEMENT_TYPES !== 'undefined' ? (STATEMENT_TYPES[activeType] || STATEMENT_TYPES.income_statement) : { label: 'Analysis' };
  const h = typeof calcHealthScore === 'function' ? calcHealthScore(saved.financials) : 0;
  banner.style.display = 'flex';
  banner.innerHTML = `
    <div class="wb-text">
      <strong>Saved ${escapeHtml(cfg.label)}</strong>
      <span>${escapeHtml(saved.monthLabel || 'On file')} · Health ${h}/100 · ${escapeHtml(saved.filename || 'Uploaded report')}</span>
    </div>
    <div class="wb-actions">
      <button class="btn-blue" style="font-size:12px;padding:8px 14px" onclick="restoreReportForType('${activeType}')">View saved report</button>
      <button class="btn-outline" style="font-size:12px;padding:8px 14px" onclick="document.getElementById('analysis-file').click()">Upload new file</button>
    </div>`;
}

function restoreReportForType(statementType) {
  loadCompanyStore();
  const saved = getSavedReportForType(statementType);
  if (!saved?.financials) return;
  currentData = { ...saved.financials };
  window.latestAIReport = saved.aiReport || null;
  renderReport(saved.financials);
  if (saved.aiReport) applyAIReportFromStore(saved.aiReport);
  renderConnectedFlowPanel();
}

function restoreLastAnalysis() {
  const activeType = typeof getStatementType === 'function' ? getStatementType() : 'income_statement';
  restoreReportForType(activeType);
}

function applyAIReportFromStore(report) {
  if (!report) return;
  window.latestAIReport = report;

  if (report.findings?.length) {
    document.getElementById('rpt-findings').innerHTML = report.findings.map(f => `
      <div class="finding-card">
        <span class="finding-tag tag-${f.type === 'good' ? 'good' : f.type === 'bad' ? 'bad' : 'warn'}">
          <span class="tag-dot"></span>${f.type === 'good' ? 'Strength' : f.type === 'bad' ? 'Critical' : 'Watch closely'}
        </span>
        <div class="finding-text">${escapeHtml(f.text)}</div>
      </div>`).join('');
  }

  if (report.actions?.length) {
    document.getElementById('rpt-actions').innerHTML = report.actions.map((a, i) => `
      <div class="action-card">
        <div class="action-number">${i + 1}</div>
        <div class="action-body">
          <div class="action-title">${escapeHtml(a.title || 'Recommended action')}</div>
          <div class="action-desc">${escapeHtml(a.description || a.desc || '')}</div>
          ${a.impact ? `<span class="action-impact">${escapeHtml(a.impact)}</span>` : ''}
        </div>
      </div>`).join('');
  }

  if (report.summary) {
    document.getElementById('rpt-summary').textContent = report.summary;
  }

  setAIStatus('Restored your saved AI CFO analysis from company memory.', 'success');
}

function hydrateAppFromStore() {
  loadCompanyStore();
  syncGlobalsFromStore();

  if (companyStore.latest?.financials) {
    const d = companyStore.latest.financials;
    if ((d.statementType || 'income_statement') === 'income_statement' && typeof buildDeck === 'function') {
      buildDeck(d);
    }
    syncClaraWithFullContext(d, companyStore.latest.aiReport);
  }

  renderWelcomeBackBanner();
  renderConnectedFlowPanel();
  updateNavCompanyBadge();
  updateHeroFromStore();
  if (typeof renderHealthPage === 'function') renderHealthPage();
}

function updateNavCompanyBadge() {
  const el = document.getElementById('nav-company-badge');
  if (!el) return;
  loadCompanyStore();
  if (!companyStore.company && !companyStore.latest?.financials?.company) {
    el.style.display = 'none';
    return;
  }
  el.style.display = 'inline-flex';
  el.textContent = companyStore.company || companyStore.latest.financials.company;
}

function calcCashRunwayMonths(d) {
  if (!d) return null;
  const cash = d.cash || d.endingCash || 0;
  const monthlyBurn = d.opex ? d.opex / 12 : (d.netIncome < 0 ? Math.abs(d.netIncome) / 12 : 0);
  if (!cash || !monthlyBurn) return null;
  return cash / monthlyBurn;
}

function getClaraApiPayload() {
  loadCompanyStore();
  const entries = [...(companyStore.health.entries || [])].sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  const latestEntry = entries[entries.length - 1] || null;
  const priorEntry = entries.length > 1 ? entries[entries.length - 2] : null;
  let healthSummary = '';
  if (latestEntry) {
    healthSummary += `Latest tracked month: ${latestEntry.monthLabel} (health ${Math.round(latestEntry.metrics?.healthScore || 0)}/100). `;
    if (priorEntry) {
      const hsDelta = (latestEntry.metrics?.healthScore || 0) - (priorEntry.metrics?.healthScore || 0);
      healthSummary += `Health score change vs prior month: ${hsDelta >= 0 ? '+' : ''}${hsDelta.toFixed(0)} pts. `;
      if (priorEntry.metrics?.revenue) {
        const revDelta = ((latestEntry.metrics.revenue - priorEntry.metrics.revenue) / Math.abs(priorEntry.metrics.revenue)) * 100;
        healthSummary += `Revenue change vs prior month: ${revDelta >= 0 ? '+' : ''}${revDelta.toFixed(1)}%. `;
      }
    }
    healthSummary += `${entries.length} month${entries.length === 1 ? '' : 's'} on file.`;
  }
  return {
    claraContext: window.claraContext || '',
    aiReport: window.latestAIReport || companyStore.latest?.aiReport || null,
    healthSummary,
    company: companyStore.company || companyStore.latest?.financials?.company || ''
  };
}

function updateHeroFromStore() {
  const summary = getConnectedFlowSummary();
  const badge = document.getElementById('hero-preview-badge');
  const urlEl = document.getElementById('hero-preview-url');

  if (!summary) {
    if (badge) badge.style.display = 'inline-flex';
    if (urlEl) urlEl.textContent = 'mycfopro.ai/dashboard';
    if (typeof initHeroPreviewCharts === 'function') initHeroPreviewCharts(null);
    return;
  }

  if (badge) badge.style.display = 'none';
  if (urlEl) urlEl.textContent = `mycfopro.ai/${(summary.company || 'dashboard').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'dashboard'}`;

  loadCompanyStore();
  const d = companyStore.latest.financials;
  const healthScore = summary.healthScore;
  const runway = calcCashRunwayMonths(d);

  setHeroMetric('hero-health-value', healthScore + '/100', healthScore >= 70 ? 'pm-green' : healthScore >= 50 ? 'pm-amber' : 'pm-red');
  setHeroMetricNote('hero-health-note', healthScore >= 70 ? 'Strong' : healthScore >= 50 ? 'Fair' : 'Needs attention', healthScore >= 70 ? 'pm-green' : healthScore >= 50 ? 'pm-amber' : 'pm-red');

  setHeroMetric('hero-margin-value', fp(summary.grossMargin), summary.grossMargin >= 38 ? 'pm-green' : summary.grossMargin >= 25 ? 'pm-amber' : 'pm-red');
  setHeroMetricNote('hero-margin-note', 'Benchmark: 38%', '');

  if (runway !== null) {
    setHeroMetric('hero-runway-value', runway.toFixed(1) + ' mo', runway >= 6 ? 'pm-green' : runway >= 3 ? 'pm-amber' : 'pm-red');
    setHeroMetricNote('hero-runway-note', runway >= 6 ? 'Healthy' : runway >= 3 ? 'Watch' : 'Critical', runway >= 6 ? 'pm-green' : runway >= 3 ? 'pm-amber' : 'pm-red');
  } else {
    setHeroMetric('hero-runway-value', '—', '');
    setHeroMetricNote('hero-runway-note', 'Upload balance sheet for cash', '');
  }

  setHeroMetric('hero-income-value', fc(summary.netIncome), summary.netIncome >= 0 ? 'pm-green' : 'pm-red');
  setHeroMetricNote('hero-income-note', summary.netIncome >= 0 ? 'Profitable' : 'Loss period', summary.netIncome >= 0 ? 'pm-green' : 'pm-red');

  if (typeof updateHeroPreviewCharts === 'function') updateHeroPreviewCharts(d);
}

function setHeroMetric(id, value, colorClass) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = value;
  el.className = 'pm-value' + (colorClass ? ' ' + colorClass : '');
}

function setHeroMetricNote(id, text, colorClass) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.className = 'pm-note' + (colorClass ? ' ' + colorClass : '');
  if (!colorClass) el.style.color = 'var(--ink-3)';
}

function clearCompanyMemory() {
  if (!confirm('Clear all saved company data (reports, health history, deck memory)? This cannot be undone.')) return;
  companyStore = createEmptyCompanyStore();
  saveCompanyStore();
  localStorage.removeItem(LEGACY_HEALTH_KEY);
  currentData = null;
  window.latestAIReport = null;
  if (typeof loadHealthStore === 'function') loadHealthStore();
  renderWelcomeBackBanner();
  renderConnectedFlowPanel();
  updateNavCompanyBadge();
  if (typeof renderHealthPage === 'function') renderHealthPage();
  if (typeof pushCompanyToCloud === 'function') pushCompanyToCloud(true);
  const deckNodata = document.getElementById('deck-nodata');
  const deckReady = document.getElementById('deck-ready');
  if (deckNodata) deckNodata.style.display = 'block';
  if (deckReady) deckReady.style.display = 'none';
}
