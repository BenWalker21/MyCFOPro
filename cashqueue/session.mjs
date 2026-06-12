import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';

const DATA_DIR = join(process.cwd(), 'data', 'cashqueue');
const COOKIE_NAME = 'cq_session';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 90;

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function sessionPath(id) {
  return join(DATA_DIR, `${id}.json`);
}

export function getCookieName() {
  return COOKIE_NAME;
}

export function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  header.split(';').forEach(part => {
    const [k, ...rest] = part.trim().split('=');
    if (k) out[k] = decodeURIComponent(rest.join('='));
  });
  return out;
}

export function setSessionCookie(res, sessionId) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}${secure}`);
}

export async function getOrCreateSession(req, res) {
  ensureDir();
  const cookies = parseCookies(req);
  let id = cookies[COOKIE_NAME];
  if (id && existsSync(sessionPath(id))) {
    return loadSession(id);
  }
  id = randomUUID();
  const session = createEmptySession(id);
  await saveSession(session);
  setSessionCookie(res, id);
  return session;
}

export async function loadSession(id) {
  ensureDir();
  try {
    const raw = await readFile(sessionPath(id), 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function saveSession(session) {
  ensureDir();
  session.updatedAt = new Date().toISOString();
  const path = sessionPath(session.id);
  const temp = `${path}.tmp-${process.pid}`;
  await writeFile(temp, JSON.stringify(session, null, 2));
  await rename(temp, path);
}

function createEmptySession(id) {
  return {
    id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    oauthState: null,
    qbo: null,
    gmail: null
  };
}

export async function updateSession(sessionId, patch) {
  const session = await loadSession(sessionId);
  if (!session) return null;
  Object.assign(session, patch);
  await saveSession(session);
  return session;
}

export async function requireSession(req, res) {
  const cookies = parseCookies(req);
  const id = cookies[COOKIE_NAME];
  if (!id) return null;
  const session = await loadSession(id);
  if (!session) return null;
  return session;
}
