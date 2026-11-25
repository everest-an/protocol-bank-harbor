const { createBridgeRequest, listBridgeTransfers } = require('./me-bridge');

const PROJECT_WALLET = 'me1dppzpwws5lp77h00gx46mq838wa2tzefzfd757';

const request = createBridgeRequest({
  sourceChain: 'BSC',
  asset: 'USDC',
  amount: 1,
  recipient: PROJECT_WALLET,
});

console.log('OFFICIAL_ME_BRIDGE_REQUEST');
console.log(JSON.stringify(request, null, 2));
console.log('RECORDED_TRANSFERS');
console.log(JSON.stringify(listBridgeTransfers(), null, 2));
