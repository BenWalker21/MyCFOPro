// ── CLARA ACTION RUNNER (reports, decks, health via conversation) ─────
const CLARA_VALID_PRESETS = ['owner', 'profit', 'cost', 'board', 'minimal'];

const CLARA_ACTION_LABELS = {
  show_report: 'P&L report',
  build_deck: 'Slide deck',
  show_deck: 'Slide deck',
  show_health: 'Health trends',
  set_dashboard: 'Dashboard layout',
  analyze: 'AI analysis'
};

function parseClaraResponse(raw) {
  const text = String(raw || '').trim();
  if (!text) return { reply: '', actions: [] };
  try {
    const json = JSON.parse(text);
    if (json && typeof json.reply === 'string') {
      return {
        reply: json.reply.trim(),
        actions: normalizeClaraActions(json.actions)
      };
    }
  } catch { /* fall through */ }

  const match = text.match(/\{[\s\S]*"reply"\s*:[\s\S]*\}/);
  if (match) {
    try {
      const json = JSON.parse(match[0]);
      if (json?.reply) {
        return { reply: String(json.reply).trim(), actions: normalizeClaraActions(json.actions) };
      }
    } catch { /* fall through */ }
  }

  return { reply: text, actions: [] };
}

function normalizeClaraActions(actions) {
  if (!Array.isArray(actions)) return [];
  return actions
    .filter(a => a && typeof a.type === 'string')
    .map(a => ({
      type: String(a.type).trim(),
      preset: typeof a.preset === 'string' ? a.preset.trim() : undefined,
      label: typeof a.label === 'string' ? a.label.trim() : undefined
    }));
}

function detectClaraIntents(message) {
  const q = String(message || '').toLowerCase();
  const actions = [];

  if (/\b(report|dashboard|analyze|analysis|p&l|p and l|income statement)\b/.test(q)) {
    actions.push({ type: 'show_report', preset: detectDashboardPresetFromText(q) });
  }
  if (/\b(deck|slide|presentation|powerpoint|ppt|bank meeting|investor meeting|board meeting)\b/.test(q)) {
    actions.push({ type: 'build_deck' });
  }
  if (/\b(health trend|health trends|month over month|month-over-month|track|tracking history|trending)\b/.test(q)) {
    actions.push({ type: 'show_health' });
  }
  if (/\b(open deck|view deck|show deck|see deck)\b/.test(q)) {
    actions.push({ type: 'show_deck' });
  }
  if (/\b(re-?analyze|refresh analysis|run analysis|ai analysis|cfo analysis)\b/.test(q)) {
    actions.push({ type: 'analyze' });
  }
  if (/\b(profit focus|cost control|board ready|minimal dashboard|owner overview)\b/.test(q)) {
    actions.push({ type: 'set_dashboard', preset: detectDashboardPresetFromText(q) });
  }

  return dedupeClaraActions(actions);
}

function detectDashboardPresetFromText(q) {
  if (/\b(profit|margin)\b/.test(q)) return 'profit';
  if (/\b(cost|expense|opex)\b/.test(q)) return 'cost';
  if (/\b(board|bank|lender|investor)\b/.test(q)) return 'board';
  if (/\b(minimal|simple|brief)\b/.test(q)) return 'minimal';
  return 'owner';
}

