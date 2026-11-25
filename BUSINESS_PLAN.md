# Protocol Bank — Agent Spending Control Plane
## Business Plan (HARBOR / pilot version)

> This is a pilot-stage business plan, not a projection of guaranteed revenue. Market sizes and unit economics are explicitly labelled assumptions. The purpose is to show a clear buyer, a clear wedge, a clear price, and a credible path from the HARBOR prototype to a commercial pilot.

## 1. Executive summary

Protocol Bank is the **spending control plane for AI agents**. A verified human gives an agent a budget; the agent can pay approved vendors only inside a server-enforced mandate. The mandate defines the vendor allowlist, per-transaction cap, daily cap, monthly cap, approval threshold, expiry, and instant revoke. Every approved payment produces an audit record and, on ME, a native MEC transfer with a structured memo.

The commercial wedge is not "another wallet" and not "another neobank". It is the **authorization and audit layer** that sits above payment rails:

- AllScale / stablecoin neobanks move the money.
- Stripe Issuing / card providers issue the card.
- Protocol Bank decides **whether the agent is allowed to spend**, **how much**, **with whom**, and **why**.

The first beachhead is the ME ecosystem (ME ID + MEC + HARBOR), where we have a live identity primitive and a real settlement asset. The second beachhead is AI agent platforms and AI-native SaaS that need to give agents a budget without giving them an unrestricted key.

## 2. Problem

AI agents are moving from "suggest a payment" to "make a payment". The current options are bad:

1. **Give the agent a private key.** The agent can drain the wallet, pay any address, and keep spending after the human revokes permission.
2. **Give the agent a custodial account.** The platform holds the funds and becomes a money transmitter / custodian, with the associated licensing and operational burden.
3. **Give the agent a card.** Card controls are coarse (merchant category, monthly limit), not agent-native, not per-task, and not auditable at the agent-action level.

Enterprises and agent platforms need a fourth option: **a programmable mandate that the agent cannot widen, with an audit trail that a finance team, auditor, or judge can verify.**

## 3. Solution

A mandate is a server-enforced policy object:

```text
Human (ME ID / account)
  └─ Mandate
       ├─ agent ID
       ├─ vendor allowlist + KYB status
       ├─ per-transaction cap
       ├─ daily cap
       ├─ monthly cap
       ├─ allowed categories / time window
       ├─ human approval threshold
       ├─ expiry
       └─ instant revoke
```

The agent requests a payment. The policy engine checks the request **before** a transaction is built. If the request is outside the mandate, it is rejected. If it is above the approval threshold, it is held for the human. If it is approved, the settlement adapter builds a transfer with a structured audit memo. The human can revoke at any time.

The product is **non-custodial by design**: Protocol Bank does not need to hold customer funds. The human wallet (or a delegated signer / MPC) signs; the policy engine authorizes. This is the key to a software-only compliance posture.

## 4. Who pays

Three buyer segments, in order of priority:

### A. AI agent platforms and AI-native SaaS

They already have agents that need to buy data, APIs, cloud, or research. They do not want to become a bank or hold customer funds. They need a drop-in mandate API and an audit trail.

**Buyer:** Head of Product / Head of Platform / CTO.
**Budget:** existing infrastructure or product budget.
**Trigger:** an enterprise customer asks "can your agent spend money safely?"

### B. Enterprises deploying agent workflows

Finance, procurement, and security teams need to let agents operate without giving them a corporate card with no controls.

**Buyer:** VP Finance / Head of Procurement / CISO.
**Budget:** expense management, procurement, or security budget.
**Trigger:** an agent pilot reaches the "who approves the spend?" stage.

### C. Payment rails and neobanks (partners, not competitors)

Stablecoin neobanks and card issuers already have accounts, cards, FX, and compliance. They do not have an agent-native policy layer. Protocol Bank can be white-labelled as their "agent controls" module.

**Buyer:** Head of Product / Partnerships at a neobank or issuer.
**Model:** revenue share or per-active-mandate fee.

## 5. Market (bottom-up, assumption-based)

We do not claim a top-down multi-billion TAM. We use a bottom-up wedge:

| Assumption | Year 1 target |
|---|---|
| Target accounts (agent platforms + AI-native SaaS) | 500 |
| Qualified conversations | 100 |
| Design partners | 3 |
| Paying customers by month 12 | 10–20 |
| Average contract value (ACV) | $6,000 |
| Platform ARR at 15 customers | $90,000 |
| Settlement volume per customer / month | $50,000 |
| Take rate | 10 bps |
| Settlement revenue at 15 customers | $9,000 / year |

These are deliberately conservative. The point is not the year-1 number; it is to prove willingness to pay and retention. If the wedge works, the same API can be sold to every agent platform and neobank.

## 6. Product and moat

### Product surface

- **Mandate API** — create, inspect, suspend, revoke.
- **Policy check API** — authorize a payment intent; return approved / blocked / requires approval.
- **Approval inbox** — human approves or denies above-threshold payments.
- **Vendor registry** — wallet address, KYB status, category, risk tier.
- **Audit log** — append-only hash chain, JSON/CSV export, on-chain memo.
- **Settlement adapters** — ME MEC (mainnet/testnet), stablecoin rails via partners, card rails via partners.
- **Dashboard** — mandates, approvals, audit, vendor list.

### Moat

1. **Policy depth** — vendor + category + velocity + time window + approval threshold, not just a monthly limit.
2. **Audit integrity** — hash-chained audit log + on-chain memo; a finance team can verify without trusting the platform.
3. **Identity root** — ME ID gives a real-person root of trust that a raw wallet address does not.
4. **Multi-rail orchestration** — the same mandate can govern MEC, stablecoins, and cards.
5. **Integration switching costs** — once mandates, vendors, and audit history live in the system, replacing it is painful.

