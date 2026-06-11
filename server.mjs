import { createReadStream, existsSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  authenticateRequest,
  authEnabled,
  loadCompanyData,
  saveCompanyData,
  signInUser,
  signUpUser
} from './auth.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(__dirname);
await loadEnvFile();
const port = Number(process.env.PORT || 3000);

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (req.method === 'POST' && url.pathname === '/api/analyze') {
      await handleAnalyze(req, res);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/chat') {
      await handleChat(req, res);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/voice/status') {
      handleVoiceStatus(res);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/tts') {
      await handleTts(req, res);
      return;
    }

    if (url.pathname.startsWith('/api/auth') || url.pathname.startsWith('/api/company')) {
      await handleAuthAndCompanyRoutes(req, res, url);
      return;
    }

    if (req.method === 'GET' || req.method === 'HEAD') {
      await serveStatic(url.pathname, req, res);
      return;
    }

    sendJson(res, 405, { error: 'Method not allowed' });
  } catch (error) {
    console.error(error);
    sendJson(res, error.statusCode || 500, { error: error.message || 'Unexpected server error' });
  }
});

server.listen(port, '0.0.0.0', () => {
  const url = `http://localhost:${port}`;
  console.log('');
  console.log('  MyCFOPro is running');
  console.log(`  Open in your browser: ${url}`);
  console.log('');
  if (process.env.OPEN_BROWSER !== '0') {
    openBrowser(url);
  }
  if (!process.env.SESSION_SECRET) {
    console.warn('Warning: SESSION_SECRET not set — using dev default. Set it in .env before production.');
  }
});

function openBrowser(url) {
  try {
    if (process.platform === 'win32') {
      spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
    } else if (process.platform === 'darwin') {
      spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
    } else {
      spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
    }
  } catch {
    console.log('  Could not open browser automatically — paste the link above into Chrome or Edge.');
  }
}

async function handleAuthAndCompanyRoutes(req, res, url) {
  if (req.method === 'GET' && url.pathname === '/api/auth/status') {
    sendJson(res, 200, { enabled: authEnabled(), cloudSync: true });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/signup') {
    const body = await readJsonBody(req);
    const result = await signUpUser(body || {});
    sendJson(res, 201, result);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/signin') {
    const body = await readJsonBody(req);
    const result = await signInUser(body || {});
    sendJson(res, 200, result);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/auth/me') {
    const user = await authenticateRequest(req);
    if (!user) {
      sendJson(res, 401, { error: 'Not signed in' });
      return;
    }
    sendJson(res, 200, { user });
    return;
  }

  if (url.pathname === '/api/company') {
    const user = await authenticateRequest(req);
    if (!user) {
      sendJson(res, 401, { error: 'Sign in required to sync company data' });
      return;
    }

    if (req.method === 'GET') {
      const store = await loadCompanyData(user.id);
      sendJson(res, 200, { store: store || null, user });
      return;
    }

    if (req.method === 'PUT') {
      const body = await readJsonBody(req);
      const saved = await saveCompanyData(user.id, body?.store);
      sendJson(res, 200, { store: saved, user });
      return;
    }
  }

  sendJson(res, 404, { error: 'Not found' });
}

async function handleAnalyze(req, res) {
  const body = await readJsonBody(req);
  const financials = body?.financials;

  if (!financials || typeof financials !== 'object') {
    sendJson(res, 400, { error: 'Missing financials payload' });
    return;
  }

  const prompt = `You are a senior CFO advisor for small businesses.

Analyze this normalized financial statement data and return ONLY valid JSON with this exact shape:
{
  "summary": "3-5 sentence executive CFO summary in plain English",
  "findings": [
    {"type":"good|warn|bad","text":"specific finding using the numbers"}
  ],
  "actions": [
    {"title":"short action title","description":"specific next step","impact":"optional financial or operational impact"}
  ],
  "questions": ["follow-up question the owner should answer"]
}

Rules:
- Be direct, practical, and owner-friendly.
- Use the provided numbers. Do not invent missing cash, AR, AP, debt, or tax details.
- Tailor the analysis to the statement type in the payload (income statement, balance sheet, cash flow, AR aging, or AP aging).
- Mention when P&L-only data limits cash-flow conclusions.
- Keep findings and actions specific to this business.
- Include the reminder that this is informational and not a substitute for a CPA when relevant.

Financial data:
${JSON.stringify(trimFinancials(financials), null, 2)}`;

  const ai = await callAiModel({
    system: 'You produce concise, valid JSON CFO analysis for small businesses.',
    messages: [{ role: 'user', content: prompt }],
    maxTokens: 1400
  });

  const parsed = parseJsonObject(ai.text);
  sendJson(res, 200, {
    provider: ai.provider,
    model: ai.model,
    report: normalizeReport(parsed)
  });
}

