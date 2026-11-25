# Protocol Bank — UBI Guard (HARBOR 2026)

UBI Guard is a server-enforced spending mandate for AI agents, built on **ME Network**. A verified human (ME ID) delegates a bounded budget to an agent; the agent can pay approved vendors only inside the mandate, and every settlement is a native **MEC** transfer on ME with a structured audit memo.

- **Team:** Protocol Bank
- **Captain:** Everest An — ME ID `2611229468093`
- **Member:** AricRedemption 陈紫键
- **Track:** AI and trust infrastructure
- **Network:** ME mainnet (`me-chain`, denom `umec`, 8 decimals)
- **Project treasury:** `me1dppzpwws5lp77h00gx46mq838wa2tzefzfd757`
- **Vendor demo wallet:** `me1rnrprnaqmmds6jfdmtxasn03se4j52j6kf8qge`

## Why UBI Guard

ME already distributes UBI and check-in rewards. The missing piece is the **spending side**: when a human gives an AI agent a budget, the agent must not be able to widen it. UBI Guard adds:

- approved vendor allowlist
- per-transaction cap
- monthly cap
- human approval threshold
- expiry and instant revoke
- an audit memo on every MEC settlement

The human root of trust is the **ME ID**. The settlement asset is **MEC**. The audit anchor is **ME mainnet**.

## Architecture

```
Human (ME ID 2611229468093)
        │  creates mandate
        ▼
Protocol Bank mandate engine (off-chain policy)
        │  authorize(vendor, amount, receipt)
        ▼
ME settlement adapter (@cosmjs/stargate)
        │  MsgSend + memo
        ▼
ME mainnet (me-chain, umec) ──► vendor wallet
        │
        └─ explorer tx + audit receipt
```

The mandate engine is deny-by-default: an agent request is approved only if the mandate is active, the vendor is allowlisted, the per-tx cap and monthly cap are respected, the mandate has not expired, and the human approval threshold is satisfied when required.

## Official ME Bridge adapter

`build/me-bridge.js` integrates the **official Meta Earth Bridge** (`https://bridge.mec.me/`). It builds and records a bridge request for **BSC/TRON USDC/USDT → ME**, validates the ME recipient, and stores the source and destination transaction hashes. It does not custody funds and does not reimplement the bridge.

Important: the official bridge does **not** mint MEC. MEC is the native gas token and must be obtained separately. The adapter is included as the cross-chain funding path for the product, not as a gas solution.

## Commercial pilot

UBI Guard is packaged as a **non-custodial Agent Spending Control Plane**, not as a neobank:

- **Buyer:** AI agent platforms, AI-native SaaS, and enterprises deploying agent workflows.
- **Revenue:** $99 Starter / $499 Growth / enterprise SaaS + 10 bps settlement fee.
- **Pilot:** 3 design partners, 90 days, no platform fee, 10 bps settlement fee.
- **Compliance posture:** no customer funds, no private keys, no card issuance; settlement is signed by the human/treasury wallet or a partner.

Supporting documents:

- `BUSINESS_PLAN.md` — market, pricing, unit economics, GTM, 12-month plan
- `PRODUCT_SPEC.md` — mandate/intent state machines, API, acceptance criteria
- `COMPLIANCE.md` — non-custodial posture, KYB/AML, launch checklist
- `PILOT_AGREEMENT.md` — 90-day pilot template

### Pilot API and console

The commercial pilot API is in `server/`:

```bash
PB_API_KEY=pb_pilot_dev_key node server/index.js
# console: http://localhost:8790
```

Endpoints:

- `POST /v1/mandates` — create a mandate
- `GET /v1/mandates` / `GET /v1/mandates/:id`
- `POST /v1/mandates/:id/authorize` — policy check
- `POST /v1/mandates/:id/approvals/:intentId/approve` / `deny`
- `POST /v1/mandates/:id/settlements` — record a settlement tx
- `POST /v1/mandates/:id/revoke` / `suspend` / `reactivate`
- `GET /v1/mandates/:id/audit` / `audit/verify`
- `GET /v1/summary`