The policy engine itself is copyable. The moat is the **integration + audit history + vendor registry + identity root**, not the code.

## 7. Business model

### Pricing

| Plan | Monthly | Included | Overage |
|---|---|---|---|
| Starter | $99 | 5 active mandates, 1,000 policy checks, 1 approver, email support | $0.02/check |
| Growth | $499 | 50 active mandates, 50,000 checks, 5 approvers, webhooks, audit export, Slack support | $0.01/check |
| Enterprise | from $2,000 | SSO, SLA, on-prem policy engine, custom rails, dedicated support | custom |

**Settlement fee:** 10 bps (0.1%) on settled volume, minimum $0.01 per settlement. For ME MEC, the fee can be waived during the HARBOR pilot.

**Pilot offer:** 3 design partners, 90 days, no platform fee, 10 bps settlement fee, co-marketing case study, priority support.

### Why this pricing

- $99 is below the threshold for a product team to expense without procurement.
- $499 maps to a team already paying for auth, observability, or payments infrastructure.
- Enterprise pricing reflects SSO/SLA/on-prem, not seat count.
- The settlement fee aligns revenue with usage and is negligible per transaction.

## 8. Go-to-market

### Phase 1 — HARBOR / ME beachhead (0–3 months)

- Use the HARBOR submission and ME community to recruit 3 design partners.
- Run the pilot on ME testnet first, then mainnet with small caps.
- Publish the "agent spending policy" reference implementation and audit format.
- Target: 3 pilots, 1 real mainnet settlement, 1 case study.

### Phase 2 — Agent platform integrations (3–9 months)

- Integrate with 2–3 agent frameworks / platforms (e.g., LangChain, CrewAI, AutoGen, or a vertical agent platform).
- Offer a hosted mandate API + webhooks + audit export.
- Target: 10 paying customers, $60k ARR.

### Phase 3 — Neobank / issuer partnerships (9–18 months)

- White-label the mandate layer to a stablecoin neobank or card issuer.
- Revenue share on active mandates / settlement volume.
- Target: 1 partnership, 3 enterprise customers.

### Channels

- Founder-led sales: 20 conversations/week.
- ME ecosystem: HARBOR, ME Pass, ME developer community.
- Content: "agent spending policy" benchmark, security checklist, audit format.
- Partnerships: neobanks, card issuers, agent platforms.

## 9. Competition

| Player | What they do | Why we are different |
|---|---|---|
| AllScale | Self-custody stablecoin neobank: accounts, invoicing, payroll, cards, compliance | We are the authorization layer above the rail; partner, not competitor |
| Stripe Issuing | Card issuing + spend controls | Card-centric, not agent-native; no ME ID, no on-chain audit |
| Coinbase AgentKit | Agent wallets and on-chain actions | Key/wallet layer; no server-enforced mandate or approval inbox |
| Agent frameworks | Agent orchestration | No payment policy, no audit, no settlement |
| Custodial agent platforms | Hold funds and pay for the agent | Money transmission/custody burden; we are non-custodial software |

Our positioning:

> **AllScale moves the money. Protocol Bank decides whether the agent may move it.**

## 10. Unit economics (assumptions)

| Metric | Assumption |
|---|---|
| ACV | $6,000 |
| Gross margin | 85% |
| CAC | $3,000 |
| Payback | ~6 months |
| Gross churn | 1.5% / month |
| LTV (3 years) | ~$18,000 |
| LTV / CAC | ~6x |

These are targets, not validated results. The pilot is designed to measure them.

## 11. 12-month plan

| Quarter | Milestone |
|---|---|
| Q1 | 3 design partners; testnet + first mainnet settlement; audit format v1; security review |
| Q2 | Hosted API; 2 agent platform integrations; 5 paying customers; pricing validation |
| Q3 | 10 paying customers; vendor KYB workflow; stablecoin rail partnership |
| Q4 | 15–20 paying customers; 1 neobank white-label pilot; SOC 2 readiness |

## 12. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Agent platforms build their own controls | Integrate early; offer audit/vendor registry they do not want to build |
| Regulatory (money transmission / custody) | Non-custodial software; no customer funds; legal review; partner with licensed rails |
| Demand timing (agent payments early) | Start with agent platforms that already have payment use cases; ME beachhead |
| Security bypass | Deny-by-default engine; property-based tests; external audit; rate limits; signed audit log |
| ME liquidity / gas | Stablecoin rails as primary; MEC as a beachhead; gas top-up process |
| Key management | Human wallet / MPC / delegated signer; never store raw private keys |

## 13. Pilot ask

We are looking for **3 design partners** for a 90-day pilot:

- 1–3 agent workflows that need to spend money
- 1–50 active mandates
- Up to 1,000 policy checks / month
- Up to 10 settlements / month
- Feedback on policy dimensions, approval UX, and audit export
- A case study if the pilot succeeds

Success criteria:

- 95% of policy checks < 100 ms
- 0 unauthorized settlements
- 100% of settlements have an audit record
- 3/3 partners renew or convert to paid

## 14. What "commercially viable" means for this plan

This plan is commercially viable **as a software layer**, not as a neobank:

- No customer funds are held.
- No card issuance or money transmission is performed by Protocol Bank.
- Revenue is SaaS + settlement fees.
- The first 3 pilots can run with the existing ME integration and a small treasury.
- The product can be sold before the full compliance stack is built, as long as it stays non-custodial and the pilot agreement is clear.

The plan is **not** viable as a standalone neobank or UBI distributor. Those require licenses, capital, and a different team. We should not pretend otherwise.
