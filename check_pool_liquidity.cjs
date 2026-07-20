const { JsonRpcProvider, Contract } = require('ethers');

async function main() {
  const provider = new JsonRpcProvider('https://mainnet.base.org');
  
  // Uniswap V3 WETH/AERO 0.3% Pool
  const poolAddress = '0x3d5D143381916280ff91407FeBEB52f2b60f33Cf';
  
  const pool = new Contract(poolAddress, [
    'function liquidity() view returns (uint128)',
    'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
    'function token0() view returns (address)',
    'function token1() view returns (address)'
  ], provider);

  try {
    const liq = await pool.liquidity();
    const slot = await pool.slot0();
    const t0 = await pool.token0();
    const t1 = await pool.token1();
    console.log('Pool Address:', poolAddress);
    console.log('Token0:', t0);
    console.log('Token1:', t1);
    console.log('Liquidity:', liq.toString());
    console.log('Slot0 tick:', slot.tick.toString());
  } catch (e) {
    console.log('Error querying pool:', e.message);
  }
}

main();
