# Protocol Bank — 90-Day Pilot Agreement (Template)

> Template for discussion. Not legal advice. Both parties should have counsel review before signing.

## 1. Parties

- **Provider:** Protocol Bank / Everest Holdings Group Co., Limited
- **Customer:** ____________________
- **Pilot start:** __________
- **Pilot end:** __________ (90 days)

## 2. Scope

Provider will make the Protocol Bank Mandate API and dashboard available to Customer for a pilot covering:

- up to 50 active mandates
- up to 50,000 policy checks per month
- up to 10 settlements per month
- one environment (testnet or mainnet, as agreed)
- one approver group
- email/Slack support during business hours

Out of scope: custody, card issuance, fiat on/off-ramp, UBI distribution, custom rails, SSO, SLA.

## 3. Fees

- Platform fee: **$0** during the 90-day pilot.
- Settlement fee: **10 bps (0.1%)** of settled volume, minimum $0.01 per settlement.
- ME MEC settlements: fee waived during the HARBOR pilot.
- After the pilot: Starter $99/month or Growth $499/month, as agreed.

## 4. Customer responsibilities

- Provide a test wallet and a small treasury for settlement.
- Complete ME ID / KYC for the human owner.
- Provide vendor information for KYB.
- Set conservative caps for the pilot.
- Approve above-threshold payments in the dashboard.
- Report bugs and feedback within 5 business days.
- Do not use the pilot for consumer funds, custody, or regulated lending.

## 5. Provider responsibilities

- Provide API access, documentation, and run instructions.
- Maintain a deny-by-default policy engine.
- Record an audit event for every decision and settlement.
- Not store private keys or customer funds.
- Provide a weekly pilot review.
- Fix critical bugs within 2 business days.
- Provide a case study draft at the end of the pilot (subject to Customer approval).

## 6. Data and privacy

- Provider processes mandate, vendor, payment, and audit data to provide the service.
- Provider does not store raw KYC documents; KYC is handled by the Customer or a KYC partner.
- Provider may use aggregated, de-identified data for product improvement.
- Customer owns its mandate and audit data; Provider provides export on request.
- Data retention: 12 months after pilot end, unless a longer period is required by law.

## 7. Security

- API keys are hashed at rest and shown once.
- Rate limits and idempotency are enforced.
- Audit log is hash-chained.
- Provider will notify Customer of a confirmed security incident within 72 hours.
- Provider will not store private keys or mnemonics.

## 8. Compliance

- The pilot is non-custodial software.
- Provider does not hold customer funds, issue cards, or transmit money.
- Customer is responsible for its own regulatory status and vendor relationships.
- Both parties will comply with applicable sanctions and AML laws.
- Neither party will use the pilot for prohibited jurisdictions or persons.

## 9. Intellectual property

- Provider owns the Protocol Bank software, API, and documentation.
- Customer owns its data, vendor list, and feedback.
- Customer grants Provider a limited license to use its name/logo in a case study only with written approval.

## 10. Limitation of liability

- Pilot software is provided "as is" during the pilot.
- Provider's aggregate liability is capped at the fees paid during the pilot (or $1,000 if no fees were paid).
- Neither party is liable for indirect, incidental, or consequential damages.
- Customer is responsible for the amounts it authorizes and the vendors it approves.

## 11. Termination

- Either party may terminate with 14 days' written notice.
- Provider may suspend immediately for security, sanctions, or illegal use.
- On termination, Provider will export Customer data within 30 days.

## 12. Success criteria

- 95% of policy checks < 100 ms
- 0 unauthorized settlements
- 100% of settlements have an audit record
- 3/3 pilot workflows complete
- Customer renews or converts to a paid plan

## 13. Signatures

**Provider:** ____________________  Date: __________

**Customer:** ____________________  Date: __________
