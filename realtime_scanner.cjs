const { JsonRpcProvider, Wallet, Contract, parseUnits, formatEther } = require('ethers');
const fs = require('fs');
const path = require('path');

const WORKSPACE_DIR = "c:\\Users\\carlos\\.gemini\\antigravity\\scratch\\arbrisync";

// Load Environment variables
let privateKey = '';
try {
  const envContent = fs.readFileSync(path.join(WORKSPACE_DIR, '.env'), 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eq = trimmed.indexOf('=');
      if (eq > 0) {
        const key = trimmed.slice(0, eq).trim();
        const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
        if (key === 'PRIVATE_KEY') privateKey = val;
      }
    }
  });
} catch (e) {
  console.error('Error loading .env:', e);
}

const provider = new JsonRpcProvider('https://mainnet.base.org');
const wallet = new Wallet(privateKey, provider);

const executorAddress = '0x7Ca487DC14Ca79D71d757252159537f749e15eFA';
const executor = new Contract(executorAddress, [
  'function executeDirectArbitrage(address tokenIn, address tokenOut, uint256 amountIn, address buyDex, address sellDex, uint256 minProfit, bool isV3Buy, bool isV3Sell, uint24 poolFeeBuy, uint24 poolFeeSell) external payable returns (uint256)'
], wallet);

const WETH = '0x4200000000000000000000000000000000000006';

const TOKENS = {
  'AERO': '0x940181a94a35a4569e4529a3cdfb74e38fd98631',
  'DEGEN': '0x4ed4e862860bed51a9570b96d89af5e1b0efefed',
  'BRETT': '0x532f27101965dd16442e59d40670faf5ebb142e4',
  'USDC': '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
  'TOSHI': '0xac1bd2486aaf3b5c0fc3fd868558b082a531b2b4',
};

const DEXS = {
  'Uniswap V3': { router: '0xe592427a0aece92de3edee1f18e0157c05861564', isV3: true, fee: 3000 },
  'PancakeSwap V3': { router: '0x1b81d678ffb9c0263b24a97847620c99d213eb14', isV3: true, fee: 2500 },
  'Aerodrome': { router: '0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43', isV3: false, fee: 3000 },
  'BaseSwap V2': { router: '0x327df1e6de05895d2ab08513aadd9313fe505d86', isV3: false, fee: 2500 },
  'SushiSwap V2': { router: '0x6bded42c6da8fbf0d2ba55b2fa120c5e0c8d7891', isV3: false, fee: 3000 }
};

// Amounts to simulate in WETH (0.01 WETH, 0.02 WETH, 0.035 WETH)
const SIM_AMOUNTS = [
  parseUnits('0.01', 18),
  parseUnits('0.02', 18),
  parseUnits('0.035', 18)
];

async function scan() {
  console.log('--- Iniciando escaneo en tiempo real por simulación estática ---');
  
  for (const [tokenSymbol, tokenAddress] of Object.entries(TOKENS)) {
    console.log(`\nEscaneando WETH <-> ${tokenSymbol}...`);
    
    for (const [buyDexName, buyDex] of Object.entries(DEXS)) {
      for (const [sellDexName, sellDex] of Object.entries(DEXS)) {
        if (buyDexName === sellDexName) continue;
        
        for (const amount of SIM_AMOUNTS) {
          try {
            // Simulate direct arbitrage on-chain
            const result = await executor.executeDirectArbitrage.staticCall(
              WETH,
              tokenAddress,
              amount,
              buyDex.router,
              sellDex.router,
              1n, // minProfit 1 wei to check if it returns more than input
              buyDex.isV3,
              sellDex.isV3,
              buyDex.fee,
              sellDex.fee,
              { value: amount }
            );
            
            const profit = result;
            const ethProfit = parseFloat(formatEther(profit));
            const ethProfitUsd = ethProfit * 3600; // Approx ETH price
            
            console.log(`🚨 ¡Oportunidad Encontrada!`);
            console.log(`   Token: ${tokenSymbol}`);
            console.log(`   Ruta: ${buyDexName} -> ${sellDexName}`);
            console.log(`   Tamaño: ${formatEther(amount)} ETH`);
            console.log(`   Ganancia Bruta: ${ethProfit.toFixed(6)} ETH (~$${ethProfitUsd.toFixed(4)})`);
          } catch (err) {
            // Reverted because not profitable
          }
        }
      }
    }
  }
  console.log('\n--- Escaneo finalizado ---');
}

scan();
