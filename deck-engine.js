// ── SLIDE DECK ENGINE ─────────────────────────────────────────────────
let deckSlides = [];
let deckSlideItems = [];
let deckCurrent = 0;
let deckSourceData = null;
let deckOptionsState = {};

const DECK_SLIDE_CATALOG = [
  { id: 'cover', name: 'Cover slide', desc: 'Title page with company name and period', default: true, required: true },
  { id: 'scorecard', name: 'Executive scorecard', desc: 'Health score, revenue, margins, and profit', default: true },
  { id: 'revenue', name: 'Revenue breakdown', desc: 'Service line contribution bars', default: true },
  { id: 'expenses', name: 'Expense breakdown', desc: 'Top operating expense categories', default: true },
  { id: 'margins', name: 'Margin analysis', desc: 'Gross and net margin vs benchmark', default: true },
  { id: 'findings', name: 'Key findings', desc: 'Strengths, watch items, and risks', default: true },
  { id: 'actions', name: 'Action plan', desc: 'Prioritized recommendations', default: true },
  { id: 'summary', name: 'CFO summary', desc: 'Executive narrative overview', default: true },
  { id: 'closing', name: 'Closing slide', desc: 'Bottom-line takeaway with key metrics', default: true, required: true }
];

function getDefaultDeckOptions() {
  const opts = {};
  DECK_SLIDE_CATALOG.forEach(item => { opts[item.id] = item.default; });
  return opts;
}

function loadDeckOptionsFromStore() {
  if (typeof loadCompanyStore === 'function') {
    loadCompanyStore();
    const saved = companyStore.deck?.optionsState;
    if (saved && Object.keys(saved).length) {
      deckOptionsState = { ...getDefaultDeckOptions(), ...saved };
      return;
    }
  }
  if (!Object.keys(deckOptionsState).length) deckOptionsState = getDefaultDeckOptions();
}

function saveDeckOptionsToStore() {
  if (typeof loadCompanyStore !== 'function') return;
  loadCompanyStore();
  if (!companyStore.deck) companyStore.deck = { optionsState: {} };
  companyStore.deck.optionsState = { ...deckOptionsState };
  saveCompanyStore();
}

function buildDeck(d) {
  if (!d) return;
  deckSourceData = d;
  loadDeckOptionsFromStore();
  renderDeckOptions();
  composeAndRenderDeck();
}

function renderDeckOptions() {
  const grid = document.getElementById('deck-option-grid');
  if (!grid) return;
  grid.innerHTML = DECK_SLIDE_CATALOG.map(item => {
    const checked = deckOptionsState[item.id] !== false;
    const disabled = item.required ? 'disabled' : '';
    return `<label class="deck-option ${checked ? 'selected' : ''}" data-deck-id="${item.id}">
      <input type="checkbox" ${checked ? 'checked' : ''} ${disabled} onchange="toggleDeckOption('${item.id}', this.checked)">
      <span>
        <span class="deck-option-name">${item.name}${item.required ? ' *' : ''}</span>
        <span class="deck-option-desc">${item.desc}</span>
      </span>
    </label>`;
  }).join('');
}

function toggleDeckOption(id, enabled) {
  const item = DECK_SLIDE_CATALOG.find(s => s.id === id);
  if (item?.required) {
    deckOptionsState[id] = true;
    renderDeckOptions();
    return;
  }
  deckOptionsState[id] = enabled;
  saveDeckOptionsToStore();
  document.querySelectorAll('.deck-option').forEach(el => {
    const input = el.querySelector('input');
    el.classList.toggle('selected', input && input.checked);
  });
}

function applyDeckOptions() {
  if (!deckSourceData) return;
  composeAndRenderDeck();
  const status = document.getElementById('deck-export-status');
  if (status) {
    status.textContent = 'Deck updated with ' + deckSlideItems.length + ' slides.';
    window.setTimeout(() => { status.textContent = ''; }, 2500);
  }
}

function composeAndRenderDeck() {
  if (!deckSourceData) return;
  const d = deckSourceData;
  const ctx = getDeckContext(d);
  const selectedIds = DECK_SLIDE_CATALOG
    .filter(item => item.required || deckOptionsState[item.id] !== false)
    .map(item => item.id);

  deckSlideItems = selectedIds.map((id, i) => ({
    id,
    title: DECK_SLIDE_CATALOG.find(item => item.id === id)?.name || id,
    html: renderDeckSlideHtml(id, d, ctx, i + 1, selectedIds.length)
  }));

  deckSlides = deckSlideItems.map(item => item.html);
  deckCurrent = 0;
  renderDeckSlide();
  renderDeckThumbs();
  updateDeckHeader();
  document.getElementById('deck-nodata').style.display = 'none';
  document.getElementById('deck-ready').style.display = 'block';
}

function getDeckContext(d) {
  const h = calcHealthPL(d);
  return {
    h,
    hColor: h >= 70 ? '#22c55e' : h >= 50 ? '#b45309' : '#dc2626',
    hLabel: h >= 70 ? 'Strong' : h >= 50 ? 'Moderate' : 'Needs attention',
    safeCompany: escapeHtml(d.company || 'Financial Performance'),
    safePeriod: escapeHtml(d.period || ''),
    findings: window.latestAIReport?.findings?.length ? window.latestAIReport.findings.map(f => ({
      t: f.type === 'good' ? 'good' : f.type === 'bad' ? 'bad' : 'warn',
      text: f.text
    })) : buildFindingsPL(d),
    actions: window.latestAIReport?.actions?.length ? window.latestAIReport.actions.map(a => ({
      title: a.title,
      desc: a.description || a.desc || '',
      impact: a.impact || ''
    })) : buildActionsPL(d),
    summary: window.latestAIReport?.summary || buildSummary(d),
    mColor: (val, good, warn) => val >= good ? '#22c55e' : val >= warn ? '#b45309' : '#dc2626'
  };
}

const DECK_NAVY = '#0a1628';
const DECK_BLUE = '#0f2570';
const DECK_GREEN = '#22c55e';
const DECK_GREEN_L = '#4ade80';

