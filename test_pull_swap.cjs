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
  const pancakeRouterAddr = '0x1b81d678ffb9c0263b24a97847620c99d213eb14';

  const weth = new Contract(wethAddress, [
    'function deposit() external payable',
    'function approve(address spender, uint256 amount) external returns (bool)',
    'function balanceOf(address) external view returns (uint256)'
  ], wallet);

  const pancakeRouter = new Contract(pancakeRouterAddr, [
    'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) external payable returns (uint256)'
  ], wallet);

  const amount = parseUnits('0.0005', 18);

  console.log('Checking WETH balance...');
  const balBefore = await weth.balanceOf(wallet.address);
  console.log('WETH Balance:', balBefore.toString());

  if (balBefore < amount) {
    console.log('Depositing ETH to WETH...');
    const depTx = await weth.deposit({ value: amount });
    await depTx.wait();
    console.log('Deposit success!');
  }

  console.log('Approving PancakeSwap Router to spend WETH...');
  const appTx = await weth.approve(pancakeRouterAddr, amount);
  await appTx.wait();
  console.log('Approval success!');

  console.log('Simulating swap with pulled WETH (no msg.value)...');
  try {
    const params = {
      tokenIn: wethAddress,
      tokenOut: aeroAddress,
      fee: 2500,
      recipient: wallet.address,
      deadline: Math.floor(Date.now() / 1000) + 300,
      amountIn: amount,
      amountOutMinimum: 0,
      sqrtPriceLimitX96: 0
    };
    const tx = await pancakeRouter.exactInputSingle.populateTransaction(params);
    const res = await provider.call({
      to: pancakeRouterAddr,
      from: wallet.address,
      data: tx.data
      // no value passed!
    });
    console.log('Simulation success! Result:', res);
  } catch (err) {
    console.log('Simulation failed:', err.message);
  }
}

main();
