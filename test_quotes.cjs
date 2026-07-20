const { JsonRpcProvider, Contract, parseUnits, formatUnits, formatEther } = require('ethers');

const provider = new JsonRpcProvider('https://1rpc.io/base');

const WETH = '0x4200000000000000000000000000000000000006';
const USDC = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';

// Uniswap V3 QuoterV2 on Base
const quoterAddress = '0x3d4e44eb1374240ce5f1b871ab26ced1605a4506';
const quoterAbi = [
  'function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96)) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)'
];

// Aerodrome Router on Base
const aeroRouterAddress = '0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43';
const aeroRouterAbi = [
  'function getAmountsOut(uint256 amountIn, (address from, address to, bool stable, address factory)[] routes) external view returns (uint256[] memory amounts)'
];

async function main() {
  const amountIn = parseUnits('0.01', 18);
  console.log(`Testing WETH -> USDC (Amount: ${formatEther(amountIn)} WETH)...`);

  // 1. Test Uniswap V3 Quote (fee: 500)
  try {
    const quoter = new Contract(quoterAddress, quoterAbi, provider);
    const quote = await quoter.quoteExactInputSingle.staticCall({
      tokenIn: WETH,
      tokenOut: USDC,
      amountIn: amountIn,
      fee: 500,
      sqrtPriceLimitX96: 0
    });
    console.log(`Uniswap V3 WETH -> USDC (fee: 500) Quote Success: ${formatUnits(quote.amountOut, 6)} USDC`);
  } catch (e) {
    console.error(`Uniswap V3 Quote Failed: ${e.message}`);
  }

  // 2. Test Aerodrome Quote for USDC -> WETH (unstable)
  try {
    const aeroRouter = new Contract(aeroRouterAddress, aeroRouterAbi, provider);
    const routes = [{
      from: USDC,
      to: WETH,
      stable: false,
      factory: '0x420DD381b31aEf6683db6B902084cB0FFECe40Da'
    }];
    const amounts = await aeroRouter.getAmountsOut(parseUnits('35', 6), routes);
    console.log(`Aerodrome USDC -> WETH (unstable) Quote Success: 35 USDC = ${formatEther(amounts[1])} WETH`);
  } catch (e) {
    console.error(`Aerodrome Quote Failed: ${e.message}`);
  }
}

main();