function deckHealthGauge(score, color, sizeVw) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const dash = Math.max(0.01, (score / 100) * c);
  return `<svg viewBox="0 0 120 120" width="${sizeVw}" height="${sizeVw}" style="display:block">
    <defs><linearGradient id="deckGaugeGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${DECK_GREEN}"/><stop offset="100%" stop-color="${DECK_GREEN_L}"/></linearGradient></defs>
    <circle cx="60" cy="60" r="${r}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="9"/>
    <circle cx="60" cy="60" r="${r}" fill="none" stroke="url(#deckGaugeGrad)" stroke-width="9" stroke-linecap="round"
      stroke-dasharray="${dash.toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 60 60)"/>
    <text x="60" y="58" text-anchor="middle" font-size="26" font-weight="900" fill="#fff" font-family="system-ui,sans-serif">${score}</text>
    <text x="60" y="74" text-anchor="middle" font-size="9" font-weight="700" fill="rgba(255,255,255,0.45)" font-family="system-ui,sans-serif">/100</text>
  </svg>`;
}

function deckSlideFooter(d, ctx, slideNo, total) {
  return `<div style="position:absolute;left:0;right:0;bottom:0;height:6.5%;display:flex;align-items:center;justify-content:space-between;padding:0 7%;box-sizing:border-box;border-top:1px solid rgba(255,255,255,0.06);background:rgba(0,0,0,0.18);z-index:5">
    <div style="font-size:0.62vw;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:rgba(255,255,255,0.28)">MyCFOPro.AI · Confidential</div>
    <div style="font-size:0.62vw;color:rgba(255,255,255,0.35)">${ctx.safeCompany}${ctx.safePeriod ? ' · ' + ctx.safePeriod : ''}</div>
    <div style="font-size:0.62vw;font-weight:700;color:rgba(255,255,255,0.28)">${slideNo} / ${total}</div>
  </div>`;
}

function deckSlideFooterLight(d, ctx, slideNo, total) {
  return `<div style="position:absolute;left:0;right:0;bottom:0;height:6.5%;display:flex;align-items:center;justify-content:space-between;padding:0 7%;box-sizing:border-box;border-top:1px solid #e2e8f0;background:linear-gradient(180deg,#fff 0%,#f8fafc 100%);z-index:5">
    <div style="font-size:0.62vw;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:#94a3b8">MyCFOPro.AI</div>
    <div style="font-size:0.62vw;color:#64748b">${ctx.safeCompany}</div>
    <div style="font-size:0.62vw;font-weight:700;color:#94a3b8">${slideNo} / ${total}</div>
  </div>`;
}

function deckHeaderBlock(eyebrow, title, light) {
  const eyebrowColor = light ? DECK_BLUE : 'rgba(255,255,255,0.45)';
  const titleColor = light ? DECK_NAVY : '#fff';
  return `<div style="margin-bottom:2.2vh">
    <div style="display:inline-flex;align-items:center;gap:0.6vw;margin-bottom:0.8vh">
      <span style="width:1.8vw;height:3px;border-radius:999px;background:linear-gradient(90deg,${DECK_GREEN},${DECK_GREEN_L})"></span>
      <span style="font-size:0.72vw;font-weight:800;letter-spacing:1.6px;text-transform:uppercase;color:${eyebrowColor}">${eyebrow}</span>
    </div>
    <div style="font-size:2.55vw;font-weight:900;color:${titleColor};letter-spacing:-0.045em;line-height:1.05">${title}</div>
  </div>`;
}

function deckSlideShell(type, inner, light, footerHtml) {
  const bg = light
    ? 'linear-gradient(180deg,#ffffff 0%,#f8fafc 100%)'
    : DECK_NAVY;
  const accent = light
    ? `<div style="position:absolute;top:0;left:0;right:0;height:6px;background:linear-gradient(90deg,${DECK_BLUE} 0%,${DECK_GREEN} 100%)"></div>
       <div style="position:absolute;top:-15%;right:-8%;width:38%;height:38%;border-radius:50%;background:radial-gradient(circle, rgba(34,197,94,0.08), transparent 70%)"></div>
       <div style="position:absolute;bottom:-20%;left:-10%;width:42%;height:42%;border-radius:50%;background:radial-gradient(circle, rgba(15,37,112,0.06), transparent 70%)"></div>`
    : `<div style="position:absolute;inset:0;background:radial-gradient(circle at 88% 12%, rgba(34,197,94,0.14), transparent 30%), radial-gradient(circle at 8% 92%, rgba(15,37,112,0.5), transparent 38%)"></div>`;
  return `<div style="width:100%;height:100%;background:${bg};display:flex;flex-direction:column;padding:5.5% 7% 8%;box-sizing:border-box;position:relative;overflow:hidden;font-family:system-ui,-apple-system,'Segoe UI',sans-serif">${accent}<div style="position:relative;z-index:2;flex:1;display:flex;flex-direction:column;min-height:0">${inner}</div>${footerHtml || ''}</div>`;
}

function renderDeckSlideHtml(id, d, ctx, slideNo, total) {
  slideNo = slideNo || 1;
  total = total || 9;
  switch (id) {
    case 'cover': return renderDeckCover(d, ctx, slideNo, total);
    case 'scorecard': return renderDeckScorecard(d, ctx, slideNo, total);
    case 'revenue': return renderDeckRevenue(d, ctx, slideNo, total);
    case 'expenses': return renderDeckExpenses(d, ctx, slideNo, total);
    case 'margins': return renderDeckMargins(d, ctx, slideNo, total);
    case 'findings': return renderDeckFindings(d, ctx, slideNo, total);
    case 'actions': return renderDeckActions(d, ctx, slideNo, total);
    case 'summary': return renderDeckSummary(d, ctx, slideNo, total);
    case 'closing': return renderDeckClosing(d, ctx, slideNo, total);
    default: return '';
  }
}

