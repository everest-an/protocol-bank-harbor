const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { StargateClient } = require('@cosmjs/stargate');
const { getProjectAddress } = require('./me-settlement');
const { MandateEngine } = require('./mandate');

const RPC = process.env.ME_RPC || 'http://118.175.0.247:16657';
const LCD = process.env.ME_LCD || 'http://118.175.0.247:11317';
const DENOM = 'umec';
const MEC = 100_000_000;
const ME_ID = '2611229468093';
const CAPTAIN = 'me1ken8mcs8r7eklv23c7k7swgf3kgph3maasgk9h';
const VENDOR = 'me1rnrprnaqmmds6jfdmtxasn03se4j52j6kf8qge';

async function lcd(pathname) {
  const res = await fetch(`${LCD}${pathname}`);
  if (!res.ok) throw new Error(`LCD ${pathname} -> ${res.status}`);
  return res.json();
}

async function main() {
  const client = await StargateClient.connect(RPC);
  const chainId = await client.getChainId();
  const height = await client.getHeight();
  const block = await client.getBlock(height);
  const project = await getProjectAddress();
  const projectBalance = await client.getBalance(project, DENOM);
  const vendorBalance = await client.getBalance(VENDOR, DENOM);
  client.disconnect();

  const meId = await lcd(`/metaearth/did/did?address=${CAPTAIN}`);
  const nodeConfig = await lcd('/cosmos/base/node/v1beta1/config');
  const supply = await lcd(`/cosmos/bank/v1beta1/supply/by_denom?denom=${DENOM}`);

  const engine = new MandateEngine();
  const mandate = engine.createMandate({
    meId: ME_ID,
    agentId: 'agent-data-01',
    vendors: [VENDOR],
    perTxCapUmec: 20_000,
    monthlyCapUmec: 60_000,
    expiryDays: 30,
    approvalThresholdUmec: 12_000,
  });
  const decision = engine.authorize({
    mandateId: mandate.id,
    vendor: VENDOR,
    amountUmec: 10_000,
    receiptHash: 'mainnet-record-receipt-001',
  });

  const record = {
    project: 'Protocol Bank / HARBOR UBI Guard',
    network: 'ME mainnet',
    chainId,
    rpc: RPC,
    lcd: LCD,
    block: {
      height,
      hash: block.id,
      time: block.header.time,
    },
    meId: {
      captain: CAPTAIN,
      did: meId.info?.did || null,
      status: meId.info?.status || null,
      kycLevel: meId.info?.kycLevel || null,
      boundAddress: meId.info?.address || null,
    },
    balances: {
      project,
      projectUmec: projectBalance.amount,
      projectMec: (Number(projectBalance.amount) / MEC).toFixed(8),
      vendor: VENDOR,
      vendorUmec: vendorBalance.amount,
      vendorMec: (Number(vendorBalance.amount) / MEC).toFixed(8),
    },
    chain: {
      minimumGasPrice: nodeConfig.minimum_gas_price,
      supplyUmec: supply.amount?.amount || null,
      denomExponent: 8,
    },
    mandate: {
      id: mandate.id,
      perTxCapUmec: mandate.perTxCapUmec,
      monthlyCapUmec: mandate.monthlyCapUmec,
      approvalThresholdUmec: mandate.approvalThresholdUmec,
      decision,
    },
    settlementPlan: {
      from: project,
      to: VENDOR,
      amountUmec: 10_000,
      amountMec: '0.00010000',
      feeUmec: 5_000,
      feeMec: '0.00005000',
      memo: decision.memo,
      broadcast: false,
      reason: 'Project treasury has 0 umec; a real broadcast requires MEC gas funding.',
    },
  };

  const canonical = JSON.stringify(record, Object.keys(record).sort());
  record.recordHash = crypto.createHash('sha256').update(canonical).digest('hex');

  const dir = path.join(__dirname, '..', 'run-records');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `mainnet-call-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(file, JSON.stringify(record, null, 2));

  console.log(JSON.stringify({ file, recordHash: record.recordHash, blockHeight: height, chainId, project, projectUmec: projectBalance.amount, meId: record.meId, decision: decision.approved ? 'approved' : decision.reason }, null, 2));
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
