# HARBOR Build Plan — Protocol Bank UBI Guard

**Decision:** Build on ME mainnet. The HARBOR feature is **Protocol Bank UBI Guard** — a verified human (ME ID) delegates a bounded budget to an AI agent; the agent can pay approved services within the mandate, and the settlement/audit is recorded on ME mainnet.

## Why UBI Guard (not a UBI clone)

- ME already owns UBI distribution. A clone would be redundant, regulated and hard to differentiate.
- UBI Guard is complementary: it protects the **spending** side of UBI and makes UBI usable in the agent economy.
- It uses ME's strongest primitives: **ME ID** as proof of personhood and the human root of trust; **MEC** as the settlement asset; **ME mainnet** as the audit anchor.
- It showcases Protocol Bank's real differentiator: a server-enforced mandate that an agent cannot widen, with revoke and audit.

## Product story

A verified ME ID holder allocates a small budget (UBI / check-in rewards / personal budget) to an AI agent. The agent can buy approved services (data, API, cloud, research) only within:

- approved merchant/vendor list
- per-transaction and monthly caps
- expiry
- human approval threshold
- instant revoke

Every settlement is a real MEC transfer on ME mainnet with a memo containing the ME ID, mandate ID, agent ID and receipt hash. The human can audit and revoke at any time.

## Mainnet MVP

### On-chain

- **Settlement:** native MEC transfer on ME mainnet (`me-chain`, denom `umec`) with a structured memo:
  `PB|meid:2611229468093|mandate:<id>|agent:<id>|receipt:<hash>`
- **Optional (if gas/time allows):** a minimal CosmWasm mandate registry on ME mainnet with `create_mandate`, `pay`, `revoke`, `query`; or an EVM contract if a validated mainnet EVM RPC/chain ID is available.
- **Run records:** ME Explorer links for the deployment (if contract) and each settlement transaction.

### Off-chain

- Mandate engine (TypeScript/Node): create mandate, policy check, payment proposal, approval, revoke, audit export.
- Demo UI or script: human creates mandate; agent pays an approved service; over-cap payment blocked; revoke; audit view.
- Settlement adapter: signs and broadcasts the MEC transfer with the memo; stores tx hash and receipt.
- Official ME Bridge adapter (`build/me-bridge.js`): builds a request for the official bridge (BSC/TRON USDC/USDT → ME), validates the ME recipient, and records the source/mint tx hashes. This is an integration with the official bridge, not a custom bridge. It does not mint MEC; the bridged USDC still needs a swap to MEC for gas.

## Mainnet wallet

A dedicated project treasury wallet has been generated:

- **Address:** `me1dppzpwws5lp77h00gx46mq838wa2tzefzfd757`
- **Network:** ME mainnet (`me-chain`)
- **Mnemonic:** stored locally at `E:\HARBOR\.private\project-wallet.mnemonic.txt` — back it up offline, never share or commit.
- **Current balance:** 0 MEC

**Funding needed (corrected 25 Nov):** the ME mainnet bank metadata is **1 MEC = 100,000,000 umec (8 decimals)**, not 6. Minimum gas price is `0.02 umec/gas`; a bank send with a 250,000 gas limit costs `5,000 umec = 0.00005 MEC`. The project wallet needs roughly **0.0004 MEC** (a 0.0001 MEC settlement plus fee, with buffer), not 0.1 MEC.

**Source found:** the captain ME Pass account `me1ken8mcs8r7eklv23c7k7swgf3kgph3maasgk9h` holds **0.00053696 MEC withdrawable staking income** (`fixibleInfo.reward`, ME Hub wstaking) plus 0.0001 MEC on the rollapp. ME Pass Lite (web) is read-only for Send/Withdraw; the mobile ME Pass app is required to sign the withdrawal and transfer. The project treasury is funded by withdrawing that staking income and sending ~0.0004 MEC to `me1dpp...`. This avoids buying MEC or bridging USDC.


## Demo flow (3–5 minutes)

1. Show ME ID `2611229468093` as the verified human owner.
2. Create a mandate: agent, approved vendor, 0.0006 MEC monthly cap, expiry.
3. Agent requests an approved 0.0001 MEC payment → mandate approves → real MEC transfer on ME mainnet with memo.
4. Agent requests 0.0005 MEC → blocked by the mandate before any transaction.
5. Human revokes the mandate → agent request blocked.
6. Show the ME Explorer transaction and the audit receipt.

## Deliverables for HARBOR

- Code repository with README and run instructions
- 3–5 minute English demo video
- ME mainnet transaction records (tx hashes / Explorer links)
- Project description: users, problem, core features, ME access method
- Optional: contract address and deployment record

## Timeline

- **Now:** fund project wallet with ~0.1 MEC; build mandate engine + settlement adapter.
- **By 5 Dec:** first real mainnet MEC settlement with memo; record tx.
- **By 12 Dec:** demo UI/script, revoke flow, audit view; optional contract.
- **By 18 Dec:** record 3–5 minute demo video, finalize repo and submission materials.
- **21 Dec 15:59 UTC:** HARBOR submission deadline.

## Risks

- **Gas:** mainnet minimum ~0.01 MEC/tx; current wallet 0. Need funding.
- **ME ID binding:** the project treasury wallet is separate from the ME ID-bound Lite wallet. The ME ID is the identity root in the memo/registration; the treasury wallet signs settlement. If judges require the tx signer to be the ME ID wallet, we can bind a sub-account later or use the ME Pass app wallet.
- **Contract:** mainnet EVM RPC/chain ID is not published in the SDK config; WASM is the supported path. Start with native settlement + memo; add WASM only if gas/time allows.