function renderDeckCover(d, ctx, slideNo, total) {
  return `<div style="width:100%;height:100%;background:linear-gradient(135deg,#050b14 0%,#0a1628 42%,#0f2570 100%);display:flex;flex-direction:column;justify-content:space-between;padding:7% 8% 8%;position:relative;box-sizing:border-box;overflow:hidden;font-family:system-ui,sans-serif">
    <div style="position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px);background-size:56px 56px;opacity:0.45"></div>
    <div style="position:absolute;top:-12%;right:-8%;width:48%;height:48%;border-radius:50%;background:radial-gradient(circle, rgba(34,197,94,0.22), transparent 68%)"></div>
    <div style="position:relative;z-index:2;display:flex;justify-content:space-between;align-items:flex-start">
      <div style="font-size:0.72vw;font-weight:800;letter-spacing:1.8px;text-transform:uppercase;color:rgba(255,255,255,0.35)">Board-ready briefing</div>
      <div style="font-size:0.85vw;font-weight:800;color:rgba(255,255,255,0.22)">MyCFOPro.AI</div>
    </div>
    <div style="position:relative;z-index:2;flex:1;display:flex;flex-direction:column;justify-content:center;padding:2vh 0">
      <div style="display:inline-flex;align-items:center;gap:0.5vw;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:999px;padding:0.5vh 1vw;width:fit-content;margin-bottom:2vh">
        <span style="width:0.45vw;height:0.45vw;border-radius:50%;background:${DECK_GREEN};box-shadow:0 0 8px ${DECK_GREEN}"></span>
        <span style="font-size:0.68vw;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:rgba(255,255,255,0.55)">Confidential · Executive review</span>
      </div>
      <div style="width:5vw;height:0.45vh;background:linear-gradient(90deg,${DECK_GREEN},${DECK_GREEN_L});border-radius:999px;margin-bottom:2.5vh"></div>
      <div style="font-size:4.2vw;font-weight:900;color:#fff;line-height:1.02;letter-spacing:-0.055em;margin-bottom:1.2vh">${ctx.safeCompany}</div>
      <div style="font-size:2.4vw;font-weight:900;background:linear-gradient(90deg,${DECK_GREEN_L},#86efac);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;letter-spacing:-0.04em;margin-bottom:2vh">Financial Overview</div>
      <div style="font-size:1.05vw;color:rgba(255,255,255,0.55);max-width:55%">${ctx.safePeriod || 'Current period'} · ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
    </div>
    <div style="position:relative;z-index:2;display:grid;grid-template-columns:repeat(3,1fr);gap:1.2vw">
      ${[
        { l: 'Revenue', v: fc(d.revenue), c: DECK_GREEN_L },
        { l: 'Net income', v: fc(d.netIncome), c: d.netIncome >= 0 ? DECK_GREEN_L : '#f87171' },
        { l: 'Health score', v: ctx.h + '/100', c: ctx.hColor }
      ].map(s => `<div style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:1.4vh 1.2vw">
        <div style="font-size:0.62vw;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:rgba(255,255,255,0.38);margin-bottom:0.6vh">${s.l}</div>
        <div style="font-size:1.55vw;font-weight:900;color:${s.c};letter-spacing:-0.04em">${s.v}</div>
      </div>`).join('')}
    </div>
    ${deckSlideFooter(d, ctx, slideNo, total)}
  </div>`;
}

function renderDeckScorecard(d, ctx, slideNo, total) {
  const metrics = [
    { l: 'Revenue', v: fc(d.revenue), c: DECK_NAVY, sub: 'Top line' },
    { l: 'Gross margin', v: fp(d.grossMargin), c: ctx.mColor(d.grossMargin, 38, 25), sub: 'Benchmark 38%' },
    { l: 'Net margin', v: fp(d.netMargin), c: ctx.mColor(d.netMargin, 8, 3), sub: 'Benchmark 8%' },
    { l: 'Gross profit', v: fc(d.grossProfit), c: DECK_BLUE, sub: 'After direct costs' },
    { l: 'Net income', v: fc(d.netIncome), c: d.netIncome >= 0 ? DECK_GREEN : '#dc2626', sub: d.netIncome >= 0 ? 'Profitable' : 'Loss period' },
    { l: 'Operating income', v: fc(d.opIncome || 0), c: (d.opIncome || 0) >= 0 ? DECK_GREEN : '#dc2626', sub: 'Core operations' }
  ];
  return deckSlideShell('scorecard', `
    ${deckHeaderBlock('Executive scorecard', 'Performance at a glance', true)}
    <div style="flex:1;display:grid;grid-template-columns:0.95fr 1.05fr;gap:3.5%;min-height:0">
      <div style="background:linear-gradient(160deg,${DECK_BLUE} 0%,${DECK_NAVY} 100%);border-radius:20px;padding:6%;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;box-shadow:0 16px 40px rgba(10,22,40,0.18);position:relative;overflow:hidden">
        <div style="position:absolute;inset:0;background:radial-gradient(circle at 50% 0%, rgba(34,197,94,0.15), transparent 55%)"></div>
        <div style="position:relative;z-index:1">
          ${deckHealthGauge(ctx.h, ctx.hColor, '11vw')}
          <div style="font-size:0.85vw;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:rgba(255,255,255,0.45);margin-top:1vh">${ctx.hLabel}</div>
          <div style="font-size:0.78vw;line-height:1.65;color:rgba(255,255,255,0.62);margin-top:1.4vh;max-width:90%">${d.netIncome >= 0 ? 'Solid operating performance with room to optimize costs and cash timing.' : 'Margins and cash need immediate leadership focus this period.'}</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:1.4vh 1.2vw;align-content:center">
        ${metrics.map(m => `
          <div style="background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:4.5% 5.5%;box-shadow:0 8px 24px rgba(15,37,112,0.06);position:relative;overflow:hidden">
            <div style="position:absolute;top:0;left:0;right:0;height:3px;background:${m.c}"></div>
            <div style="font-size:0.62vw;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;color:#94a3b8;margin-bottom:0.5vh">${m.l}</div>
            <div style="font-size:1.85vw;font-weight:900;color:${m.c};letter-spacing:-0.05em;line-height:1">${m.v}</div>
            <div style="font-size:0.62vw;color:#64748b;margin-top:0.6vh">${m.sub}</div>
          </div>`).join('')}
      </div>
    </div>`, true, deckSlideFooterLight(d, ctx, slideNo, total));
}

