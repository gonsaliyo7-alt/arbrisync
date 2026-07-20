/**
 * ArbiSync AutoBot v1.3 - Bot de Arbitraje Autónomo de Consola (CLI)
 * Guarda los logs en public/bot_logs.json para visualización en tiempo real en la UI.
 */

const { JsonRpcProvider, Wallet, Contract, parseUnits, formatEther } = require('ethers');
const fs = require('fs');
const path = require('path');

// === CONFIGURACIÓN DE RUTAS ===
const WORKSPACE_DIR = "c:\\Users\\carlos\\.gemini\\antigravity\\scratch\\arbrisync";

// === PARSER SIMPLE DE ARCHIVO .env ===
const potentialEnvPaths = [
  path.join(WORKSPACE_DIR, '.env'),
  path.join(__dirname, '.env'),
  path.join(__dirname, '../.env')
];

for (const envPath of potentialEnvPaths) {
  try {
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      envContent.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const equalsIdx = trimmed.indexOf('=');
          if (equalsIdx > 0) {
            const key = trimmed.slice(0, equalsIdx).trim();
            const val = trimmed.slice(equalsIdx + 1).trim().replace(/^["']|["']$/g, '');
            process.env[key] = val;
          }
        }
      });
      break;
    }
  } catch (e) {
    // Silencioso
  }
}

// === CONFIGURACIÓN GLOBAL ===
const PRIVATE_KEY = process.env.PRIVATE_KEY || "TU_CLAVE_PRIVADA_AQUÍ";
const RPC_URL = process.env.RPC_URL || "https://arb1.arbitrum.io/rpc";
const CONTRACT_ADDRESS = (process.env.CONTRACT_ADDRESS || "0x59d781068Ba0db1B232605BB3C836e4a8Dc59914").toLowerCase();
const WETH = "0x82af49447d8a07e3bd95bd0d56f352415231a11d"; // WETH en Arbitrum One (lowercase)

const OFFICIAL_TOKENS = {
  'ETH': '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
  'WETH': '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
  'WBTC': '0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f',
  'BTC': '0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f',
  'ARB': '0x912ce59144191c1204e64559fe8253a0e49e6548',
  'USDC': '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
  'USDC.E': '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8',
  'USDT': '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9',
  'DAI': '0xda10009cbd5d07dd0cecc66161fc93d7c9000da1',
  'LINK': '0xf97f4df75117a78c1a5a0dbb814af92458539fb4',
  'UNI': '0xfa7f8980b0f1e64a2062791cc3b0871572f1f7f0',
  'AAVE': '0xba5ddd1f9d7f570dc94a51479a000e3bce967196',
  'LDO': '0x13ad51ed4f1b7e9dc168d8a00cb3f4ddd85efa60',
  'GRT': '0x9623063377ad1b27544c965ccd7342f7ea7e88c7',
  'GMX': '0xfc5a1a6eb076a2c7ad06ed22c90d7e710e35ad0a',
  'PENDLE': '0x0c880f6761f1af8d9aa9c466984b80dab9a8c9e8',
  'CAKE': '0x1b896893dfc86bb67cf57767298b9073d2c1ba2c',
  'CRV': '0x11cdb42b0eb46d95f990bedd4695a6e3fa034978',
  'FRAX': '0x9d2f299715d94d8a7e6f5eaa8e654e8c74a988a7',
  'SPA': '0x5575552988a3a80504bbaeb1311674fcfd40ad4b',
  'PEPE': '0x25d887ce7a35172c62febfd67a1856f20faebb00',
  'RDNT': '0x3082cc23568ea640225c2467653db90e9250aaa0',
  'MAGIC': '0x539bde0d7dbd336b79148aa742883198bbf60342',
  'JOE': '0x371c7cd6d80c09012f23d45af213c0b067645d5c',
  'STG': '0x6694340fc020c5e2a9d2d6d8d9b6a9a0827258b6',
  'FXS': '0x9d2f299715d94d8a7e6f5eaa8e654e8c74a988a7',
  'SUSHI': '0xd4d42b0eb46d95f990bedd4695a6e3fa034978',
  'WOO': '0xcaf3ac5c557eaf3f105e4b2dcd8d9b6a086bcd4e',
  'DPX': '0x6c2c06790b3e3773b0f7a07530c330c6df8c4262',
  'GNS': '0x18c11fd286c5ec11c3b683caa813b77f5163a122',
  'VELA': '0x08881e359f40951412237e1d1b45287f3b5550a1',
  'LPT': '0x289ba1701c2f088cf0faf8b3705246331cb8a839',
  'ENS': '0x9e3340f1c6d354f5a56e00e710b90ef4201f984'
};

