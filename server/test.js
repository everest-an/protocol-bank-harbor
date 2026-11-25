const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { MandateStore, PolicyError } = require('./policy');
const { createApp } = require('./index');

function tempFile() {
  const dir = path.join(os.tmpdir(), 'protocol-bank-pilot-tests');
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `state-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
}

function store() {
  return new MandateStore(tempFile());
}

function baseMandate(overrides = {}) {
  return {
    meId: '2611229468093',
    agentId: 'agent-data-01',
    vendors: [
      {
        address: 'me1rnrprnaqmmds6jfdmtxasn03se4j52j6kf8qge',
        name: 'Demo Data Vendor',
        category: 'data',
        kybStatus: 'approved',
      },
    ],
    perTxCapUmec: 20_000,
    dailyCapUmec: 40_000,
    monthlyCapUmec: 200_000,
    approvalThresholdUmec: 12_000,
    allowedCategories: ['data', 'api'],
    expiryDays: 30,
    ...overrides,
  };
}

function authorize(store, mandateId, amountUmec = 10_000, extra = {}) {
  return store.authorize(mandateId, {
    agentId: 'agent-data-01',
    vendor: 'me1rnrprnaqmmds6jfdmtxasn03se4j52j6kf8qge',
    amountUmec,
    receiptHash: `sha256:test-${amountUmec}`,
    category: 'data',
    ...extra,
  });
}

test('approve within cap, block over cap, require approval, settle', () => {
  const s = store();
  const m = s.createMandate(baseMandate());

  const ok = authorize(s, m.id, 10_000);
  assert.equal(ok.status, 'approved');
  assert.ok(ok.intentId);
  assert.match(ok.memo, /PB\|meid:2611229468093/);

  const blocked = authorize(s, m.id, 50_000);
  assert.equal(blocked.status, 'blocked');
  assert.equal(blocked.code, 'PER_TX_CAP');

  const pending = authorize(s, m.id, 15_000);
  assert.equal(pending.status, 'pending_approval');
  assert.equal(pending.code, 'APPROVAL_REQUIRED');

  const approved = s.approve(m.id, pending.intentId, 'human:2611229468093');
  assert.equal(approved.status, 'approved');
  assert.equal(approved.approvedBy, 'human:2611229468093');

  const settled = s.settle(m.id, { intentId: ok.intentId, txHash: 'TX-1', adapter: 'me-testnet' });
  assert.equal(settled.status, 'settled');
  assert.equal(settled.txHash, 'TX-1');

  assert.throws(
    () => s.settle(m.id, { intentId: ok.intentId, txHash: 'TX-2', adapter: 'me-testnet' }),
    (err) => err instanceof PolicyError && err.code === 'INTENT_ALREADY_SETTLED',
  );
});

test('revoke blocks all later requests and invalidates open intents', () => {
  const s = store();
  const m = s.createMandate(baseMandate());
  const approved = authorize(s, m.id, 10_000);
  s.revoke(m.id, 'human:2611229468093');

  const blocked = authorize(s, m.id, 1_000);
  assert.equal(blocked.status, 'blocked');
  assert.equal(blocked.code, 'MANDATE_NOT_ACTIVE');

  assert.throws(
    () => s.settle(m.id, { intentId: approved.intentId, txHash: 'TX-REVOKED', adapter: 'me-testnet' }),
    (err) => err instanceof PolicyError && err.code === 'INTENT_NOT_APPROVED',
  );
});

test('daily cap is enforced after settlement', () => {
  const s = store();
  const m = s.createMandate(baseMandate({ perTxCapUmec: 10_000, dailyCapUmec: 15_000, monthlyCapUmec: 100_000, approvalThresholdUmec: 0 }));
  const first = authorize(s, m.id, 10_000);
  assert.equal(first.status, 'approved');
  s.settle(m.id, { intentId: first.intentId, txHash: 'TX-DAILY-1', adapter: 'me-testnet' });
  const second = authorize(s, m.id, 10_000);
  assert.equal(second.status, 'blocked');
  assert.equal(second.code, 'DAILY_CAP');
});

test('vendor KYB and category are enforced', () => {
  const s = store();
  const m = s.createMandate(baseMandate({
    vendors: [{ address: 'me1rnrprnaqmmds6jfdmtxasn03se4j52j6kf8qge', name: 'Pending Vendor', category: 'data', kybStatus: 'pending' }],
  }));
  const kycBlocked = authorize(s, m.id, 10_000);
  assert.equal(kycBlocked.status, 'blocked');
  assert.equal(kycBlocked.code, 'VENDOR_KYB_REQUIRED');

  const s2 = store();
  const m2 = s2.createMandate(baseMandate({ allowedCategories: ['api'] }));
  const categoryBlocked = authorize(s2, m2.id, 10_000);
  assert.equal(categoryBlocked.status, 'blocked');
  assert.equal(categoryBlocked.code, 'CATEGORY_NOT_ALLOWED');
});

test('time window handles UTC day and overnight windows', () => {
  const s = store();
  const m = s.createMandate(baseMandate({ allowedHours: { start: 9, end: 17, timezone: 'UTC' } }));
  assert.equal(s.checkTimeWindow(m, new Date('2026-11-25T12:00:00Z')), true);
  assert.equal(s.checkTimeWindow(m, new Date('2026-11-25T18:00:00Z')), false);

  const overnight = s.createMandate(baseMandate({ allowedHours: { start: 22, end: 6, timezone: 'UTC' } }));
  assert.equal(s.checkTimeWindow(overnight, new Date('2026-11-25T23:00:00Z')), true);
  assert.equal(s.checkTimeWindow(overnight, new Date('2026-11-25T02:00:00Z')), true);
  assert.equal(s.checkTimeWindow(overnight, new Date('2026-11-25T12:00:00Z')), false);
});

test('audit hash chain verifies', () => {
  const s = store();
  const m = s.createMandate(baseMandate());
  authorize(s, m.id, 10_000);
  authorize(s, m.id, 50_000);
  const verify = s.verifyAudit(m.id);
  assert.equal(verify.valid, true);
  assert.ok(verify.events >= 3);
});

test('HTTP API requires auth, supports idempotency', async () => {
  const file = tempFile();
  const app = createApp({ file, apiKey: 'pb_test_key' });
  await new Promise((resolve) => app.server.listen(0, resolve));
  const port = app.server.address().port;
  const base = `http://127.0.0.1:${port}`;

  try {
    const health = await fetch(`${base}/health`);
    assert.equal(health.status, 200);

    const noAuth = await fetch(`${base}/v1/mandates`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(baseMandate()) });
    assert.equal(noAuth.status, 401);

    const create = await fetch(`${base}/v1/mandates`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': 'pb_test_key', 'idempotency-key': 'create-1' },
      body: JSON.stringify(baseMandate()),
    });
    assert.equal(create.status, 201);
    const mandate = await create.json();

    const replay = await fetch(`${base}/v1/mandates`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': 'pb_test_key', 'idempotency-key': 'create-1' },
      body: JSON.stringify(baseMandate()),
    });
    assert.equal(replay.status, 201);
    const replayBody = await replay.json();
    assert.equal(replayBody.id, mandate.id);

    const auth = await fetch(`${base}/v1/mandates/${mandate.id}/authorize`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': 'pb_test_key', 'idempotency-key': 'auth-1' },
      body: JSON.stringify({ agentId: 'agent-data-01', vendor: 'me1rnrprnaqmmds6jfdmtxasn03se4j52j6kf8qge', amountUmec: 10_000, category: 'data' }),
    });
    assert.equal(auth.status, 200);
    const authBody = await auth.json();
    assert.equal(authBody.status, 'approved');

    const audit = await fetch(`${base}/v1/mandates/${mandate.id}/audit`, { headers: { 'x-api-key': 'pb_test_key' } });
    assert.equal(audit.status, 200);
    const auditBody = await audit.json();
    assert.ok(auditBody.events.length >= 2);

    const verify = await fetch(`${base}/v1/mandates/${mandate.id}/audit/verify`, { headers: { 'x-api-key': 'pb_test_key' } });
    assert.equal(verify.status, 200);
    assert.equal((await verify.json()).valid, true);
  } finally {
    await new Promise((resolve) => app.server.close(resolve));
  }
});