function renderDeckRevenue(d, ctx, slideNo, total) {
  const rows = (d.serviceRevenue && d.serviceRevenue.length ? d.serviceRevenue : [{ name: 'Revenue', val: d.revenue }]).slice(0, 6);
  const colors = [DECK_BLUE, DECK_GREEN, DECK_GREEN_L, '#1a4480', '#16a34a', DECK_NAVY];
  return deckSlideShell('revenue', `
    ${deckHeaderBlock('Revenue analysis', 'Where the money comes from', true)}
    <div style="flex:1;display:grid;grid-template-columns:1.35fr 0.65fr;gap:4%;min-height:0">
      <div style="display:flex;flex-direction:column;gap:1.5vh;justify-content:center">
        ${rows.map((s, i) => {
          const pct = d.revenue > 0 ? (s.val / d.revenue * 100) : 0;
          return `<div style="display:grid;grid-template-columns:1.4vw 22% 1fr 11%;gap:1.2vw;align-items:center">
            <div style="font-size:0.72vw;font-weight:900;color:${colors[i % colors.length]};opacity:0.7">${String(i + 1).padStart(2, '0')}</div>
            <div style="font-size:0.78vw;font-weight:700;color:#334155;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(s.name)}</div>
            <div style="background:#e8eef6;border-radius:999px;overflow:hidden;height:1.8vh;box-shadow:inset 0 1px 2px rgba(15,37,112,0.06)">
              <div style="width:${Math.max(pct, 4).toFixed(1)}%;height:100%;background:linear-gradient(90deg,${colors[i % colors.length]},${i % 2 ? DECK_GREEN_L : '#4ade80'});border-radius:999px;box-shadow:0 0 12px rgba(34,197,94,0.25)"></div>
            </div>
            <div style="font-size:0.78vw;font-weight:900;color:${DECK_NAVY};text-align:right">${pct.toFixed(0)}%</div>
          </div>`;
        }).join('')}
      </div>
      <div style="background:linear-gradient(180deg,${DECK_NAVY} 0%,${DECK_BLUE} 100%);border-radius:20px;padding:8%;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;color:#fff;box-shadow:0 16px 36px rgba(10,22,40,0.15)">
        <div style="font-size:0.68vw;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:rgba(255,255,255,0.4);margin-bottom:1vh">Total revenue</div>
        <div style="font-size:2.8vw;font-weight:900;color:${DECK_GREEN_L};letter-spacing:-0.05em;line-height:1">${fc(d.revenue)}</div>
        <div style="font-size:0.75vw;color:rgba(255,255,255,0.55);margin-top:1.4vh;line-height:1.6">${rows.length} revenue line${rows.length === 1 ? '' : 's'} · Top: ${escapeHtml(rows[0]?.name || 'N/A')}</div>
      </div>
    </div>`, true, deckSlideFooterLight(d, ctx, slideNo, total));
}

function renderDeckExpenses(d, ctx, slideNo, total) {
  const rows = (d.expenseItems && d.expenseItems.length ? d.expenseItems : [{ name: 'Operating Expenses', val: d.opex || 0 }]).slice(0, 6);
  const totalExp = rows.reduce((sum, item) => sum + (item.val || 0), 0) || d.opex || 1;
  const top = rows[0];
  const topPct = totalExp > 0 && top ? (top.val / totalExp * 100) : 0;
  return deckSlideShell('expenses', `
    ${deckHeaderBlock('Cost structure', 'Operating expense breakdown', true)}
    <div style="flex:1;display:grid;grid-template-columns:1.15fr 0.85fr;gap:4%;min-height:0">
      <div style="display:flex;flex-direction:column;gap:1.3vh;justify-content:center">
        ${rows.map((item, i) => {
          const pct = totalExp > 0 ? item.val / totalExp * 100 : 0;
          return `<div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:3% 4%;box-shadow:0 4px 16px rgba(15,37,112,0.04)">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.6vh">
              <span style="font-size:0.78vw;font-weight:700;color:#334155">${escapeHtml(item.name)}</span>
              <span style="font-size:0.82vw;font-weight:900;color:${DECK_BLUE}">${fc(item.val)}</span>
            </div>
            <div style="background:#eef2f7;border-radius:999px;height:1.3vh;overflow:hidden">
              <div style="width:${Math.max(pct, 5)}%;height:100%;background:linear-gradient(90deg,${i % 2 ? DECK_BLUE : DECK_GREEN},${i % 2 ? '#1a4480' : DECK_GREEN_L});border-radius:999px"></div>
            </div>
            <div style="font-size:0.62vw;color:#94a3b8;margin-top:0.4vh">${pct.toFixed(1)}% of OpEx</div>
          </div>`;
        }).join('')}
      </div>
      <div style="display:flex;flex-direction:column;gap:1.4vh">
        <div style="flex:1;background:linear-gradient(160deg,${DECK_BLUE},${DECK_NAVY});border-radius:20px;padding:8%;display:flex;flex-direction:column;justify-content:center;color:#fff">
          <div style="font-size:0.68vw;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:rgba(255,255,255,0.4)">Total OpEx</div>
          <div style="font-size:3vw;font-weight:900;color:${DECK_GREEN_L};letter-spacing:-0.05em;margin:1vh 0">${fc(d.opex || totalExp)}</div>
          <div style="font-size:0.78vw;color:rgba(255,255,255,0.6);line-height:1.6">${d.revenue > 0 ? fp((d.opex || totalExp) / d.revenue * 100) + ' of revenue' : 'Review each category for savings.'}</div>
        </div>
        ${top ? `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:6% 7%">
          <div style="font-size:0.62vw;font-weight:800;text-transform:uppercase;color:#94a3b8;margin-bottom:0.5vh">Largest cost driver</div>
          <div style="font-size:1.1vw;font-weight:800;color:${DECK_NAVY}">${escapeHtml(top.name)}</div>
          <div style="font-size:1.6vw;font-weight:900;color:${DECK_GREEN};margin-top:0.5vh">${topPct.toFixed(0)}% of OpEx</div>
        </div>` : ''}
      </div>
    </div>`, true, deckSlideFooterLight(d, ctx, slideNo, total));
}