async function handleChat(req, res) {
  const body = await readJsonBody(req);
  const message = String(body?.message || '').trim();
  const financials = body?.financials && typeof body.financials === 'object' ? body.financials : null;
  const history = Array.isArray(body?.history) ? body.history.slice(-8) : [];
  const claraContext = String(body?.claraContext || '').trim();
  const healthSummary = String(body?.healthSummary || '').trim();
  const company = String(body?.company || '').trim();
  const aiReport = body?.aiReport && typeof body.aiReport === 'object' ? body.aiReport : null;

  if (!message) {
    sendJson(res, 400, { error: 'Missing chat message' });
    return;
  }

  const contextParts = [];
  if (company) contextParts.push(`Company: ${company}`);
  if (financials) {
    contextParts.push(`Current financial data:\n${JSON.stringify(trimFinancials(financials), null, 2)}`);
  } else {
    contextParts.push('No financial file has been uploaded yet. Answer generally and ask the owner to upload financials for specific guidance.');
  }
  if (healthSummary) contextParts.push(`Company Health tracking:\n${healthSummary}`);
  if (aiReport?.summary) contextParts.push(`Latest CFO report summary:\n${aiReport.summary.slice(0, 1200)}`);
  if (Array.isArray(aiReport?.actions) && aiReport.actions.length) {
    contextParts.push('Top recommended actions:\n' + aiReport.actions.slice(0, 4).map((a, i) => `${i + 1}. ${a.title || a.text || 'Action'}${a.description || a.desc ? ' — ' + (a.description || a.desc) : ''}`).join('\n'));
  }
  if (claraContext) contextParts.push(`Additional company memory:\n${claraContext.slice(0, 3500)}`);

  const ai = await callAiModel({
    system: `You are Clara, MyCFOPro's CFO Advisor for small businesses.
Be warm, direct, and practical. Explain financial concepts in plain English.
Use exact provided numbers when available. Reference month-over-month trends when health tracking data is present.
Do not invent missing data. Keep answers to 3-5 sentences unless the user asks for detail.
This is informational and not a substitute for a CPA or licensed advisor.`,
    messages: [
      { role: 'user', content: contextParts.join('\n\n') },
      ...history.map(item => ({
        role: item.role === 'assistant' ? 'assistant' : 'user',
        content: String(item.content || '').slice(0, 2000)
      })),
      { role: 'user', content: message }
    ],
    maxTokens: 700
  });

  sendJson(res, 200, {
    provider: ai.provider,
    model: ai.model,
    reply: ai.text.trim()
  });
}

function handleVoiceStatus(res) {
  const provider = getVoiceProvider();
  sendJson(res, 200, {
    provider: provider.id,
    label: provider.label,
    natural: provider.id !== 'browser'
  });
}

function getVoiceProvider() {
  if (process.env.ELEVENLABS_API_KEY) {
    return { id: 'elevenlabs', label: 'ElevenLabs natural voice' };
  }
  if (process.env.OPENAI_API_KEY) {
    return { id: 'openai', label: 'OpenAI natural voice' };
  }
  return { id: 'browser', label: 'Browser voice (add API key for natural speech)' };
}

async function handleTts(req, res) {
  const body = await readJsonBody(req);
  const text = String(body?.text || '').trim();

  if (!text) {
    sendJson(res, 400, { error: 'Missing text for speech synthesis' });
    return;
  }

  const input = text.slice(0, 4000);

  if (process.env.ELEVENLABS_API_KEY) {
    const audio = await synthesizeElevenLabs(input);
    sendAudio(res, 200, audio, 'elevenlabs');
    return;
  }

  if (process.env.OPENAI_API_KEY) {
    const audio = await synthesizeOpenAi(input);
    sendAudio(res, 200, audio, 'openai');
    return;
  }

  sendJson(res, 503, { error: 'No TTS provider configured. Add OPENAI_API_KEY or ELEVENLABS_API_KEY to .env' });
}

async function synthesizeOpenAi(text) {
  const model = process.env.OPENAI_TTS_MODEL || 'tts-1-hd';
  const voice = process.env.OPENAI_TTS_VOICE || 'nova';
  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model,
      voice,
      input: text,
      response_format: 'mp3',
      speed: 1.0
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI TTS failed: ${response.status} ${await response.text()}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function synthesizeElevenLabs(text) {
  const voiceId = process.env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL';
  const modelId = process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2';
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': process.env.ELEVENLABS_API_KEY,
      'content-type': 'application/json',
      accept: 'audio/mpeg'
    },
    body: JSON.stringify({
      text,
      model_id: modelId,
      voice_settings: {
        stability: 0.42,
        similarity_boost: 0.78,
        style: 0.35,
        use_speaker_boost: true
      }
    })
  });

  if (!response.ok) {
    throw new Error(`ElevenLabs TTS failed: ${response.status} ${await response.text()}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

function sendAudio(res, statusCode, buffer, provider) {
  res.writeHead(statusCode, {
    'content-type': 'audio/mpeg',
    'content-length': buffer.length,
    'x-voice-provider': provider,
    'cache-control': 'no-store'
  });
  res.end(buffer);
}

async function callAiModel({ system, messages, maxTokens }) {
  if (process.env.ANTHROPIC_API_KEY) {
    const model = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-latest';
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system,
        messages: messages.map(message => ({
          role: message.role === 'assistant' ? 'assistant' : 'user',
          content: message.content
        }))
      })
    });

    if (!response.ok) {
      throw new Error(`Anthropic request failed: ${response.status} ${await response.text()}`);
    }

    const json = await response.json();
    return {
      provider: 'anthropic',
      model,
      text: json.content?.map(part => part.text || '').join('\n').trim() || ''
    };
  }

  if (process.env.OPENAI_API_KEY) {
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: system },
          ...messages.map(message => ({
            role: message.role === 'assistant' ? 'assistant' : 'user',
            content: message.content
          }))
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI request failed: ${response.status} ${await response.text()}`);
    }

    const json = await response.json();
    return {
      provider: 'openai',
      model,
      text: json.choices?.[0]?.message?.content?.trim() || ''
    };
  }

  const error = new Error('AI provider is not configured');
  error.statusCode = 503;
  throw error;
}

