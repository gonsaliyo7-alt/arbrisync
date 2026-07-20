const { JsonRpcProvider, Wallet, Contract, parseUnits } = require('ethers');
const fs = require('fs');
const path = require('path');

async function main() {
  const provider = new JsonRpcProvider('https://mainnet.base.org');
  const envPath = path.join(__dirname, '.env');
  const env = fs.readFileSync(envPath, 'utf8');
  const pk = env.match(/PRIVATE_KEY=(.+)/)[1].trim().replace(/['"]/g, '');
  const wallet = new Wallet(pk, provider);

  const weth = '0x4200000000000000000000000000000000000006';
  const aero = '0x940181a94a35a4569e4529a3cdfb74e38fd98631';
  const pancakeRouterAddr = '0x1b81d678ffb9c0263b24a97847620c99d213eb14';

  const routerWithDeadline = new Contract(pancakeRouterAddr, [
    'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) external payable returns (uint256)'
  ], wallet);

  const routerWithoutDeadline = new Contract(pancakeRouterAddr, [
    'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) external payable returns (uint256)'
  ], wallet);

  const amountIn = parseUnits('0.0005', 18);

  console.log('--- Testing PancakeSwap V3 WITH deadline ---');
  try {
    const params = {
      tokenIn: weth,
      tokenOut: aero,
      fee: 2500,
      recipient: wallet.address,
      deadline: Math.floor(Date.now() / 1000) + 300,
      amountIn: amountIn,
      amountOutMinimum: 0,
      sqrtPriceLimitX96: 0
    };
    const tx = await routerWithDeadline.exactInputSingle.populateTransaction(params, { value: amountIn });
    const res = await provider.call({
      to: pancakeRouterAddr,
      from: wallet.address,
      data: tx.data,
      value: amountIn
    });
    console.log('Success WITH deadline! Result:', res);
  } catch (err) {
    console.log('Failed WITH deadline:', err.message);
  }

  console.log('\n--- Testing PancakeSwap V3 WITHOUT deadline ---');
  try {
    const params = {
      tokenIn: weth,
      tokenOut: aero,
      fee: 2500,
      recipient: wallet.address,
      amountIn: amountIn,
      amountOutMinimum: 0,
      sqrtPriceLimitX96: 0
    };
    const tx = await routerWithoutDeadline.exactInputSingle.populateTransaction(params, { value: amountIn });
    const res = await provider.call({
      to: pancakeRouterAddr,
      from: wallet.address,
      data: tx.data,
      value: amountIn
    });
    console.log('Success WITHOUT deadline! Result:', res);
  } catch (err) {
    console.log('Failed WITHOUT deadline:', err.message);
  }
}

main();