function renderDeckMargins(d, ctx, slideNo, total) {
  const items = [
    { label: 'Gross margin', value: d.grossMargin, benchmark: 38 },
    { label: 'Net margin', value: d.netMargin, benchmark: 8 },
    { label: 'Operating margin', value: d.opMargin || 0, benchmark: 10 }
  ];
  return deckSlideShell('margins', `
    ${deckHeaderBlock('Profitability', 'Margin performance vs benchmark', true)}
    <div style="flex:1;display:grid;grid-template-columns:repeat(3,1fr);gap:2vw;align-content:center">
      ${items.map(item => {
        const color = ctx.mColor(item.value, item.benchmark, item.benchmark * 0.6);
        const delta = item.value - item.benchmark;
        return `<div style="background:#fff;border:1px solid #e2e8f0;border-radius:20px;padding:6% 5%;box-shadow:0 10px 30px rgba(15,37,112,0.07);display:flex;flex-direction:column;align-items:center;text-align:center">
          <div style="font-size:0.68vw;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;color:#94a3b8;margin-bottom:1vh">${item.label}</div>
          <div style="font-size:3.2vw;font-weight:900;color:${color};letter-spacing:-0.06em;line-height:1">${fp(item.value)}</div>
          <div style="margin:1.4vh 0;width:100%;height:1.6vh;background:#eef2f7;border-radius:999px;overflow:hidden;position:relative">
            <div style="position:absolute;left:0;top:0;height:100%;width:${Math.min(item.benchmark / 50 * 100, 100)}%;background:rgba(34,197,94,0.15)"></div>
            <div style="position:absolute;left:0;top:0;height:100%;width:${Math.min(Math.max(item.value, 0) / 50 * 100, 100)}%;background:linear-gradient(90deg,${DECK_BLUE},${DECK_GREEN});border-radius:999px"></div>
          </div>
          <div style="font-size:0.68vw;color:#64748b">Benchmark ${item.benchmark}%</div>
          <div style="margin-top:0.8vh;font-size:0.72vw;font-weight:800;color:${delta >= 0 ? DECK_GREEN : '#dc2626'}">${delta >= 0 ? '+' : ''}${delta.toFixed(1)} pts vs benchmark</div>
        </div>`;
      }).join('')}
    </div>`, true, deckSlideFooterLight(d, ctx, slideNo, total));
}

function renderDeckFindings(d, ctx, slideNo, total) {
  const icon = t => t === 'good' ? '✓' : t === 'warn' ? '!' : '⚠';
  return deckSlideShell('findings', `
    ${deckHeaderBlock('Analysis', 'Key findings from your financials', true)}
    <div style="flex:1;display:grid;grid-template-columns:1fr 1fr;gap:1.4vh;min-height:0">
      ${ctx.findings.slice(0, 6).map(f => {
        const bg = f.t === 'good' ? 'linear-gradient(135deg,#ecfdf5,#dcfce7)' : f.t === 'warn' ? 'linear-gradient(135deg,#fffbeb,#fef9ec)' : 'linear-gradient(135deg,#fef2f2,#fee2e2)';
        const label = f.t === 'good' ? 'Strength' : f.t === 'warn' ? 'Watch' : 'Critical';
        const color = f.t === 'good' ? DECK_GREEN : f.t === 'warn' ? '#b45309' : '#dc2626';
        return `<div style="background:${bg};border:1px solid ${color}22;border-left:5px solid ${color};border-radius:16px;padding:4% 5%;display:flex;gap:3%;box-shadow:0 6px 20px rgba(15,37,112,0.05)">
          <div style="width:2vw;height:2vw;border-radius:10px;background:${color};color:#fff;font-size:0.9vw;font-weight:900;display:flex;align-items:center;justify-content:center;flex-shrink:0">${icon(f.t)}</div>
          <div>
            <div style="font-size:0.62vw;font-weight:800;letter-spacing:0.6px;text-transform:uppercase;color:${color};margin-bottom:0.5vh">${label}</div>
            <div style="font-size:0.76vw;color:#334155;line-height:1.55">${escapeHtml(f.text)}</div>
          </div>
        </div>`;
      }).join('')}
    </div>`, true, deckSlideFooterLight(d, ctx, slideNo, total));
}

function renderDeckActions(d, ctx, slideNo, total) {
  return deckSlideShell('actions', `
    ${deckHeaderBlock('Recommendations', 'Priority action plan', true)}
    <div style="flex:1;display:flex;flex-direction:column;gap:1.4vh;justify-content:center;position:relative">
      <div style="position:absolute;left:1.1vw;top:8%;bottom:8%;width:3px;background:linear-gradient(180deg,${DECK_BLUE},${DECK_GREEN});border-radius:999px;opacity:0.25"></div>
      ${ctx.actions.slice(0, 4).map((a, i) => `
        <div style="display:grid;grid-template-columns:3vw 1fr;gap:1.2vw;align-items:start;margin-left:0.5vw">
          <div style="width:2.4vw;height:2.4vw;border-radius:12px;background:linear-gradient(135deg,${DECK_BLUE},${DECK_NAVY});color:#fff;font-size:0.85vw;font-weight:900;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 20px rgba(15,37,112,0.2)">${i + 1}</div>
          <div style="background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:3.5% 4.5%;box-shadow:0 8px 24px rgba(15,37,112,0.05)">
            <div style="font-size:0.88vw;font-weight:800;color:${DECK_NAVY};margin-bottom:0.5vh">${escapeHtml(a.title)}</div>
            <div style="font-size:0.74vw;color:#475569;line-height:1.6">${escapeHtml((a.desc || '').substring(0, 200))}${(a.desc || '').length > 200 ? '…' : ''}</div>
            ${a.impact ? `<div style="display:inline-block;margin-top:0.8vh;font-size:0.65vw;font-weight:800;color:${DECK_GREEN};background:#ecfdf5;border:1px solid #cceedd;border-radius:999px;padding:0.4vh 0.8vw">${escapeHtml(a.impact)}</div>` : ''}
          </div>
        </div>`).join('')}
    </div>`, true, deckSlideFooterLight(d, ctx, slideNo, total));
}

