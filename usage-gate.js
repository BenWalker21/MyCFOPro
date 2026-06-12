// ── USAGE GATE: 1 free analysis, account required for full access ─────
const FREE_ANALYSIS_KEY = 'mycfopro_free_analysis_used';

function hasUsedFreeAnalysis() {
  return localStorage.getItem(FREE_ANALYSIS_KEY) === '1';
}

function markFreeAnalysisUsed() {
  localStorage.setItem(FREE_ANALYSIS_KEY, '1');
}

function hasFullAccess() {
  return typeof isSignedIn === 'function' && isSignedIn();
}

function canUploadAnalysis() {
  if (hasFullAccess()) return true;
  if (!hasUsedFreeAnalysis()) return true;
  openAuthModal('signup');
  if (typeof showToast === 'function') {
    showToast('Create a free account to run more analyses and unlock the full CFO workspace.');
  }
  return false;
}

function canAccessPage(pageId) {
  if (hasFullAccess()) return true;
  if (pageId === 'home' || pageId === 'bot' || pageId === 'analysis') return true;
  return false;
}

function requireAccountForPage(pageId, btn) {
  if (canAccessPage(pageId)) return true;
  if (typeof showToast === 'function') {
    showToast('Sign in or create an account to access this feature.');
  }
  openAuthModal('signup');
  return false;
}

function requireAccountForFeature(featureLabel) {
  if (hasFullAccess()) return true;
  if (typeof showToast === 'function') {
    showToast(`Create an account to use ${featureLabel}.`);
  }
  openAuthModal('signup');
  return false;
}

function renderUsageGateBanner() {
  const el = document.getElementById('usage-gate-banner');
  if (!el) return;
  if (hasFullAccess()) {
    el.style.display = 'none';
    return;
  }
  el.style.display = 'flex';
  if (hasUsedFreeAnalysis()) {
    el.className = 'usage-gate-banner locked';
    el.innerHTML = `
      <span><strong>Account required.</strong> You have used your free P&amp;L preview. Create an account for unlimited uploads, health trends, your slide deck, and Clara.</span>
      <button class="btn-blue" style="font-size:12px;padding:7px 12px" onclick="openAuthModal('signup')">Create account</button>`;
  } else {
    el.className = 'usage-gate-banner trial';
    el.innerHTML = `
      <span><strong>Try one P&amp;L analysis free.</strong> Talk to Clara and upload your income statement — then create an account for unlimited uploads, health trends, and your deck.</span>
      <button class="btn-outline" style="font-size:12px;padding:7px 12px" onclick="openAuthModal('signup')">Create account</button>`;
  }
}
