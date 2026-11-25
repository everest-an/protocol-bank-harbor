const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const GENESIS = 'genesis';

function nowIso() {
  return new Date().toISOString();
}

function newId(prefix) {
  return `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function dayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function monthKey(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

class PolicyError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'PolicyError';
    this.code = code;
    this.status = status;
  }
}

function assertPositiveInt(value, field, { allowZero = false } = {}) {
  if (!Number.isInteger(value) || (allowZero ? value < 0 : value <= 0)) {
    throw new PolicyError('INVALID_AMOUNT', `${field} must be a ${allowZero ? 'non-negative' : 'positive'} integer`);
  }
}

class MandateStore {
  constructor(file) {
    this.file = file || path.join(__dirname, 'data', 'pilot-state.json');
    this.state = { mandates: {}, intents: {}, idempotency: {} };
    this.load();
  }

  load() {
    if (fs.existsSync(this.file)) {
      const raw = fs.readFileSync(this.file, 'utf8');
      if (raw.trim()) this.state = JSON.parse(raw);
    }
    this.state.mandates ||= {};
    this.state.intents ||= {};
    this.state.idempotency ||= {};
  }

  save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.state, null, 2));
    fs.renameSync(tmp, this.file);
  }

  addAudit(mandate, type, payload) {
    const seq = mandate.audit.length + 1;
    const at = nowIso();
    const prevHash = seq === 1 ? GENESIS : mandate.audit[mandate.audit.length - 1].hash;
    const hash = sha256(canonical({ seq, type, at, payload, prevHash }));
    mandate.audit.push({ seq, type, at, payload, prevHash, hash });
  }

  publicMandate(mandate) {
    return {
      id: mandate.id,
      status: mandate.status,
      meId: mandate.meId,
      agentId: mandate.agentId,
      vendors: mandate.vendors.map((v) => ({ ...v })),
      perTxCapUmec: mandate.perTxCapUmec,
      dailyCapUmec: mandate.dailyCapUmec,
      monthlyCapUmec: mandate.monthlyCapUmec,
      approvalThresholdUmec: mandate.approvalThresholdUmec,
      allowedCategories: [...mandate.allowedCategories],
      allowedHours: { ...mandate.allowedHours },
      spentTodayUmec: mandate.spentTodayUmec,
      spentMonthUmec: mandate.spentMonthUmec,
      reservedUmec: mandate.reservedUmec,
      createdAt: mandate.createdAt,
      expiresAt: mandate.expiresAt,
      revokedAt: mandate.revokedAt || null,
      suspendedAt: mandate.suspendedAt || null,
      settlementFeeUmec: mandate.settlementFeeUmec,
    };
  }

  publicIntent(intent) {
    return {
      id: intent.id,
      mandateId: intent.mandateId,
      agentId: intent.agentId,
      vendor: intent.vendor,
      amountUmec: intent.amountUmec,
      feeUmec: intent.feeUmec,
      category: intent.category,
      receiptHash: intent.receiptHash,
      status: intent.status,
      memo: intent.memo,
      createdAt: intent.createdAt,
      expiresAt: intent.expiresAt,
      approvedBy: intent.approvedBy || null,
      deniedBy: intent.deniedBy || null,
      denyReason: intent.denyReason || null,
      txHash: intent.txHash || null,
      adapter: intent.adapter || null,
      settledAt: intent.settledAt || null,
    };
  }

  createMandate(input) {
    if (!input || typeof input !== 'object') throw new PolicyError('INVALID_INPUT', 'body is required');
    if (!input.meId) throw new PolicyError('INVALID_INPUT', 'meId is required');
    if (!input.agentId) throw new PolicyError('INVALID_INPUT', 'agentId is required');
    if (!Array.isArray(input.vendors) || input.vendors.length === 0) {
      throw new PolicyError('INVALID_INPUT', 'vendors must be a non-empty array');
    }

    assertPositiveInt(input.perTxCapUmec, 'perTxCapUmec');
    assertPositiveInt(input.monthlyCapUmec, 'monthlyCapUmec');
    const dailyCapUmec = input.dailyCapUmec == null ? input.monthlyCapUmec : input.dailyCapUmec;
    assertPositiveInt(dailyCapUmec, 'dailyCapUmec');
    const approvalThresholdUmec = input.approvalThresholdUmec == null ? 0 : input.approvalThresholdUmec;
    assertPositiveInt(approvalThresholdUmec, 'approvalThresholdUmec', { allowZero: true });

    if (input.perTxCapUmec > input.monthlyCapUmec) {
      throw new PolicyError('INVALID_INPUT', 'perTxCapUmec cannot exceed monthlyCapUmec');
    }
    if (dailyCapUmec > input.monthlyCapUmec) {
      throw new PolicyError('INVALID_INPUT', 'dailyCapUmec cannot exceed monthlyCapUmec');
    }

    const vendors = input.vendors.map((v) => {
      if (!v || !v.address) throw new PolicyError('INVALID_INPUT', 'vendor.address is required');
      return {
        address: String(v.address),
        name: v.name ? String(v.name) : '',
        category: v.category ? String(v.category) : 'general',
        kybStatus: v.kybStatus ? String(v.kybStatus) : 'pending',
        riskTier: v.riskTier ? String(v.riskTier) : 'medium',
      };
    });

    const allowedCategories = Array.isArray(input.allowedCategories)
      ? input.allowedCategories.map(String)
      : [];

    const allowedHours = input.allowedHours && typeof input.allowedHours === 'object'
      ? {
          start: Number.isInteger(input.allowedHours.start) ? input.allowedHours.start : 0,
          end: Number.isInteger(input.allowedHours.end) ? input.allowedHours.end : 24,
          timezone: input.allowedHours.timezone || 'UTC',
        }
      : { start: 0, end: 24, timezone: 'UTC' };

    if (allowedHours.start < 0 || allowedHours.start > 24 || allowedHours.end < 0 || allowedHours.end > 24) {
      throw new PolicyError('INVALID_INPUT', 'allowedHours must be within 0..24');
    }

    const expiryDays = Number.isInteger(input.expiryDays) ? input.expiryDays : 30;
    if (expiryDays <= 0) throw new PolicyError('INVALID_INPUT', 'expiryDays must be positive');

    const createdAt = nowIso();
    const mandate = {
      id: newId('mandate'),
      status: 'active',
      meId: String(input.meId),
      agentId: String(input.agentId),
      vendors,
      perTxCapUmec: input.perTxCapUmec,
      dailyCapUmec,
      monthlyCapUmec: input.monthlyCapUmec,
      approvalThresholdUmec,
      allowedCategories,
      allowedHours,
      allowPendingKyb: Boolean(input.allowPendingKyb),
      settlementFeeUmec: Number.isInteger(input.settlementFeeUmec) ? input.settlementFeeUmec : 5000,
      createdAt,
      expiresAt: new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString(),
      spentTodayUmec: 0,
      spentMonthUmec: 0,
      reservedUmec: 0,
      spendDay: dayKey(),
      spendMonth: monthKey(),
      audit: [],
      settlements: [],
    };

    this.addAudit(mandate, 'mandate.created', {
      meId: mandate.meId,
      agentId: mandate.agentId,
      perTxCapUmec: mandate.perTxCapUmec,
      dailyCapUmec: mandate.dailyCapUmec,
      monthlyCapUmec: mandate.monthlyCapUmec,
      approvalThresholdUmec: mandate.approvalThresholdUmec,
      expiresAt: mandate.expiresAt,
      vendors: mandate.vendors.map((v) => v.address),
    });

    this.state.mandates[mandate.id] = mandate;
    this.save();
    return this.publicMandate(mandate);
  }

  getMandate(mandateId) {
    const mandate = this.state.mandates[mandateId];
    if (!mandate) throw new PolicyError('MANDATE_NOT_FOUND', 'mandate not found', 404);
    return mandate;
  }

  listMandates({ status, limit = 50 } = {}) {
    let list = Object.values(this.state.mandates);
    if (status) list = list.filter((m) => m.status === status);
    list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return list.slice(0, Math.min(Math.max(Number(limit) || 50, 1), 200)).map((m) => this.publicMandate(m));
  }

  resetPeriods(mandate) {
    const today = dayKey();
    const thisMonth = monthKey();
    if (mandate.spendDay !== today) {
      mandate.spentTodayUmec = 0;
      mandate.spendDay = today;
    }
    if (mandate.spendMonth !== thisMonth) {
      mandate.spentMonthUmec = 0;
      mandate.spendMonth = thisMonth;
    }
  }

  expireIntents(mandate) {
    const now = Date.now();
    for (const intent of Object.values(this.state.intents)) {
      if (intent.mandateId !== mandate.id) continue;
      if (!['approved', 'pending_approval'].includes(intent.status)) continue;
      if (new Date(intent.expiresAt).getTime() >= now) continue;
      intent.status = 'expired';
      intent.expiredAt = nowIso();
      mandate.reservedUmec = Math.max(0, mandate.reservedUmec - intent.amountUmec);
      this.addAudit(mandate, 'intent.expired', { intentId: intent.id, amountUmec: intent.amountUmec });
    }
  }

  checkTimeWindow(mandate, date = new Date()) {
    const { start, end, timezone } = mandate.allowedHours;
    if (start === 0 && end === 24) return true;
    let hour;
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone || 'UTC',
        hour: 'numeric',
        hour12: false,
      }).formatToParts(date);
      hour = Number(parts.find((p) => p.type === 'hour')?.value || '0');
      if (hour === 24) hour = 0;
    } catch {
      throw new PolicyError('INVALID_TIMEZONE', `invalid timezone: ${timezone}`);
    }
    if (start < end) return hour >= start && hour < end;
    if (start > end) return hour >= start || hour < end;
    return false;
  }

  findVendor(mandate, address) {
    return mandate.vendors.find((v) => v.address === address);
  }

  authorize(mandateId, input) {
    const mandate = this.getMandate(mandateId);
    this.expireIntents(mandate);
    this.resetPeriods(mandate);

    const fail = (code, reason) => {
      this.addAudit(mandate, 'intent.blocked', {
        code,
        reason,
        agentId: input?.agentId || null,
        vendor: input?.vendor || null,
        amountUmec: input?.amountUmec || null,
      });
      this.save();
      return { status: 'blocked', code, reason };
    };

    if (mandate.status !== 'active') {
      return fail(mandate.status === 'revoked' ? 'MANDATE_NOT_ACTIVE' : 'MANDATE_NOT_ACTIVE', `mandate is ${mandate.status}`);
    }
    if (Date.now() > new Date(mandate.expiresAt).getTime()) {
      mandate.status = 'expired';
      return fail('MANDATE_EXPIRED', 'mandate expired');
    }
    if (!input || input.agentId !== mandate.agentId) {
      return fail('AGENT_MISMATCH', 'agent does not match the mandate');
    }

    const vendor = this.findVendor(mandate, input.vendor);
    if (!vendor) return fail('VENDOR_NOT_ALLOWED', 'vendor is not in the allowlist');
    if (vendor.kybStatus !== 'approved' && !mandate.allowPendingKyb) {
      return fail('VENDOR_KYB_REQUIRED', 'vendor KYB is not approved');
    }

    const category = input.category || vendor.category;
    if (mandate.allowedCategories.length > 0 && !mandate.allowedCategories.includes(category)) {
      return fail('CATEGORY_NOT_ALLOWED', `category ${category} is not allowed`);
    }

    if (!Number.isInteger(input.amountUmec) || input.amountUmec <= 0) {
      return fail('INVALID_AMOUNT', 'amountUmec must be a positive integer');
    }
    if (input.amountUmec > mandate.perTxCapUmec) {
      return fail('PER_TX_CAP', 'per-transaction cap exceeded');
    }
    if (mandate.spentTodayUmec + input.amountUmec > mandate.dailyCapUmec) {
      return fail('DAILY_CAP', 'daily cap exceeded');
    }
    if (mandate.spentMonthUmec + mandate.reservedUmec + input.amountUmec > mandate.monthlyCapUmec) {
      return fail('MONTHLY_CAP', 'monthly cap exceeded');
    }
    if (!this.checkTimeWindow(mandate)) {
      return fail('OUTSIDE_TIME_WINDOW', 'outside the allowed time window');
    }

    const receiptHash = input.receiptHash ? String(input.receiptHash) : `sha256:${sha256(`${mandate.id}|${input.vendor}|${input.amountUmec}|${Date.now()}`)}`;
    const intentId = newId('pi');
    const memo = `PB|meid:${mandate.meId}|mandate:${mandate.id}|agent:${mandate.agentId}|vendor:${input.vendor}|amount:${input.amountUmec}|receipt:${receiptHash}`;
    const intent = {
      id: intentId,
      mandateId: mandate.id,
      agentId: mandate.agentId,
      vendor: input.vendor,
      amountUmec: input.amountUmec,
      feeUmec: mandate.settlementFeeUmec,
      category,
      receiptHash,
      status: 'approved',
      memo,
      createdAt: nowIso(),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      approvedBy: input.approvedBy || null,
    };

    if (mandate.approvalThresholdUmec > 0 && input.amountUmec > mandate.approvalThresholdUmec && !input.approvedBy) {
      intent.status = 'pending_approval';
      mandate.reservedUmec += input.amountUmec;
      this.state.intents[intentId] = intent;
      this.addAudit(mandate, 'intent.pending_approval', {
        intentId,
        amountUmec: input.amountUmec,
        vendor: input.vendor,
        reason: 'above approval threshold',
      });
      this.save();
      return {
        status: 'pending_approval',
        intentId,
        reason: 'human approval required',
        code: 'APPROVAL_REQUIRED',
        amountUmec: input.amountUmec,
        feeUmec: intent.feeUmec,
        expiresAt: intent.expiresAt,
        memo,
      };
    }

    mandate.reservedUmec += input.amountUmec;
    this.state.intents[intentId] = intent;
    this.addAudit(mandate, 'intent.approved', {
      intentId,
      amountUmec: input.amountUmec,
      vendor: input.vendor,
      category,
      receiptHash,
    });
    this.save();
    return {
      status: 'approved',
      intentId,
      amountUmec: input.amountUmec,
      feeUmec: intent.feeUmec,
      expiresAt: intent.expiresAt,
      memo,
    };
  }

  getIntent(mandateId, intentId) {
    const intent = this.state.intents[intentId];
    if (!intent || intent.mandateId !== mandateId) {
      throw new PolicyError('INTENT_NOT_FOUND', 'payment intent not found', 404);
    }
    return intent;
  }

  approve(mandateId, intentId, approvedBy) {
    const mandate = this.getMandate(mandateId);
    const intent = this.getIntent(mandateId, intentId);
    if (intent.status === 'settled') throw new PolicyError('INTENT_ALREADY_SETTLED', 'intent already settled', 409);
    if (intent.status === 'approved') return this.publicIntent(intent);
    if (intent.status !== 'pending_approval') {
      throw new PolicyError('INTENT_NOT_PENDING', `intent is ${intent.status}`, 409);
    }
    if (Date.now() > new Date(intent.expiresAt).getTime()) {
      intent.status = 'expired';
      mandate.reservedUmec = Math.max(0, mandate.reservedUmec - intent.amountUmec);
      this.addAudit(mandate, 'intent.expired', { intentId, amountUmec: intent.amountUmec });
      this.save();
      throw new PolicyError('INTENT_EXPIRED', 'intent expired', 409);
    }
    if (!approvedBy) throw new PolicyError('INVALID_INPUT', 'approvedBy is required');
    intent.status = 'approved';
    intent.approvedBy = String(approvedBy);
    intent.approvedAt = nowIso();
    this.addAudit(mandate, 'intent.approved_by_human', {
      intentId,
      amountUmec: intent.amountUmec,
      approvedBy: intent.approvedBy,
    });
    this.save();
    return this.publicIntent(intent);
  }

  deny(mandateId, intentId, deniedBy, reason) {
    const mandate = this.getMandate(mandateId);
    const intent = this.getIntent(mandateId, intentId);
    if (intent.status !== 'pending_approval') {
      throw new PolicyError('INTENT_NOT_PENDING', `intent is ${intent.status}`, 409);
    }
    intent.status = 'denied';
    intent.deniedBy = deniedBy ? String(deniedBy) : null;
    intent.denyReason = reason ? String(reason) : null;
    intent.deniedAt = nowIso();
    mandate.reservedUmec = Math.max(0, mandate.reservedUmec - intent.amountUmec);
    this.addAudit(mandate, 'intent.denied', {
      intentId,
      amountUmec: intent.amountUmec,
      deniedBy: intent.deniedBy,
      reason: intent.denyReason,
    });
    this.save();
    return this.publicIntent(intent);
  }

  revoke(mandateId, revokedBy) {
    const mandate = this.getMandate(mandateId);
    if (mandate.status === 'revoked') return this.publicMandate(mandate);
    mandate.status = 'revoked';
    mandate.revokedAt = nowIso();
    mandate.revokedBy = revokedBy ? String(revokedBy) : null;
    for (const intent of Object.values(this.state.intents)) {
      if (intent.mandateId !== mandate.id) continue;
      if (['approved', 'pending_approval'].includes(intent.status)) {
        intent.status = 'revoked';
        intent.revokedAt = mandate.revokedAt;
        mandate.reservedUmec = Math.max(0, mandate.reservedUmec - intent.amountUmec);
      }
    }
    this.addAudit(mandate, 'mandate.revoked', { revokedBy: mandate.revokedBy });
    this.save();
    return this.publicMandate(mandate);
  }

  suspend(mandateId, suspendedBy) {
    const mandate = this.getMandate(mandateId);
    if (mandate.status !== 'active') throw new PolicyError('MANDATE_NOT_ACTIVE', `mandate is ${mandate.status}`, 409);
    mandate.status = 'suspended';
    mandate.suspendedAt = nowIso();
    mandate.suspendedBy = suspendedBy ? String(suspendedBy) : null;
    for (const intent of Object.values(this.state.intents)) {
      if (intent.mandateId !== mandate.id) continue;
      if (['approved', 'pending_approval'].includes(intent.status)) {
        intent.status = 'suspended';
        mandate.reservedUmec = Math.max(0, mandate.reservedUmec - intent.amountUmec);
      }
    }
    this.addAudit(mandate, 'mandate.suspended', { suspendedBy: mandate.suspendedBy });
    this.save();
    return this.publicMandate(mandate);
  }

  reactivate(mandateId, reactivatedBy) {
    const mandate = this.getMandate(mandateId);
    if (mandate.status !== 'suspended') throw new PolicyError('MANDATE_NOT_SUSPENDED', `mandate is ${mandate.status}`, 409);
    mandate.status = 'active';
    mandate.reactivatedAt = nowIso();
    mandate.reactivatedBy = reactivatedBy ? String(reactivatedBy) : null;
    this.addAudit(mandate, 'mandate.reactivated', { reactivatedBy: mandate.reactivatedBy });
    this.save();
    return this.publicMandate(mandate);
  }

  settle(mandateId, input) {
    const mandate = this.getMandate(mandateId);
    if (!input || !input.intentId) throw new PolicyError('INVALID_INPUT', 'intentId is required');
    if (!input.txHash) throw new PolicyError('INVALID_INPUT', 'txHash is required');
    const intent = this.getIntent(mandateId, input.intentId);
    if (intent.status === 'settled') throw new PolicyError('INTENT_ALREADY_SETTLED', 'intent already settled', 409);
    if (intent.status !== 'approved') throw new PolicyError('INTENT_NOT_APPROVED', `intent is ${intent.status}`, 409);
    if (Date.now() > new Date(intent.expiresAt).getTime()) {
      intent.status = 'expired';
      mandate.reservedUmec = Math.max(0, mandate.reservedUmec - intent.amountUmec);
      this.addAudit(mandate, 'intent.expired', { intentId: intent.id, amountUmec: intent.amountUmec });
      this.save();
      throw new PolicyError('INTENT_EXPIRED', 'intent expired', 409);
    }

    this.resetPeriods(mandate);
    intent.status = 'settled';
    intent.txHash = String(input.txHash);
    intent.adapter = input.adapter ? String(input.adapter) : 'unknown';
    intent.settledAt = input.settledAt ? String(input.settledAt) : nowIso();
    mandate.reservedUmec = Math.max(0, mandate.reservedUmec - intent.amountUmec);
    mandate.spentTodayUmec += intent.amountUmec;
    mandate.spentMonthUmec += intent.amountUmec;
    mandate.settlements.push({
      intentId: intent.id,
      amountUmec: intent.amountUmec,
      txHash: intent.txHash,
      adapter: intent.adapter,
      settledAt: intent.settledAt,
    });
    this.addAudit(mandate, 'intent.settled', {
      intentId: intent.id,
      amountUmec: intent.amountUmec,
      txHash: intent.txHash,
      adapter: intent.adapter,
    });
    this.save();
    return this.publicIntent(intent);
  }

  audit(mandateId, { limit = 100 } = {}) {
    const mandate = this.getMandate(mandateId);
    return mandate.audit.slice(-Math.min(Math.max(Number(limit) || 100, 1), 500));
  }

  verifyAudit(mandateId) {
    const mandate = this.getMandate(mandateId);
    let prevHash = GENESIS;
    for (const event of mandate.audit) {
      if (event.prevHash !== prevHash) {
        return { valid: false, firstInvalid: event.seq, reason: 'prevHash mismatch' };
      }
      const expected = sha256(canonical({
        seq: event.seq,
        type: event.type,
        at: event.at,
        payload: event.payload,
        prevHash: event.prevHash,
      }));
      if (expected !== event.hash) {
        return { valid: false, firstInvalid: event.seq, reason: 'hash mismatch' };
      }
      prevHash = event.hash;
    }
    return { valid: true, events: mandate.audit.length, lastHash: prevHash };
  }
}

module.exports = { MandateStore, PolicyError, canonical, sha256, dayKey, monthKey };