function renderDeckSummary(d, ctx, slideNo, total) {
  return deckSlideShell('summary', `
    <div style="flex:1;display:grid;grid-template-columns:0.42fr 0.58fr;gap:4%;min-height:0">
      <div style="background:linear-gradient(165deg,${DECK_BLUE} 0%,${DECK_NAVY} 100%);border-radius:22px;padding:7%;color:#fff;display:flex;flex-direction:column;justify-content:center;box-shadow:0 18px 40px rgba(10,22,40,0.16);position:relative;overflow:hidden">
        <div style="position:absolute;inset:0;background:radial-gradient(circle at 100% 0%, rgba(34,197,94,0.12), transparent 45%)"></div>
        <div style="position:relative;z-index:1">
          <div style="font-size:0.72vw;font-weight:800;letter-spacing:1.4px;text-transform:uppercase;color:rgba(255,255,255,0.42);margin-bottom:1vh">CFO summary</div>
          <div style="font-size:2.1vw;font-weight:900;line-height:1.12;margin-bottom:1.5vh">What the numbers are saying</div>
          <div style="width:3vw;height:0.35vh;background:${DECK_GREEN};border-radius:999px;margin-bottom:1.5vh"></div>
          <div style="font-size:0.82vw;line-height:1.7;color:rgba(255,255,255,0.65)">Executive readout based on your uploaded financials — ready for leadership review.</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;padding-right:2%">
        <div style="font-size:0.95vw;line-height:1.9;color:#334155;border-left:4px solid ${DECK_GREEN};padding-left:1.2vw">${escapeHtml(ctx.summary)}</div>
      </div>
    </div>`, true, deckSlideFooterLight(d, ctx, slideNo, total));
}

function renderDeckClosing(d, ctx, slideNo, total) {
  return `<div style="width:100%;height:100%;background:linear-gradient(135deg,#050b14 0%,#0a1628 50%,#0f2570 100%);display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:8%;box-sizing:border-box;position:relative;overflow:hidden;font-family:system-ui,sans-serif">
    <div style="position:absolute;inset:0;background:radial-gradient(circle at 50% 20%, rgba(34,197,94,0.18), transparent 40%)"></div>
    <div style="position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);background-size:48px 48px"></div>
    <div style="position:relative;z-index:1;max-width:85%">
      <div style="font-size:0.78vw;font-weight:800;letter-spacing:1.8px;text-transform:uppercase;color:rgba(255,255,255,0.35);margin-bottom:2vh">Bottom line</div>
      <div style="width:4vw;height:0.4vh;background:linear-gradient(90deg,${DECK_GREEN},${DECK_GREEN_L});border-radius:999px;margin:0 auto 2.5vh"></div>
      <div style="font-size:3.2vw;font-weight:900;color:#fff;letter-spacing:-0.045em;line-height:1.12;margin-bottom:3vh">
        ${d.netIncome >= 0 ? 'Profitable. <span style="background:linear-gradient(90deg,#4ade80,#86efac);-webkit-background-clip:text;-webkit-text-fill-color:transparent">Room to grow.</span>' : '<span style="color:#f87171">Action needed now.</span>'}
      </div>
      <div style="display:flex;gap:3vw;justify-content:center;flex-wrap:wrap">
        ${[
          { l: 'Revenue', v: fc(d.revenue), c: DECK_GREEN_L },
          { l: 'Net income', v: fc(d.netIncome), c: d.netIncome >= 0 ? DECK_GREEN_L : '#f87171' },
          { l: 'Health score', v: ctx.h + '/100', c: ctx.hColor }
        ].map(s => `<div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:18px;padding:2vh 2vw;min-width:10vw">
          <div style="font-size:2.4vw;font-weight:900;color:${s.c};letter-spacing:-0.05em">${s.v}</div>
          <div style="font-size:0.72vw;color:rgba(255,255,255,0.38);margin-top:0.6vh;text-transform:uppercase;letter-spacing:0.5px">${s.l}</div>
        </div>`).join('')}
      </div>
    </div>
    ${deckSlideFooter(d, ctx, slideNo, total)}
  </div>`;
}

function renderDeckThumbs() {
  const thumbStrip = document.getElementById('deck-thumbs');
  if (!thumbStrip) return;
  thumbStrip.innerHTML = deckSlideItems.map((item, i) =>
    `<div onclick="jumpDeckSlide(${i})" id="deck-thumb-${i}" style="flex-shrink:0;width:180px;cursor:pointer;border-radius:12px;overflow:hidden;border:2px solid ${i === deckCurrent ? '#22c55e' : '#dbe3ef'};transition:all 0.15s;box-shadow:${i === deckCurrent ? '0 8px 20px rgba(34,197,94,0.15)' : 'none'}">
      <div style="aspect-ratio:16/9;background:#050b14;overflow:hidden;pointer-events:none">
        <div style="width:960px;height:540px;transform:scale(0.1875);transform-origin:0 0;pointer-events:none">${item.html}</div>
      </div>
      <div style="font-size:10px;font-weight:700;color:${i === deckCurrent ? '#0f2570' : '#64748b'};text-align:center;padding:7px;background:${i === deckCurrent ? '#ecfdf5' : '#f8fafc'}">${escapeHtml(item.title)}</div>
    </div>`
  ).join('');
}

function updateDeckHeader() {
  const d = deckSourceData;
  if (!d) return;
  document.getElementById('deck-title').textContent = (d.company || 'CEO Presentation') + ' — Financial Overview';
  document.getElementById('deck-sub').textContent = (d.period || '') + ' · ' + deckSlideItems.length + ' slides · Built from your data';
  document.getElementById('deck-counter').textContent = 'Slide ' + (deckCurrent + 1) + ' of ' + deckSlideItems.length;
}

function renderDeckSlide() {
  const viewer = document.getElementById('deck-viewer');
  if (!viewer || !deckSlides[deckCurrent]) return;
  viewer.innerHTML = `<div class="deck-slide-frame" style="width:100%;height:100%">${deckSlides[deckCurrent]}</div>`;
  document.getElementById('deck-counter').textContent = 'Slide ' + (deckCurrent + 1) + ' of ' + deckSlides.length;
  deckSlideItems.forEach((_, i) => {
    const t = document.getElementById('deck-thumb-' + i);
    if (t) t.style.borderColor = i === deckCurrent ? '#22c55e' : '#dbe3ef';
  });
}

function deckNext() { if (deckCurrent < deckSlides.length - 1) { deckCurrent++; renderDeckSlide(); } }
function deckPrev() { if (deckCurrent > 0) { deckCurrent--; renderDeckSlide(); } }
function jumpDeckSlide(i) { deckCurrent = i; renderDeckSlide(); }

