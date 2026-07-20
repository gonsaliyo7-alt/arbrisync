const { JsonRpcProvider, Wallet, Contract, parseUnits } = require('ethers');
const fs = require('fs');
const path = require('path');

async function main() {
  const provider = new JsonRpcProvider('https://mainnet.base.org');
  const envPath = path.join(__dirname, '.env');
  const env = fs.readFileSync(envPath, 'utf8');
  const pk = env.match(/PRIVATE_KEY=(.+)/)[1].trim().replace(/['"]/g, '');
  const wallet = new Wallet(pk, provider);

  const executorAddress = '0x7Ca487DC14Ca79D71d757252159537f749e15eFA';
  const executor = new Contract(executorAddress, [
    'function executeDirectArbitrage(address tokenIn, address tokenOut, uint256 amountIn, address buyDex, address sellDex, uint256 minProfit, bool isV3Buy, bool isV3Sell, uint24 poolFeeBuy, uint24 poolFeeSell) external payable returns (uint256)'
  ], wallet);

  const weth = '0x4200000000000000000000000000000000000006';
  const aero = '0x940181a94a35a4569e4529a3cdfb74e38fd98631';
  const pancakeRouter = '0x1b81d678ffb9c0263b24a97847620c99d213eb14';
  const uniRouter = '0xe592427a0aece92de3edee1f18e0157c05861564';
  const aerodromeRouter = '0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43';
  const amount = parseUnits('0.00138', 18);

  const testCases = [
    { name: 'Pancake (Buy) -> Aero (Sell)', buy: pancakeRouter, sell: aerodromeRouter, isV3Buy: true, isV3Sell: false, feeBuy: 2500, feeSell: 3000 },
    { name: 'Aero (Buy) -> Pancake (Sell)', buy: aerodromeRouter, sell: pancakeRouter, isV3Buy: false, isV3Sell: true, feeBuy: 3000, feeSell: 2500 },
    { name: 'Uni (Buy) -> Aero (Sell)', buy: uniRouter, sell: aerodromeRouter, isV3Buy: true, isV3Sell: false, feeBuy: 3000, feeSell: 3000 },
    { name: 'Aero (Buy) -> Uni (Sell)', buy: aerodromeRouter, sell: uniRouter, isV3Buy: false, isV3Sell: true, feeBuy: 3000, feeSell: 3000 },
    { name: 'Pancake (Buy) -> Uni (Sell)', buy: pancakeRouter, sell: uniRouter, isV3Buy: true, isV3Sell: true, feeBuy: 2500, feeSell: 3000 }
  ];

  for (const tc of testCases) {
    console.log(`\nSimulating ${tc.name}...`);
    try {
      const res = await executor.executeDirectArbitrage.staticCall(
        weth, aero, amount, tc.buy, tc.sell, 1n,
        tc.isV3Buy, tc.isV3Sell, tc.feeBuy, tc.feeSell,
        { value: amount }
      );
      console.log('Success! Result:', res.toString());
    } catch (err) {
      if (err.info && err.info.error) {
        console.log('Failed:', err.info.error.message);
      } else {
        console.log('Failed:', err.message);
      }
    }
  }
}

main();
