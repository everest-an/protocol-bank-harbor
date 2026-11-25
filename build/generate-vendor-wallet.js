const fs = require('fs');
const path = require('path');
const { DirectSecp256k1HdWallet } = require('@cosmjs/proto-signing');

(async () => {
  const dir = path.join(__dirname, '..', '.private');
  fs.mkdirSync(dir, { recursive: true });
  const wallet = await DirectSecp256k1HdWallet.generate(24, { prefix: 'me' });
  const [account] = await wallet.getAccounts();
  fs.writeFileSync(path.join(dir, 'vendor-wallet.mnemonic.txt'), wallet.mnemonic + '\n', { encoding: 'utf8', mode: 0o600 });
  console.log('VENDOR_ADDRESS', account.address);
})();