function exportDeckPowerPoint() {
  if (!deckSourceData || !deckSlideItems.length) return;
  if (typeof PptxGenJS === 'undefined') {
    alert('PowerPoint export library is still loading. Please try again in a moment.');
    return;
  }

  const d = deckSourceData;
  const ctx = getDeckContext(d);
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  pptx.author = 'MyCFOPro.AI';
  pptx.company = d.company || 'MyCFOPro';
  pptx.subject = 'Financial Overview';
  pptx.title = (d.company || 'CEO Presentation') + ' — Financial Overview';

  deckSlideItems.forEach(item => addDeckSlideToPptx(pptx, item.id, d, ctx));

  const fileName = ((d.company || 'CEO-Presentation').replace(/[^\w\- ]+/g, '').trim() || 'CEO-Presentation') + '-MyCFOPro.pptx';
  const status = document.getElementById('deck-export-status');
  if (status) status.textContent = 'Generating PowerPoint…';

  pptx.writeFile({ fileName }).then(() => {
    if (status) status.textContent = 'Downloaded ' + fileName;
    window.setTimeout(() => { if (status) status.textContent = ''; }, 3000);
  }).catch(err => {
    console.error(err);
    if (status) status.textContent = '';
    alert('Could not export PowerPoint. Please try again.');
  });
}

