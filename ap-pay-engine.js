// ── AP CASH PAYMENT PLANNER ───────────────────────────────────────────
// Recommends which vendors to pay based on aging vs available cash.

const AP_BUCKET_META = [
  { key: 'd90plus', label: '90+ days', urgency: 'critical', score: 100 },
  { key: 'd90', label: '61–90 days', urgency: 'high', score: 80 },
  { key: 'd60', label: '31–60 days', urgency: 'medium', score: 60 },
  { key: 'd30', label: '1–30 days', urgency: 'moderate', score: 40 },
  { key: 'current', label: 'Current', urgency: 'low', score: 20 }
];

function getApCashPrefill() {
  if (typeof currentData !== 'undefined' && currentData?.cash) return currentData.cash;
  if (typeof currentData !== 'undefined' && currentData?.endingCash) return currentData.endingCash;
  if (typeof loadCompanyStore === 'function') {
    const latest = loadCompanyStore()?.latest?.financials;
    if (latest?.cash) return latest.cash;
    if (latest?.endingCash) return latest.endingCash;
  }
  return '';
}

function vendorHasAgingDetail(v) {
  return AP_BUCKET_META.some(b => (v[b.key] || 0) > 0);
}

function buildApPayableLines(vendors) {
  const lines = [];
  (vendors || []).forEach(vendor => {
    if (vendorHasAgingDetail(vendor)) {
      AP_BUCKET_META.forEach(bucket => {
        const amount = vendor[bucket.key] || 0;
        if (amount <= 0) return;
        lines.push({
          vendor: vendor.name,
          bucketKey: bucket.key,
          bucketLabel: bucket.label,
          urgency: bucket.urgency,
          score: bucket.score,
          owed: amount,
          payNow: 0,
          reason: reasonForBucket(bucket)
        });
      });
    } else if ((vendor.val || 0) > 0) {
      lines.push({
        vendor: vendor.name,
        bucketKey: 'unknown',
        bucketLabel: 'Total balance',
        urgency: 'medium',
        score: 55,
        owed: vendor.val,
        payNow: 0,
        reason: 'No aging detail in file — treat as priority until vendor breakdown is available.'
      });
    }
  });
  return lines.sort((a, b) => b.score - a.score || b.owed - a.owed);
}

function reasonForBucket(bucket) {
  if (bucket.key === 'd90plus') return 'Most overdue — pay first to avoid supply disruption, liens, or lost terms.';
  if (bucket.key === 'd90') return 'Seriously past due — high risk to vendor relationship.';
  if (bucket.key === 'd60') return 'Past due — schedule before current bills to protect credit.';
  if (bucket.key === 'd30') return 'Recently overdue — pay after older buckets if cash is tight.';
  return 'Not yet due — pay after overdue vendors unless required for critical supply.';
}

function allocateApCash(lines, cashAvailable) {
  let remaining = Math.max(0, cashAvailable);
  const plan = lines.map(line => ({ ...line, payNow: 0, stillOwed: line.owed }));

  plan.forEach(line => {
    if (remaining <= 0) {
      line.stillOwed = line.owed;
      return;
    }
    const pay = Math.min(line.owed, remaining);
    line.payNow = pay;
    line.stillOwed = line.owed - pay;
    remaining -= pay;
  });

  const totalOwed = plan.reduce((s, l) => s + l.owed, 0);
  const totalPay = plan.reduce((s, l) => s + l.payNow, 0);
  const vendorsPaid = new Set(plan.filter(l => l.payNow > 0).map(l => l.vendor)).size;
  const criticalUnpaid = plan.filter(l => l.stillOwed > 0 && (l.urgency === 'critical' || l.urgency === 'high'));

  return {
    lines: plan,
    cashAvailable,
    cashRemaining: remaining,
    totalOwed,
    totalPay,
    totalUnpaid: totalOwed - totalPay,
    vendorsPaid,
    criticalUnpaid,
    coveragePct: totalOwed > 0 ? (totalPay / totalOwed) * 100 : 0
  };
}

