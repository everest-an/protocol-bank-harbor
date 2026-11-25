const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'mandates.json');

function load() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) return { mandates: {} };
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function save(state) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2));
}

function now() {
  return Date.now();
}

function id(prefix) {
  return `${prefix}-${crypto.randomBytes(4).toString('hex')}`;
}

class MandateEngine {
  constructor() {
    this.state = load();
  }

  createMandate({
    meId,
    agentId,
    vendors,
    perTxCapUmec,
    monthlyCapUmec,
    expiryDays = 30,
    approvalThresholdUmec = 0,
  }) {
    if (!meId || !agentId) throw new Error('meId and agentId are required');
    if (!Array.isArray(vendors) || vendors.length === 0) throw new Error('vendors allowlist is required');
    if (!Number.isInteger(perTxCapUmec) || perTxCapUmec <= 0) throw new Error('perTxCapUmec must be a positive integer');
    if (!Number.isInteger(monthlyCapUmec) || monthlyCapUmec <= 0) throw new Error('monthlyCapUmec must be a positive integer');
    if (perTxCapUmec > monthlyCapUmec) throw new Error('perTxCapUmec cannot exceed monthlyCapUmec');

    const mandate = {
      id: id('mandate'),
      meId,
      agentId,
      vendors,
      perTxCapUmec,
      monthlyCapUmec,
      approvalThresholdUmec,
      spentUmec: 0,
      createdAt: now(),
      expiresAt: now() + expiryDays * 24 * 60 * 60 * 1000,
      active: true,
      settlements: [],
    };
    this.state.mandates[mandate.id] = mandate;
    save(this.state);
    return mandate;
  }

  get(mandateId) {
    const mandate = this.state.mandates[mandateId];
    if (!mandate) throw new Error(`mandate not found: ${mandateId}`);
    return mandate;
  }

  authorize({ mandateId, vendor, amountUmec, receiptHash, approvedBy }) {
    const m = this.get(mandateId);
    if (!m.active) return { approved: false, reason: 'mandate revoked' };
    if (now() > m.expiresAt) return { approved: false, reason: 'mandate expired' };
    if (!m.vendors.includes(vendor)) return { approved: false, reason: 'vendor not in allowlist' };
    if (!Number.isInteger(amountUmec) || amountUmec <= 0) return { approved: false, reason: 'amount must be a positive integer' };
    if (amountUmec > m.perTxCapUmec) return { approved: false, reason: 'per-transaction cap exceeded' };
    if (m.spentUmec + amountUmec > m.monthlyCapUmec) return { approved: false, reason: 'monthly cap exceeded' };
    if (m.approvalThresholdUmec > 0 && amountUmec > m.approvalThresholdUmec && !approvedBy) {
      return { approved: false, reason: 'human approval required', requiresApproval: true };
    }

    const receipt = receiptHash || crypto.createHash('sha256').update(`${m.id}|${vendor}|${amountUmec}|${Date.now()}`).digest('hex');
    const memo = `PB|meid:${m.meId}|mandate:${m.id}|agent:${m.agentId}|vendor:${vendor}|amount:${amountUmec}|receipt:${receipt}`;
    return {
      approved: true,
      mandate: m,
      vendor,
      amountUmec,
      receiptHash: receipt,
      memo,
      approvedBy: approvedBy || null,
    };
  }

  recordSettlement({ mandateId, amountUmec, txHash }) {
    const m = this.get(mandateId);
    if (m.settlements.some(s => s.txHash === txHash)) throw new Error('tx already recorded');
    m.spentUmec += amountUmec;
    m.settlements.push({ amountUmec, txHash, at: now() });
    save(this.state);
    return m;
  }

  revoke(mandateId) {
    const m = this.get(mandateId);
    m.active = false;
    m.revokedAt = now();
    save(this.state);
    return m;
  }
}

module.exports = { MandateEngine };
