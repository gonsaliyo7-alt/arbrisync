const { JsonRpcProvider, Contract } = require('ethers');

async function main() {
  const provider = new JsonRpcProvider('https://mainnet.base.org');
  
  const weth = '0x4200000000000000000000000000000000000006'.toLowerCase();
  const aero = '0x940181a94a35a4569e4529a3cdfb74e38fd98631'.toLowerCase();

  const token0 = weth < aero ? weth : aero;
  const token1 = weth < aero ? aero : weth;

  const uniFactoryAddr = '0x33128a8fC17869897dcE68Ed026d694621f6FDfD';
  const pancakeFactoryAddr = '0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865'; // corrected

  const factoryAbi = [
    'function getPool(address,address,uint24) view returns (address)'
  ];

  const uniFactory = new Contract(uniFactoryAddr.toLowerCase(), factoryAbi, provider);
  const pancakeFactory = new Contract(pancakeFactoryAddr.toLowerCase(), factoryAbi, provider);

  const fees = [100, 500, 2500, 3000, 10000];

  console.log('--- Uniswap V3 WETH-AERO Pools ---');
  for (const fee of fees) {
    try {
      const pool = await uniFactory.getPool(token0, token1, fee);
      console.log(`Fee: ${fee} -> Pool: ${pool}`);
    } catch (e) {
      console.log(`Fee: ${fee} -> Error: ${e.message}`);
    }
  }

  console.log('\n--- PancakeSwap V3 WETH-AERO Pools ---');
  for (const fee of fees) {
    try {
      const pool = await pancakeFactory.getPool(token0, token1, fee);
      console.log(`Fee: ${fee} -> Pool: ${pool}`);
    } catch (e) {
      console.log(`Fee: ${fee} -> Error: ${e.message}`);
    }
  }
}

main();