function buildApPlannerSummary(plan) {
  if (!plan.lines.length) return 'Upload an AP aging report with vendor rows to build a payment plan.';
  if (plan.cashAvailable <= 0) return 'Enter how much cash you can allocate to vendor payments this cycle.';

  const parts = [];
  parts.push(`You can pay ${fc(plan.totalPay)} across ${plan.vendorsPaid} vendor${plan.vendorsPaid === 1 ? '' : 's'} with ${fc(plan.cashAvailable)} available.`);

  if (plan.cashRemaining > 0) {
    parts.push(`${fc(plan.cashRemaining)} would remain unallocated — consider prepaying current vendors or holding as buffer.`);
  } else if (plan.totalUnpaid > 0) {
    parts.push(`${fc(plan.totalUnpaid)} in AP would remain unpaid — focus on the critical/high rows first and call vendors on the rest.`);
  } else {
    parts.push('This cash covers all listed payables in priority order.');
  }

  if (plan.criticalUnpaid.length) {
    parts.push(`${plan.criticalUnpaid.length} critical/high-priority balance${plan.criticalUnpaid.length === 1 ? '' : 's'} still need attention after this plan.`);
  }

  return parts.join(' ');
}

function renderApCashPlanner(d) {
  const panel = document.getElementById('ap-cash-planner');
  if (!panel) return;

  if ((d.statementType || '') !== 'unpaid_bills') {
    panel.style.display = 'none';
    return;
  }

  const vendors = d.counterparties?.length ? d.counterparties : d.topCounterparties || [];
  const prefill = getApCashPrefill();
  const totalAp = d.totalBalance || vendors.reduce((s, v) => s + (v.val || 0), 0);
  const overdueAp = d.overdueBalance || 0;

  panel.style.display = 'block';
  panel.innerHTML = `
    <div class="ap-planner-head">
      <div>
        <div class="ap-planner-eyebrow">Unpaid Bills Planner</div>
        <div class="ap-planner-title">Which bills to pay with the cash you have</div>
        <div class="ap-planner-sub">Prioritizes oldest vendor balances first — 90+ and 61–90 day bills before current invoices.</div>
      </div>
      <div class="ap-planner-stats">
        <div class="ap-planner-stat"><span>Total AP</span><strong>${fc(totalAp)}</strong></div>
        <div class="ap-planner-stat"><span>Past due</span><strong>${fc(overdueAp)}</strong></div>
        <div class="ap-planner-stat"><span>Vendors</span><strong>${vendors.length}</strong></div>
      </div>
    </div>
    <div class="ap-planner-controls">
      <label class="ap-cash-field">
        <span>Available cash for vendor payments</span>
        <div class="ap-cash-input-wrap">
          <span class="ap-cash-prefix">$</span>
          <input type="text" id="ap-cash-input" value="${prefill ? Math.round(Number(prefill)).toLocaleString('en-US') : ''}" placeholder="e.g. 25000" oninput="updateApPaymentPlan()">
        </div>
      </label>
      ${prefill ? '<div class="ap-cash-hint">Prefilled from your latest cash balance — adjust to what you actually want to pay out.</div>' : ''}
    </div>
    <div class="ap-planner-summary" id="ap-planner-summary"></div>
    <div class="ap-planner-table-wrap" id="ap-planner-table"></div>
    <div class="ap-planner-foot">Tip: Export vendor-level aging from QuickBooks or Xero (not just bucket totals) for the most accurate pay list.</div>`;

  updateApPaymentPlan();
}

function parseApCashInput() {
  const el = document.getElementById('ap-cash-input');
  if (!el) return 0;
  const n = parseFloat(String(el.value).replace(/[$,\s]/g, ''));
  return isNaN(n) || n < 0 ? 0 : n;
}

