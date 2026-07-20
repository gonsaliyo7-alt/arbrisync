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

  // Let's simulate AERO: PancakeSwap (buy) -> Uniswap V3 (sell)
  const weth = '0x4200000000000000000000000000000000000006';
  const aero = '0x940181a94a35a4569e4529a3cdfb74e38fd98631';
  const pancakeRouter = '0x1b81d678ffb9c0263b24a97847620c99d213eb14';
  const uniRouter = '0xe592427a0aece92de3edee1f18e0157c05861564';
  const amount = parseUnits('0.00138', 18);

  console.log('Simulating WETH -> AERO (Pancake V3) -> WETH (Uni V3)...');
  try {
    const res = await executor.executeDirectArbitrage.staticCall(
      weth, aero, amount, pancakeRouter, uniRouter, 1n,
      true, true, 2500, 3000,
      { value: amount }
    );
    console.log('Success! Result:', res.toString());
  } catch (err) {
    console.log('Simulation failed:', err.message);
    if (err.data) console.log('Data:', err.data);
  }
}

main();
