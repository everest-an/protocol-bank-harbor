const fs = require('fs');
const path = require('path');

const BRIDGE_URL = 'https://bridge.mec.me/';
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'bridge-transfers.json');
const SUPPORTED_CHAINS = ['BSC', 'TRON'];
const SUPPORTED_ASSETS = ['USDC', 'USDT'];
const MIN_AMOUNT = 1;
const MAX_AMOUNT = 100000;

function isMeAddress(address) {
  return typeof address === 'string' && /^me1[0-9a-z]{20,}$/.test(address);
}

function load() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) return { transfers: [] };
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function save(state) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2));
}

/**
 * Build a request for the OFFICIAL Meta Earth Bridge.
 * This adapter does not custody funds and does not reimplement the bridge.
 */
function createBridgeRequest({ sourceChain, asset, amount, recipient }) {
  const chain = String(sourceChain || '').toUpperCase();
  const token = String(asset || '').toUpperCase();
  const value = Number(amount);
  if (!SUPPORTED_CHAINS.includes(chain)) throw new Error(`unsupported source chain: ${chain}. Use BSC or TRON.`);
  if (!SUPPORTED_ASSETS.includes(token)) throw new Error(`unsupported asset: ${token}. Use USDC or USDT.`);
  if (!Number.isFinite(value) || value < MIN_AMOUNT || value > MAX_AMOUNT) {
    throw new Error(`amount must be between ${MIN_AMOUNT} and ${MAX_AMOUNT}`);
  }
  if (!isMeAddress(recipient)) throw new Error('recipient must be a ME address (me1...)');

  return {
    bridge: 'Meta Earth Bridge (official)',
    bridgeUrl: BRIDGE_URL,
    sourceChain: chain,
    asset: token,
    amount: value,
    recipient,
    steps: [
      `Open ${BRIDGE_URL}`,
      `Connect the ${chain} wallet that holds ${token}`,
      `Select ${chain} -> Meta Earth`,
      `Select ${token} and amount ${value}`,
      `Set recipient to ${recipient}`,
      'Confirm the bridge transaction and pay the source-chain gas',
      'Save the source transaction hash and the Meta Earth mint transaction hash',
      `After ${token} arrives on Meta Earth, swap it to MEC in ME Pass / UnitySwap before using it for gas`,
    ],
    notes: [
      'The official bridge supports USDC/USDT from BSC and TRON to Meta Earth.',
      'The bridge does not mint MEC. MEC is the native gas token and must be obtained separately.',
      'Minimum bridge amount shown by the official UI is 1 USDC/USDT; maximum is 100,000.',
      'Never send USDC/USDT directly to a me1... address outside the official bridge.',
    ],
  };
}

function recordBridgeTransfer({ sourceChain, asset, amount, recipient, sourceTxHash, meTxHash, note }) {
  if (!sourceTxHash) throw new Error('sourceTxHash is required');
  const state = load();
  const record = {
    id: `bridge-${Date.now()}`,
    bridge: 'Meta Earth Bridge (official)',
    sourceChain: String(sourceChain || '').toUpperCase(),
    asset: String(asset || '').toUpperCase(),
    amount: Number(amount),
    recipient,
    sourceTxHash,
    meTxHash: meTxHash || null,
    note: note || null,
    status: meTxHash ? 'minted' : 'source-confirmed',
    createdAt: new Date().toISOString(),
  };
  state.transfers.push(record);
  save(state);
  return record;
}

function listBridgeTransfers() {
  return load().transfers;
}

module.exports = {
  BRIDGE_URL,
  SUPPORTED_CHAINS,
  SUPPORTED_ASSETS,
  MIN_AMOUNT,
  MAX_AMOUNT,
  createBridgeRequest,
  recordBridgeTransfer,
  listBridgeTransfers,
};
