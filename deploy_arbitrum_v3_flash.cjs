/**
 * Deploy ArbiSyncExecutor (Uniswap V3 Flash Swap edition) to Arbitrum One Network
 */
const { JsonRpcProvider, Wallet, ContractFactory } = require('ethers');
const fs = require('fs');
const path = require('path');

// Parse .env
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eq = trimmed.indexOf('=');
      if (eq > 0) {
        const key = trimmed.slice(0, eq).trim();
        const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
        process.env[key] = val;
      }
    }
  });
}

const ARBITRUM_RPC = process.env.ARBITRUM_RPC || 'https://arb1.arbitrum.io/rpc';

const ABI = [
  "constructor()",
  "function owner() view returns (address)",
  "function executeArbitrage(address token, address stableToken, uint256 amount, address buyDex, address sellDex, uint256 minProfit, bool isV3Buy, bool isV3Sell, uint24 poolFeeBuy, uint24 poolFeeSell, address loanPool) external returns (uint256)",
  "function withdrawToken(address token) external",
  "function withdrawEther() external"
];

// Read compiled CONTRACT_BYTECODE from compiledContract.ts dynamically
const compiledPath = path.join(__dirname, 'services', 'compiledContract.ts');
const compiledContent = fs.readFileSync(compiledPath, 'utf8');
const bytecodeMatch = compiledContent.match(/export const CONTRACT_BYTECODE = "(.+)"/);
if (!bytecodeMatch) {
  console.error("❌ No se encontró CONTRACT_BYTECODE en compiledContract.ts");
  process.exit(1);
}
const BYTECODE = bytecodeMatch[1];

async function main() {
  const PRIVATE_KEY = process.env.PRIVATE_KEY;
  if (!PRIVATE_KEY) {
    console.error('❌ PRIVATE_KEY no encontrada en .env');
    process.exit(1);
  }

  console.log('🚀 Desplegando ArbiSyncExecutor (Uniswap V3 Flash Swap Edition) en Arbitrum One...');
  console.log(`   RPC: ${ARBITRUM_RPC}`);

  const provider = new JsonRpcProvider(ARBITRUM_RPC);
  const wallet = new Wallet(PRIVATE_KEY, provider);
  
  const balance = await provider.getBalance(wallet.address);
  console.log(`   Wallet: ${wallet.address}`);
  console.log(`   Balance en Arbitrum: ${balance.toString()} wei (${Number(balance) / 1e18} ETH)`);

  if (balance === 0n) {
    console.error('❌ No tienes ETH de gas en la red Arbitrum.');
    process.exit(1);
  }

  const factory = new ContractFactory(ABI, BYTECODE, wallet);
  
  console.log('\n📦 Enviando transacción de despliegue en Arbitrum...');
  const contract = await factory.deploy();
  
  console.log(`   TX Hash: ${contract.deploymentTransaction().hash}`);
  console.log('   Esperando confirmación...');
  
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  
  console.log(`\n✅ ¡CONTRATO UNISWAP V3 FLASH DESPLEGADO CON ÉXITO EN ARBITRUM!`);
  console.log(`   Dirección: ${address}`);
  console.log(`   Arbiscan: https://arbiscan.io/address/${address}`);
}

main().catch(err => {
  console.error('❌ Error:', err.message || err);
  process.exit(1);
});
