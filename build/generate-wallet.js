const fs = require('fs');
const path = require('path');
const { DirectSecp256k1HdWallet } = require('@cosmjs/proto-signing');
const { StargateClient } = require('@cosmjs/stargate');

(async () => {
  const dir = path.join(__dirname, '..', '.private');
  fs.mkdirSync(dir, { recursive: true });
  const wallet = await DirectSecp256k1HdWallet.generate(24, { prefix: 'me' });
  const [account] = await wallet.getAccounts();
  const mnemonic = wallet.mnemonic;
  const mnemonicPath = path.join(dir, 'project-wallet.mnemonic.txt');
  fs.writeFileSync(mnemonicPath, mnemonic + '\n', { encoding: 'utf8', mode: 0o600 });
  console.log('ADDRESS', account.address);
  console.log('MNEMONIC_FILE', mnemonicPath);

  try {
    const client = await StargateClient.connect('http://118.175.0.247:16657');
    const chainId = await client.getChainId();
    const balance = await client.getBalance(account.address, 'umec');
    console.log('CHAIN_ID', chainId);
    console.log('BALANCE_UMEC', balance.amount);
    client.disconnect();
  } catch (e) {
    console.log('RPC_ERROR', e.message);
  }
})();
