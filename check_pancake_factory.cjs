const { JsonRpcProvider, Contract } = require('ethers');

async function main() {
  const provider = new JsonRpcProvider('https://mainnet.base.org');
  
  const weth = '0x4200000000000000000000000000000000000006'.toLowerCase();
  const aero = '0x940181a94a35a4569e4529a3cdfb74e38fd98631'.toLowerCase();
  const token0 = weth < aero ? weth : aero;
  const token1 = weth < aero ? aero : weth;

  const pancakeFactoryAddr = '0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865';

  const factory = new Contract(pancakeFactoryAddr, [
    'function owner() view returns (address)',
    'function feeAmountTickSpacing(uint24) view returns (int24)',
    'function getPool(address,address,uint24) view returns (address)'
  ], provider);

  try {
    const owner = await factory.owner();
    console.log('Owner:', owner);
  } catch (e) {
    console.log('Error owner():', e.message);
  }

  try {
    const spacing = await factory.feeAmountTickSpacing(2500);
    console.log('Spacing for 2500 fee:', spacing);
  } catch (e) {
    console.log('Error spacing for 2500:', e.message);
  }

  try {
    const pool = await factory.getPool(token0, token1, 2500);
    console.log('Pool:', pool);
  } catch (e) {
    console.log('Error getPool:', e.message);
  }
}
main();