function dedupeClaraActions(actions) {
  const seen = new Set();
  return actions.filter(a => {
    const key = a.type + (a.preset || '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function hasFinancialData() {
  return typeof currentData !== 'undefined' && currentData && (currentData.revenue || currentData.statementType);
}

function getClaraNavLink(index) {
  const links = document.querySelectorAll('.nav-link');
  return links[index] || null;
}

function runClaraActions(actions) {
  const artifacts = [];
  dedupeClaraActions(actions || []).forEach(action => {
    const result = executeClaraAction(action);
    if (result) artifacts.push(result);
  });
  return artifacts;
}

function executeClaraAction(action) {
  const type = action?.type;
  if (!type) return null;

  if (type === 'set_dashboard') {
    const preset = CLARA_VALID_PRESETS.includes(action.preset) ? action.preset : 'owner';
    if (typeof applyDashboardPreset === 'function') applyDashboardPreset(preset);
    if (hasFinancialData() && typeof applyDashboardToReport === 'function') applyDashboardToReport();
    return buildClaraArtifact('set_dashboard', {
      title: 'Dashboard updated',
      subtitle: `Using the ${preset} layout`,
      buttons: hasFinancialData()
        ? [{ label: 'View report', page: 'analysis', navIndex: 2 }]
        : [{ label: 'Upload P&L', fn: 'claraPromptUpload()' }]
    });
  }

  if (type === 'show_report') {
    if (!hasFinancialData()) {
      return buildClaraArtifact('show_report', {
        title: 'Upload your P&L first',
        subtitle: 'Drop your income statement here and I will build your report.',
        buttons: [{ label: 'Upload P&L', fn: 'claraPromptUpload()' }]
      });
    }
    const preset = action.preset && CLARA_VALID_PRESETS.includes(action.preset) ? action.preset : null;
    if (preset && typeof applyDashboardPreset === 'function') applyDashboardPreset(preset);
    if (typeof renderReport === 'function') renderReport(currentData);
    if (window.latestAIReport && typeof applyAIReport === 'function') {
      applyAIReport(window.latestAIReport, null, null);
    }
    const h = typeof calcHealthScore === 'function' ? calcHealthScore(currentData) : null;
    return buildClaraArtifact('show_report', {
      title: 'P&L report ready',
      subtitle: `${currentData.company || 'Your business'} · ${currentData.period || 'Current period'}${h != null ? ' · Health ' + h + '/100' : ''}`,
      buttons: [
        { label: 'View full report', page: 'analysis', navIndex: 2 },
        { label: 'Open deck', page: 'slides', navIndex: 4 }
      ]
    });
  }

  if (type === 'build_deck') {
    if (!hasFinancialData()) {
      return buildClaraArtifact('build_deck', {
        title: 'Need your P&L first',
        subtitle: 'Upload your income statement and I will build a CEO-ready deck.',
        buttons: [{ label: 'Upload P&L', fn: 'claraPromptUpload()' }]
      });
    }
    if (typeof buildDeck === 'function') buildDeck(currentData);
    if (typeof composeAndRenderDeck === 'function') composeAndRenderDeck();
    const slideCount = typeof deckSlideItems !== 'undefined' && deckSlideItems?.length ? deckSlideItems.length : 6;
    return buildClaraArtifact('build_deck', {
      title: 'Slide deck ready',
      subtitle: `${slideCount} slides with your real numbers`,
      buttons: [
        { label: 'Open deck', page: 'slides', navIndex: 4 },
        { label: 'Download PowerPoint', fn: 'exportDeckPowerPoint()' }
      ]
    });
  }

  if (type === 'show_deck') {
    if (!hasFinancialData()) {
      return buildClaraArtifact('show_deck', {
        title: 'No deck yet',
        subtitle: 'Upload a P&L and ask me to build your deck.',
        buttons: [{ label: 'Upload P&L', fn: 'claraPromptUpload()' }]
      });
    }
    if (typeof buildDeck === 'function') buildDeck(currentData);
    goPage('slides', getClaraNavLink(4));
    return buildClaraArtifact('show_deck', {
      title: 'Opening your deck',
      subtitle: `${currentData.company || 'Your business'} presentation`,
      buttons: [{ label: 'Download PowerPoint', fn: 'exportDeckPowerPoint()' }]
    });
  }

  if (type === 'show_health') {
    if (typeof renderHealthPage === 'function') renderHealthPage();
    goPage('health', getClaraNavLink(3));
    const entries = typeof loadCompanyStore === 'function' ? (loadCompanyStore().health?.entries?.length || 0) : 0;
    return buildClaraArtifact('show_health', {
      title: 'Health trends',
      subtitle: entries ? `${entries} month${entries === 1 ? '' : 's'} tracked` : 'Upload monthly P&Ls to build your history',
      buttons: [{ label: 'View health page', page: 'health', navIndex: 3 }]
    });
  }

  if (type === 'analyze') {
    if (!hasFinancialData()) {
      return buildClaraArtifact('analyze', {
        title: 'Upload a P&L first',
        subtitle: 'I need your numbers before I can run a full CFO analysis.',
        buttons: [{ label: 'Upload P&L', fn: 'claraPromptUpload()' }]
      });
    }
    if (typeof requestAIReport === 'function') requestAIReport(currentData);
    return buildClaraArtifact('analyze', {
      title: 'Running AI analysis',
      subtitle: 'Generating CFO insights from your numbers…',
      buttons: [{ label: 'View report', page: 'analysis', navIndex: 2 }]
    });
  }

  if (type === 'open_upload') {
    claraPromptUpload();
    return null;
  }

  return null;
}

function buildClaraArtifact(kind, { title, subtitle, buttons }) {
  return { kind, title, subtitle, buttons: buttons || [] };
}

function renderClaraArtifactCard(artifact) {
  if (!artifact) return '';
  const icon = artifact.kind === 'build_deck' || artifact.kind === 'show_deck' ? '📊'
    : artifact.kind === 'show_health' ? '📈'
    : artifact.kind === 'analyze' ? '✨'
    : artifact.kind === 'set_dashboard' ? '🎛️'
    : '📋';

  const btns = (artifact.buttons || []).map((btn, i) => {
    if (btn.fn) {
      return `<button type="button" class="clara-artifact-btn${i === 0 ? ' primary' : ''}" onclick="${btn.fn}">${escapeHtml(btn.label)}</button>`;
    }
    if (btn.page) {
      const idx = btn.navIndex != null ? btn.navIndex : 2;
      return `<button type="button" class="clara-artifact-btn${i === 0 ? ' primary' : ''}" onclick="goPage('${btn.page}', getClaraNavLink(${idx}))">${escapeHtml(btn.label)}</button>`;
    }
    return '';
  }).join('');

  return `<div class="clara-artifact">
    <div class="clara-artifact-icon" aria-hidden="true">${icon}</div>
    <div class="clara-artifact-body">
      <div class="clara-artifact-title">${escapeHtml(artifact.title)}</div>
      <div class="clara-artifact-sub">${escapeHtml(artifact.subtitle || '')}</div>
      ${btns ? `<div class="clara-artifact-actions">${btns}</div>` : ''}
    </div>
  </div>`;
}

function addClaraArtifactCards(artifacts) {
  if (!artifacts?.length) return;
  const msgs = document.getElementById('bot-msgs');
  if (!msgs) return;

  const el = document.createElement('div');
  el.className = 'bmsg b clara-artifact-msg';
  el.innerHTML = `<div class="bav clara-mini-av">${typeof claraMiniAvatarHtml === 'function' ? claraMiniAvatarHtml() : ''}</div>
    <div class="bbubble clara-artifact-stack">${artifacts.map(renderClaraArtifactCard).join('')}</div>`;
  msgs.appendChild(el);
  if (typeof bindClaraAvatarImage === 'function') {
    el.querySelectorAll('img[src*="clara-avatar"]').forEach(bindClaraAvatarImage);
  }
  msgs.scrollTop = msgs.scrollHeight;
}

function claraQuickAction(actionType, preset) {
  const action = { type: actionType };
  if (preset) action.preset = preset;
  const artifacts = runClaraActions([action]);
  if (artifacts.length) addClaraArtifactCards(artifacts);
}

function claraPromptUpload() {
  const input = document.getElementById('clara-file') || document.getElementById('analysis-file');
  if (input) {
    input.click();
    const strip = document.getElementById('clara-upload-strip');
    if (strip) {
      strip.classList.add('highlight');
      window.setTimeout(() => strip.classList.remove('highlight'), 1800);
    }
  }
}

function handleClaraFileUpload(event) {
  if (typeof canUploadAnalysis === 'function' && !canUploadAnalysis()) {
    if (event?.target) event.target.value = '';
    return;
  }
  const file = event?.target?.files?.[0];
  window.claraUploadPending = true;
  if (typeof ensureBotInit === 'function') ensureBotInit();
  if (file) {
    addUserMsg('Uploading ' + file.name);
    botHistory.push({ role: 'user', content: 'Uploading ' + file.name });
    if (typeof showTyping === 'function') showTyping();
  }
  if (typeof handleAnalysisFile === 'function') {
    handleAnalysisFile(event);
  }
}

function notifyClaraUploadComplete(data) {
  if (!data) return;
  ensureBotInit();
  if (typeof removeTyping === 'function') removeTyping();

  const h = typeof calcHealthScore === 'function' ? calcHealthScore(data) : null;
  const summary = `I parsed your P&L${data.company ? ' for ' + data.company : ''}${data.period ? ' (' + data.period + ')' : ''}. Revenue is ${typeof fc === 'function' ? fc(data.revenue) : data.revenue}, net income is ${typeof fc === 'function' ? fc(data.netIncome) : data.netIncome}${h != null ? ', and your health score is ' + h + '/100' : ''}.`;

  const artifacts = runClaraActions([
    { type: 'show_report', preset: 'owner' },
    { type: 'build_deck' }
  ]);

  const reply = summary + ' I built your report and slide deck. Ask me to focus the dashboard, explain any metric, or get you ready for a bank meeting.';
  botHistory.push({ role: 'assistant', content: reply });
  deliverClaraReply(reply);
  if (artifacts.length) window.setTimeout(() => addClaraArtifactCards(artifacts), 600);

  if (typeof requestAIReport === 'function') requestAIReport(data);
}

function initClaraWorkspaceDropzone() {
  const strip = document.getElementById('clara-upload-strip');
  if (!strip || strip.dataset.bound) return;
  strip.dataset.bound = '1';

  strip.addEventListener('dragover', e => {
    e.preventDefault();
    strip.classList.add('dragover');
  });
  strip.addEventListener('dragleave', () => strip.classList.remove('dragover'));
  strip.addEventListener('drop', e => {
    e.preventDefault();
    strip.classList.remove('dragover');
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    const input = document.getElementById('clara-file');
    if (!input) return;
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    handleClaraFileUpload({ target: input });
  });
}

function maybeOpenClaraWorkspace() {
  const onClara = document.getElementById('page-bot')?.classList.contains('active');
  if (onClara) return;
  const signedIn = typeof hasFullAccess === 'function' && hasFullAccess();
  const hasData = typeof loadCompanyStore === 'function' && loadCompanyStore().latest?.financials;
  if (signedIn || hasData) {
    goPage('bot', getClaraNavLink(1));
  }
}
