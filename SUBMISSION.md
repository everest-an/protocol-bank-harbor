# HARBOR 2026 — Project Submission

## Team

- **Team name:** Protocol Bank
- **Captain:** Everest An — ME ID `2611229468093`
- **Member:** AricRedemption 陈紫键
- **Track:** AI and trust infrastructure

## Project

**Protocol Bank — UBI Guard**

### Target users

- ME ID-verified humans who receive UBI, check-in rewards, or a personal MEC budget
- AI agents that pay for data, APIs, cloud, research, and other digital services
- Vendors and service providers that need a verifiable payment mandate

### Problem

ME gives verified humans an identity and a budget. It does not yet give them a safe way to delegate that budget to an AI agent. An agent with a wallet can overspend, pay an unapproved vendor, or keep spending after the human has revoked permission. Existing agent wallets are either fully custodial or give the agent an unrestricted key.

### Core features

1. **Mandate creation** — the human binds a mandate to their ME ID, an agent ID, an approved vendor list, a per-transaction cap, a monthly cap, an expiry, and a human-approval threshold.
2. **Server-enforced policy** — every agent payment is checked against the mandate before a transaction is built. Over-cap, unapproved-vendor, expired, and revoked requests are blocked.
3. **Human approval** — payments above the threshold require an explicit `human:<ME ID>` approval.
4. **Instant revoke** — the human can revoke the mandate; all later requests are denied.
5. **MEC settlement with audit memo** — approved payments are native MEC transfers on ME with a memo containing the ME ID, mandate ID, agent ID, vendor, amount, and receipt hash.
6. **Official ME Bridge adapter** — builds and records BSC/TRON USDC/USDT → ME bridge requests using the official Meta Earth Bridge. The adapter does not custody funds or reimplement the bridge.
7. **Pilot API and console** — a non-custodial REST API with mandate/intent state machines, human approval, settlement recording, idempotency, API-key auth, and a SHA-256 audit chain; plus a local console for the full flow.

### Commercial model

- **Buyer:** AI agent platforms, AI-native SaaS, and enterprises deploying agent workflows.
- **Pricing:** $99 Starter / $499 Growth / enterprise SaaS, plus 10 bps on settled volume.
- **Pilot:** 3 design partners, 90 days, no platform fee, 10 bps settlement fee.
- **Positioning:** the authorization/audit layer above payment rails (AllScale, stablecoin neobanks, card issuers), not a neobank and not a UBI distributor.
- **Compliance posture:** non-custodial software; no customer funds, no private keys, no card issuance.

### ME access methods

- **ME ID / DID lookup:** the mandate is rooted in ME ID `2611229468093`; the engine queries the ME mainnet DID module to verify the human and the bound address.
- **ME mainnet settlement:** native `umec` transfer on `me-chain` through `@cosmjs/stargate`, with the mandate memo.
- **ME testnet:** the same settlement flow on `mechain_400-1` using the official faucet.
- **Official ME Bridge:** `https://bridge.mec.me/` for BSC/TRON USDC/USDT → ME.

### Existing foundation

Protocol Bank already operates an agent-commerce control plane with agent-scoped card controls in provider onboarding, x402/EIP-3009 payment rails, a trading-only Hyperliquid agent, and an audit/revoke layer. The existing product is live at `https://www.protocolbanks.com`.

### New work built for HARBOR

- ME ID binding and mainnet DID verification for the mandate owner.
- ME mainnet MEC settlement adapter with structured audit memos.
- UBI Guard mandate engine and demo flow (approve, over-cap block, human approval, revoke).
- Official ME Bridge adapter and request/record model.
- Mainnet call record generator with a SHA-256 record hash.
- Pilot API and console with API-key auth, idempotency, vendor KYB, daily/monthly caps, and a SHA-256 audit chain.
- Testnet settlement path using the official ME faucet (run record pending).

## Evidence of ME usage

### Mainnet call record

`run-records/mainnet-call-2026-11-25T10-38-44-489Z.json`

- Chain ID: `me-chain`
- Block: `16229680`
- ME ID `2611229468093`: `DID_STATUS_ACTIVE`, bound to `me1ken8mcs8r7eklv23c7k7swgf3kgph3maasgk9h`
- Minimum gas price: `0.020000000000000000umec`
- Treasury: `me1dppzpwws5lp77h00gx46mq838wa2tzefzfd757` (`0 umec` at record time)
- Mandate decision: `approved`
- Record hash: `ec9ac4701e6c986e2292ebafe87d208defe680e683c9e9981ad7e446e6e4f561`

### Testnet settlement

`run-records/testnet-settlement-*.json`

- Chain ID: `mechain_400-1`
- Faucet: `https://www.mec.me/en-US/faucet`
- Transaction hash: `TBD`
- Explorer: `TBD`

### Mainnet settlement

`run-records/mainnet-settlement-*.json` (pending gas funding)

- Treasury needs approximately `0.0005 MEC` for the first settlement and audit transaction.
- The treasury funding source is the captain's ME Pass staking income; the ME Lite → ME Pass transfer requires `0.0001 MEC` gas, which is the current blocker.

## Repository

- Repository: `https://github.com/everest-an/protocol-bank-harbor`
- Final commit: `5b2a69d`
- Run instructions: `README.md`

## Demo video

- 3–5 minutes, English narration
- Link: `https://github.com/everest-an/protocol-bank-harbor/releases/download/v1.0-harbor/ubi-guard-demo.mp4`
- Release page: `https://github.com/everest-an/protocol-bank-harbor/releases/tag/v1.0-harbor`

## Experience mode

Local execution:

```bash
npm install
node build/demo.js
```

Optional dry run:

```bash
PROJECT_ADDRESS=me1dppzpwws5lp77h00gx46mq838wa2tzefzfd757 \
node build/settle.js --to me1rnrprnaqmmds6jfdmtxasn03se4j52j6kf8qge --amount 0.0001 --memo "UBI-GUARD:demo" --dry-run
```

## Submission status

- HARBOR registration submitted on 2026-11-25 (team Protocol Bank, captain ME ID `2611229468093`).
- Pre-submission package sent to `build@openbuild.xyz` on 2026-11-25, requesting the official project portal link.
- Official project portal: pending publication in the HARBOR community channel.
- The repository, demo video, mainnet call record, and official bridge adapter are ready for the portal entry.

## Security and limitations

- The repository does not contain private keys or mnemonics.
- The mainnet treasury is unfunded at record time; the mainnet settlement is pending a small MEC gas top-up.
- The official ME Bridge does not mint MEC; bridged USDC still needs a swap to MEC for gas.
- The testnet transaction is clearly labeled as testnet and is not presented as a mainnet transaction.
