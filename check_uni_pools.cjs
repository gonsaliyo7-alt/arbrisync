const { JsonRpcProvider, Contract } = require('ethers');

const provider = new JsonRpcProvider('https://1rpc.io/base');

const weth = '0x4200000000000000000000000000000000000006'.toLowerCase();
const usdc = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'.toLowerCase();

const token0 = weth < usdc ? weth : usdc;
const token1 = weth < usdc ? usdc : weth;

const uniFactoryAddr = '0x33128a8fC17869897dcE68Ed026d694621f6FDfD';
const factoryAbi = [
  'function getPool(address,address,uint24) view returns (address)'
];

async function main() {
  const uniFactory = new Contract(uniFactoryAddr, factoryAbi, provider);
  const fees = [100, 500, 3000, 10000];

  console.log('Checking Uniswap V3 WETH/USDC Pools on Base...');
  for (const fee of fees) {
    const pool = await uniFactory.getPool(token0, token1, fee);
    console.log(`Fee: ${fee} -> Pool: ${pool}`);
  }
}

main();
