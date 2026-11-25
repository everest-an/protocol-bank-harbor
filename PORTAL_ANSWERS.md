# HARBOR Project Portal — Ready-to-paste answers

## Basic fields

- **Project name:** Protocol Bank — UBI Guard
- **Team name:** Protocol Bank
- **Captain:** Everest An
- **Captain ME ID:** `2611229468093`
- **Member:** AricRedemption 陈紫键
- **Track:** AI and trust infrastructure
- **Project link:** `https://www.protocolbanks.com`

## One-line description

Server-enforced spending mandates that let a verified ME ID holder delegate a bounded MEC budget to an AI agent — with vendor allowlists, caps, human approval, instant revoke, and on-chain audit memos.

## Project description

ME Network gives every verified human an identity and a UBI budget. But when a human delegates that budget to an AI agent, there is no safe spending layer. The agent usually gets a wallet and a private key, and it can overspend, pay the wrong vendor, or keep spending after the human has revoked permission.

UBI Guard fixes the spending side. A verified ME ID holder creates a mandate that names the agent, the approved vendors, a per-transaction cap, a monthly cap, an expiry, and a human approval threshold. The agent can request a payment, but the mandate engine checks every request before a transaction is built. Requests outside the mandate are blocked. Requests above the approval threshold wait for the human. The human can revoke at any time, and every later request is denied.

Every approved payment produces a structured memo containing the ME ID, mandate ID, agent ID, vendor, amount, and receipt hash. The settlement adapter signs a native MEC transfer on ME mainnet with that memo, linking the payment to the policy decision on-chain.

The human root of trust is the ME ID. The demo uses ME ID `2611229468093`; the engine queries the ME mainnet DID module and verifies that the ME ID is active and bound to the captain wallet. The settlement asset is MEC. The audit anchor is ME mainnet.

The project also includes an adapter for the official Meta Earth Bridge. It builds and records BSC/TRON USDC/USDT → ME bridge requests, validates the ME recipient, and stores the source and destination transaction hashes. It does not custody funds, does not reimplement the bridge, and does not claim that the bridge mints MEC.

## Commercial model

- **Buyer:** AI agent platforms, AI-native SaaS, enterprises deploying agent workflows, and neobank/card partners that need an agent controls layer.
- **Pricing:** $99 Starter / $499 Growth / enterprise SaaS, plus 10 bps on settled volume.
- **Pilot:** 3 design partners, 90 days, no platform fee, 10 bps settlement fee.
- **Positioning:** non-custodial authorization and audit layer above payment rails; not a neobank, not a UBI distributor.
- **Why now:** agents are moving from suggesting payments to making payments; the missing layer is a mandate that the agent cannot widen.

## ME access methods

- ME ID / DID lookup on ME mainnet (`/metaearth/did/did`)
- Native MEC settlement on `me-chain` via `@cosmjs/stargate`
- ME testnet flow on `mechain_400-1` via the official faucet
- Official ME Bridge at `https://bridge.mec.me/`

## Existing foundation and new work

Protocol Bank already operates an agent-commerce control plane with agent-scoped card controls in provider onboarding, x402/EIP-3009 payment rails, a trading-only Hyperliquid agent, and an audit/revoke layer. The existing product is live at `https://www.protocolbanks.com`.

New work built for HARBOR:

- ME ID binding and mainnet DID verification for the mandate owner.
- ME mainnet MEC settlement adapter with structured audit memos.
- UBI Guard mandate engine and demo flow: approve, over-cap block, human approval, revoke.
- Official ME Bridge adapter and request/record model.
- Mainnet call record generator with a SHA-256 record hash.
- Pilot API and console with API-key auth, idempotency, vendor KYB, daily/monthly caps, and a SHA-256 audit chain.
- Local dashboard and 3–5 minute English demo video.

## Repository

- URL: `https://github.com/everest-an/protocol-bank-harbor`
- Final commit: `fbfba6e` (latest `master`)
- The repository is public and contains no private keys or mnemonics.

## Demo video

- `https://github.com/everest-an/protocol-bank-harbor/releases/download/v1.0-harbor/ubi-guard-demo.mp4`
- Duration: 4:46, English narration.

## Experience mode

Local execution:

```bash
npm install
node build/demo.js
node demo/serve.js
```

The dashboard is served at `http://localhost:8787`.

Pilot API and console:

```bash
PB_API_KEY=pb_pilot_dev_key node server/index.js
```

Open `http://localhost:8790` for the mandate console. Run the tests with `node --test server/test.js`.

Optional mainnet read-only record:

```bash
PROJECT_ADDRESS=me1dppzpwws5lp77h00gx46mq838wa2tzefzfd757 node build/record-mainnet.js
```

Optional dry-run settlement:

```bash
PROJECT_ADDRESS=me1dppzpwws5lp77h00gx46mq838wa2tzefzfd757 \
node build/settle.js --to me1rnrprnaqmmds6jfdmtxasn03se4j52j6kf8qge --amount 0.0001 --memo "UBI-GUARD:demo" --dry-run
```

## Run records

- Mainnet call record: `run-records/mainnet-call-2026-11-25T10-38-44-489Z.json`
  - chain ID `me-chain`, block `16229680`
  - ME ID `2611229468093` → `DID_STATUS_ACTIVE`
  - treasury `me1dpp...` → `0 umec` at record time
  - record hash `ec9ac4701e6c986e2292ebafe87d208defe680e683c9e9981ad7e446e6e4f561`
- Testnet settlement: pending the official faucet claim; will be added as `run-records/testnet-settlement-*.json`.
- Mainnet settlement: pending a small MEC gas top-up; not presented as completed.

## Honest limitation

The treasury wallet has 0 MEC, so the first mainnet settlement is pending gas funding. The submission includes a live mainnet call record, the full policy demo, and a signed testnet settlement when available. We do not represent a testnet transaction as mainnet.
