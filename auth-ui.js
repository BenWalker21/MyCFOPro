// ── AUTH + CLOUD SYNC ───────────────────────────────────────────────
const AUTH_TOKEN_KEY = 'mycfopro_auth_token';
const AUTH_USER_KEY = 'mycfopro_auth_user';

let authUser = null;
let authToken = null;
let authEnabledFlag = false;
let cloudSyncTimer = null;
let cloudSyncStatus = 'idle';
let cloudSyncError = '';

async function readApiError(res, fallback) {
  try {
    const json = await res.json();
    return json.error || fallback;
  } catch {
    return fallback;
  }
}

function handleAuthFailure(message) {
  cloudSyncError = message;
  cloudSyncStatus = 'error';
  if (/sign in|session|unauthorized|expired/i.test(message)) {
    setAuthSession(null, null);
  }
  renderCloudSyncBanner();
}

function getAuthToken() {
  return authToken || localStorage.getItem(AUTH_TOKEN_KEY) || '';
}

function setAuthSession(user, token) {
  authUser = user;
  authToken = token;
  if (token) localStorage.setItem(AUTH_TOKEN_KEY, token);
  else localStorage.removeItem(AUTH_TOKEN_KEY);
  if (user) localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(AUTH_USER_KEY);
  updateAuthNav();
  renderCloudSyncBanner();
}

function loadAuthSessionFromStorage() {
  authToken = localStorage.getItem(AUTH_TOKEN_KEY);
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    authUser = raw ? JSON.parse(raw) : null;
  } catch {
    authUser = null;
  }
}

async function initAuth() {
  loadAuthSessionFromStorage();
  updateAuthNav();

  try {
    const res = await fetch('/api/auth/status');
    if (res.ok) {
      const json = await res.json();
      authEnabledFlag = !!json.enabled;
    }
  } catch {
    authEnabledFlag = false;
  }

  if (!authEnabledFlag) return;

  if (authToken) {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: 'Bearer ' + authToken }
      });
      if (res.ok) {
        const json = await res.json();
        setAuthSession(json.user, authToken);
        await pullCompanyFromCloud(true);
        return;
      }
    } catch { /* fall through */ }
    setAuthSession(null, null);
  }

  renderCloudSyncBanner();
}

function isSignedIn() {
  return !!(authUser && authToken);
}

function openAuthModal(mode) {
  const modal = document.getElementById('auth-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  setAuthTab(mode || 'signin');
  document.getElementById('auth-error').textContent = '';
}

function closeAuthModal() {
  const modal = document.getElementById('auth-modal');
  if (modal) modal.style.display = 'none';
}

function setAuthTab(mode) {
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.mode === mode);
  });
  document.getElementById('auth-signin-panel').style.display = mode === 'signin' ? 'block' : 'none';
  document.getElementById('auth-signup-panel').style.display = mode === 'signup' ? 'block' : 'none';
}

async function submitSignIn(event) {
  event.preventDefault();
  const email = document.getElementById('auth-signin-email').value.trim();
  const password = document.getElementById('auth-signin-password').value;
  const errEl = document.getElementById('auth-error');
  errEl.textContent = '';

  try {
    const res = await fetch('/api/auth/signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Sign in failed');

    setAuthSession(json.user, json.token);
    closeAuthModal();
    await pullCompanyFromCloud(true);
    if (typeof hydrateAppFromStore === 'function') hydrateAppFromStore();
    if (typeof showToast === 'function') showToast('Signed in — your workspace is syncing to the cloud.');
  } catch (error) {
    errEl.textContent = error.message;
  }
}

async function submitSignUp(event) {
  event.preventDefault();
  const name = document.getElementById('auth-signup-name').value.trim();
  const email = document.getElementById('auth-signup-email').value.trim();
  const password = document.getElementById('auth-signup-password').value;
  const errEl = document.getElementById('auth-error');
  errEl.textContent = '';

  try {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name })
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Sign up failed');

    setAuthSession(json.user, json.token);
    closeAuthModal();
    await pushCompanyToCloud(true);
    if (typeof hydrateAppFromStore === 'function') hydrateAppFromStore();
    if (typeof showToast === 'function') {
      showToast('Account created — you are signed in. No email confirmation needed.');
    }
  } catch (error) {
    errEl.textContent = error.message;
  }
}

async function signOut() {
  setAuthSession(null, null);
  renderCloudSyncBanner();
  if (typeof renderConnectedFlowPanel === 'function') renderConnectedFlowPanel();
}

function updateAuthNav() {
  const signedOut = document.getElementById('auth-nav-signed-out');
  const signedIn = document.getElementById('auth-nav-signed-in');
  const emailEl = document.getElementById('auth-nav-email');
  if (!signedOut || !signedIn) return;

  if (isSignedIn()) {
    signedOut.style.display = 'none';
    signedIn.style.display = 'flex';
    if (emailEl) emailEl.textContent = authUser.email;
  } else {
    signedOut.style.display = 'flex';
    signedIn.style.display = 'none';
  }
}