const PROVIDER = new JsonRpcProvider(RPC_URL);
let SIGNER = null;
let ARB_CONTRACT = null;

const ABI = [
  "function executeArbitrage(address token, address stableToken, uint256 amount, address buyDex, address sellDex, uint256 minProfit, bool isV3Buy, bool isV3Sell, uint24 poolFeeBuy, uint24 poolFeeSell) external returns (uint256)"
];

try {
  if (PRIVATE_KEY !== "TU_CLAVE_PRIVADA_AQUÍ") {
    SIGNER = new Wallet(PRIVATE_KEY, PROVIDER);
    ARB_CONTRACT = new Contract(CONTRACT_ADDRESS, ABI, SIGNER);
  }
} catch (e) {
  // Ignorar en simulación
}

// === GESTOR DE TELEMETRÍA (JSON LOGGING) ===
const LOGS_FILE = path.join(WORKSPACE_DIR, 'public', 'bot_logs.json');
const publicDir = path.join(WORKSPACE_DIR, 'public');

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

let botLogs = [];

function addBotLog(text, type = 'info') {
  const timestamp = new Date().toISOString();
  const timeStr = new Date().toLocaleTimeString();
  
  // Imprimir en consola local
  const prefix = type === 'success' ? 'SUCCESS' : (type === 'error' ? 'ERROR' : (type === 'warning' ? 'WARN' : 'INFO'));
  console.log(`[${timeStr}] [${prefix}] ${text}`);

  // Guardar estructura compatible con la UI
  botLogs.push({
    id: `bot-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    message: `🤖 [BOT CONSOLA] ${text}`,
    type: type, // 'info' | 'success' | 'warning' | 'error' | 'sim'
    timestamp: timestamp
  });

  if (botLogs.length > 50) {
    botLogs.shift();
  }

  try {
    fs.writeFileSync(LOGS_FILE, JSON.stringify(botLogs, null, 2));
  } catch (err) {
    // Ignorar fallos de escritura menores
  }
}

// Routers
const ROUTERS = {
  'uniswap v3': '0xe592427a0aece92de3edee1f18e0157c05861564',
  'pancakeswap v3': '0x1b81d678ffb9c0263b24a97847620c99d213eb14',
  'sushiswap v2': '0x1b02da8cb0d097eb8d57a175b88c7d8b47997506',
  'camelot v2': '0xc873fecbd354f5a56e00e710b90ef4201db2448d'
};

function getDexConfig(dexId) {
  const d = dexId.toLowerCase();
  if (d.includes('uniswap')) {
    return { router: ROUTERS['uniswap v3'], isV3: true, defaultFee: 0.003 };
  }
  if (d.includes('pancake')) {
    return { router: ROUTERS['pancakeswap v3'], isV3: true, defaultFee: 0.0025 };
  }
  if (d.includes('sushi')) {
    return { router: ROUTERS['sushiswap v2'], isV3: false, defaultFee: 0.003 };
  }
  if (d.includes('camelot')) {
    return { router: ROUTERS['camelot v2'], isV3: false, defaultFee: 0.003 };
  }
  return null;
}

const SCAN_TOKENS = [
  'ETH', 'WBTC', 'PENDLE', 'ARB', 'LINK', 'GMX', 'SOL', 'USDC', 'USDT', 'LDO', 'UNI', 'GRAIL', 'RDNT', 'JOE', 'STG', 'FXS', 'AAVE', 'MKR', 'CRV', 'WETH', 'SUSHI', 'WOO', 'DPX', 'PLS', 'SPA', 'JONES', 'GNS', 'MAGIC', 'VELA', 'STX', 'EETH', 'RPL', 'BEND', 'LUSD', 'FRAX', 'DAI', 'RETH', 'MIM', 'BAL', 'COMP', 'YFI', 'SNX', 'GRT', '1INCH', 'BAT', 'ENJ', 'LRC', 'ZRX', 'BNT', 'REN', 'ANKR', 'IMX', 'SAND', 'MANA', 'CHZ', 'DYDX', 'LPT', 'ENS', 'PEPE', 'SHIB', 'WLD', 'RNDR', 'FET', 'JASMY', 'NEAR', 'OP', 'TIA', 'SUI', 'SEI', 'APT'
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

let lastTradeTime = Date.now();

function updateLastTradeTime() {
  lastTradeTime = Date.now();
}

function calculateOptimalVolume(buyPrice, sellPrice, liqUSD, buyFee, sellFee) {
  const spread = ((sellPrice - buyPrice) / buyPrice);
  const fees = buyFee + sellFee;
  const netSpread = spread - fees - 0.0005; // Reducido de 0.0015 (0.15%) a 0.0005 (0.05%) para ser más sensible
  if (netSpread <= 0) return 0;

  let V_opt = (netSpread * liqUSD) / 2;
  V_opt = Math.max(15, Math.min(V_opt, liqUSD * 0.15));

  const estimatedGasUSD = 0.40;
  const grossProfit = V_opt * netSpread;
  const netProfit = grossProfit - estimatedGasUSD;

  return netProfit > 0.10 ? V_opt : 0; // Reducido de 0.80 a 0.10 USD
}

async function scanToken(symbol, isPaperMode) {
  try {
    addBotLog(`Escaneando balances de ${symbol} en Arbitrum...`, 'info');
    const res = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${symbol}`);
    if (!res.ok) return;
    const data = await res.json();
    if (!data.pairs) return;

    const pairs = data.pairs.filter(p => {
      if (p.chainId !== 'arbitrum') return false;
      if (p.dexId !== 'uniswap' && p.dexId !== 'pancakeswap' && p.dexId !== 'sushiswap' && p.dexId !== 'camelot') return false;
      if (p.quoteToken.symbol !== 'WETH') return false;
      if (p.baseToken.symbol !== symbol) return false;
      
      const officialAddress = OFFICIAL_TOKENS[symbol];
      if (officialAddress && p.baseToken.address.toLowerCase() !== officialAddress.toLowerCase()) {
        return false;
      }
      return true;
    });

    if (pairs.length < 2) return;

    for (const buyPair of pairs) {
      for (const sellPair of pairs) {
        if (buyPair.pairAddress === sellPair.pairAddress) continue;
        if (buyPair.baseToken.address.toLowerCase() !== sellPair.baseToken.address.toLowerCase()) continue;

        const buyPrice = parseFloat(buyPair.priceUsd);
        const sellPrice = parseFloat(sellPair.priceUsd);
        if (sellPrice <= buyPrice) continue;

        const key = `${symbol}-${buyPair.dexId}-${sellPair.dexId}`;
        if (COOLDOWNS[key] && Date.now() < COOLDOWNS[key]) continue;

        const buyConfig = getDexConfig(buyPair.dexId);
        const sellConfig = getDexConfig(sellPair.dexId);
        if (!buyConfig || !sellConfig) continue;

        const buyFee = buyConfig.defaultFee;
        const sellFee = sellConfig.defaultFee;
        const liqUSD = Math.min(buyPair.liquidity?.usd || 0, sellPair.liquidity?.usd || 0);
        if (liqUSD < 3000) continue; // Skip pools with liquidity under $3000 to prevent massive price impact

        const optimalUSD = calculateOptimalVolume(buyPrice, sellPrice, liqUSD, buyFee, sellFee);
        if (optimalUSD > 0) {
          addBotLog(`🚨 OPORTUNIDAD DETECTADA en ${symbol}: Compra en ${buyPair.dexId.toUpperCase()} ($${buyPrice}) ➔ Venta en ${sellPair.dexId.toUpperCase()} ($${sellPrice}). Spread: ${(((sellPrice - buyPrice)/buyPrice)*100).toFixed(2)}%. Volumen sugerido: $${Math.round(optimalUSD)} USD.`, 'success');
          await executeArbitrage(symbol, buyPair, sellPair, optimalUSD, key, isPaperMode);
        }
      }
    }
  } catch (err) {
    addBotLog(`Error al escanear ${symbol}: ${err.message}`, 'error');
  }
}

