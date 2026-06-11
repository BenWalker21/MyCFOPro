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

  companyStore.latest = {
    financials: d,
    aiReport: aiReport ? trimAIReportForStore(aiReport) : (companyStore.latest?.aiReport || null),
    statementType: d.statementType || 'income_statement',
    monthKey,
    monthLabel: monthKeyToLabel(monthKey),
    filename: d.filename || '',
    uploadedAt: new Date().toISOString()
  };

  const snap = buildHistorySnapshot(d);
  companyStore.history = companyStore.history.filter(h => h.monthKey !== snap.monthKey);
  companyStore.history.push(snap);
  companyStore.history.sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  if (companyStore.history.length > 36) companyStore.history = companyStore.history.slice(-36);

  saveCompanyStore();
  syncGlobalsFromStore();
  runConnectedPipeline(d, companyStore.latest.aiReport);
}

function updateCompanyAIReport(report) {
  loadCompanyStore();
  if (!companyStore.latest) return;
  companyStore.latest.aiReport = trimAIReportForStore(report);
  companyStore.lastUpdated = new Date().toISOString();
  saveCompanyStore();
  syncGlobalsFromStore();
  if (companyStore.latest.financials) {
    runConnectedPipeline(companyStore.latest.financials, companyStore.latest.aiReport);
  }
}

function syncGlobalsFromStore() {
  loadCompanyStore();
  if (companyStore.latest?.financials) {
    currentData = { ...companyStore.latest.financials };
    window.latestAIReport = companyStore.latest.aiReport || null;
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
      <button class="btn-blue" style="font-size:12px;padding:8px 14px" onclick="goPage('health', document.querySelectorAll('.nav-link')[5])">View health trends →</button>
      <button class="btn-outline" style="font-size:12px;padding:8px 14px" onclick="goPage('slides', document.querySelectorAll('.nav-link')[2])">Open slide deck →</button>
      <button class="btn-outline" style="font-size:12px;padding:8px 14px" onclick="goPage('bot', document.querySelectorAll('.nav-link')[4])">Ask Clara →</button>
    </div>`;

  const banner = document.getElementById('health-save-banner');
  if (banner) banner.style.display = 'none';
}

function renderWelcomeBackBanner() {
  const banner = document.getElementById('welcome-back-banner');
  if (!banner) return;

  loadCompanyStore();
  if (!companyStore.latest?.financials) {
    banner.style.display = 'none';
    return;
  }

  const s = getConnectedFlowSummary();
  banner.style.display = 'flex';
  banner.innerHTML = `
    <div class="wb-text">
      <strong>Welcome back — ${escapeHtml(s.company)}</strong>
      <span>Your ${escapeHtml(s.monthLabel)} analysis is saved. Health ${s.healthScore}/100 · ${s.monthsTracked} month${s.monthsTracked === 1 ? '' : 's'} on file.</span>
    </div>
    <div class="wb-actions">
      <button class="btn-blue" style="font-size:12px;padding:8px 14px" onclick="restoreLastAnalysis()">View saved report</button>
      <button class="btn-outline" style="font-size:12px;padding:8px 14px" onclick="document.getElementById('analysis-file').click()">Upload new month</button>
    </div>`;
}

function restoreLastAnalysis() {
  loadCompanyStore();
  if (!companyStore.latest?.financials) return;
  syncGlobalsFromStore();
  renderReport(companyStore.latest.financials);
  if (companyStore.latest.aiReport) {
    applyAIReportFromStore(companyStore.latest.aiReport);
  }
  renderConnectedFlowPanel();
  document.getElementById('analysis-report').scrollIntoView({ behavior: 'smooth', block: 'start' });
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

function updateHeroFromStore() {
  const summary = getConnectedFlowSummary();
  if (!summary) return;

  const healthEl = document.querySelector('.hero-preview .pm-card:nth-child(1) .pm-value');
  const marginEl = document.querySelector('.hero-preview .pm-card:nth-child(2) .pm-value');
  const incomeEl = document.querySelector('.hero-preview .pm-card:nth-child(4) .pm-value');
  if (healthEl) {
    healthEl.textContent = summary.healthScore + '/100';
    healthEl.className = 'pm-value ' + (summary.healthScore >= 70 ? 'pm-green' : summary.healthScore >= 50 ? 'pm-amber' : 'pm-red');
  }
  if (marginEl) marginEl.textContent = fp(summary.grossMargin);
  if (incomeEl) {
    incomeEl.textContent = fc(summary.netIncome);
    incomeEl.className = 'pm-value ' + (summary.netIncome >= 0 ? 'pm-green' : 'pm-red');
  }
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
