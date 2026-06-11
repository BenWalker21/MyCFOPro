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

function buildDeck(d) {
  if (!d) return;
  deckSourceData = d;
  if (!Object.keys(deckOptionsState).length) deckOptionsState = getDefaultDeckOptions();
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

  deckSlideItems = selectedIds.map(id => ({
    id,
    title: DECK_SLIDE_CATALOG.find(item => item.id === id)?.name || id,
    html: renderDeckSlideHtml(id, d, ctx)
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

function deckSlideShell(type, inner, dark) {
  const bg = dark ? '#0a1628' : '#ffffff';
  const accent = dark
    ? `<div style="position:absolute;inset:0;background:radial-gradient(circle at 85% 15%, rgba(34,197,94,0.18), transparent 28%), radial-gradient(circle at 10% 90%, rgba(15,37,112,0.55), transparent 35%)"></div>`
    : `<div style="position:absolute;top:0;left:0;right:0;height:5px;background:linear-gradient(90deg,#0f2570 0%,#22c55e 100%)"></div>`;
  return `<div style="width:100%;height:100%;background:${bg};display:flex;flex-direction:column;padding:6% 8%;box-sizing:border-box;position:relative;overflow:hidden">${accent}${inner}</div>`;
}

function renderDeckSlideHtml(id, d, ctx) {
  switch (id) {
    case 'cover': return renderDeckCover(d, ctx);
    case 'scorecard': return renderDeckScorecard(d, ctx);
    case 'revenue': return renderDeckRevenue(d, ctx);
    case 'expenses': return renderDeckExpenses(d, ctx);
    case 'margins': return renderDeckMargins(d, ctx);
    case 'findings': return renderDeckFindings(d, ctx);
    case 'actions': return renderDeckActions(d, ctx);
    case 'summary': return renderDeckSummary(d, ctx);
    case 'closing': return renderDeckClosing(d, ctx);
    default: return '';
  }
}

function renderDeckCover(d, ctx) {
  return `<div style="width:100%;height:100%;background:linear-gradient(135deg,#0a1628 0%,#0f2570 58%,#12356c 100%);display:flex;flex-direction:column;justify-content:flex-end;padding:7% 9%;position:relative;box-sizing:border-box;overflow:hidden">
    <div style="position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px);background-size:48px 48px;opacity:0.35"></div>
    <div style="position:absolute;top:-8%;right:-6%;width:42%;height:42%;border-radius:50%;background:rgba(34,197,94,0.12);filter:blur(10px)"></div>
    <div style="position:absolute;top:7%;right:7%;font-size:1.1vw;font-weight:700;color:rgba(255,255,255,0.25);letter-spacing:1px">MyCFOPro.AI</div>
    <div style="font-size:0.85vw;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:rgba(255,255,255,0.42);margin-bottom:1.5vh">Confidential · Executive Review</div>
    <div style="width:64px;height:5px;background:linear-gradient(90deg,#22c55e,#4ade80);border-radius:999px;margin-bottom:2.5vh"></div>
    <div style="font-size:3.6vw;font-weight:900;color:#fff;line-height:1.08;letter-spacing:-0.05em;margin-bottom:1.5vh">${ctx.safeCompany}<br><span style="color:#4ade80">Financial Overview</span></div>
    <div style="font-size:1.05vw;color:rgba(255,255,255,0.58);margin-bottom:3vh">${ctx.safePeriod} · Prepared by MyCFOPro.AI</div>
    <div style="font-size:0.8vw;color:rgba(255,255,255,0.32)">${new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</div>
  </div>`;
}

function renderDeckScorecard(d, ctx) {
  const metrics = [
    { l: 'Health Score', v: ctx.h + '/100', c: ctx.hColor, big: true },
    { l: 'Revenue', v: fc(d.revenue), c: '#0a1628' },
    { l: 'Gross Margin', v: fp(d.grossMargin), c: ctx.mColor(d.grossMargin, 38, 25) },
    { l: 'Net Margin', v: fp(d.netMargin), c: ctx.mColor(d.netMargin, 8, 3) },
    { l: 'Gross Profit', v: fc(d.grossProfit), c: '#0a1628' },
    { l: 'Net Income', v: fc(d.netIncome), c: d.netIncome > 0 ? '#22c55e' : '#dc2626' },
    { l: 'Operating Income', v: fc(d.opIncome || 0), c: (d.opIncome || 0) > 0 ? '#22c55e' : '#dc2626' },
    { l: 'Total OpEx', v: fc(d.opex || 0), c: '#0f2570' }
  ];
  return deckSlideShell('scorecard', `
    <div style="position:relative;z-index:1;display:grid;grid-template-columns:1.1fr 1.9fr;gap:4%;height:100%">
      <div style="background:linear-gradient(180deg,#0f2570 0%,#0a1628 100%);border-radius:18px;padding:6%;display:flex;flex-direction:column;justify-content:center;color:#fff">
        <div style="font-size:0.75vw;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:rgba(255,255,255,0.45);margin-bottom:1vh">Executive Summary</div>
        <div style="font-size:1.1vw;color:rgba(255,255,255,0.62);margin-bottom:2vh">${ctx.safePeriod}</div>
        <div style="font-size:5vw;font-weight:900;line-height:1;color:#4ade80;letter-spacing:-0.06em">${ctx.h}</div>
        <div style="font-size:1vw;color:rgba(255,255,255,0.55);margin-top:0.8vh">Financial health score</div>
        <div style="margin-top:2vh;font-size:0.85vw;line-height:1.6;color:rgba(255,255,255,0.68)">${d.netIncome > 0 ? 'Profitable period with measurable operating momentum.' : 'Period ended in a loss — focus on margin and cash next.'}</div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:2.2%;align-content:start">
        ${metrics.filter(m => !m.big).map(m => `
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:5% 6%">
            <div style="font-size:0.65vw;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#94a3b8;margin-bottom:0.8vh">${m.l}</div>
            <div style="font-size:2vw;font-weight:900;color:${m.c};letter-spacing:-0.05em">${m.v}</div>
          </div>`).join('')}
      </div>
    </div>`);
}

function renderDeckRevenue(d, ctx) {
  const rows = (d.serviceRevenue && d.serviceRevenue.length ? d.serviceRevenue : [{ name: 'Revenue', val: d.revenue }]).slice(0, 7);
  const colors = ['#0f2570', '#22c55e', '#4ade80', '#1a4480', '#16a34a', '#64748b', '#0a1628'];
  return deckSlideShell('revenue', `
    <div style="position:relative;z-index:1;height:100%;display:flex;flex-direction:column">
      <div style="font-size:0.75vw;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#0f2570;margin-bottom:1vh">Revenue Analysis</div>
      <div style="font-size:2.3vw;font-weight:900;color:#0a1628;letter-spacing:-0.04em;margin-bottom:3vh">Where the money comes from</div>
      <div style="flex:1;display:flex;flex-direction:column;gap:1.3vh">
        ${rows.map((s, i) => {
          const pct = d.revenue > 0 ? (s.val / d.revenue * 100) : 0;
          return `<div style="display:grid;grid-template-columns:24% 1fr 12% 8%;gap:2%;align-items:center">
            <div style="font-size:0.78vw;color:#334155;text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(s.name)}</div>
            <div style="background:#eef2f7;border-radius:999px;overflow:hidden;height:1.5vh">
              <div style="width:${Math.max(pct, 3).toFixed(1)}%;height:100%;background:${colors[i % colors.length]};border-radius:999px"></div>
            </div>
            <div style="font-size:0.82vw;font-weight:800;color:#0a1628;text-align:right">${fc(s.val)}</div>
            <div style="font-size:0.72vw;color:#94a3b8;text-align:right">${pct.toFixed(1)}%</div>
          </div>`;
        }).join('')}
        <div style="margin-top:auto;padding-top:1.4vh;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:0.85vw;font-weight:800;color:#0a1628">
          <span>Total Revenue</span><span style="color:#0f2570">${fc(d.revenue)}</span>
        </div>
      </div>
    </div>`);
}

function renderDeckExpenses(d, ctx) {
  const rows = (d.expenseItems && d.expenseItems.length ? d.expenseItems : [{ name: 'Operating Expenses', val: d.opex || 0 }]).slice(0, 6);
  const total = rows.reduce((sum, item) => sum + (item.val || 0), 0) || d.opex || 1;
  return deckSlideShell('expenses', `
    <div style="position:relative;z-index:1;height:100%;display:flex;flex-direction:column">
      <div style="font-size:0.75vw;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#0f2570;margin-bottom:1vh">Cost Structure</div>
      <div style="font-size:2.3vw;font-weight:900;color:#0a1628;letter-spacing:-0.04em;margin-bottom:3vh">Operating expense breakdown</div>
      <div style="flex:1;display:grid;grid-template-columns:1.1fr 1fr;gap:5%">
        <div style="display:flex;flex-direction:column;gap:1.2vh;justify-content:center">
          ${rows.map((item, i) => {
            const pct = total > 0 ? item.val / total * 100 : 0;
            return `<div>
              <div style="display:flex;justify-content:space-between;font-size:0.78vw;margin-bottom:0.5vh"><span>${escapeHtml(item.name)}</span><strong>${fc(item.val)}</strong></div>
              <div style="background:#eef2f7;border-radius:999px;height:1.2vh;overflow:hidden"><div style="width:${Math.max(pct, 4)}%;height:100%;background:${i % 2 ? '#0f2570' : '#22c55e'};border-radius:999px"></div></div>
            </div>`;
          }).join('')}
        </div>
        <div style="background:linear-gradient(180deg,#f8fafc 0%,#eef2f7 100%);border-radius:18px;padding:8%;display:flex;flex-direction:column;justify-content:center;border:1px solid #e2e8f0">
          <div style="font-size:0.75vw;color:#64748b;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:1vh">Total OpEx</div>
          <div style="font-size:3.4vw;font-weight:900;color:#0f2570;letter-spacing:-0.05em">${fc(d.opex || total)}</div>
          <div style="font-size:0.9vw;color:#64748b;margin-top:1vh;line-height:1.6">${d.revenue > 0 ? fp((d.opex || total) / d.revenue * 100) + ' of revenue' : 'Review each category for savings opportunities.'}</div>
        </div>
      </div>
    </div>`);
}

function renderDeckMargins(d, ctx) {
  const items = [
    { label: 'Gross Margin', value: d.grossMargin, benchmark: 38 },
    { label: 'Net Margin', value: d.netMargin, benchmark: 8 },
    { label: 'Operating Margin', value: d.opMargin || 0, benchmark: 10 }
  ];
  return deckSlideShell('margins', `
    <div style="position:relative;z-index:1;height:100%;display:flex;flex-direction:column">
      <div style="font-size:0.75vw;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#0f2570;margin-bottom:1vh">Profitability</div>
      <div style="font-size:2.3vw;font-weight:900;color:#0a1628;letter-spacing:-0.04em;margin-bottom:3vh">Margin performance vs benchmark</div>
      <div style="flex:1;display:flex;flex-direction:column;gap:2.4vh;justify-content:center">
        ${items.map(item => {
          const valWidth = Math.min(item.value / 50 * 100, 100);
          const benchWidth = Math.min(item.benchmark / 50 * 100, 100);
          return `<div>
            <div style="display:flex;justify-content:space-between;align-items:end;margin-bottom:0.8vh">
              <span style="font-size:0.9vw;font-weight:700;color:#0a1628">${item.label}</span>
              <span style="font-size:1.4vw;font-weight:900;color:${ctx.mColor(item.value, item.benchmark, item.benchmark * 0.6)}">${fp(item.value)}</span>
            </div>
            <div style="position:relative;height:2vh;background:#eef2f7;border-radius:999px;overflow:hidden">
              <div style="position:absolute;left:0;top:0;height:100%;width:${benchWidth}%;background:rgba(34,197,94,0.18)"></div>
              <div style="position:absolute;left:0;top:0;height:100%;width:${valWidth}%;background:linear-gradient(90deg,#0f2570,#22c55e);border-radius:999px"></div>
            </div>
            <div style="font-size:0.68vw;color:#94a3b8;margin-top:0.5vh">Benchmark ~${item.benchmark}%</div>
          </div>`;
        }).join('')}
      </div>
    </div>`);
}

function renderDeckFindings(d, ctx) {
  return deckSlideShell('findings', `
    <div style="position:relative;z-index:1;height:100%;display:flex;flex-direction:column">
      <div style="font-size:0.75vw;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#0f2570;margin-bottom:1vh">Analysis</div>
      <div style="font-size:2.3vw;font-weight:900;color:#0a1628;letter-spacing:-0.04em;margin-bottom:2.5vh">Key findings</div>
      <div style="flex:1;display:grid;grid-template-columns:1fr 1fr;gap:1.4vh">
        ${ctx.findings.slice(0, 6).map(f => {
          const bg = f.t === 'good' ? '#dcfce7' : f.t === 'warn' ? '#fef9ec' : '#fef2f2';
          const label = f.t === 'good' ? 'Strength' : f.t === 'warn' ? 'Watch' : 'Critical';
          const color = f.t === 'good' ? '#22c55e' : f.t === 'warn' ? '#b45309' : '#dc2626';
          return `<div style="background:${bg};border-left:4px solid ${color};border-radius:12px;padding:4% 5%;display:flex;flex-direction:column;gap:0.8vh">
            <div style="font-size:0.62vw;font-weight:800;letter-spacing:0.6px;text-transform:uppercase;color:${color}">${label}</div>
            <div style="font-size:0.78vw;color:#334155;line-height:1.55">${escapeHtml(f.text)}</div>
          </div>`;
        }).join('')}
      </div>
    </div>`);
}

function renderDeckActions(d, ctx) {
  return deckSlideShell('actions', `
    <div style="position:relative;z-index:1;height:100%;display:flex;flex-direction:column">
      <div style="font-size:0.75vw;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#0f2570;margin-bottom:1vh">Recommendations</div>
      <div style="font-size:2.3vw;font-weight:900;color:#0a1628;letter-spacing:-0.04em;margin-bottom:2.5vh">Priority action plan</div>
      <div style="flex:1;display:grid;grid-template-columns:1fr 1fr;gap:1.4vh">
        ${ctx.actions.slice(0, 4).map((a, i) => `
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:4% 5%;display:flex;gap:3%">
            <div style="width:2vw;height:2vw;border-radius:10px;background:#0f2570;color:#fff;font-size:0.75vw;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0">${i + 1}</div>
            <div>
              <div style="font-size:0.82vw;font-weight:800;color:#0a1628;margin-bottom:0.5vh">${escapeHtml(a.title)}</div>
              <div style="font-size:0.72vw;color:#475569;line-height:1.55">${escapeHtml((a.desc || '').substring(0, 160))}${(a.desc || '').length > 160 ? '…' : ''}</div>
              ${a.impact ? `<div style="font-size:0.65vw;font-weight:700;color:#22c55e;margin-top:0.6vh">${escapeHtml(a.impact)}</div>` : ''}
            </div>
          </div>`).join('')}
      </div>
    </div>`);
}

function renderDeckSummary(d, ctx) {
  return deckSlideShell('summary', `
    <div style="position:relative;z-index:1;height:100%;display:grid;grid-template-columns:0.95fr 1.05fr;gap:4%">
      <div style="background:linear-gradient(180deg,#0f2570 0%,#0a1628 100%);border-radius:18px;padding:7%;color:#fff;display:flex;flex-direction:column;justify-content:center">
        <div style="font-size:0.75vw;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:rgba(255,255,255,0.45);margin-bottom:1vh">CFO Summary</div>
        <div style="font-size:2vw;font-weight:900;line-height:1.15;margin-bottom:1.5vh">What the numbers are saying</div>
        <div style="font-size:0.85vw;line-height:1.7;color:rgba(255,255,255,0.68)">A concise executive readout based on your uploaded financials.</div>
      </div>
      <div style="display:flex;align-items:center">
        <div style="font-size:0.95vw;line-height:1.85;color:#334155">${escapeHtml(ctx.summary)}</div>
      </div>
    </div>`);
}

function renderDeckClosing(d, ctx) {
  return `<div style="width:100%;height:100%;background:linear-gradient(135deg,#0a1628 0%,#0f2570 100%);display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:8%;box-sizing:border-box;position:relative;overflow:hidden">
    <div style="position:absolute;inset:0;background:radial-gradient(circle at 50% 0%, rgba(34,197,94,0.16), transparent 35%)"></div>
    <div style="position:relative;z-index:1">
      <div style="font-size:0.85vw;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:rgba(255,255,255,0.35);margin-bottom:2vh">Bottom Line</div>
      <div style="width:52px;height:4px;background:#22c55e;border-radius:999px;margin:0 auto 2.5vh"></div>
      <div style="font-size:2.8vw;font-weight:900;color:#fff;letter-spacing:-0.04em;line-height:1.15;margin-bottom:2vh">
        ${d.netIncome > 0 ? 'Profitable. <span style="color:#4ade80">Room to grow.</span>' : '<span style="color:#f87171">Action needed now.</span>'}
      </div>
      <div style="display:flex;gap:4rem;justify-content:center;margin-top:1vh">
        ${[
          { l: 'Revenue', v: fc(d.revenue), c: '#4ade80' },
          { l: 'Net Income', v: fc(d.netIncome), c: d.netIncome > 0 ? '#4ade80' : '#f87171' },
          { l: 'Health', v: ctx.h + '/100', c: ctx.hColor === '#22c55e' ? '#4ade80' : ctx.hColor === '#b45309' ? '#fbbf24' : '#f87171' }
        ].map(s => `<div><div style="font-size:2.8vw;font-weight:900;color:${s.c};letter-spacing:-0.05em">${s.v}</div><div style="font-size:0.75vw;color:rgba(255,255,255,0.35);margin-top:0.6vh">${s.l}</div></div>`).join('')}
      </div>
    </div>
  </div>`;
}

function renderDeckThumbs() {
  const thumbStrip = document.getElementById('deck-thumbs');
  if (!thumbStrip) return;
  thumbStrip.innerHTML = deckSlideItems.map((item, i) =>
    `<div onclick="jumpDeckSlide(${i})" id="deck-thumb-${i}" style="flex-shrink:0;width:168px;cursor:pointer;border-radius:10px;overflow:hidden;border:2px solid ${i === deckCurrent ? '#22c55e' : '#dbe3ef'};transition:border-color 0.13s">
      <div style="aspect-ratio:16/9;background:#0a1628;overflow:hidden;pointer-events:none">
        <div style="width:960px;height:540px;transform:scale(0.175);transform-origin:0 0;pointer-events:none">${item.html}</div>
      </div>
      <div style="font-size:10px;font-weight:700;color:#64748b;text-align:center;padding:6px;background:#f8fafc">${escapeHtml(item.title)}</div>
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
  viewer.innerHTML = `<div style="width:100%;height:100%">${deckSlides[deckCurrent]}</div>`;
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
