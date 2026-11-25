const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const pathModule = require('path');
const { MandateStore, PolicyError, sha256 } = require('./policy');

const MAX_BODY = 64 * 1024;
const RATE_WINDOW_MS = 60 * 1000;
const RATE_LIMIT = 60;

class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function send(res, status, body, extra = {}) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type, x-api-key, idempotency-key, x-request-id',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'cache-control': 'no-store',
    ...extra,
  });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > MAX_BODY) {
        reject(new HttpError(413, 'BODY_TOO_LARGE', 'request body exceeds 64 KB'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!data.trim()) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new HttpError(400, 'INVALID_JSON', 'request body must be valid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function createApp({ file, apiKey } = {}) {
  const store = new MandateStore(file);
  const plaintextKey = apiKey || process.env.PB_API_KEY || `pb_pilot_${crypto.randomBytes(16).toString('hex')}`;
  const keyHash = sha256(plaintextKey);
  const hits = new Map();

  function auth(req) {
    const provided = req.headers['x-api-key'];
    if (!provided || sha256(String(provided)) !== keyHash) {
      throw new HttpError(401, 'UNAUTHORIZED', 'missing or invalid x-api-key');
    }
  }

  function rateLimit() {
    const now = Date.now();
    const recent = (hits.get(keyHash) || []).filter((t) => now - t < RATE_WINDOW_MS);
    if (recent.length >= RATE_LIMIT) {
      throw new HttpError(429, 'RATE_LIMITED', '60 requests per minute exceeded');
    }
    recent.push(now);
    hits.set(keyHash, recent);
  }

  function idempotencyKey(req) {
    const key = req.headers['idempotency-key'];
    if (!key) throw new HttpError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'idempotency-key header is required');
    return `${keyHash}:${String(key)}`;
  }

  function getCached(idem) {
    const cached = store.state.idempotency[idem];
    if (!cached) return null;
    return cached;
  }

  function putCached(idem, status, body) {
    store.state.idempotency[idem] = { status, body, at: new Date().toISOString() };
    store.save();
  }

  async function handle(req, res) {
    if (req.method === 'OPTIONS') {
      send(res, 204, {});
      return;
    }

    const url = new URL(req.url, 'http://localhost');
    const path = url.pathname;

    if (req.method === 'GET' && path === '/health') {
      send(res, 200, { ok: true, version: 'pilot-1', now: new Date().toISOString() });
      return;
    }

    if (req.method === 'GET' && (path === '/' || path === '/console' || path === '/console.html')) {
      const file = pathModule.join(__dirname, 'console.html');
      if (!fs.existsSync(file)) {
        send(res, 404, { error: { code: 'CONSOLE_NOT_FOUND', message: 'console.html not found' } });
        return;
      }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      res.end(fs.readFileSync(file));
      return;
    }

    try {
      auth(req);
      rateLimit();

      if (req.method === 'POST' && path === '/v1/mandates') {
        const body = await readBody(req);
        const idem = idempotencyKey(req);
        const cached = getCached(idem);
        if (cached) return send(res, cached.status, cached.body);
        const mandate = store.createMandate(body);
        putCached(idem, 201, mandate);
        return send(res, 201, mandate);
      }

      if (req.method === 'GET' && path === '/v1/mandates') {
        const status = url.searchParams.get('status') || undefined;
        const limit = url.searchParams.get('limit') || 50;
        return send(res, 200, { mandates: store.listMandates({ status, limit }) });
      }

      const mandateMatch = path.match(/^\/v1\/mandates\/([^/]+)$/);
      if (req.method === 'GET' && mandateMatch) {
        return send(res, 200, store.publicMandate(store.getMandate(mandateMatch[1])));
      }

      const authorizeMatch = path.match(/^\/v1\/mandates\/([^/]+)\/authorize$/);
      if (req.method === 'POST' && authorizeMatch) {
        const body = await readBody(req);
        const idem = idempotencyKey(req);
        const cached = getCached(idem);
        if (cached) return send(res, cached.status, cached.body);
        const result = store.authorize(authorizeMatch[1], body);
        putCached(idem, 200, result);
        return send(res, 200, result);
      }

      const approveMatch = path.match(/^\/v1\/mandates\/([^/]+)\/approvals\/([^/]+)\/approve$/);
      if (req.method === 'POST' && approveMatch) {
        const body = await readBody(req);
        const idem = idempotencyKey(req);
        const cached = getCached(idem);
        if (cached) return send(res, cached.status, cached.body);
        const result = store.approve(approveMatch[1], approveMatch[2], body.approvedBy);
        putCached(idem, 200, result);
        return send(res, 200, result);
      }

      const denyMatch = path.match(/^\/v1\/mandates\/([^/]+)\/approvals\/([^/]+)\/deny$/);
      if (req.method === 'POST' && denyMatch) {
        const body = await readBody(req);
        const idem = idempotencyKey(req);
        const cached = getCached(idem);
        if (cached) return send(res, cached.status, cached.body);
        const result = store.deny(denyMatch[1], denyMatch[2], body.deniedBy, body.reason);
        putCached(idem, 200, result);
        return send(res, 200, result);
      }

      const revokeMatch = path.match(/^\/v1\/mandates\/([^/]+)\/revoke$/);
      if (req.method === 'POST' && revokeMatch) {
        const body = await readBody(req);
        const idem = idempotencyKey(req);
        const cached = getCached(idem);
        if (cached) return send(res, cached.status, cached.body);
        const result = store.revoke(revokeMatch[1], body.revokedBy);
        putCached(idem, 200, result);
        return send(res, 200, result);
      }

      const suspendMatch = path.match(/^\/v1\/mandates\/([^/]+)\/suspend$/);
      if (req.method === 'POST' && suspendMatch) {
        const body = await readBody(req);
        const idem = idempotencyKey(req);
        const cached = getCached(idem);
        if (cached) return send(res, cached.status, cached.body);
        const result = store.suspend(suspendMatch[1], body.suspendedBy);
        putCached(idem, 200, result);
        return send(res, 200, result);
      }

      const reactivateMatch = path.match(/^\/v1\/mandates\/([^/]+)\/reactivate$/);
      if (req.method === 'POST' && reactivateMatch) {
        const body = await readBody(req);
        const idem = idempotencyKey(req);
        const cached = getCached(idem);
        if (cached) return send(res, cached.status, cached.body);
        const result = store.reactivate(reactivateMatch[1], body.reactivatedBy);
        putCached(idem, 200, result);
        return send(res, 200, result);
      }

      const settleMatch = path.match(/^\/v1\/mandates\/([^/]+)\/settlements$/);
      if (req.method === 'POST' && settleMatch) {
        const body = await readBody(req);
        const idem = idempotencyKey(req);
        const cached = getCached(idem);
        if (cached) return send(res, cached.status, cached.body);
        const result = store.settle(settleMatch[1], body);
        putCached(idem, 200, result);
        return send(res, 200, result);
      }

      const auditMatch = path.match(/^\/v1\/mandates\/([^/]+)\/audit$/);
      if (req.method === 'GET' && auditMatch) {
        const limit = url.searchParams.get('limit') || 100;
        return send(res, 200, { events: store.audit(auditMatch[1], { limit }) });
      }

      const verifyMatch = path.match(/^\/v1\/mandates\/([^/]+)\/audit\/verify$/);
      if (req.method === 'GET' && verifyMatch) {
        return send(res, 200, store.verifyAudit(verifyMatch[1]));
      }

      const intentsMatch = path.match(/^\/v1\/mandates\/([^/]+)\/intents$/);
      if (req.method === 'GET' && intentsMatch) {
        store.getMandate(intentsMatch[1]);
        const intents = Object.values(store.state.intents)
          .filter((i) => i.mandateId === intentsMatch[1])
          .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
          .map((i) => store.publicIntent(i));
        return send(res, 200, { intents });
      }

      if (req.method === 'GET' && path === '/v1/summary') {
        const mandates = Object.values(store.state.mandates);
        const intents = Object.values(store.state.intents);
        const settlements = mandates.flatMap((m) => m.settlements);
        return send(res, 200, {
          mandates: mandates.length,
          activeMandates: mandates.filter((m) => m.status === 'active').length,
          pendingApprovals: intents.filter((i) => i.status === 'pending_approval').length,
          blocked: intents.filter((i) => i.status === 'blocked').length,
          settled: settlements.length,
          settledUmec: settlements.reduce((sum, s) => sum + s.amountUmec, 0),
        });
      }

      throw new HttpError(404, 'NOT_FOUND', 'route not found');
    } catch (error) {
      if (error instanceof HttpError) {
        return send(res, error.status, { error: { code: error.code, message: error.message } });
      }
      if (error instanceof PolicyError) {
        return send(res, error.status, { error: { code: error.code, message: error.message } });
      }
      console.error(error);
      return send(res, 500, { error: { code: 'INTERNAL_ERROR', message: 'internal error' } });
    }
  }

  const server = http.createServer((req, res) => {
    handle(req, res).catch((error) => {
      console.error(error);
      send(res, 500, { error: { code: 'INTERNAL_ERROR', message: 'internal error' } });
    });
  });

  return { server, store, apiKey: plaintextKey };
}

if (require.main === module) {
  const port = Number(process.env.PORT || 8790);
  const file = process.env.PB_STATE_FILE || require('path').join(__dirname, 'data', 'pilot-state.json');
  const app = createApp({ file });
  app.server.listen(port, () => {
    console.log(`Protocol Bank pilot API on http://localhost:${port}`);
    console.log(`API key: ${app.apiKey}`);
    console.log('Set PB_API_KEY to use a fixed key. Do not commit the key.');
  });
}

module.exports = { createApp, HttpError };
