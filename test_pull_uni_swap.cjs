const { JsonRpcProvider, Wallet, Contract, parseUnits } = require('ethers');
const fs = require('fs');
const path = require('path');

async function main() {
  const provider = new JsonRpcProvider('https://mainnet.base.org');
  const envPath = path.join(__dirname, '.env');
  const env = fs.readFileSync(envPath, 'utf8');
  const pk = env.match(/PRIVATE_KEY=(.+)/)[1].trim().replace(/['"]/g, '');
  const wallet = new Wallet(pk, provider);

  const wethAddress = '0x4200000000000000000000000000000000000006';
  const aeroAddress = '0x940181a94a35a4569e4529a3cdfb74e38fd98631';
  const uniRouterAddr = '0xe592427a0aece92de3edee1f18e0157c05861564';

  const weth = new Contract(wethAddress, [
    'function approve(address spender, uint256 amount) external returns (bool)',
    'function balanceOf(address) external view returns (uint256)'
  ], wallet);

  const uniRouter = new Contract(uniRouterAddr, [
    'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) external payable returns (uint256)'
  ], wallet);

  const amount = parseUnits('0.0005', 18);

  console.log('Approving Uniswap V3 Router to spend WETH...');
  const appTx = await weth.approve(uniRouterAddr, amount);
  await appTx.wait();
  console.log('Approval success!');

  console.log('Simulating swap with pulled WETH on Uniswap V3...');
  try {
    const params = {
      tokenIn: wethAddress,
      tokenOut: aeroAddress,
      fee: 3000, // WETH/AERO Uniswap V3 pool fee might be 0.3% (3000)
      recipient: wallet.address,
      deadline: Math.floor(Date.now() / 1000) + 300,
      amountIn: amount,
      amountOutMinimum: 0,
      sqrtPriceLimitX96: 0
    };
    const tx = await uniRouter.exactInputSingle.populateTransaction(params);
    const res = await provider.call({
      to: uniRouterAddr,
      from: wallet.address,
      data: tx.data
    });
    console.log('Simulation success! Result:', res);
  } catch (err) {
    console.log('Simulation failed:', err.message);
  }
}

main();
