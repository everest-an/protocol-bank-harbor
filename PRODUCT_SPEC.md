# Protocol Bank — Product Specification (Pilot v1)

## 1. Product definition

Protocol Bank Mandate is a **non-custodial spending control plane** for AI agents. It authorizes or blocks an agent's payment request against a human-owned mandate, records the decision in an append-only audit log, and hands an approved payment intent to a settlement adapter.

Protocol Bank does **not** hold customer funds, issue cards, or operate a bank account. It is software that sits between an agent and a payment rail.

## 2. Personas

| Persona | Goal | Permissions |
|---|---|---|
| Human owner | Give an agent a bounded budget and revoke it instantly | Create/suspend/revoke mandate, approve above-threshold payments, view audit |
| Agent | Buy approved services within the mandate | Submit payment intents, read its own mandate status |
| Vendor | Receive approved payments | Read-only: payment status, receipt |
| Auditor / finance | Verify what the agent did | Read-only: audit log, settlement records, export |

## 3. Mandate lifecycle

```text
draft ──activate──► active ──suspend──► suspended
  │                   │                   │
  │                   ├──revoke──► revoked │
  │                   │                   │
  └───────────────────┴──expire──► expired
```

- **draft:** created but not usable. Can be edited.
- **active:** policy checks are allowed.
- **suspended:** checks are blocked, but the mandate can be reactivated.
- **revoked:** permanent; cannot be reactivated. A new mandate must be created.
- **expired:** `expiresAt` has passed. Permanent until a new mandate is created.

Rules:

- Only `active` mandates can authorize payments.
- Revoke is immediate and idempotent.
- Expiry is evaluated on every request; no cron is required.
- A revoked or expired mandate cannot be edited.

## 4. Payment intent lifecycle

```text
requested ──policy──► approved ──settle──► settled
    │                   │
    ├──policy──► blocked │
    ├──policy──► pending_approval ──approve──► approved
    │                   │
    │                   └──deny──► denied
    └──expire──► expired
```

- **requested:** the agent submitted an intent.
- **approved:** the policy engine authorized it and returned a `PaymentIntent`.
- **pending_approval:** the amount is above the approval threshold; the human must approve.
- **blocked:** the policy engine rejected it. No transaction is built.
- **denied:** the human denied a pending intent.
- **settled:** a settlement adapter recorded a tx hash.
- **expired:** the intent was not settled before `intentExpiresAt`.

An approved intent is **single-use**. It cannot be replayed to settle twice.

## 5. Policy checks

The engine evaluates, in order:

1. Mandate exists and is `active`.
2. `expiresAt` is in the future.
3. Agent ID matches the mandate.
4. Vendor address is in the allowlist.
5. Vendor KYB status is `approved` (configurable for pilot: `pending` can be allowed with a flag).
6. Vendor category is in `allowedCategories` (if set).
7. Amount is a positive integer in `umec`.
8. Amount ≤ `perTxCapUmec`.
9. `spentTodayUmec + amount` ≤ `dailyCapUmec` (if set).
10. `spentMonthUmec + amount` ≤ `monthlyCapUmec`.
11. Time window: current hour in `timezone` is inside `allowedHours` (if set).
12. If `amount > approvalThresholdUmec`, require `approvedBy` or return `pending_approval`.

On approval, the engine returns:

```json
{
  "intentId": "pi_...",
  "status": "approved",
  "memo": "PB|meid:...|mandate:...|agent:...|vendor:...|amount:...|receipt:...",
  "amountUmec": "10000",
  "feeUmec": "5000",
  "expiresAt": "2026-11-25T12:00:00.000Z"
}
```

On block:

```json
{
  "status": "blocked",
  "reason": "per-transaction cap exceeded",
  "code": "PER_TX_CAP"
}
```

Error codes:

- `MANDATE_NOT_FOUND`
- `MANDATE_NOT_ACTIVE`
- `MANDATE_EXPIRED`
- `AGENT_MISMATCH`
- `VENDOR_NOT_ALLOWED`
- `VENDOR_KYB_REQUIRED`
- `CATEGORY_NOT_ALLOWED`
- `INVALID_AMOUNT`
- `PER_TX_CAP`
- `DAILY_CAP`
- `MONTHLY_CAP`
- `OUTSIDE_TIME_WINDOW`
- `APPROVAL_REQUIRED`
- `INTENT_NOT_FOUND`
- `INTENT_ALREADY_SETTLED`
- `INTENT_EXPIRED`

## 6. API (pilot v1)

Base URL: `http://localhost:8790/v1`

Authentication: `x-api-key: pb_live_...` (hashed at rest). The pilot uses one key per tenant. The key is shown once at creation.

Common headers:

- `Idempotency-Key: <uuid>` for POST requests that create or settle.
- `x-request-id: <uuid>` optional; echoed in the response.

### Create a mandate

`POST /mandates`