All mutating calls require `x-api-key` and `Idempotency-Key`. The audit log is a SHA-256 hash chain. Tests:

```bash
node --test server/test.js
```

## Quick start

Requirements: Node.js 18+.

```bash
npm install
```

### 1. Policy demo (no wallet, no gas)

```bash
node build/demo.js
```

This creates a mandate, approves a payment, blocks an over-cap payment, requires human approval above a threshold, revokes the mandate, and blocks the post-revoke payment.

### 2. Dry-run settlement

```bash
PROJECT_ADDRESS=me1dppzpwws5lp77h00gx46mq838wa2tzefzfd757 \
node build/settle.js --to me1rnrprnaqmmds6jfdmtxasn03se4j52j6kf8qge --amount 0.0001 --memo "UBI-GUARD:demo" --dry-run
```

The dry run reads the ME mainnet balance and prints whether the treasury can cover the amount + fee.

### 3. Real settlement (requires a funded treasury mnemonic)

Put the treasury mnemonic in `.private/project-wallet.mnemonic.txt` (never commit it), fund the address with MEC, then:

```bash
node build/settle.js --to me1rnrprnaqmmds6jfdmtxasn03se4j52j6kf8qge --amount 0.0001 --memo "UBI-GUARD:mainnet"
```

The result includes the tx hash and an ME Explorer link.

### 4. Mainnet call record

```bash
PROJECT_ADDRESS=me1dppzpwws5lp77h00gx46mq838wa2tzefzfd757 \
node build/record-mainnet.js
```

This queries ME mainnet (chain ID, block, ME ID DID, balances, minimum gas price), builds a mandate decision, and writes a JSON record plus a SHA-256 record hash to `run-records/`.

### 5. Official bridge demo

```bash
node build/bridge-demo.js
```

## Testnet

The ME testnet is available at:

- RPC: `http://118.175.0.249:26657`
- LCD: `http://118.175.0.249:1317`
- Chain ID: `mechain_400-1`
- Faucet: `https://www.mec.me/en-US/faucet` (2 test MEC per address per day)

Run the same settlement with:

```bash
ME_RPC=http://118.175.0.249:26657 \
PROJECT_ADDRESS=<testnet-funded-address> \
node build/settle.js --to <vendor-testnet-address> --amount 0.0001 --memo "UBI-GUARD:testnet"
```

## Run records

- Mainnet call record: `run-records/mainnet-call-2026-11-25T10-38-44-489Z.json`
  - chain ID `me-chain`
  - block `16229680`
  - ME ID `2611229468093` → `DID_STATUS_ACTIVE`, bound to `me1ken8mcs8r7eklv23c7k7swgf3kgph3maasgk9h`
  - treasury `me1dpp...` balance: `0 umec`
  - record hash: `ec9ac4701e6c986e2292ebafe87d208defe680e683c9e9981ad7e446e6e4f561`
- Testnet settlement: `run-records/testnet-settlement-*.json` (added after the faucet claim)

The mainnet record proves the live ME ID/DID lookup, the chain configuration, and the mandate decision. The testnet record proves the full signed MEC transfer and audit memo end to end.

## Repository layout

```
build/
  mandate.js           mandate policy engine
  me-settlement.js     ME mainnet/testnet MEC adapter
  settle.js            settlement CLI
  demo.js              UBI Guard policy demo
  me-bridge.js         official ME Bridge adapter
  bridge-demo.js       bridge request demo
  record-mainnet.js    mainnet call record generator
run-records/           mainnet call records and settlement records
```

## Security

- No private keys or mnemonics are committed.
- `.private/` is git-ignored.
- The mandate engine denies by default and records every decision.
- Settlement memos contain the ME ID, mandate ID, agent ID, vendor, amount, and receipt hash for audit.

## HARBOR submission

Required materials and the project description are in `SUBMISSION.md`.

- Repository: `https://github.com/everest-an/protocol-bank-harbor`
- Final commit: latest `master`
- Demo video: `https://github.com/everest-an/protocol-bank-harbor/releases/download/v1.0-harbor/ubi-guard-demo.mp4`
- Local dashboard: `node demo/serve.js` → `http://localhost:8787`