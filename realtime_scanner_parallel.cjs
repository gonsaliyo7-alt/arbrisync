const { JsonRpcProvider, Wallet, Contract, parseUnits, formatEther } = require('ethers');
const fs = require('fs');
const path = require('path');

const WORKSPACE_DIR = "c:\\Users\\carlos\\.gemini\\antigravity\\scratch\\arbrisync";
const LOGS_FILE = path.join(WORKSPACE_DIR, 'public', 'bot_logs.json');

// Load Environment variables
let privateKey = '';
let executorAddress = '';
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
        if (key === 'CONTRACT_ADDRESS') executorAddress = val;
      }
    }
  });
} catch (e) {
  console.error('Error loading .env:', e);
}

const RPC_URL = 'https://mainnet.base.org';
const provider = new JsonRpcProvider(RPC_URL, undefined, { staticNetwork: true });
const wallet = new Wallet(privateKey, provider);

const executor = new Contract(executorAddress, [
  'function executeArbitrage(address token, address stableToken, uint256 amount, address buyDex, address sellDex, uint256 minProfit, bool isV3Buy, bool isV3Sell, uint24 poolFeeBuy, uint24 poolFeeSell, address loanPool) external returns (uint256)'
], wallet);

const WETH = '0x4200000000000000000000000000000000000006';
const USDC_WETH_POOL = '0xd0b53D9277642d899DF5C87A3966A349A798F224'; // USDC-WETH 0.05% pool to borrow WETH

const TOKENS = {
  'AERO': '0x940181a94a35a4569e4529a3cdfb74e38fd98631',
  'DEGEN': '0x4ed4e862860bed51a9570b96d89af5e1b0efefed',
  'BRETT': '0x532f27101965dd16442e59d40670faf5ebb142e4',
  'USDC': '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
  'TOSHI': '0xac1bd2486aaf3b5c0fc3fd868558b082a531b2b4',
};

const DEXS = {
  'Uniswap V3': { router: '0x2626664c2603336e57b271c5c0b26f421741e481', isV3: true, fees: [100, 500, 3000, 10000] },
  'PancakeSwap V3': { router: '0x1b81d678ffb9c0263b24a97847620c99d213eb14', isV3: true, fees: [100, 500, 2500, 10000] },
  'Aerodrome': { router: '0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43', isV3: false, fees: [0] },
  'BaseSwap V2': { router: '0x327df1e6de05895d2ab08513aadd9313fe505d86', isV3: false, fees: [0] },
  'SushiSwap V2': { router: '0x6bded42c6da8fbf0d2ba55b2fa120c5e0c8d7891', isV3: false, fees: [0] }
};

// Flash Loan sizes to scan (0.25 ETH, 0.5 ETH, 1 ETH, 2 ETH, 3 ETH)
const FLASH_LOAN_AMOUNTS = [
  parseUnits('0.25', 18),
  parseUnits('0.5', 18),
  parseUnits('1', 18),
  parseUnits('2', 18),
  parseUnits('3', 18)
];

const TARGET_PROFIT_USD = 0.05; // minimum $0.05 profit per trade
const ETH_PRICE = 3600;
const minProfitWei = parseUnits((TARGET_PROFIT_USD / ETH_PRICE).toFixed(6), 18);

let botLogs = [];

