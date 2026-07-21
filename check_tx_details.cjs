const { formatUnits } = require('ethers');

async function checkTx() {
  const hash = '0x8b830a927e348825582d86990d2c44a7481d04b227f4ecb9143d7513254cee9a';
  
  const res = await fetch('https://mainnet.base.org', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_getTransactionReceipt',
      params: [hash]
    })
  });
  const json = await res.json();
  const receipt = json.result;

  console.log('📜 RESULTADO EXACTO DE LA TRANSACCIÓN EN BASESCAN:');
  console.log('   Hash:', hash);
  console.log('   Status:', receipt.status === '0x1' ? '✅ ÉXITO (SUCCESS)' : '❌ REVERTIDA (REVERTED)');
  console.log('   Bloque:', parseInt(receipt.blockNumber, 16));
  console.log('   Gas Consumido:', parseInt(receipt.gasUsed, 16), 'unidades');
  
  const gasPrice = BigInt(receipt.effectiveGasPrice || '0x0');
  const gasCost = BigInt(receipt.gasUsed) * gasPrice;
  console.log(`   Coste de Gas Real Pagado al Minero de Base: ${formatUnits(gasCost, 18)} ETH`);
}

checkTx().catch(err => console.error(err));
