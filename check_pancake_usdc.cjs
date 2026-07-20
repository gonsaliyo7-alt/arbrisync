const { JsonRpcProvider, Contract } = require('ethers');

const provider = new JsonRpcProvider('https://1rpc.io/base');

const weth = '0x4200000000000000000000000000000000000006'.toLowerCase();
const usdc = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'.toLowerCase();

const token0 = weth < usdc ? weth : usdc;
const token1 = weth < usdc ? usdc : weth;

const pancakeFactoryAddr = '0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865'; 
const factoryAbi = [
  'function getPool(address,address,uint24) view returns (address)'
];

async function main() {
  const pancakeFactory = new Contract(pancakeFactoryAddr, factoryAbi, provider);
  const fees = [100, 500, 2500, 3000, 10000];

  console.log('Checking PancakeSwap V3 WETH/USDC Pools on Base...');
  for (const fee of fees) {
    const pool = await pancakeFactory.getPool(token0, token1, fee);
    console.log(`Fee: ${fee} -> Pool: ${pool}`);
  }
}

main();
