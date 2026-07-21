const { JsonRpcProvider, Wallet, Contract, parseUnits, formatEther } = require('ethers');
const fs = require('fs');
const path = require('path');

// === CONFIGURACIÓN DE RUTAS ===
const WORKSPACE_DIR = "c:\\Users\\carlos\\.gemini\\antigravity\\scratch\\arbrisync";

// === PARSER .env ===
const potentialEnvPaths = [
  path.join(WORKSPACE_DIR, '.env'),
  path.join(__dirname, '.env'),
];
for (const envPath of potentialEnvPaths) {
  try {
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
      break;
    }
  } catch (e) {}
}

// === CONFIGURACIÓN BASE NETWORK ===
const PRIVATE_KEY = process.env.PRIVATE_KEY || "TU_CLAVE_PRIVADA_AQUÍ";
const RPC_URL = "https://mainnet.base.org";
const CONTRACT_ADDRESS = (process.env.CONTRACT_ADDRESS || "0xC9A3Fb4e6Fa94eC7F3834555e934592a3eF9A21").toLowerCase();
const WETH = "0x4200000000000000000000000000000000000006"; // WETH en Base
const USDC = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"; // USDC en Base

const PROVIDER = new JsonRpcProvider(RPC_URL, undefined, { staticNetwork: true });
let SIGNER = null;
let ARB_CONTRACT = null;

const ABI = [
  "function executeArbitrage(address token, address stableToken, uint256 amount, address buyDex, address sellDex, uint256 minProfit, bool isV3Buy, bool isV3Sell, uint24 poolFeeBuy, uint24 poolFeeSell, address loanPool) external returns (uint256)",
  "function executeDirectArbitrage(address tokenIn, address tokenOut, uint256 amountIn, address buyDex, address sellDex, uint256 minProfit, bool isV3Buy, bool isV3Sell, uint24 poolFeeBuy, uint24 poolFeeSell) external payable returns (uint256)"
];

try {
  if (PRIVATE_KEY !== "TU_CLAVE_PRIVADA_AQUÍ") {
    SIGNER = new Wallet(PRIVATE_KEY, PROVIDER);
    ARB_CONTRACT = new Contract(CONTRACT_ADDRESS, ABI, SIGNER);
  }
} catch (e) {}

// === TELEMETRÍA ===
const LOGS_FILE = path.join(WORKSPACE_DIR, 'public', 'bot_logs.json');
const publicDir = path.join(WORKSPACE_DIR, 'public');
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