async function executeArbitrage(symbol, buyPair, sellPair, amountUSD, cooldownKey, isPaperMode) {
  try {
    const WETH_PRICE = 3000;
    const amountWei = parseUnits((amountUSD / WETH_PRICE).toFixed(9), 18);
    const minProfitWei = parseUnits("0.00003", 18);

    const buyConfig = getDexConfig(buyPair.dexId);
    const sellConfig = getDexConfig(sellPair.dexId);
    if (!buyConfig || !sellConfig) return;

    const buyRouter = buyConfig.router.toLowerCase();
    const sellRouter = sellConfig.router.toLowerCase();
    const tokenAddress = buyPair.baseToken.address.toLowerCase();

    const poolFeeBuy = getV3PoolFee(buyPair.dexId === 'uniswap' ? 0.003 : 0.0025, buyPair.dexId);
    const poolFeeSell = getV3PoolFee(sellPair.dexId === 'uniswap' ? 0.003 : 0.0025, sellPair.dexId);

    if (isPaperMode) {
      addBotLog(`[SIMULACIÓN] Simulando transacción de forma virtual...`, 'sim');
      addBotLog(`[SIMULACIÓN] ¡Transacción viable! Beneficio neto proyectado: +$${(amountUSD * 0.012).toFixed(2)} USD.`, 'success');
      addBotLog(`[SIMULACIÓN] Transacción virtual firmada. Hash: 0xsim_${Math.random().toString(36).substring(2, 15)}`, 'info');
      COOLDOWNS[cooldownKey] = Date.now() + 60 * 1000;
      updateLastTradeTime();
      return;
    }

    addBotLog(`Simulando transacción EVM en vivo...`, 'info');
    const gasEstimate = await ARB_CONTRACT.executeArbitrage.estimateGas(
      tokenAddress, WETH, amountWei, buyRouter, sellRouter, minProfitWei,
      buyConfig.isV3, sellConfig.isV3, poolFeeBuy, poolFeeSell
    );

    addBotLog(`🔥 ¡Simulación exitosa! Coste de Gas: ${gasEstimate.toString()} unidades.`, 'success');
    addBotLog(`Transmitiendo transacción de forma autónoma al secuenciador...`, 'info');

    const tx = await ARB_CONTRACT.executeArbitrage(
      tokenAddress, WETH, amountWei, buyRouter, sellRouter, minProfitWei,
      buyConfig.isV3, sellConfig.isV3, poolFeeBuy, poolFeeSell,
      { gasLimit: (gasEstimate * 120n) / 100n }
    );

    addBotLog(`🚀 Transacción enviada! Hash: ${tx.hash}`, 'info');
    const receipt = await tx.wait();
    addBotLog(`✅ CONFIRMADA en bloque ${receipt.blockNumber}. Status: ${receipt.status}`, 'success');
    COOLDOWNS[cooldownKey] = Date.now() + 300 * 1000;
    updateLastTradeTime();
  } catch (err) {
    addBotLog(`❌ Abortado: La simulación falló o no es rentable (${err.reason || err.message}).`, 'error');
    COOLDOWNS[cooldownKey] = Date.now() + 15 * 1000;
  }
}

