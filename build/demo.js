const { MandateEngine } = require('./mandate');
const { MEC, sendMec } = require('./me-settlement');

const ME_ID = '2611229468093';
const AGENT_ID = 'agent-data-01';
const VENDOR = 'me1rnrprnaqmmds6jfdmtxasn03se4j52j6kf8qge';

function fmt(umec) {
  return `${umec} umec (${(umec / MEC).toFixed(8)} MEC)`;
}

async function main() {
  const settle = process.argv.includes('--settle');
  const engine = new MandateEngine();
  const mandate = engine.createMandate({
    meId: ME_ID,
    agentId: AGENT_ID,
    vendors: [VENDOR],
    perTxCapUmec: 20_000,        // 0.0002 MEC
    monthlyCapUmec: 60_000,      // 0.0006 MEC
    expiryDays: 30,
    approvalThresholdUmec: 12_000, // above 0.00012 MEC needs human approval
  });
  console.log('MANDATE', JSON.stringify({ id: mandate.id, meId: mandate.meId, agentId: mandate.agentId, vendor: VENDOR, perTxCap: fmt(mandate.perTxCapUmec), monthlyCap: fmt(mandate.monthlyCapUmec) }, null, 2));

  const ok = engine.authorize({ mandateId: mandate.id, vendor: VENDOR, amountUmec: 10_000, receiptHash: 'demo-receipt-001' });
  console.log('APPROVED_0.0001', JSON.stringify(ok, null, 2));

  if (settle && ok.approved) {
    const tx = await sendMec({ to: VENDOR, amountUmec: 10_000, memo: ok.memo });
    console.log('SETTLEMENT', JSON.stringify(tx, null, 2));
    if (tx.code === 0) engine.recordSettlement({ mandateId: mandate.id, amountUmec: 10_000, txHash: tx.txHash });
  }

  const overCap = engine.authorize({ mandateId: mandate.id, vendor: VENDOR, amountUmec: 50_000, receiptHash: 'demo-receipt-002' });
  console.log('BLOCKED_OVER_CAP', JSON.stringify(overCap, null, 2));

  const needsApproval = engine.authorize({ mandateId: mandate.id, vendor: VENDOR, amountUmec: 15_000, receiptHash: 'demo-receipt-003' });
  console.log('NEEDS_APPROVAL', JSON.stringify(needsApproval, null, 2));

  const approved = engine.authorize({ mandateId: mandate.id, vendor: VENDOR, amountUmec: 15_000, receiptHash: 'demo-receipt-003', approvedBy: `human:${ME_ID}` });
  console.log('APPROVED_WITH_HUMAN', JSON.stringify(approved, null, 2));

  engine.revoke(mandate.id);
  const afterRevoke = engine.authorize({ mandateId: mandate.id, vendor: VENDOR, amountUmec: 2_000, receiptHash: 'demo-receipt-004' });
  console.log('BLOCKED_AFTER_REVOKE', JSON.stringify(afterRevoke, null, 2));
  console.log('FINAL_STATE', JSON.stringify(engine.get(mandate.id), null, 2));
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