let botLogs = [];
function addBotLog(text, type = 'info') {
  const timeStr = new Date().toLocaleTimeString();
  const prefix = type === 'success' ? 'SUCCESS' : (type === 'error' ? 'ERROR' : (type === 'warning' ? 'WARN' : 'INFO'));
  console.log(`[${timeStr}] [${prefix}] ${text}`);
  botLogs.push({
    id: `bot-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    message: `🔵 [BASE V3 BOT] ${text}`,
    type, timestamp: new Date().toISOString()
  });
  if (botLogs.length > 50) botLogs.shift();
  try { fs.writeFileSync(LOGS_FILE, JSON.stringify(botLogs, null, 2)); } catch (err) {}
}

// === ROUTERS DE BASE ===
const ROUTERS = {
  'uniswap v3':     '0x2626664c2603336e57b271c5c0b26f421741e481',
  'pancakeswap v3': '0x1b81d678ffb9c0263b24a97847620c99d213eb14',
  'baseswap v2':    '0x327df1e6de05895d2ab08513aadd9313fe505d86',
  'sushiswap v2':   '0x6bded42c6da8fbf0d2ba55b2fa120c5e0c8d7891',
  'alienbase v2':   '0x8c1a3cf8f83074169fe5d7ad50b978e1cd6b37c7',
  'aerodrome':      '0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43',
};

const USDC_WETH_POOL = '0xd0b53D9277642d899DF5C87A3966A349A798F224'; // USDC-WETH 0.05% pool to borrow WETH

function getDexConfig(dexId) {
  const d = dexId.toLowerCase();
  if (d.includes('uniswap'))    return { router: ROUTERS['uniswap v3'],     isV3: true,  defaultFee: 0.003 };
  if (d.includes('pancake'))    return { router: ROUTERS['pancakeswap v3'], isV3: true,  defaultFee: 0.0025 };
  if (d.includes('baseswap'))   return { router: ROUTERS['baseswap v2'],   isV3: false, defaultFee: 0.0025 };
  if (d.includes('sushi'))      return { router: ROUTERS['sushiswap v2'],  isV3: false, defaultFee: 0.003 };
  if (d.includes('alien'))      return { router: ROUTERS['alienbase v2'],  isV3: false, defaultFee: 0.003 };
  if (d.includes('aerodrome'))  return { router: ROUTERS['aerodrome'],     isV3: false, defaultFee: 0.003 };
  return null;
}

// === TOKENS OFICIALES EN BASE ===
const OFFICIAL_TOKENS = {
  'ETH':    '0x4200000000000000000000000000000000000006',
  'WETH':   '0x4200000000000000000000000000000000000006',
  'USDC':   '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
  'USDbC':  '0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca',
  'DAI':    '0x50c5725949a6f0c72e6c4a641f24049a917db0cb',
  'AERO':   '0x940181a94a35a4569e4529a3cdfb74e38fd98631',
  'DEGEN':  '0x4ed4e862860bed51a9570b96d89af5e1b0efefed',
  'BRETT':  '0x532f27101965dd16442e59d40670faf5ebb142e4',
  'TOSHI':  '0xac1bd2486aaf3b5c0fc3fd868558b082a531b2b4',
};

const SCAN_TOKENS = [
  'AERO', 'DEGEN', 'BRETT', 'USDC', 'TOSHI'
];

const COOLDOWNS = {};

function getV3PoolFee(feeRate, dexId) {
  const rateInPips = Math.round(feeRate * 1000000);
  const isPancake = dexId.toLowerCase().includes('pancake');
  if (rateInPips <= 200) return 100;
  if (rateInPips <= 1500) return 500;
  if (isPancake) {
    if (rateInPips <= 5000) return 2500;
  } else {
    if (rateInPips <= 6500) return 3000;
  }
  return 10000;
}

function calculateOptimalVolume(buyPrice, sellPrice, liqUSD, buyFee, sellFee) {
  const useFlashLoan = process.env.USE_FLASH_LOAN === 'true';
  const spread = ((sellPrice - buyPrice) / buyPrice);
  const fees = buyFee + sellFee;
  const netSpread = spread - fees - (useFlashLoan ? 0.0011 : 0.0006); // extra buffer for flash loan fee
  if (netSpread <= 0) return 0;

  let V_opt = (netSpread * liqUSD) / 2;
  
  if (useFlashLoan) {
    // Flash Loan size limited to 0.5 - 3 ETH equivalent (~$1,800 to ~$10,800 USD)
    V_opt = Math.max(1800, Math.min(V_opt, 10800));
  } else {
    // Direct capital limited to €150 equivalent (~$165 USD)
    V_opt = Math.max(10, Math.min(V_opt, 165));
  }

  const estimatedGasUSD = useFlashLoan ? 0.02 : 0.01;
  const grossProfit = V_opt * netSpread;
  const netProfit = grossProfit - estimatedGasUSD;

  return netProfit > TARGET_PROFIT_USD ? V_opt : 0;
}

const TARGET_PROFIT_USD = 0.05;

async function scanToken(symbol, isPaperMode) {
  try {
    addBotLog(`Escaneando ${symbol} en Base...`, 'info');
    const res = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${symbol}`);
    if (!res.ok) return;
    const data = await res.json();
    if (!data.pairs) return;

    const pairs = data.pairs.filter(p => {
      if (p.chainId !== 'base') return false;
      const dex = p.dexId.toLowerCase();
      if (!dex.includes('uniswap') && !dex.includes('pancakeswap') && !dex.includes('sushiswap') && !dex.includes('baseswap') && !dex.includes('alien') && !dex.includes('aerodrome')) return false;
      if (p.quoteToken.symbol !== 'WETH') return false;
      if (p.baseToken.symbol !== symbol) return false;

      const officialAddress = OFFICIAL_TOKENS[symbol];
      if (officialAddress && p.baseToken.address.toLowerCase() !== officialAddress.toLowerCase()) return false;
      return true;
    });

    if (pairs.length < 2) return;

    for (const buyPair of pairs) {
      for (const sellPair of pairs) {
        if (buyPair.pairAddress === sellPair.pairAddress) continue;
        if (buyPair.dexId.toLowerCase() === sellPair.dexId.toLowerCase()) continue;
        if (buyPair.baseToken.address.toLowerCase() !== sellPair.baseToken.address.toLowerCase()) continue;
        if (buyPair.quoteToken.address.toLowerCase() !== sellPair.quoteToken.address.toLowerCase()) continue;

        const buyPrice = parseFloat(buyPair.priceUsd);
        const sellPrice = parseFloat(sellPair.priceUsd);
        if (sellPrice <= buyPrice) continue;

        const key = `${symbol}-${buyPair.dexId}-${sellPair.dexId}`;
        if (COOLDOWNS[key] && Date.now() < COOLDOWNS[key]) continue;

        const buyConfig = getDexConfig(buyPair.dexId);
        const sellConfig = getDexConfig(sellPair.dexId);
        if (!buyConfig || !sellConfig) continue;

        const liqUSD = Math.min(buyPair.liquidity?.usd || 0, sellPair.liquidity?.usd || 0);
        if (liqUSD < 2000) {
          addBotLog(`ℹ️ ${symbol}: Desbalance visto (${buyPair.dexId} vs ${sellPair.dexId}), pero liquidez insuficiente ($${Math.round(liqUSD)} < $2000 min). No ejecutado.`, 'info');
          continue;
        }

        const optimalUSD = calculateOptimalVolume(buyPrice, sellPrice, liqUSD, buyConfig.defaultFee, sellConfig.defaultFee);
        if (optimalUSD > 0) {
          const spreadPct = (((sellPrice - buyPrice) / buyPrice) * 100).toFixed(2);
          addBotLog(`🚨 OPORTUNIDAD RENTABLE en ${symbol}: ${buyPair.dexId.toUpperCase()} ($${buyPrice.toFixed(4)}) ➔ ${sellPair.dexId.toUpperCase()} ($${sellPrice.toFixed(4)}). Spread: ${spreadPct}%. Vol: $${Math.round(optimalUSD)}`, 'success');
          await executeArbitrage(symbol, buyPair, sellPair, optimalUSD, key, isPaperMode);
        } else {
          const spreadPct = (((sellPrice - buyPrice) / buyPrice) * 100).toFixed(2);
          addBotLog(`ℹ️ ${symbol}: Spread de +${spreadPct}% en ${buyPair.dexId} ➔ ${sellPair.dexId}, pero tras deducir comisiones DEX y gas la ganancia neta no alcanza +$0.05. No se envía TX para no perder dinero.`, 'info');
        }
      }
    }
  } catch (err) {
    addBotLog(`Error escaneando ${symbol}: ${err.message}`, 'error');
  }
}