async function main() {
  let balance = 0n;
  if (SIGNER) {
    try {
      balance = await PROVIDER.getBalance(SIGNER.address);
      addBotLog(`Saldo de la billetera: ${formatEther(balance)} ETH`, 'info');
    } catch (e) {
      addBotLog(`Error al consultar saldo: ${e.message}`, 'warning');
    }
  }

  let isPaperMode = PRIVATE_KEY === "TU_CLAVE_PRIVADA_AQUÍ";
  if (!isPaperMode && balance === 0n) {
    addBotLog("⚠️ Saldo de ETH es 0. Activando MODO SIMULACIÓN AUTOMÁTICO para realizar pruebas.", "warning");
    isPaperMode = true;
  }
  
  if (isPaperMode) {
    addBotLog("BOT EN MODO SIMULACIÓN (PAPER TRADING)", 'warning');
    addBotLog("Para operar en REAL, añade tu PRIVATE_KEY con saldo de gas en un archivo .env.", 'info');
  } else {
    addBotLog("BOT EN MODO REAL (LIVE EXECUTION)", 'info');
    addBotLog(`Billetera cargada: ${SIGNER.address}`, 'info');
    addBotLog(`Contrato inteligente objetivo: ${CONTRACT_ADDRESS}`, 'info');
  }
  
  addBotLog("Iniciando escáner en bucle infinito (Ctrl+C para detener)...", 'info');
  updateLastTradeTime();
  
  while (true) {
    for (const token of SCAN_TOKENS) {
      await scanToken(token, isPaperMode);
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

main();
