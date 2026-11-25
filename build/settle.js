const { MEC, sendMec } = require('./me-settlement');

function parseArgs(argv) {
  const out = { dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--to') out.to = argv[++i];
    else if (a === '--amount') out.amount = argv[++i];
    else if (a === '--memo') out.memo = argv[++i];
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.to) throw new Error('usage: node settle.js --to me1... --amount 0.005 [--memo "..."] [--dry-run]');
  const amountMec = Number(args.amount || '0');
  if (!Number.isFinite(amountMec) || amountMec <= 0) throw new Error('amount must be a positive MEC value');
  const amountUmec = Math.round(amountMec * MEC);
  const memo = args.memo || `PB|meid:2611229468093|settlement|amount:${amountUmec}|ts:${Date.now()}`;
  const result = await sendMec({ to: args.to, amountUmec, memo, dryRun: args.dryRun });
  console.log(JSON.stringify(result, null, 2));
  if (result.code !== undefined && result.code !== 0) process.exit(1);
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