function parseJsonObject(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('AI response did not include JSON');
    return JSON.parse(match[0]);
  }
}

function normalizeReport(value) {
  const report = value && typeof value === 'object' ? value : {};
  return {
    summary: String(report.summary || '').slice(0, 2500),
    findings: normalizeList(report.findings).slice(0, 6).map(item => ({
      type: ['good', 'warn', 'bad'].includes(item.type) ? item.type : 'warn',
      text: String(item.text || '').slice(0, 800)
    })),
    actions: normalizeList(report.actions).slice(0, 6).map(item => ({
      title: String(item.title || 'Recommended action').slice(0, 160),
      description: String(item.description || item.desc || '').slice(0, 900),
      impact: item.impact ? String(item.impact).slice(0, 300) : ''
    })),
    questions: normalizeList(report.questions).slice(0, 5).map(item => String(item).slice(0, 240))
  };
}

function normalizeList(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function trimFinancials(financials) {
  const pick = [
    'filename', 'company', 'period', 'statementType', 'revenue', 'cogs', 'grossProfit',
    'opex', 'opIncome', 'netIncome', 'grossMargin', 'netMargin',
    'opMargin', 'payroll', 'payrollPct', 'rent', 'marketing',
    'interestExpense', 'hasBalanceSheet', 'totalAssets', 'totalLiabilities',
    'totalEquity', 'currentAssets', 'currentLiabilities', 'cash',
    'accountsReceivable', 'accountsPayable', 'inventory', 'longTermDebt',
    'workingCapital', 'currentRatio', 'debtToEquity', 'operatingCashFlow',
    'investingCashFlow', 'financingCashFlow', 'netCashChange', 'beginningCash',
    'endingCash', 'totalBalance', 'overdueBalance', 'overduePct'
  ];

  const out = {};
  for (const key of pick) {
    if (financials[key] !== undefined) out[key] = financials[key];
  }

  out.serviceRevenue = trimItems(financials.serviceRevenue);
  out.serviceCogs = trimItems(financials.serviceCogs);
  out.expenseItems = trimItems(financials.expenseItems);
  out.assetItems = trimItems(financials.assetItems);
  out.liabilityItems = trimItems(financials.liabilityItems);
  out.operatingItems = trimItems(financials.operatingItems);
  out.topCounterparties = trimItems(financials.topCounterparties);
  if (financials.agingBuckets) out.agingBuckets = financials.agingBuckets;
  return out;
}

function trimItems(items) {
  return Array.isArray(items)
    ? items.slice(0, 20).map(item => ({
        name: String(item.name || item.label || '').slice(0, 120),
        val: Number(item.val || 0)
      }))
    : [];
}

async function serveStatic(pathname, req, res) {
  const safePath = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
  const relativePath = safePath === '/' || safePath === '.' ? 'index.html' : safePath.replace(/^[/\\]/, '');
  const filePath = resolve(root, relativePath);

  if (!filePath.startsWith(root)) {
    sendJson(res, 403, { error: 'Forbidden' });
    return;
  }

  const pathToServe = existsSync(filePath) && statSync(filePath).isDirectory()
    ? join(filePath, 'index.html')
    : filePath;

  if (!existsSync(pathToServe) || !statSync(pathToServe).isFile()) {
    sendJson(res, 404, { error: 'Not found' });
    return;
  }

  res.writeHead(200, {
    'content-type': contentTypes[extname(pathToServe)] || 'application/octet-stream'
  });

  if (req.method === 'HEAD') {
    res.end();
    return;
  }

  createReadStream(pathToServe).pipe(res);
}

async function readJsonBody(req) {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1_000_000) {
      const error = new Error('Request body too large');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }

  if (!chunks.length) return null;
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

process.on('uncaughtException', error => {
  console.error(error);
});

process.on('unhandledRejection', error => {
  console.error(error);
});

async function loadEnvFile() {
  const envPath = join(root, '.env');
  if (!existsSync(envPath)) return;

  const contents = await readFile(envPath, 'utf8');
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const equalsIndex = trimmed.indexOf('=');
    if (equalsIndex === -1) continue;

    const key = trimmed.slice(0, equalsIndex).trim();
    let value = trimmed.slice(equalsIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}
