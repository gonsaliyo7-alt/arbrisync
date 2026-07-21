const { JsonRpcProvider, Wallet, Contract, formatUnits } = require('ethers');

const PRIVATE_KEY = '8bfad205c8d31e38adb7c00f9d67e7edc2156479c62f5c5c03e2ea1ec8e54856';

const NETWORKS = [
  {
    name: 'Base',
    rpc: 'https://mainnet.base.org',
    contract: '0xC9A3Fb4e6Fa94eC7F3834555e934592a3eF9A21',
    symbol: 'ETH'
  },
  {
    name: 'Arbitrum',
    rpc: 'https://arb1.arbitrum.io/rpc',
    contract: '0x2d972032bE3DC8c99FE78e7925069DbA551C35A1',
    symbol: 'ETH'
  },
  {
    name: 'Polygon',
    rpc: 'https://polygon-bor-rpc.publicnode.com',
    contract: '0x5C8aBfC165e3158fB2bA1e35Db4DFfa405Efa055B',
    symbol: 'POL'
  },
  {
    name: 'BSC (BNB)',
    rpc: 'https://binance.llamarpc.com',
    contract: '0x3cBaBfC165e3158fB2bA1e35Db4DFfa405Efa055B',
    symbol: 'BNB'
  }
];

async function recoverAll() {
  console.log('🔍 INICIANDO RECUPERACIÓN DIRECTA...\n');
  const abi = [
    'function withdrawEther() external'
  ];

  for (const net of NETWORKS) {
    try {
      const provider = new JsonRpcProvider(net.rpc);
      const wallet = new Wallet(PRIVATE_KEY, provider);
      
      const code = await provider.getCode(net.contract);
      if (code === '0x' || code === '0x0') {
        console.log(`ℹ️ Red ${net.name}: El contrato ${net.contract.slice(0, 10)}... no estaba desplegado en esta red.`);
        continue;
      }

      const contractBal = await provider.getBalance(net.contract);
      console.log(`🌐 [${net.name}] Saldo en Contrato (${net.contract.slice(0, 10)}...): ${formatUnits(contractBal, 18)} ${net.symbol}`);
      
      if (contractBal > 0n) {
        console.log(`   🚀 Reclamando ${formatUnits(contractBal, 18)} ${net.symbol} a tu wallet...`);
        const contract = new Contract(net.contract, abi, wallet);
        const tx = await contract.withdrawEther();
        console.log(`   ✅ Transacción enviada: ${tx.hash}`);
        await tx.wait();
        console.log(`   🎉 ¡${net.name} ${net.symbol} RECUPERADO CON ÉXITO!\n`);
      }
    } catch (e) {
      console.log(`   ⚠️ Información ${net.name}: ${e.message || e}`);
    }
  }
  console.log('\n✅ REVISIÓN Y RECUPERACIÓN COMPLETADA CON ÉXITO.');
}

recoverAll();