async function executeArbitrage(symbol, buyPair, sellPair, amountUSD, cooldownKey, isPaperMode) {
  try {
    const ETH_PRICE = 3600;
    const quoteToken = buyPair.quoteToken.address.toLowerCase();
    const minProfitWei = parseUnits((TARGET_PROFIT_USD / ETH_PRICE).toFixed(6), 18);
    const buyConfig = getDexConfig(buyPair.dexId);
    const sellConfig = getDexConfig(sellPair.dexId);
    if (!buyConfig || !sellConfig) return;

    let decimals = 18;
    let amountInQuote = amountUSD / ETH_PRICE;
    if (quoteToken === USDC.toLowerCase()) {
      decimals = 6;
      amountInQuote = amountUSD;
    }
    const amountWei = parseUnits(amountInQuote.toFixed(decimals > 6 ? 9 : 4), decimals);

    const buyRouter = buyConfig.router.toLowerCase();
    const sellRouter = sellConfig.router.toLowerCase();
    const tokenAddress = buyPair.baseToken.address.toLowerCase();
    const poolFeeBuy = getV3PoolFee(buyConfig.defaultFee, buyPair.dexId);
    const poolFeeSell = getV3PoolFee(sellConfig.defaultFee, sellPair.dexId);

    if (isPaperMode) {
      addBotLog(`[PAPER] Trade simulado exitoso: +$${(amountUSD * 0.015).toFixed(2)} USD`, 'sim');
      COOLDOWNS[cooldownKey] = Date.now() + 60000;
      return;
    }

    const useFlashLoan = process.env.USE_FLASH_LOAN === 'true';

    let txValue = 0n;
    if (!useFlashLoan) {
      // Direct Arbitrage: Prepare capital wrap if needed
      const tokenContract = new Contract(quoteToken, [
        "function balanceOf(address) view returns (uint256)",
        "function transfer(address,uint256) returns (bool)"
      ], SIGNER);
      const contractBal = await tokenContract.balanceOf(CONTRACT_ADDRESS);
      const isWeth = quoteToken.toLowerCase() === WETH.toLowerCase();
      if (contractBal < amountWei) {
        const needed = amountWei - contractBal;
        if (isWeth) {
          txValue = needed;
          addBotLog(`⚡ Usando fondos propios: Pasando ${formatEther(needed)} ETH como msg.value`, 'info');
        } else {
          addBotLog(`⚡ Enviando ${formatEther(needed)} ${quoteToken} al contrato`, 'info');
          const tx = await tokenContract.transfer(CONTRACT_ADDRESS, needed);
          await tx.wait();
        }
      }
    }

    addBotLog(`⚡ Simulando TX en Base EVM (${useFlashLoan ? 'Flash Loan' : 'Fondos Propios'})...`, 'info');
    
    let gasEstimate;
    if (useFlashLoan) {
      gasEstimate = await ARB_CONTRACT.executeArbitrage.estimateGas(
        tokenAddress,
        quoteToken,
        amountWei,
        buyRouter,
        sellRouter,
        minProfitWei,
        buyConfig.isV3,
        sellConfig.isV3,
        poolFeeBuy,
        poolFeeSell,
        USDC_WETH_POOL
      );
    } else {
      gasEstimate = await ARB_CONTRACT.executeDirectArbitrage.estimateGas(
        quoteToken, tokenAddress, amountWei, buyRouter, sellRouter, minProfitWei,
        buyConfig.isV3, sellConfig.isV3, poolFeeBuy, poolFeeSell,
        { value: txValue }
      );
    }

    addBotLog(`🔥 Simulación OK! Gas: ${gasEstimate.toString()} (~$${(Number(gasEstimate) * 0.000000006 * ETH_PRICE).toFixed(4)})`, 'success');
    addBotLog(`🚀 Transmitiendo transacción real...`, 'info');

    let tx;
    if (useFlashLoan) {
      tx = await ARB_CONTRACT.executeArbitrage(
        tokenAddress,
        quoteToken,
        amountWei,
        buyRouter,
        sellRouter,
        minProfitWei,
        buyConfig.isV3,
        sellConfig.isV3,
        poolFeeBuy,
        poolFeeSell,
        USDC_WETH_POOL,
        { gasLimit: (gasEstimate * 130n) / 100n }
      );
    } else {
      tx = await ARB_CONTRACT.executeDirectArbitrage(
        quoteToken, tokenAddress, amountWei, buyRouter, sellRouter, minProfitWei,
        buyConfig.isV3, sellConfig.isV3, poolFeeBuy, poolFeeSell,
        { 
          value: txValue,
          gasLimit: (gasEstimate * 130n) / 100n 
        }
      );
    }

    addBotLog(`📡 TX enviada! Hash: ${tx.hash}`, 'info');
    const receipt = await tx.wait();
    addBotLog(`✅ ¡CONFIRMADA! Bloque ${receipt.blockNumber}. Status: ${receipt.status}`, 'success');
    COOLDOWNS[cooldownKey] = Date.now() + 300000;
  } catch (err) {
    addBotLog(`❌ Abortado: ${err.reason || err.message}`, 'error');
    COOLDOWNS[cooldownKey] = Date.now() + 15000;
  }
}

