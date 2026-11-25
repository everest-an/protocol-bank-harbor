const fs = require('fs');
const path = require('path');
const { MandateEngine } = require('./mandate');
const { createBridgeRequest } = require('./me-bridge');

const ME_ID = '2611229468093';
const AGENT_ID = 'agent-data-01';
const VENDOR = 'me1rnrprnaqmmds6jfdmtxasn03se4j52j6kf8qge';
const PROJECT = 'me1dppzpwws5lp77h00gx46mq838wa2tzefzfd757';

function mec(umec) {
  return (umec / 100_000_000).toFixed(8);
}

function main() {
  const engine = new MandateEngine();
  const mandate = engine.createMandate({
    meId: ME_ID,
    agentId: AGENT_ID,
    vendors: [VENDOR],
    perTxCapUmec: 20_000,
    monthlyCapUmec: 60_000,
    expiryDays: 30,
    approvalThresholdUmec: 12_000,
  });

  const decisions = [
    {
      label: 'Approved agent payment',
      amountUmec: 10_000,
      result: engine.authorize({ mandateId: mandate.id, vendor: VENDOR, amountUmec: 10_000, receiptHash: 'demo-receipt-001' }),
    },
    {
      label: 'Over-cap payment',
      amountUmec: 50_000,
      result: engine.authorize({ mandateId: mandate.id, vendor: VENDOR, amountUmec: 50_000, receiptHash: 'demo-receipt-002' }),
    },
    {
      label: 'Above approval threshold',
      amountUmec: 15_000,
      result: engine.authorize({ mandateId: mandate.id, vendor: VENDOR, amountUmec: 15_000, receiptHash: 'demo-receipt-003' }),
    },
    {
      label: 'Human approved payment',
      amountUmec: 15_000,
      result: engine.authorize({ mandateId: mandate.id, vendor: VENDOR, amountUmec: 15_000, receiptHash: 'demo-receipt-003', approvedBy: `human:${ME_ID}` }),
    },
  ];

  engine.revoke(mandate.id);
  decisions.push({
    label: 'After human revoke',
    amountUmec: 2_000,
    result: engine.authorize({ mandateId: mandate.id, vendor: VENDOR, amountUmec: 2_000, receiptHash: 'demo-receipt-004' }),
  });

  const bridge = createBridgeRequest({
    sourceChain: 'BSC',
    asset: 'USDC',
    amount: 1,
    recipient: PROJECT,
  });

  const out = {
    generatedAt: new Date().toISOString(),
    project: 'Protocol Bank UBI Guard',
    team: {
      name: 'Protocol Bank',
      captain: 'Everest An',
      meId: ME_ID,
      captainWallet: 'me1ken8mcs8r7eklv23c7k7swgf3kgph3maasgk9h',
      member: 'AricRedemption 陈紫键',
    },
    mandate: {
      id: mandate.id,
      meId: mandate.meId,
      agentId: mandate.agentId,
      vendor: VENDOR,
      perTxCapMec: mec(mandate.perTxCapUmec),
      monthlyCapMec: mec(mandate.monthlyCapUmec),
      approvalThresholdMec: mec(mandate.approvalThresholdUmec),
      expiresAt: new Date(mandate.expiresAt).toISOString(),
      active: false,
      revokedAt: new Date(mandate.revokedAt).toISOString(),
    },
    decisions: decisions.map((d) => ({
      label: d.label,
      amountUmec: d.amountUmec,
      amountMec: mec(d.amountUmec),
      approved: d.result.approved,
      reason: d.result.reason || null,
      requiresApproval: d.result.requiresApproval || false,
      approvedBy: d.result.approvedBy || null,
      memo: d.result.memo || null,
    })),
    mainnetRecord: {
      file: 'run-records/mainnet-call-2026-11-25T10-38-44-489Z.json',
      chainId: 'me-chain',
      blockHeight: 16229680,
      recordHash: 'ec9ac4701e6c986e2292ebafe87d208defe680e683c9e9981ad7e446e6e4f561',
      did: ME_ID,
      didStatus: 'DID_STATUS_ACTIVE',
      treasury: PROJECT,
      treasuryUmec: '0',
    },
    bridge,
    settlement: {
      mainnet: {
        status: 'pending gas funding',
        amountMec: '0.00010000',
        feeMec: '0.00005000',
        memo: decisions[0].result.memo,
      },
      testnet: {
        status: 'pending faucet claim',
        chainId: 'mechain_400-1',
        txHash: null,
      },
    },
  };

  const dir = path.join(__dirname, '..', 'demo');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'demo-data.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify({ file: path.join(dir, 'demo-data.json'), mandate: out.mandate.id, decisions: out.decisions.length }, null, 2));
}

main();
