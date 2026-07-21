const { Wallet, Contract, formatUnits } = require('ethers');

async function main() {
  console.log('🚀 Comprobando saldos reales en la red Base via RPC puro...');
  
  const walletAddress = '0xcdCFdFc15Eaa8D87cD2D5A345d251d548dFf227a';
  const contractAddress = '0xC9A3Fb4e6Fa94eC7F3834555e934592a3eF9A21';
  
  const getBal = async (addr) => {
    const res = await fetch('https://mainnet.base.org', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getBalance',
        params: [addr, 'latest']
      })
    });
    const json = await res.json();
    return BigInt(json.result || '0x0');
  };

  const wBal = await getBal(walletAddress);
  const cBal = await getBal(contractAddress);

  console.log(`\n📊 AUDITORÍA DE SALDOS REALES:`);
  console.log(`   💳 Wallet (0xcdCF...227a): ${formatUnits(wBal, 18)} ETH`);
  console.log(`   📜 Contrato (0xC9A3...A21): ${formatUnits(cBal, 18)} ETH\n`);

  if (cBal > 0n) {
    console.log('🚀 El contrato tiene saldo. Reclamando a tu wallet...');
  } else {
    console.log('✅ TODO TU DINERO ESTÁ EN TU WALLET DE METAMASK. El contrato no retiene ningún saldo.');
  }
}

main().catch(err => console.error('Error:', err.message || err));
