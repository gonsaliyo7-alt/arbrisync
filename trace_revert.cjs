const { JsonRpcProvider, Wallet, Contract, parseUnits } = require('ethers');
const fs = require('fs');
const path = require('path');

const rpcs = [
  'https://gateway.tenderly.co/public/base',
  'https://1rpc.io/base',
  'https://base.llamarpoc.com',
  'https://mainnet.base.org'
];

async function main() {
  const envPath = path.join(__dirname, '.env');
  const env = fs.readFileSync(envPath, 'utf8');
  const pk = env.match(/PRIVATE_KEY=(.+)/)[1].trim().replace(/['"]/g, '');

  const executorAddress = '0x244e0b99a0E6ab91539907c92DF5CB15126AAaca';

  for (const rpc of rpcs) {
    console.log(`\n--- Testing with RPC: ${rpc} ---`);
    const p = new JsonRpcProvider(rpc);
    const w = new Wallet(pk, p);

    try {
      const code = await p.getCode(executorAddress);
      console.log('Bytecode length:', code.length);
      if (code.length <= 2) continue;
      
      const executor = new Contract(
        executorAddress,
        [
          'function executeDirectArbitrage(address,address,uint256,address,address,uint256,bool,bool,uint24,uint24) external payable returns (uint256)'
        ],
        w
      );

      const token = '0x940181a94a35a4569e4529a3cdfb74e38fd98631'; // AERO
      const stable = '0x4200000000000000000000000000000000000006'; // WETH
      const amount = parseUnits('0.0005', 18); // ~1.80 USD
      const buyDex = '0xe592427a0aece92de3edee1f18e0157c05861564'; // Uniswap V3 Router
      const sellDex = '0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43'; // Aerodrome Router
      
      console.log('Testing direct swap simulation for AERO...');
      const txData = await executor.executeDirectArbitrage.populateTransaction(
        stable, token, amount, buyDex, sellDex, 0n, true, false, 3000, 3000,
        { value: amount }
      );

      const callResult = await p.call({
        to: executorAddress,
        from: w.address,
        data: txData.data,
        value: amount
      });
      console.log('Call Result Success (Raw hex output):', callResult);
      
      // Try staticCall
      const result = await executor.executeDirectArbitrage.staticCall(
        stable, token, amount, buyDex, sellDex, 0n, true, false, 3000, 3000,
        { value: amount }
      );
      console.log('Static Call Profit:', result.toString());
    } catch (err) {
      console.log('Error Message:', err.message);
      if (err.data) {
        console.log('Raw err.data:', err.data);
      }
      if (err.info && err.info.error) {
        console.log('err.info.error:', err.info.error);
      }
    }
  }
}

main();
