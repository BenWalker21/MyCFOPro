import { randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SignJWT, jwtVerify } from 'jose';

const USERS_FILE = join(process.cwd(), 'data', 'users.json');
const COMPANIES_DIR = join(process.cwd(), 'data', 'companies');

function ensureDataDirs() {
  mkdirSync(join(process.cwd(), 'data', 'companies'), { recursive: true });
  if (!existsSync(USERS_FILE)) {
    writeFileSync(USERS_FILE, JSON.stringify({ users: [] }, null, 2));
  }
}

ensureDataDirs();

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET || 'mycfopro-dev-secret-change-in-production';
  return new TextEncoder().encode(secret);
}

function hashPassword(password) {
  const salt = randomUUID();
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  const attempt = scryptSync(password, salt, 64).toString('hex');
  try {
    return timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(attempt, 'hex'));
  } catch {
    return false;
  }
}

async function readUsersFile() {
  ensureDataDirs();
  const raw = await readFile(USERS_FILE, 'utf8');
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed.users) ? parsed : { users: [] };
}

async function writeUsersFile(data) {
  ensureDataDirs();
  await writeFile(USERS_FILE, JSON.stringify(data, null, 2));
}

export async function signUpUser({ email, password, name }) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const pwd = String(password || '');

  if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    const error = new Error('Valid email is required');
    error.statusCode = 400;
    throw error;
  }
  if (pwd.length < 8) {
    const error = new Error('Password must be at least 8 characters');
    error.statusCode = 400;
    throw error;
  }

  const db = await readUsersFile();
  if (db.users.some(u => u.email === normalizedEmail)) {
    const error = new Error('An account with this email already exists');
    error.statusCode = 409;
    throw error;
  }

  const user = {
    id: randomUUID(),
    email: normalizedEmail,
    name: String(name || '').trim() || normalizedEmail.split('@')[0],
    passwordHash: hashPassword(pwd),
    createdAt: new Date().toISOString()
  };

  db.users.push(user);
  await writeUsersFile(db);

  const token = await createSessionToken(user);
  return { user: publicUser(user), token };
}

export async function signInUser({ email, password }) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const pwd = String(password || '');

  const db = await readUsersFile();
  const user = db.users.find(u => u.email === normalizedEmail);
  if (!user || !verifyPassword(pwd, user.passwordHash)) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    throw error;
  }

  const token = await createSessionToken(user);
  return { user: publicUser(user), token };
}

async function createSessionToken(user) {
  return new SignJWT({ sub: user.id, email: user.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(getSessionSecret());
}

export async function verifySessionToken(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSessionSecret());
    const db = await readUsersFile();
    const user = db.users.find(u => u.id === payload.sub);
    return user ? publicUser(user) : null;
  } catch {
    return null;
  }
}

export async function authenticateRequest(req) {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  return verifySessionToken(match[1].trim());
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt
  };
}

function companyPath(userId) {
  return join(COMPANIES_DIR, `${userId}.json`);
}

export async function loadCompanyData(userId) {
  ensureDataDirs();
  const path = companyPath(userId);
  if (!existsSync(path)) return null;
  const raw = await readFile(path, 'utf8');
  return JSON.parse(raw);
}

export async function saveCompanyData(userId, store) {
  ensureDataDirs();
  if (!store || typeof store !== 'object') {
    const error = new Error('Invalid company data');
    error.statusCode = 400;
    throw error;
  }
  const payload = {
    ...store,
    lastUpdated: new Date().toISOString(),
    cloudSyncedAt: new Date().toISOString()
  };
  await writeFile(companyPath(userId), JSON.stringify(payload, null, 2));
  return payload;
}

export function authEnabled() {
  return true;
}