function updateApPaymentPlan() {
  if (!currentData || currentData.statementType !== 'unpaid_bills') return;

  const vendors = currentData.counterparties?.length ? currentData.counterparties : currentData.topCounterparties || [];
  const lines = buildApPayableLines(vendors);
  const cash = parseApCashInput();
  const plan = allocateApCash(lines, cash);

  const summaryEl = document.getElementById('ap-planner-summary');
  const tableEl = document.getElementById('ap-planner-table');

  if (summaryEl) {
    summaryEl.textContent = buildApPlannerSummary(plan);
    summaryEl.className = 'ap-planner-summary' + (plan.criticalUnpaid.length && cash > 0 ? ' warn' : cash > 0 && plan.totalUnpaid === 0 ? ' good' : '');
  }

  if (!tableEl) return;

  if (!lines.length) {
    tableEl.innerHTML = `<div class="ap-planner-empty">No vendor rows detected. Upload an aging report that lists each vendor with bucket columns (Current, 1–30, 31–60, 61–90, 90+).</div>`;
    return;
  }

  if (cash <= 0) {
    tableEl.innerHTML = `<div class="ap-planner-empty">Enter your available cash above to generate a prioritized payment list.</div>`;
    return;
  }

  const vendorGroups = {};
  plan.lines.forEach(line => {
    if (!vendorGroups[line.vendor]) vendorGroups[line.vendor] = { lines: [], payTotal: 0, owedTotal: 0 };
    vendorGroups[line.vendor].lines.push(line);
    vendorGroups[line.vendor].payTotal += line.payNow;
    vendorGroups[line.vendor].owedTotal += line.owed;
  });

  tableEl.innerHTML = `
    <table class="ap-planner-table">
      <thead>
        <tr>
          <th>Priority</th>
          <th>Vendor</th>
          <th>Aging</th>
          <th>Owed</th>
          <th>Pay now</th>
          <th>Still owed</th>
          <th>Why</th>
        </tr>
      </thead>
      <tbody>
        ${plan.lines.map((line, i) => `
          <tr class="ap-row-${line.urgency}${line.payNow > 0 ? ' ap-row-pay' : ' ap-row-skip'}">
            <td>${i + 1}</td>
            <td><strong>${escapeHtml(line.vendor)}</strong></td>
            <td><span class="ap-urgency ap-urgency-${line.urgency}">${escapeHtml(line.bucketLabel)}</span></td>
            <td>${fc(line.owed)}</td>
            <td class="${line.payNow > 0 ? 'ap-pay-yes' : 'ap-pay-no'}">${line.payNow > 0 ? fc(line.payNow) : '—'}</td>
            <td>${line.stillOwed > 0 ? fc(line.stillOwed) : '—'}</td>
            <td class="ap-reason">${escapeHtml(line.reason)}</td>
          </tr>`).join('')}
      </tbody>
    </table>
    <div class="ap-vendor-totals">
      <div class="ap-vendor-totals-title">Vendor payment totals (this cycle)</div>
      <div class="ap-vendor-total-grid">
        ${Object.entries(vendorGroups)
          .filter(([, g]) => g.payTotal > 0)
          .sort((a, b) => b[1].payTotal - a[1].payTotal)
          .map(([name, g]) => `
            <div class="ap-vendor-total-card">
              <div class="ap-vendor-total-name">${escapeHtml(name)}</div>
              <div class="ap-vendor-total-amt">${fc(g.payTotal)}</div>
              <div class="ap-vendor-total-sub">${g.payTotal >= g.owedTotal ? 'Fully covered' : fc(g.owedTotal - g.payTotal) + ' still owed'}</div>
            </div>`).join('') || '<div class="ap-planner-empty">No vendors receive payment at this cash level — increase available cash or renegotiate terms.</div>'}
      </div>
    </div>`;

  window.apLastPaymentPlan = plan;
}

function getApPaymentPlanForClara() {
  const plan = window.apLastPaymentPlan;
  if (!plan?.lines?.length || plan.cashAvailable <= 0) return '';
  const topPays = plan.lines.filter(l => l.payNow > 0).slice(0, 6);
  if (!topPays.length) return '';
  return ' AP payment plan with ' + fc(plan.cashAvailable) + ' cash: ' +
    topPays.map(l => l.vendor + ' (' + l.bucketLabel + ') ' + fc(l.payNow)).join('; ') + '.';
}
