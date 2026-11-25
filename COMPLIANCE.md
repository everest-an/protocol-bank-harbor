# Protocol Bank — Compliance and Launch Checklist (Pilot v1)

> This document is an internal launch checklist, not legal advice. Before a production launch, obtain a written opinion from counsel in each operating jurisdiction, especially on money transmission, custody, card issuance, and UBI-related marketing.

## 1. Product posture

Protocol Bank Mandate is **software** that authorizes payments against a human-owned mandate. The pilot is designed to be **non-custodial**:

- Protocol Bank does not hold customer funds.
- Protocol Bank does not store private keys or mnemonics.
- Protocol Bank does not issue cards or maintain bank accounts.
- Settlement is signed by the human/treasury wallet or a partner institution.
- The policy engine only returns an authorization decision and an audit record.

If any of these change, the compliance analysis changes. Do not custody funds or issue cards without the appropriate licenses/partners.

## 2. Regulatory questions to resolve before production

| Question | Why it matters | Pilot mitigation |
|---|---|---|
| Does authorizing a payment constitute money transmission? | Money transmission licensing is fact-specific | Non-custodial software; no funds held; counsel opinion |
| Does the platform act as a custodian? | Custody triggers capital, segregation, and licensing | No private keys; no customer balances |
| Is the product a card issuer/processor? | Card issuance is regulated | No card issuance in pilot; partner with issuer |
| Is "UBI Guard" marketing a regulated financial promotion? | UBI/benefits claims can be regulated | Describe it as a spending control, not a UBI promise |
| Are vendor payments subject to AML/KYB? | B2B payments can be covered | Vendor KYB workflow; sanctions screening |
| Does the audit log contain personal data? | Privacy/GDPR/PDPO obligations | Data minimization; retention policy; DPA |
| Are cross-border payments subject to sanctions? | OFAC/EU/HK sanctions | Screen vendor addresses/entities; block high-risk jurisdictions |

## 3. KYB / AML workflow (pilot)

For each vendor:

1. Collect legal name, registration number, jurisdiction, beneficial owner, and wallet address.
2. Screen against sanctions/PEP lists (manual or vendor API).
3. Assign a risk tier: low / medium / high.
4. Store `kybStatus`: `pending` / `approved` / `rejected`.
5. Only `approved` vendors can receive payments by default. A pilot flag can allow `pending` for testnet only.
6. Re-screen on a schedule (e.g., quarterly) and on material changes.

For each human owner:

1. Verify the ME ID / DID status.
2. Bind the mandate to the ME ID and the signing wallet.
3. Record the approval/revoke events.

## 4. Recordkeeping

- Retain mandate, intent, approval, settlement, and audit records for at least 5 years (or the local requirement).
- Store the audit hash chain and the on-chain memo.
- Export formats: JSON and CSV.
- Backups: encrypted, access-controlled, tested restore.
- No private keys in the database or logs.

## 5. Data protection

- Collect only what is needed: ME ID, wallet address, vendor legal name, KYB status, payment metadata.
- Do not store raw KYC documents in the pilot; use a KYC partner or a secure vault.
- Encrypt at rest and in transit.
- Role-based access: owner, approver, auditor, support.
- Log access to audit data.
- Retention and deletion policy per jurisdiction.

## 6. Security controls (pilot)

- API keys hashed at rest; show once.
- Rate limiting and body size limits.
- Idempotency keys for all mutating endpoints.
- Deny-by-default policy engine.
- Input validation on amounts, addresses, and vendor IDs.
- Audit hash chain + daily integrity check.
- Secrets in a managed vault, not in the repo.
- Dependency scanning and `npm audit`.
- Incident response runbook and contact.

## 7. Launch checklist

### Before testnet pilot

- [ ] Non-custodial architecture documented
- [ ] No private keys in repo/DB/logs
- [ ] API key auth + rate limits
- [ ] Mandate/intent state machine tested
- [ ] Audit hash chain tested
- [ ] Vendor allowlist + KYB status
- [ ] Testnet settlement recorded
- [ ] Pilot agreement signed

### Before mainnet pilot

- [ ] Counsel review of money transmission/custody
- [ ] Sanctions screening process
- [ ] Treasury/key management (MPC/HSM or human signer)
- [ ] Monitoring/alerting for blocked and settled payments
- [ ] Reconciliation process
- [ ] Incident response contact
- [ ] Caps and manual approval enabled
- [ ] First mainnet settlement with a small amount

### Before paid production

- [ ] SOC 2 readiness or equivalent
- [ ] Penetration test
- [ ] DPA/privacy policy
- [ ] SLA/support
- [ ] Billing and dunning
- [ ] Vendor KYB at scale
- [ ] Partner/licensing model confirmed
- [ ] Insurance review

## 8. Marketing guardrails

- Do not say "Protocol Bank is a bank" or "we hold your money".
- Do not say "guaranteed UBI" or "risk-free yield".
- Do not present testnet transactions as mainnet.
- Do not claim partnerships or licenses that are not signed.
- Clearly label the pilot's caps, limitations, and non-custodial model.

## 9. Open items for counsel

1. Is the mandate/authorization function money transmission in HK, SG, EU, US?
2. Does the settlement signer model create custody?
3. What disclosures are required for agent-initiated payments?
4. What are the AML/KYB obligations for vendor payments?
5. Can "UBI Guard" be marketed to ME ID holders without a financial promotion license?
6. What are the cross-border data transfer requirements for audit logs?
