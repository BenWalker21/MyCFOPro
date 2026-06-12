const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.compose';

function gmailConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
  return { clientId, clientSecret, configured: Boolean(clientId && clientSecret) };
}

export function isGmailConfigured() {
  return gmailConfig().configured;
}

export function buildGmailAuthUrl(state, redirectUri) {
  const { clientId } = gmailConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GMAIL_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    state
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeGmailCode(code, redirectUri) {
  const { clientId, clientSecret } = gmailConfig();
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret
  });
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body
  });
  if (!response.ok) {
    throw new Error(`Gmail token exchange failed: ${response.status} ${await response.text()}`);
  }
  const json = await response.json();
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: Date.now() + (json.expires_in || 3600) * 1000
  };
}

export async function refreshGmailToken(refreshToken) {
  const { clientId, clientSecret } = gmailConfig();
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret
  });
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body
  });
  if (!response.ok) {
    throw new Error(`Gmail token refresh failed: ${response.status} ${await response.text()}`);
  }
  const json = await response.json();
  return {
    accessToken: json.access_token,
    refreshToken: refreshToken,
    expiresAt: Date.now() + (json.expires_in || 3600) * 1000
  };
}

async function getValidGmailAccessToken(session, saveSession) {
  if (!session.gmail?.refreshToken && !session.gmail?.accessToken) {
    throw new Error('Gmail not connected');
  }
  if (session.gmail.expiresAt && session.gmail.expiresAt > Date.now() + 60_000) {
    return session.gmail.accessToken;
  }
  if (!session.gmail.refreshToken) {
    throw new Error('Gmail session expired — reconnect Gmail');
  }
  const tokens = await refreshGmailToken(session.gmail.refreshToken);
  session.gmail.accessToken = tokens.accessToken;
  session.gmail.expiresAt = tokens.expiresAt;
  await saveSession(session);
  return session.gmail.accessToken;
}

function encodeRfc822({ to, subject, body }) {
  const lines = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
    '',
    body
  ];
  return Buffer.from(lines.join('\r\n'))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function createGmailDraft(session, saveSession, { to, subject, body }) {
  const token = await getValidGmailAccessToken(session, saveSession);
  const raw = encodeRfc822({ to, subject, body });
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({ message: { raw } })
  });
  if (!response.ok) {
    throw new Error(`Gmail draft failed: ${response.status} ${await response.text()}`);
  }
  const json = await response.json();
  return { draftId: json.id, messageId: json.message?.id };
}
