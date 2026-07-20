const { JsonRpcProvider, Wallet, parseUnits } = require('ethers');
const fs = require('fs');
const path = require('path');

async function main() {
  const p = new JsonRpcProvider('https://mainnet.base.org');
  const envPath = path.join(__dirname, '.env');
  const env = fs.readFileSync(envPath, 'utf8');
  const pk = env.match(/PRIVATE_KEY=(.+)/)[1].trim().replace(/['"]/g, '');
  const w = new Wallet(pk, p);

  const contractAddress = '0xe4ecD580A6aBd7E8750EF6dE8E7eC8EdA7E36d3c'; // Aerodrome fix contract
  
  // Send 0.0005 ETH (~$1.80 USD) directly to the executor contract to seed it for Uniswap V3 Flash Swap fees
  const amount = parseUnits('0.0005', 18);
  console.log(`Enviando 0.0005 ETH de la wallet (${w.address}) al contrato (${contractAddress}) para pagar las comisiones del flash loan...`);
  
  const tx = await w.sendTransaction({
    to: contractAddress,
    value: amount
  });
  
  console.log('TX enviada. Hash:', tx.hash);
  await tx.wait();
  console.log('¡Seeding completado con éxito!');
}

main().catch(err => console.error(err));
