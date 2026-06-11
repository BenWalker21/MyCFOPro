// ── CUSTOM DASHBOARD PREFERENCES ──────────────────────────────────────
const DASHBOARD_PREFS = {
  owner: {
    label: 'Owner overview',
    desc: 'Balanced view of profit, cash, and priorities',
    plCharts: ['revenue', 'waterfall', 'opex', 'margins'],
    bsCharts: ['assets', 'liabilities', 'liquidity', 'ratios'],
    arCharts: ['aging', 'pastDue', 'topAccounts', 'collections']
  },
  cash: {
    label: 'Cash & runway focus',
    desc: 'Emphasize liquidity, burn, and collections',
    plCharts: ['revenue', 'opex', 'waterfall', 'margins'],
    bsCharts: ['liquidity', 'assets', 'liabilities', 'ratios'],
    arCharts: ['pastDue', 'aging', 'topAccounts', 'collections']
  },
  profit: {
    label: 'Profitability focus',
    desc: 'Margins, cost drivers, and bottom line',
    plCharts: ['revenue', 'margins', 'opex', 'waterfall'],
    bsCharts: ['assets', 'ratios', 'liquidity', 'liabilities'],
    arCharts: ['aging', 'topAccounts', 'pastDue', 'collections']
  },
  board: {
    label: 'Board / lender ready',
    desc: 'Clean KPIs and trend-friendly layout',
    plCharts: ['waterfall', 'margins', 'revenue', 'opex'],
    bsCharts: ['ratios', 'liquidity', 'assets', 'liabilities'],
    arCharts: ['aging', 'topAccounts', 'pastDue', 'collections']
  }
};

function getDashboardPrefKey() {
  if (typeof loadCompanyStore === 'function') {
    const store = loadCompanyStore();
    if (store.dashboardPref) return store.dashboardPref;
  }
  return localStorage.getItem('mycfopro_dashboard_pref') || 'owner';
}

function setDashboardPref(key) {
  const pref = DASHBOARD_PREFS[key] ? key : 'owner';
  localStorage.setItem('mycfopro_dashboard_pref', pref);
  if (typeof loadCompanyStore === 'function') {
    loadCompanyStore().dashboardPref = pref;
    if (typeof saveCompanyStore === 'function') saveCompanyStore();
  }
  document.querySelectorAll('.dash-pref-card').forEach(card => {
    card.classList.toggle('active', card.dataset.pref === pref);
  });
  const label = document.getElementById('dash-pref-label');
  if (label) label.textContent = DASHBOARD_PREFS[pref].label;
  if (currentData && typeof renderReport === 'function') {
    renderReport(currentData);
  }
}

function initDashboardPrefPicker() {
  const key = getDashboardPrefKey();
  document.querySelectorAll('.dash-pref-card').forEach(card => {
    card.classList.toggle('active', card.dataset.pref === key);
  });
  const label = document.getElementById('dash-pref-label');
  if (label && DASHBOARD_PREFS[key]) label.textContent = DASHBOARD_PREFS[key].label;
}
