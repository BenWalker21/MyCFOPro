import { randomUUID } from 'node:crypto';
import {
  getOrCreateSession,
  requireSession,
  saveSession,
  setSessionCookie,
  getCookieName
} from './session.mjs';
import {
  isQboConfigured,
  buildQboAuthUrl,
  exchangeQboCode,
  fetchOpenInvoices,
  fetchCustomersByIds,
  fetchCompanyInfo
} from './qbo.mjs';
import {
  isGmailConfigured,
  buildGmailAuthUrl,
  exchangeGmailCode,
  createGmailDraft
} from './gmail.mjs';
import { buildCollectionQueue, generateCollectionEmail } from './queue.mjs';

export async function handleCashQueueRoute(ctx) {
  const { req, res, url, sendJson, readJsonBody, callAiModel } = ctx;
  const path = url.pathname;

  if (path === '/api/cq/config' && req.method === 'GET') {
    sendJson(res, 200, {
      qboConfigured: isQboConfigured(),
      gmailConfigured: isGmailConfigured()
    });
    return true;
  }

  if (path === '/api/cq/status' && req.method === 'GET') {
    const session = await getOrCreateSession(req, res);
    sendJson(res, 200, {
      qboConnected: Boolean(session.qbo?.realmId),
      gmailConnected: Boolean(session.gmail?.refreshToken || session.gmail?.accessToken),
      companyName: session.qbo?.companyName || null,
      realmId: session.qbo?.realmId || null
    });
    return true;
  }

  if (path === '/api/cq/qbo/auth' && req.method === 'GET') {
    if (!isQboConfigured()) {
      sendJson(res, 503, { error: 'QuickBooks OAuth not configured. Set INTUIT_CLIENT_ID and INTUIT_CLIENT_SECRET in .env' });
      return true;
    }
    const session = await getOrCreateSession(req, res);
    const state = randomUUID();
    session.oauthState = { qbo: state, at: Date.now() };
    await saveSession(session);
    const redirectUri = `${getBaseUrl(ctx)}/api/cq/qbo/callback`;
    res.writeHead(302, { Location: buildQboAuthUrl(state, redirectUri) });
    res.end();
    return true;
  }

  if (path === '/api/cq/qbo/callback' && req.method === 'GET') {
    const session = await requireSession(req, res);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const realmId = url.searchParams.get('realmId');
    const error = url.searchParams.get('error');

    if (error || !code || !session) {
      redirectApp(res, ctx, 'qbo=error');
      return true;
    }
    if (session.oauthState?.qbo !== state) {
      redirectApp(res, ctx, 'qbo=state_mismatch');
      return true;
    }

    try {
      const redirectUri = `${getBaseUrl(ctx)}/api/cq/qbo/callback`;
      const tokens = await exchangeQboCode(code, redirectUri);
      session.qbo = {
        realmId,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        connectedAt: new Date().toISOString()
      };
      session.oauthState = null;
      try {
        session.qbo.companyName = await fetchCompanyInfo(session, saveSession);
      } catch {
        session.qbo.companyName = 'Connected company';
      }
      await saveSession(session);
      redirectApp(res, ctx, 'qbo=connected');
    } catch (e) {
      console.error('QBO callback error:', e);
      redirectApp(res, ctx, 'qbo=error');
    }
    return true;
  }

  if (path === '/api/cq/gmail/auth' && req.method === 'GET') {
    if (!isGmailConfigured()) {
      sendJson(res, 503, { error: 'Gmail OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env' });
      return true;
    }
    const session = await getOrCreateSession(req, res);
    const state = randomUUID();
    session.oauthState = { gmail: state, at: Date.now() };
    await saveSession(session);
    const redirectUri = `${getBaseUrl(ctx)}/api/cq/gmail/callback`;
    res.writeHead(302, { Location: buildGmailAuthUrl(state, redirectUri) });
    res.end();
    return true;
  }

  if (path === '/api/cq/gmail/callback' && req.method === 'GET') {
    const session = await requireSession(req, res);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    if (error || !code || !session) {
      redirectApp(res, ctx, 'gmail=error');
      return true;
    }
    if (session.oauthState?.gmail !== state) {
      redirectApp(res, ctx, 'gmail=state_mismatch');
      return true;
    }

    try {
      const redirectUri = `${getBaseUrl(ctx)}/api/cq/gmail/callback`;
      const tokens = await exchangeGmailCode(code, redirectUri);
      session.gmail = {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        connectedAt: new Date().toISOString()
      };
      session.oauthState = null;
      await saveSession(session);
      redirectApp(res, ctx, 'gmail=connected');
    } catch (e) {
      console.error('Gmail callback error:', e);
      redirectApp(res, ctx, 'gmail=error');
    }
    return true;
  }

  if (path === '/api/cq/queue' && req.method === 'GET') {
    const session = await requireSession(req, res);
    if (!session?.qbo?.realmId) {
      sendJson(res, 400, { error: 'Connect QuickBooks first' });
      return true;
    }
    try {
      const invoices = await fetchOpenInvoices(session, saveSession);
      const customerIds = invoices.map(inv => inv.CustomerRef?.value);
      const customersById = await fetchCustomersByIds(session, saveSession, customerIds);
      const queue = buildCollectionQueue(invoices, customersById);
      if (!session.qbo.companyName) {
        try {
          session.qbo.companyName = await fetchCompanyInfo(session, saveSession);
          await saveSession(session);
        } catch { /* ignore */ }
      }
      sendJson(res, 200, {
        companyName: session.qbo.companyName,
        ...queue
      });
    } catch (e) {
      console.error('Queue fetch error:', e);
      sendJson(res, 500, { error: e.message || 'Could not load queue from QuickBooks' });
    }
    return true;
  }

  if (path === '/api/cq/draft' && req.method === 'POST') {
    const session = await requireSession(req, res);
    if (!session) {
      sendJson(res, 401, { error: 'Session required' });
      return true;
    }
    const body = await readJsonBody(req);
    const invoiceId = String(body?.invoiceId || '');
    const createInGmail = body?.createInGmail !== false;

    if (!session.qbo?.realmId) {
      sendJson(res, 400, { error: 'Connect QuickBooks first' });
      return true;
    }

    try {
      const invoices = await fetchOpenInvoices(session, saveSession);
      const inv = invoices.find(i => String(i.Id) === invoiceId);
      if (!inv) {
        sendJson(res, 404, { error: 'Invoice not found in open balances' });
        return true;
      }
      const customersById = await fetchCustomersByIds(session, saveSession, [inv.CustomerRef?.value]);
      const item = buildCollectionQueue([inv], customersById).items[0];
      const companyName = session.qbo.companyName || 'Our team';
      const email = await generateCollectionEmail(item, companyName, callAiModel);

      if (!item.email) {
        sendJson(res, 400, {
          error: 'No email on file for this customer in QuickBooks. Add PrimaryEmailAddr in QBO.',
          draft: email,
          item
        });
        return true;
      }

      let gmailResult = null;
      if (createInGmail) {
        if (!session.gmail?.refreshToken && !session.gmail?.accessToken) {
          sendJson(res, 400, {
            error: 'Connect Gmail to create drafts',
            draft: email,
            item
          });
          return true;
        }
        gmailResult = await createGmailDraft(session, saveSession, {
          to: item.email,
          subject: email.subject,
          body: email.body
        });
      }

      sendJson(res, 200, {
        draft: email,
        item,
        gmail: gmailResult
      });
    } catch (e) {
      console.error('Draft error:', e);
      sendJson(res, 500, { error: e.message || 'Could not create draft' });
    }
    return true;
  }

  if (path === '/api/cq/draft-all' && req.method === 'POST') {
    const session = await requireSession(req, res);
    if (!session?.qbo?.realmId || !session.gmail) {
      sendJson(res, 400, { error: 'Connect QuickBooks and Gmail first' });
      return true;
    }
    const body = await readJsonBody(req);
    const limit = Math.min(Number(body?.limit) || 10, 25);

    try {
      const invoices = await fetchOpenInvoices(session, saveSession);
      const customersById = await fetchCustomersByIds(
        session,
        saveSession,
        invoices.map(i => i.CustomerRef?.value)
      );
      const { items } = buildCollectionQueue(invoices, customersById);
      const companyName = session.qbo.companyName || 'Our team';
      const results = [];

      for (const item of items.slice(0, limit)) {
        if (!item.email) {
          results.push({ invoiceId: item.invoiceId, ok: false, error: 'No customer email' });
          continue;
        }
        try {
          const email = await generateCollectionEmail(item, companyName, callAiModel);
          const gmail = await createGmailDraft(session, saveSession, {
            to: item.email,
            subject: email.subject,
            body: email.body
          });
          results.push({ invoiceId: item.invoiceId, ok: true, customerName: item.customerName, gmail });
        } catch (err) {
          results.push({ invoiceId: item.invoiceId, ok: false, error: err.message });
        }
      }

      sendJson(res, 200, {
        created: results.filter(r => r.ok).length,
        skipped: results.filter(r => !r.ok).length,
        results
      });
    } catch (e) {
      sendJson(res, 500, { error: e.message || 'Batch draft failed' });
    }
    return true;
  }

  return false;
}

function getBaseUrl(ctx) {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL.replace(/\/$/, '');
  const proto = ctx.req.headers['x-forwarded-proto'] || 'http';
  const host = ctx.req.headers.host || 'localhost:3000';
  return `${proto}://${host}`;
}

function redirectApp(res, ctx, query) {
  const base = getBaseUrl(ctx);
  res.writeHead(302, { Location: `${base}/collections/app/?${query}` });
  res.end();
}

export { getCookieName };
