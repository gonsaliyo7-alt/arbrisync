const { JsonRpcProvider } = require('ethers');

const rpcs = [
  'https://mainnet.base.org',
  'https://base.llamarpc.com',
  'https://1rpc.io/base',
  'https://base-pokt.nodies.app',
  'https://gateway.tenderly.co/public/base'
];

async function main() {
  for (const url of rpcs) {
    console.log(`Connecting to ${url}...`);
    try {
      const provider = new JsonRpcProvider(url, undefined, { staticNetwork: true });
      const block = await provider.getBlockNumber();
      console.log(`Success! Current block: ${block}`);
    } catch (e) {
      console.error(`Failed: ${e.message}`);
    }
  }
}

main();
