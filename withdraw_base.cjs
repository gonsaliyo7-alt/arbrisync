const { JsonRpcProvider, Wallet, Contract, formatUnits, getAddress } = require('ethers');

const PRIVATE_KEY = '8bfad205c8d31e38adb7c00f9d67e7edc2156479c62f5c5c03e2ea1ec8e54856';

async function main() {
  const provider = new JsonRpcProvider('https://mainnet.base.org');
  const signer = new Wallet(PRIVATE_KEY, provider);
  const contractAddress = '0x6511252a4a1c81a53b3edf54d718d7fdce18981e';

  const bal = await provider.getBalance(contractAddress);
  console.log(`Saldo actual en Contrato Base (${contractAddress}): ${formatUnits(bal, 18)} ETH`);

  if (bal > 0n) {
    const abi = ['function withdrawEther() external'];
    const contract = new Contract(contractAddress, abi, signer);
    const tx = await contract.withdrawEther();
    console.log(`✅ Transacción enviada a la blockchain. Hash: ${tx.hash}`);
    await tx.wait();
    console.log('🎉 ¡ETH RETIRADO Y DEVUELTO A TU WALLET CON ÉXITO!');
  } else {
    console.log('ℹ️ El contrato no tiene saldo pendiente acumulado (ya fue procesado).');
  }
}

main().catch(err => console.error('Error:', err.message || err));