function mergeCompanyStores(localStore, cloudStore) {
  if (!cloudStore) return localStore;
  if (!localStore?.latest?.financials) return cloudStore;
  if (!cloudStore?.latest?.financials) return localStore;

  const localTime = Date.parse(localStore.lastUpdated || 0);
  const cloudTime = Date.parse(cloudStore.lastUpdated || 0);
  const localMonths = localStore.health?.entries?.length || 0;
  const cloudMonths = cloudStore.health?.entries?.length || 0;

  if (cloudTime > localTime || cloudMonths > localMonths) return cloudStore;
  return localStore;
}

async function pullCompanyFromCloud(mergeLocal) {
  if (!isSignedIn()) return;
  cloudSyncStatus = 'syncing';
  cloudSyncError = '';
  renderCloudSyncBanner();

  try {
    const res = await fetch('/api/company', {
      headers: { Authorization: 'Bearer ' + getAuthToken() }
    });
    if (res.status === 401) {
      handleAuthFailure('Session expired — please sign in again.');
      return;
    }
    if (!res.ok) throw new Error(await readApiError(res, 'Could not load cloud data'));

    const json = await res.json();

    if (json.store) {
      const local = typeof loadCompanyStore === 'function' ? loadCompanyStore() : null;
      const merged = mergeLocal ? mergeCompanyStores(local, json.store) : json.store;
      if (typeof applyCompanyStoreFromCloud === 'function') applyCompanyStoreFromCloud(merged);
      if (mergeLocal && merged === local && local?.latest?.financials) {
        await pushCompanyToCloud(true);
        return;
      }
    } else if (mergeLocal && typeof loadCompanyStore === 'function') {
      const local = loadCompanyStore();
      if (local?.latest?.financials) {
        await pushCompanyToCloud(true);
        return;
      }
    }

    cloudSyncStatus = 'synced';
    cloudSyncError = '';
  } catch (error) {
    console.warn('Cloud pull failed:', error);
    cloudSyncStatus = 'error';
    cloudSyncError = error.message || 'Could not sync from cloud';
  }
  renderCloudSyncBanner();
}

async function pushCompanyToCloud(immediate) {
  if (!isSignedIn()) return;
  if (!immediate) {
    if (cloudSyncTimer) clearTimeout(cloudSyncTimer);
    cloudSyncTimer = setTimeout(() => pushCompanyToCloud(true), 800);
    return;
  }

  cloudSyncStatus = 'syncing';
  cloudSyncError = '';
  renderCloudSyncBanner();

  try {
    const store = typeof loadCompanyStore === 'function' ? loadCompanyStore() : null;
    const res = await fetch('/api/company', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + getAuthToken()
      },
      body: JSON.stringify({ store })
    });
    if (res.status === 401) {
      handleAuthFailure('Session expired — please sign in again.');
      return;
    }
    if (!res.ok) throw new Error(await readApiError(res, 'Cloud save failed'));
    cloudSyncStatus = 'synced';
    cloudSyncError = '';
  } catch (error) {
    console.warn('Cloud push failed:', error);
    cloudSyncStatus = 'error';
    cloudSyncError = error.message || 'Cloud save failed';
  }
  renderCloudSyncBanner();
}

function renderCloudSyncBanner() {
  const el = document.getElementById('cloud-sync-banner');
  if (!el) return;

  if (!authEnabledFlag) {
    el.style.display = 'none';
    return;
  }

  if (!isSignedIn()) {
    const hasLocal = typeof loadCompanyStore === 'function' && loadCompanyStore()?.latest?.financials;
    if (!hasLocal) {
      el.style.display = 'none';
      return;
    }
    el.style.display = 'flex';
    el.className = 'cloud-sync-banner prompt';
    el.innerHTML = `
      <span><strong>Save your CFO workspace</strong> — create a free account to sync reports, health history, and deck across devices.</span>
      <button class="btn-blue" style="font-size:12px;padding:7px 12px" onclick="openAuthModal('signup')">Create account</button>
      <button class="btn-outline" style="font-size:12px;padding:7px 12px" onclick="openAuthModal('signin')">Sign in</button>`;
    return;
  }

  el.style.display = 'flex';
  const labels = {
    idle: 'Signed in · cloud sync ready',
    syncing: 'Syncing to cloud…',
    synced: 'Saved to cloud',
    error: cloudSyncError || 'Cloud sync issue — saved locally on this device'
  };
  el.className = 'cloud-sync-banner ' + (cloudSyncStatus === 'error' ? 'error' : 'synced');
  const retryBtn = cloudSyncStatus === 'error'
    ? `<button class="btn-outline" style="font-size:12px;padding:7px 12px" onclick="retryCloudSync()">Retry sync</button>`
    : '';
  el.innerHTML = `<span>● ${labels[cloudSyncStatus] || labels.idle} · ${escapeHtml(authUser.email)}</span>${retryBtn}`;
}

async function retryCloudSync() {
  if (!isSignedIn()) return;
  await pullCompanyFromCloud(true);
  if (cloudSyncStatus === 'error') return;
  const local = typeof loadCompanyStore === 'function' ? loadCompanyStore() : null;
  if (local) await pushCompanyToCloud(true);
}

function applyCompanyStoreFromCloud(store) {
  if (!store) return;
  companyStore = store;
  if (typeof normalizeCompanyStore === 'function') normalizeCompanyStore();
  localStorage.setItem('mycfopro_company_v1', JSON.stringify(companyStore));
}