function writeLog(text, type = 'info') {
  const timeStr = new Date().toLocaleTimeString();
  const prefix = type === 'success' ? 'SUCCESS' : (type === 'error' ? 'ERROR' : 'INFO');
  console.log(`[${timeStr}] [${prefix}] ${text}`);

  botLogs.push({
    id: `bot-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    message: `⚡ [REAL FLASH LOAN] ${text}`,
    type,
    timestamp: new Date().toISOString()
  });

  if (botLogs.length > 50) botLogs.shift();
  try {
    fs.writeFileSync(LOGS_FILE, JSON.stringify(botLogs, null, 2));
  } catch (err) {}
}

const COOLDOWNS = {};

async function scan() {
  writeLog('Escaneando bloques en Base Mainnet (Modo Real)...', 'info');
  
  const feeData = await provider.getFeeData();
  const gasPrice = feeData.gasPrice || feeData.maxFeePerGas || 5000000n; 
  const gasCostEstimate = gasPrice * 300000n; // ~300k gas for V3 flash loans

  const tasks = [];
  for (const [tokenSymbol, tokenAddress] of Object.entries(TOKENS)) {
    for (const [buyDexName, buyDex] of Object.entries(DEXS)) {
      for (const [sellDexName, sellDex] of Object.entries(DEXS)) {
        if (buyDexName === sellDexName) continue;
        
        for (const buyFee of buyDex.fees) {
          for (const sellFee of sellDex.fees) {
            for (const amount of FLASH_LOAN_AMOUNTS) {
              const cooldownKey = `${tokenSymbol}-${buyDexName}-${sellDexName}-${formatEther(amount)}`;
              if (COOLDOWNS[cooldownKey] && Date.now() < COOLDOWNS[cooldownKey]) continue;

              tasks.push({
                tokenSymbol,
                tokenAddress,
                amount,
                buyDexName,
                buyDex,
                buyFee,
                sellDexName,
                sellDex,
                sellFee,
                cooldownKey
              });
            }
          }
        }
      }
    }
  }

  const chunkSize = 15;
  for (let i = 0; i < tasks.length; i += chunkSize) {
    const chunk = tasks.slice(i, i + chunkSize);
    
    await Promise.all(chunk.map(async (task) => {
      try {
        // 1. Simulate on-chain via staticCall (Free)
        const result = await executor.executeArbitrage.staticCall(
          task.tokenAddress,
          WETH,
          task.amount,
          task.buyDex.router,
          task.sellDex.router,
          minProfitWei,
          task.buyDex.isV3,
          task.sellDex.isV3,
          task.buyFee,
          task.sellFee,
          USDC_WETH_POOL
        );
        
        const grossProfit = result;
        const netProfit = grossProfit - gasCostEstimate;
        
        if (netProfit >= minProfitWei) {
          const ethNetProfit = parseFloat(formatEther(netProfit));
          const netProfitUsd = ethNetProfit * ETH_PRICE;
          
          writeLog(`🚨 ¡OPORTUNIDAD RENTABLE CONFIRMADA EN SIMULACIÓN!`, 'success');
          writeLog(`   Ruta: ${task.tokenSymbol} (${task.buyDexName} ➔ ${task.sellDexName}) | Préstamo: ${formatEther(task.amount)} ETH`, 'info');
          writeLog(`   Ganancia Neta Estimada: +$${netProfitUsd.toFixed(2)} USD`, 'success');
          
          // 2. Execute transaction in 100% REAL mode
          writeLog(`🚀 Transmitiendo transacción real al secuenciador de Base...`, 'info');
          
          const tx = await executor.executeArbitrage(
            task.tokenAddress,
            WETH,
            task.amount,
            task.buyDex.router,
            task.sellDex.router,
            minProfitWei,
            task.buyDex.isV3,
            task.sellDex.isV3,
            task.buyFee,
            task.sellFee,
            USDC_WETH_POOL,
            {
              gasLimit: 450000n // Safe gas limit for execution
            }
          );
          
          writeLog(`📡 TX enviada. Hash: ${tx.hash}`, 'info');
          const receipt = await tx.wait();
          writeLog(`✅ ¡TX CONFIRMADA EN BLOQUE ${receipt.blockNumber}! Status: ${receipt.status}`, 'success');
          
          // Apply a 5-minute cooldown to prevent spamming the same pool
          COOLDOWNS[task.cooldownKey] = Date.now() + 300000;
        }
      } catch (err) {
        // Quietly catch reverts for non-profitable routes
      }
    }));

    await new Promise(r => setTimeout(r, 40)); 
  }
}

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('   ArbiSync Bot - MODO 100% REAL FLASH LOANS');
  console.log('═══════════════════════════════════════════');
  
  const balance = await provider.getBalance(wallet.address);
  writeLog(`Wallet: ${wallet.address}`, 'info');
  writeLog(`Saldo de Gas: ${formatEther(balance)} ETH`, 'info');
  writeLog(`Contrato: ${executorAddress}`, 'info');
  
  if (balance === 0n) {
    writeLog(`❌ Error: Tienes 0 ETH en la wallet. Necesitas al menos una fracción de centavo para pagar el gas.`, 'error');
    process.exit(1);
  }

  writeLog('Iniciando radar de arbitraje HFT en tiempo real...', 'success');
  
  while (true) {
    try {
      await scan();
    } catch (e) {
      writeLog(`Error en el radar: ${e.message}`, 'error');
    }
    await new Promise(r => setTimeout(r, 4000)); // Scan every 4 seconds
  }
}

main();
