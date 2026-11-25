const fs = require('fs');
const path = require('path');
const { DirectSecp256k1HdWallet } = require('@cosmjs/proto-signing');
const { SigningStargateClient, StargateClient } = require('@cosmjs/stargate');

const RPC = process.env.ME_RPC || 'http://118.175.0.247:16657';
const DENOM = 'umec';
// On ME mainnet the bank metadata is: 1 MEC display = 100,000,000 umec (exponent 8).
const MEC = 100_000_000;
// 0.02 umec/gas minimum; 250k gas is a safe bank-send limit.
const FEE = { amount: [{ denom: DENOM, amount: '5000' }], gas: '250000' }; // 0.00005 MEC

async function getProjectWallet() {
  const mnemonicPath = path.join(__dirname, '..', '.private', 'project-wallet.mnemonic.txt');
  if (!fs.existsSync(mnemonicPath)) throw new Error(`mnemonic not found: ${mnemonicPath}`);
  const mnemonic = fs.readFileSync(mnemonicPath, 'utf8').trim();
  return DirectSecp256k1HdWallet.fromMnemonic(mnemonic, { prefix: 'me' });
}

async function getProjectAddress() {
  if (process.env.PROJECT_ADDRESS) return process.env.PROJECT_ADDRESS;
  const wallet = await getProjectWallet();
  const [account] = await wallet.getAccounts();
  return account.address;
}

async function getBalance(address) {
  const client = await StargateClient.connect(RPC);
  const chainId = await client.getChainId();
  const balance = await client.getBalance(address, DENOM);
  client.disconnect();
  return { chainId, balanceUmec: balance.amount };
}

async function sendMec({ to, amountUmec, memo, dryRun = false }) {
  if (!to) throw new Error('recipient is required');
  if (!Number.isInteger(amountUmec) || amountUmec <= 0) throw new Error('amountUmec must be a positive integer');
  const from = await getProjectAddress();

  if (dryRun) {
    const { chainId, balanceUmec } = await getBalance(from);
    return {
      dryRun: true,
      rpc: RPC,
      chainId,
      from,
      to,
      amountUmec,
      feeUmec: Number(FEE.amount[0].amount),
      balanceUmec,
      sufficient: Number(balanceUmec) >= amountUmec + Number(FEE.amount[0].amount),
      memo,
    };
  }

  const wallet = await getProjectWallet();
  const client = await SigningStargateClient.connectWithSigner(RPC, wallet);
  const chainId = await client.getChainId();
  const balance = await client.getBalance(from, DENOM);
  if (Number(balance.amount) < amountUmec + Number(FEE.amount[0].amount)) {
    client.disconnect();
    throw new Error(`insufficient balance: ${balance.amount} umec, need ${amountUmec + Number(FEE.amount[0].amount)} umec (amount + fee)`);
  }
  const result = await client.sendTokens(from, to, [{ denom: DENOM, amount: String(amountUmec) }], FEE, memo);
  client.disconnect();
  return {
    chainId,
    from,
    to,
    amountUmec,
    feeUmec: Number(FEE.amount[0].amount),
    txHash: result.transactionHash,
    code: result.code,
    height: result.height,
    memo,
    explorer: `https://explorer.mec.me/en-US/transactions/${result.transactionHash}`,
  };
}

module.exports = { RPC, DENOM, MEC, FEE, getProjectWallet, getProjectAddress, getBalance, sendMec };