function addDeckSlideToPptx(pptx, id, d, ctx) {
  const slide = pptx.addSlide();
  const NAVY = '0F2570';
  const NAVY_D = '0A1628';
  const GREEN = '22C55E';
  const GREEN_L = '4ADE80';
  const WHITE = 'FFFFFF';
  const MUTED = '64748B';

  if (id === 'cover') {
    slide.background = { color: NAVY_D };
    slide.addShape(pptx.ShapeType.rect, { x: 7.2, y: 0.2, w: 2.3, h: 2.3, fill: { color: GREEN, transparency: 88 } });
    slide.addText('CONFIDENTIAL · EXECUTIVE REVIEW', { x: 0.6, y: 3.0, w: 5, h: 0.3, fontSize: 10, bold: true, color: '94A3B8', charSpacing: 2 });
    slide.addShape(pptx.ShapeType.rect, { x: 0.6, y: 3.45, w: 0.9, h: 0.06, fill: { color: GREEN } });
    slide.addText(d.company || 'Financial Performance', { x: 0.6, y: 3.7, w: 8.5, h: 0.9, fontSize: 34, bold: true, color: WHITE });
    slide.addText('Financial Overview', { x: 0.6, y: 4.45, w: 8, h: 0.5, fontSize: 24, bold: true, color: GREEN_L });
    slide.addText((d.period || '') + ' · Prepared by MyCFOPro.AI', { x: 0.6, y: 5.0, w: 8, h: 0.3, fontSize: 12, color: 'CBD5E1' });
    return;
  }

  if (id === 'scorecard') {
    slide.background = { color: WHITE };
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 10, h: 0.08, fill: { color: GREEN } });
    slide.addShape(pptx.ShapeType.rect, { x: 0.5, y: 0.5, w: 3.2, h: 4.5, fill: { color: NAVY_D }, rectRadius: 0.12 });
    slide.addText('Executive Summary', { x: 0.75, y: 0.8, w: 2.8, h: 0.3, fontSize: 11, bold: true, color: '94A3B8' });
    slide.addText(String(ctx.h), { x: 0.75, y: 1.5, w: 2.5, h: 1.2, fontSize: 54, bold: true, color: GREEN_L });
    slide.addText('Financial health score', { x: 0.75, y: 2.7, w: 2.8, h: 0.3, fontSize: 12, color: 'CBD5E1' });
    const metrics = [
      ['Revenue', fc(d.revenue)], ['Gross Margin', fp(d.grossMargin)], ['Net Margin', fp(d.netMargin)],
      ['Net Income', fc(d.netIncome)], ['Gross Profit', fc(d.grossProfit)], ['Total OpEx', fc(d.opex || 0)]
    ];
    metrics.forEach((m, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      slide.addText(m[0], { x: 4.0 + col * 2.7, y: 0.8 + row * 1.35, w: 2.4, h: 0.25, fontSize: 9, color: MUTED, bold: true });
      slide.addText(m[1], { x: 4.0 + col * 2.7, y: 1.05 + row * 1.35, w: 2.4, h: 0.45, fontSize: 20, bold: true, color: NAVY_D });
    });
    return;
  }

  if (id === 'revenue') {
    slide.background = { color: WHITE };
    slide.addText('Revenue Analysis', { x: 0.6, y: 0.45, w: 4, h: 0.3, fontSize: 11, bold: true, color: NAVY });
    slide.addText('Where the money comes from', { x: 0.6, y: 0.8, w: 8, h: 0.5, fontSize: 24, bold: true, color: NAVY_D });
    const rows = (d.serviceRevenue && d.serviceRevenue.length ? d.serviceRevenue : [{ name: 'Revenue', val: d.revenue }]).slice(0, 6);
    rows.forEach((row, i) => {
      const pct = d.revenue > 0 ? row.val / d.revenue : 0;
      slide.addText(row.name, { x: 0.6, y: 1.55 + i * 0.55, w: 2.2, h: 0.3, fontSize: 10, color: NAVY_D });
      slide.addShape(pptx.ShapeType.rect, { x: 2.9, y: 1.62 + i * 0.55, w: 4.8, h: 0.16, fill: { color: 'E2E8F0' } });
      slide.addShape(pptx.ShapeType.rect, { x: 2.9, y: 1.62 + i * 0.55, w: Math.max(4.8 * pct, 0.15), h: 0.16, fill: { color: i % 2 ? NAVY : GREEN } });
      slide.addText(fc(row.val), { x: 7.9, y: 1.55 + i * 0.55, w: 1.2, h: 0.3, fontSize: 10, bold: true, color: NAVY_D, align: 'right' });
    });
    return;
  }

  if (id === 'expenses') {
    slide.background = { color: WHITE };
    slide.addText('Cost Structure', { x: 0.6, y: 0.45, w: 4, h: 0.3, fontSize: 11, bold: true, color: NAVY });
    slide.addText('Operating expense breakdown', { x: 0.6, y: 0.8, w: 8, h: 0.5, fontSize: 24, bold: true, color: NAVY_D });
    const rows = (d.expenseItems && d.expenseItems.length ? d.expenseItems : [{ name: 'Operating Expenses', val: d.opex || 0 }]).slice(0, 5);
    rows.forEach((row, i) => {
      slide.addText(row.name, { x: 0.6, y: 1.55 + i * 0.55, w: 3.5, h: 0.3, fontSize: 10, color: NAVY_D });
      slide.addText(fc(row.val), { x: 4.2, y: 1.55 + i * 0.55, w: 1.5, h: 0.3, fontSize: 10, bold: true, color: NAVY });
    });
    slide.addShape(pptx.ShapeType.rect, { x: 6.3, y: 1.4, w: 3.0, h: 3.0, fill: { color: 'EEF2F7' }, line: { color: 'E2E8F0' } });
    slide.addText('Total OpEx', { x: 6.6, y: 2.0, w: 2.4, h: 0.3, fontSize: 10, color: MUTED, bold: true });
    slide.addText(fc(d.opex || 0), { x: 6.6, y: 2.45, w: 2.4, h: 0.7, fontSize: 28, bold: true, color: NAVY });
    return;
  }

  if (id === 'margins') {
    slide.background = { color: WHITE };
    slide.addText('Profitability', { x: 0.6, y: 0.45, w: 4, h: 0.3, fontSize: 11, bold: true, color: NAVY });
    slide.addText('Margin performance vs benchmark', { x: 0.6, y: 0.8, w: 8, h: 0.5, fontSize: 24, bold: true, color: NAVY_D });
    [
      ['Gross Margin', fp(d.grossMargin), '38% benchmark'],
      ['Net Margin', fp(d.netMargin), '8% benchmark'],
      ['Operating Margin', fp(d.opMargin || 0), '10% benchmark']
    ].forEach((row, i) => {
      slide.addText(row[0], { x: 0.6, y: 1.6 + i * 0.95, w: 3, h: 0.3, fontSize: 12, bold: true, color: NAVY_D });
      slide.addText(row[1], { x: 8.0, y: 1.6 + i * 0.95, w: 1.2, h: 0.3, fontSize: 18, bold: true, color: GREEN, align: 'right' });
      slide.addShape(pptx.ShapeType.rect, { x: 0.6, y: 2.0 + i * 0.95, w: 8.5, h: 0.18, fill: { color: 'E2E8F0' } });
      slide.addShape(pptx.ShapeType.rect, { x: 0.6, y: 2.0 + i * 0.95, w: 4.2, h: 0.18, fill: { color: NAVY } });
      slide.addText(row[2], { x: 0.6, y: 2.22 + i * 0.95, w: 3, h: 0.2, fontSize: 9, color: MUTED });
    });
    return;
  }

  if (id === 'findings') {
    slide.background = { color: WHITE };
    slide.addText('Key Findings', { x: 0.6, y: 0.45, w: 8, h: 0.5, fontSize: 24, bold: true, color: NAVY_D });
    ctx.findings.slice(0, 4).forEach((f, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      slide.addText(f.text, {
        x: 0.6 + col * 4.7, y: 1.2 + row * 1.8, w: 4.3, h: 1.4,
        fontSize: 11, color: '334155', valign: 'top',
        fill: { color: f.t === 'good' ? 'DCFCE7' : f.t === 'warn' ? 'FEF9EC' : 'FEF2F2' }
      });
    });
    return;
  }

  if (id === 'actions') {
    slide.background = { color: WHITE };
    slide.addText('Priority Action Plan', { x: 0.6, y: 0.45, w: 8, h: 0.5, fontSize: 24, bold: true, color: NAVY_D });
    ctx.actions.slice(0, 4).forEach((a, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      slide.addText(String(i + 1) + '. ' + a.title, { x: 0.6 + col * 4.7, y: 1.15 + row * 1.85, w: 4.2, h: 0.35, fontSize: 12, bold: true, color: NAVY_D });
      slide.addText(a.desc, { x: 0.6 + col * 4.7, y: 1.55 + row * 1.85, w: 4.2, h: 1.0, fontSize: 10, color: '475569' });
    });
    return;
  }

  if (id === 'summary') {
    slide.background = { color: WHITE };
    slide.addShape(pptx.ShapeType.rect, { x: 0.5, y: 0.5, w: 3.4, h: 4.5, fill: { color: NAVY_D } });
    slide.addText('CFO Summary', { x: 0.8, y: 0.9, w: 3, h: 0.3, fontSize: 12, bold: true, color: '94A3B8' });
    slide.addText('What the numbers are saying', { x: 0.8, y: 1.4, w: 3, h: 1.0, fontSize: 20, bold: true, color: WHITE });
    slide.addText(ctx.summary, { x: 4.2, y: 0.9, w: 5.2, h: 3.8, fontSize: 12, color: '334155', valign: 'top' });
    return;
  }

  if (id === 'closing') {
    slide.background = { color: NAVY_D };
    slide.addText('Bottom Line', { x: 0.6, y: 1.0, w: 8.8, h: 0.3, fontSize: 11, bold: true, color: '94A3B8', align: 'center', charSpacing: 2 });
    slide.addText(d.netIncome > 0 ? 'Profitable. Room to grow.' : 'Action needed now.', { x: 0.6, y: 1.8, w: 8.8, h: 0.8, fontSize: 30, bold: true, color: WHITE, align: 'center' });
    slide.addText('Revenue: ' + fc(d.revenue) + '   Net Income: ' + fc(d.netIncome) + '   Health: ' + ctx.h + '/100', {
      x: 0.6, y: 3.2, w: 8.8, h: 0.4, fontSize: 14, color: GREEN_L, align: 'center'
    });
  }
}

function exportDeckPDF() {
  if (!deckSlides.length) return;
  const win = window.open('', '_blank');
  if (!win) {
    alert('Pop-up blocked. Allow pop-ups to print or save as PDF.');
    return;
  }
  win.document.write(`<!DOCTYPE html><html><head><title>CEO Deck</title><style>
    @page { size: landscape; margin: 0.4in; }
    body { margin:0; font-family: system-ui, sans-serif; }
    .slide-page { page-break-after: always; width: 100vw; height: 100vh; }
    .slide-frame { width:100%; height:calc(100vh - 20px); border:1px solid #dbe3ef; border-radius:12px; overflow:hidden; }
  </style></head><body>`);
  deckSlides.forEach(html => {
    win.document.write(`<div class="slide-page"><div class="slide-frame">${html}</div></div>`);
  });
  win.document.write('</body></html>');
  win.document.close();
  win.focus();
  win.print();
}
