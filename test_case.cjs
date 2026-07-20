const { JsonRpcProvider, Contract } = require('ethers');

async function main() {
  const provider = new JsonRpcProvider('https://mainnet.base.org');
  const factory1 = new Contract('0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865', ['function getPool(address,address,uint24) view returns (address)'], provider);
  const factory2 = new Contract('0x0bfbcf9fa4f9c56b0f40a671ad40e0805a091865', ['function getPool(address,address,uint24) view returns (address)'], provider);

  const t0 = '0x4200000000000000000000000000000000000006';
  const t1 = '0x940181a94a35a4569e4529a3cdfb74e38fd98631';

  try {
    const r1 = await factory1.getPool(t0, t1, 2500);
    console.log('factory1:', r1);
  } catch (e) {
    console.log('factory1 err:', e.message);
  }

  try {
    const r2 = await factory2.getPool(t0, t1, 2500);
    console.log('factory2:', r2);
  } catch (e) {
    console.log('factory2 err:', e.message);
  }
}
main();
