const INTUIT_AUTH_URL = 'https://appcenter.intuit.com/connect/oauth2';
const INTUIT_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
const QBO_SCOPE = 'com.intuit.quickbooks.accounting';

function qboConfig() {
  const clientId = process.env.INTUIT_CLIENT_ID || '';
  const clientSecret = process.env.INTUIT_CLIENT_SECRET || '';
  const env = (process.env.INTUIT_ENVIRONMENT || 'sandbox').toLowerCase();
  return {
    clientId,
    clientSecret,
    configured: Boolean(clientId && clientSecret),
    apiBase: env === 'production'
      ? 'https://quickbooks.api.intuit.com/v3/company'
      : 'https://sandbox-quickbooks.api.intuit.com/v3/company'
  };
}

function basicAuthHeader(clientId, clientSecret) {
  return 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
}

export function isQboConfigured() {
  return qboConfig().configured;
}

export function buildQboAuthUrl(state, redirectUri) {
  const { clientId } = qboConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: QBO_SCOPE,
    state
  });
  return `${INTUIT_AUTH_URL}?${params.toString()}`;
}

export async function exchangeQboCode(code, redirectUri) {
  const { clientId, clientSecret } = qboConfig();
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri
  });
  const response = await fetch(INTUIT_TOKEN_URL, {
    method: 'POST',
    headers: {
      authorization: basicAuthHeader(clientId, clientSecret),
      'content-type': 'application/x-www-form-urlencoded',
      accept: 'application/json'
    },
    body
  });
  if (!response.ok) {
    throw new Error(`QuickBooks token exchange failed: ${response.status} ${await response.text()}`);
  }
  const json = await response.json();
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: Date.now() + (json.expires_in || 3600) * 1000
  };
}

export async function refreshQboToken(refreshToken) {
  const { clientId, clientSecret } = qboConfig();
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken
  });
  const response = await fetch(INTUIT_TOKEN_URL, {
    method: 'POST',
    headers: {
      authorization: basicAuthHeader(clientId, clientSecret),
      'content-type': 'application/x-www-form-urlencoded',
      accept: 'application/json'
    },
    body
  });
  if (!response.ok) {
    throw new Error(`QuickBooks token refresh failed: ${response.status} ${await response.text()}`);
  }
  const json = await response.json();
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token || refreshToken,
    expiresAt: Date.now() + (json.expires_in || 3600) * 1000
  };
}

async function getValidQboAccessToken(session, saveSession) {
  if (!session.qbo?.refreshToken) {
    throw new Error('QuickBooks not connected');
  }
  if (session.qbo.expiresAt && session.qbo.expiresAt > Date.now() + 60_000) {
    return session.qbo.accessToken;
  }
  const tokens = await refreshQboToken(session.qbo.refreshToken);
  session.qbo.accessToken = tokens.accessToken;
  session.qbo.refreshToken = tokens.refreshToken;
  session.qbo.expiresAt = tokens.expiresAt;
  await saveSession(session);
  return session.qbo.accessToken;
}

async function qboFetch(session, saveSession, path, query = '') {
  const token = await getValidQboAccessToken(session, saveSession);
  const { apiBase } = qboConfig();
  const realmId = session.qbo.realmId;
  const url = `${apiBase}/${realmId}${path}${query ? '?' + query : ''}`;
  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/json'
    }
  });
  if (!response.ok) {
    throw new Error(`QuickBooks API error: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

async function qboQuery(session, saveSession, sql) {
  const encoded = encodeURIComponent(sql);
  const json = await qboFetch(session, saveSession, '/query', `query=${encoded}&minorversion=65`);
  return json.QueryResponse || {};
}

export async function fetchCompanyInfo(session, saveSession) {
  const json = await qboFetch(session, saveSession, '/companyinfo/1');
  return json.CompanyInfo?.CompanyName || 'Your company';
}

export async function fetchOpenInvoices(session, saveSession) {
  const response = await qboQuery(
    session,
    saveSession,
    "SELECT * FROM Invoice WHERE Balance > '0' MAXRESULTS 100"
  );
  return response.Invoice || [];
}

export async function fetchCustomersByIds(session, saveSession, ids) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return {};
  const map = {};
  for (const id of unique.slice(0, 50)) {
    try {
      const response = await qboQuery(
        session,
        saveSession,
        `SELECT * FROM Customer WHERE Id = '${id}'`
      );
      const customer = response.Customer?.[0];
      if (customer) map[id] = customer;
    } catch {
      /* skip missing customer */
    }
  }
  return map;
}