async function main() {
  addBotLog('═══════════════════════════════════════════', 'info');
  addBotLog('   ArbiSync Bot v2.5 — DUAL STRATEGY DISPATCHER', 'info');
  addBotLog('═══════════════════════════════════════════', 'info');

  const useFlashLoan = process.env.USE_FLASH_LOAN === 'true';
  addBotLog(`ESTRATEGIA ACTIVA: ${useFlashLoan ? '⚡ FLASH LOAN (Uniswap V3)' : '💰 FONDOS PROPIOS (Directo)'}`, 'success');

  let balance = 0n;
  if (SIGNER) {
    try {
      balance = await PROVIDER.getBalance(SIGNER.address);
      addBotLog(`Wallet: ${SIGNER.address}`, 'info');
      addBotLog(`Saldo de Gas: ${formatEther(balance)} ETH`, 'info');
      addBotLog(`Contrato: ${CONTRACT_ADDRESS}`, 'info');
    } catch (e) {
      addBotLog(`Error saldo: ${e.message}`, 'warning');
    }
  }

  let isPaperMode = PRIVATE_KEY === "TU_CLAVE_PRIVADA_AQUÍ";
  if (!isPaperMode && balance === 0n) {
    addBotLog("⚠️ Saldo 0 ETH. Modo simulación activo.", "warning");
    isPaperMode = true;
  }

  addBotLog(isPaperMode ? "MODO SIMULACIÓN ACTIVO" : "🟢 MODO REAL OPERATIVO", isPaperMode ? 'warning' : 'success');
  while (true) {
    for (const token of SCAN_TOKENS) {
      await scanToken(token, isPaperMode);
      await new Promise(r => setTimeout(r, 7000));
    }
  }
}

// === SERVIDOR HTTP DUMMY PARA HEALTH CHECKS DE RAILWAY ===
const http = require('http');
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('ArbiSync Bot Status: OK & Running 24/7');
}).listen(PORT, () => {
  console.log(`🌐 Servidor de respuesta web activo en puerto ${PORT}`);
});

main().catch(console.error);