```json
{
  "meId": "2611229468093",
  "agentId": "agent-data-01",
  "vendors": [
    {
      "address": "me1rnrprnaqmmds6jfdmtxasn03se4j52j6kf8qge",
      "name": "Demo Data Vendor",
      "category": "data",
      "kybStatus": "approved"
    }
  ],
  "perTxCapUmec": 20000,
  "dailyCapUmec": 40000,
  "monthlyCapUmec": 200000,
  "approvalThresholdUmec": 12000,
  "allowedCategories": ["data", "api", "cloud"],
  "allowedHours": { "start": 0, "end": 24, "timezone": "UTC" },
  "expiryDays": 30
}
```

Response `201`:

```json
{
  "id": "mandate_...",
  "status": "active",
  "meId": "2611229468093",
  "agentId": "agent-data-01",
  "perTxCapUmec": 20000,
  "dailyCapUmec": 40000,
  "monthlyCapUmec": 200000,
  "approvalThresholdUmec": 12000,
  "expiresAt": "2026-12-25T00:00:00.000Z"
}
```

### Get a mandate

`GET /mandates/:id`

### List mandates

`GET /mandates?status=active&limit=50`

### Authorize a payment

`POST /mandates/:id/authorize`

```json
{
  "agentId": "agent-data-01",
  "vendor": "me1rnrprnaqmmds6jfdmtxasn03se4j52j6kf8qge",
  "amountUmec": 10000,
  "receiptHash": "sha256:...",
  "category": "data"
}
```

Response `200` (approved / pending / blocked) as in §5.

### Approve a pending payment

`POST /mandates/:id/approvals/:intentId/approve`

```json
{ "approvedBy": "human:2611229468093" }
```

### Deny a pending payment

`POST /mandates/:id/approvals/:intentId/deny`

```json
{ "deniedBy": "human:2611229468093", "reason": "vendor not recognized" }
```

### Revoke a mandate

`POST /mandates/:id/revoke`

```json
{ "revokedBy": "human:2611229468093" }
```

### Settle an approved intent

`POST /mandates/:id/settlements`

```json
{
  "intentId": "pi_...",
  "txHash": "ABC123...",
  "adapter": "me-mainnet",
  "settledAt": "2026-11-25T12:00:00.000Z"
}
```

### Audit log

`GET /mandates/:id/audit?limit=100`

Returns an append-only array of events with `seq`, `type`, `at`, `payload`, `prevHash`, `hash`.

### Health

`GET /health` → `{ "ok": true, "version": "pilot-1" }`

## 7. Auth, idempotency, rate limits

- API keys are stored as SHA-256 hashes; the plaintext is shown once.
- Rate limit: 60 requests/minute per key, burst 20.
- `Idempotency-Key` is required for `POST /mandates`, `authorize`, `approve`, `deny`, `revoke`, `settlements`. Replaying the same key returns the original response.
- Body size limit: 64 KB.
- All timestamps are UTC ISO-8601.

## 8. Audit log integrity

Each event is:

```json
{
  "seq": 1,
  "type": "mandate.created",
  "at": "2026-11-25T12:00:00.000Z",
  "payload": { "...": "..." },
  "prevHash": "genesis",
  "hash": "sha256(canonical(seq,type,at,payload,prevHash))"
}
```

The settlement memo includes the mandate ID, agent ID, vendor, amount, and receipt hash. The audit export includes the full hash chain, so an auditor can verify that no event was removed or edited.

## 9. Non-custodial settlement flow

1. Agent calls `authorize`.
2. Policy engine returns an approved `PaymentIntent` with a memo and an expiry.
3. The **human signer** (wallet, MPC, or delegated session key) signs a transfer for exactly that intent.
4. The settlement adapter broadcasts the tx.
5. The adapter calls `POST /settlements` with the tx hash.
6. The engine marks the intent `settled`, updates daily/monthly spend, and appends an audit event.

The policy engine never stores a private key. In the pilot, the settlement can be executed by a treasury wallet or a manual signer; in production, it should be an MPC/HSM or a user-held wallet.

## 10. Dashboard

Views:

- **Overview:** active mandates, pending approvals, settled volume, blocked attempts.
- **Mandate detail:** policy, vendors, spend, audit timeline.
- **Approval inbox:** pending intents with amount, vendor, agent, receipt, approve/deny.
- **Audit:** filter by event type, export JSON/CSV, verify hash chain.
- **Vendors:** address, KYB status, category, risk tier.

The pilot dashboard can be a local web app; the hosted version should add SSO and tenant isolation.

## 11. Acceptance criteria

- A mandate can be created, authorized, approved, settled, revoked, and audited via API.
- An over-cap request returns `blocked` and creates no settlement.
- An above-threshold request returns `pending_approval`; approval transitions it to `approved`.
- A revoked mandate blocks all later requests.
- Replaying an approved intent returns `INTENT_ALREADY_SETTLED` or `INTENT_ALREADY_APPROVED`.
- The audit hash chain verifies for a full mandate history.
- The API rejects missing/invalid keys, oversized bodies, and invalid amounts.
- The dashboard shows the same decisions as the API.
- The ME testnet settlement produces a tx hash and an audit record.

## 12. Out of scope for the pilot

- Custody of customer funds.
- Card issuance.
- Fiat on/off-ramp.
- UBI distribution.
- Multi-tenant SSO.
- Chargebacks/disputes.
- Tax reporting.

These are partner or later-stage items, not pilot blockers.
