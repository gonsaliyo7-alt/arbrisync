
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ArbitrageOpportunity, WalletState, ExecutionLog } from './types';
import { scanImbalances, QuotaError } from './services/geminiService';
import WalletConnector, { switchNetwork, NETWORKS } from './components/WalletConnector';
import OpportunityCard from './components/OpportunityCard';
import { BrowserProvider, JsonRpcProvider, Wallet, Contract, parseUnits, formatEther, isAddress, ContractFactory } from 'ethers';
import { ARBISYNC_ABI } from './services/contractAbi';
import { CONTRACT_ABI, CONTRACT_BYTECODE } from './services/compiledContract';

const SUPPORTED_CHAINS = [
  { id: 'all', name: 'Global Radar', desc: 'Cross-EVM Scan', cost: 'global' },
  { id: '42161', name: 'Arbitrum', desc: 'Nitro L2', cost: 'cheap' },
  { id: '137', name: 'Polygon', desc: 'POS Network', cost: 'cheap' },
  { id: '8453', name: 'Base', desc: 'Coinbase L2', cost: 'cheap' },
  { id: '10', name: 'OP', desc: 'OP Mainnet', cost: 'cheap' },
  { id: '1329', name: 'Sei', desc: 'Parallelized EVM', cost: 'cheap' },
  { id: '143', name: 'Monad', desc: 'Parallelized L1', cost: 'cheap' },
  { id: '10143', name: 'Monad Testnet', desc: 'Parallelized L1', cost: 'testnet' },
  { id: '999', name: 'HyperEVM', desc: 'Hyperliquid L1', cost: 'cheap' },
  { id: '43260', name: 'MegaETH', desc: 'Real-Time L2', cost: 'cheap' },
  { id: '4326', name: 'MegaETH Testnet', desc: 'Real-Time L2', cost: 'testnet' },
  { id: '14', name: 'Flare Mainnet', desc: 'Oracle L1 Network', cost: 'cheap' },
  { id: '324', name: 'zkSync Era', desc: 'Era L2 Rollup', cost: 'cheap' },
  { id: '534352', name: 'Scroll', desc: 'zkEVM L2', cost: 'cheap' },
  { id: '5000', name: 'Mantle', desc: 'Modular L2', cost: 'cheap' },
  { id: '1101', name: 'Polygon zkEVM', desc: 'zk-Rollup L2', cost: 'cheap' },
  { id: '59144', name: 'Linea', desc: 'ConsenSys L2', cost: 'cheap' },
  { id: '56', name: 'BNB Chain', desc: 'Binance Chain', cost: 'cheap' },
  { id: '250', name: 'Fantom', desc: 'Opera Network', cost: 'cheap' },
  { id: '43114', name: 'Avalanche', desc: 'C-Chain', cost: 'cheap' },
  { id: '25', name: 'Cronos', desc: 'Crypto.com L1', cost: 'cheap' },
  { id: '1', name: 'Ethereum', desc: 'Mainnet Core', cost: 'expensive' },
  { id: '11155111', name: 'Sepolia', desc: 'Ethereum Testnet', cost: 'testnet' },
  { id: '421614', name: 'Arbitrum Sepolia', desc: 'Arbitrum Testnet', cost: 'testnet' },
  { id: '84532', name: 'Base Sepolia', desc: 'Base Testnet', cost: 'testnet' },
  { id: '11155420', name: 'Optimism Sepolia', desc: 'Optimism Testnet', cost: 'testnet' },
  { id: '59141', name: 'Linea Sepolia', desc: 'Linea Testnet', cost: 'testnet' },
  { id: 'bitcoin', name: 'Bitcoin', desc: 'L1 Crypto Reserve', cost: 'expensive' },
  { id: 'solana', name: 'Solana', desc: 'High-Performance L1', cost: 'cheap' },
  { id: 'solana-testnet', name: 'Solana Testnet', desc: 'Solana Testing', cost: 'testnet' },
  { id: 'solana-devnet', name: 'Solana Devnet', desc: 'Solana Dev Network', cost: 'testnet' },
  { id: 'tron', name: 'Tron', desc: 'TVM L1 Network', cost: 'cheap' },
  { id: 'tron-nile', name: 'Tron Nile', desc: 'Tron Nile Testnet', cost: 'testnet' },
  { id: 'tron-shasta', name: 'Tron Shasta', desc: 'Tron Shasta Testnet', cost: 'testnet' }
];

const NETWORK_NATIVE_TOKENS: { [key: string]: string } = {
  '1': 'ETH',
  '137': 'POL',
  '56': 'BNB',
  '42161': 'ETH',
  '8453': 'ETH',
  '43114': 'AVAX',
  '10': 'ETH',
  '59144': 'ETH',
  '250': 'FTM',
  '324': 'ETH',
  '534352': 'ETH',
  '5000': 'MNT',
  '1101': 'ETH',
  '25': 'CRO',
  '1329': 'SEI',
  '143': 'MON',
  '10143': 'MON',
  '999': 'HYPE',
  '43260': 'ETH',
  '4326': 'ETH',
  '14': 'FLR',
  '11155111': 'ETH',
  '421614': 'ETH',
  '84532': 'ETH',
  '11155420': 'ETH',
  '59141': 'ETH',
  'bitcoin': 'BTC',
  'solana': 'SOL',
  'solana-testnet': 'SOL',
  'solana-devnet': 'SOL',
  'tron': 'TRX',
  'tron-nile': 'TRX',
  'tron-shasta': 'TRX'
};

const SHARED_PROXY_CONTRACTS: { [chainId: string]: string } = {
  '1': '0xE675a861e38147133d81DdC73BB9893a50b18dB8',
  '42161': '0x334474489942Eca6740Ee8d20ea3269Bbf2d66A5',
  '8453': '0xE675a861e38147133d81DdC73BB9893a50b18dB8',
  '137': '0x5C8aBfC165e3158fB2bA1e35Db4DFfa405Efa055B',
  '10': '0x1cBaBfC165e3158fB2bA1e35Db4DFfa405Efa055B',
  '56': '0x3cBaBfC165e3158fB2bA1e35Db4DFfa405Efa055B',
  '43114': '0x4cBaBfC165e3158fB2bA1e35Db4DFfa405Efa055B',
  '250': '0x2cBaBfC165e3158fB2bA1e35Db4DFfa405Efa055B',
  '324': '0xdcBaBfC165e3158fB2bA1e35Db4DFfa405Efa055B',
  '534352': '0xacBaBfC165e3158fB2bA1e35Db4DFfa405Efa055B',
  '5000': '0xbcBaBfC165e3158fB2bA1e35Db4DFfa405Efa055B',
  '1101': '0xccBaBfC165e3158fB2bA1e35Db4DFfa405Efa055B',
  '59144': '0xecBaBfC165e3158fB2bA1e35Db4DFfa405Efa055B',
  '25': '0xfcBaBfC165e3158fB2bA1e35Db4DFfa405Efa055B',
  '1329': '0x1329BfC165e3158fB2bA1e35Db4DFfa405Efa055',
  '10143': '0x1014BfC165e3158fB2bA1e35Db4DFfa405Efa055',
  '999': '0x9999BfC165e3158fB2bA1e35Db4DFfa405Efa055',
  '4326': '0x4326BfC165e3158fB2bA1e35Db4DFfa405Efa055',
  '14': '0x1414BfC165e3158fB2bA1e35Db4DFfa405Efa055',
  '143': '0x1431BfC165e3158fB2bA1e35Db4DFfa405Efa055',
  '11155111': '0x111551115e3158fB2bA1e35Db4DFfa405Efa055B',
  '421614': '0x421614e165e3158fB2bA1e35Db4DFfa405Efa055',
  '84532': '0x84532fc165e3158fB2bA1e35Db4DFfa405Efa055',
  '11155420': '0x111554205e3158fB2bA1e35Db4DFfa405Efa055B',
  '59141': '0x591411115e3158fB2bA1e35Db4DFfa405Efa055B',
  '43260': '0x432601115e3158fB2bA1e35Db4DFfa405Efa055B',
  'bitcoin': '0xbc10000065e3158fB2bA1e35Db4DFfa405Efa055B',
  'solana': '0x5010000065e3158fB2bA1e35Db4DFfa405Efa055B',
  'solana-testnet': '0x5011000065e3158fB2bA1e35Db4DFfa405Efa055B',
  'solana-devnet': '0x5012000065e3158fB2bA1e35Db4DFfa405Efa055B',
  'tron': '0x7b00000065e3158fB2bA1e35Db4DFfa405Efa055B',
  'tron-nile': '0x7b01000065e3158fB2bA1e35Db4DFfa405Efa055B',
  'tron-shasta': '0x7b02000065e3158fB2bA1e35Db4DFfa405Efa055B'
};

const FLASH_PROVIDERS = [
  { id: 'auto', name: 'Auto-Routing (Cheapest)', fee: 0, desc: 'Enrutado Inteligente' },
  { id: 'balancer', name: 'Balancer V2 Vault', fee: 0, desc: '0.00% Zero-Fee' },
  { id: 'aave_v3', name: 'AAVE V3 Institutional', fee: 0.0009, desc: '0.09% Fee' },
  { id: 'uniswap_v3', name: 'Uniswap V3 Flash', fee: 0.003, desc: '0.30% Fee' }
];

const NATIVE_PRICES: { [key: string]: number } = {
  'ethereum': 3000,
  'arbitrum': 3000,
  'polygon': 0.55,
  'bsc': 580,
  'base': 3000,
  'avalanche': 28,
  'optimism': 3000,
  'linea': 3000,
  'fantom': 0.70,
  'bitcoin': 65000,
  'solana': 150,
  'tron': 0.12
};

const getQuoteTokenPrice = (quoteSym: string, nativePrice: number): number => {
  const sym = (quoteSym || '').toUpperCase();
  if (sym.includes('USD') || sym.includes('DAI')) {
    return 1.0;
  }
  if (sym.includes('ETH')) {
    return nativePrice;
  }
  if (sym.includes('BTC')) {
    return 65000;
  }
  return nativePrice;
};

const getRevertExplanation = (reason: string): string => {
  const r = reason.toUpperCase();
  if (r.includes('BAL#528') || r.includes('INSUFFICIENT_FLASH_LOAN_BALANCE')) {
    return "⚠️ EXPLICACIÓN: El Vault de Balancer no tiene suficiente balance del token estable para concederte el préstamo rápido (Flash Loan) solicitado. SOLUCIÓN: Reduce el monto de la operación (Trade Amount USD) a una cantidad menor (ej. $10, $100 o $1000) o intenta con otro token estable.";
  }
  if (r.includes('BAL#')) {
    return `⚠️ EXPLICACIÓN: Error interno de Balancer (revert de Balancer). Código del error: ${reason}. Consulta la documentación de códigos de error de Balancer para más detalles.`;
  }
  if (r.includes('ONLY OWNER') || r.includes('OWNER') || r.includes('CALLER IS NOT THE OWNER')) {
    return "⚠️ EXPLICACIÓN: Acceso denegado. Solo la billetera propietaria (la que desplegó el contrato inteligente) puede ejecutar esta operación. SOLUCIÓN: Asegúrate de haber pegado en 'Contract Address' tu propia dirección de contrato y estar conectado en MetaMask con la misma billetera que usaste para el despliegue.";
  }
  if (r.includes('PROFIT INSUFICIENTE') || r.includes('ARBITRAJE NO RENTABLE') || r.includes('REVERSION DE SEGURIDAD') || r.includes('REQUIRE(FALSE)')) {
    return "ℹ️ EXPLICACIÓN DE SALVAGUARDA: La simulación local prevé que el swap final no cubrirá el coste del préstamo rápido. El contrato inteligente revirtió la ejecución antes de enviar la transacción real, salvando tu saldo de comisiones inútiles.";
  }
  if (r.includes('TRANSFER_FROM_FAILED') || r.includes('TRANSFER_FROM') || r.includes('STF')) {
    return "⚠️ EXPLICACIÓN: Error de transferencia de tokens (STF). Ocurre si el pool no tiene suficiente liquidez del token para realizar el intercambio, o si el contrato intentó mover fondos sin la aprobación (approve) adecuada.";
  }
  if (r.includes('INSUFFICIENT_OUTPUT_AMOUNT') || r.includes('SLIPPAGE') || r.includes('TOO_LITTLE_RECEIVED')) {
    return "ℹ️ EXPLICACIÓN DE DESLIZAMIENTO: El precio se movió temporalmente por encima de tu tolerancia. El contrato abortó la simulación para proteger tu capital de pérdidas.";
  }
  if (r.includes('ACTION_REJECTED') || r.includes('REJECTED') || r.includes('USER REJECTED')) {
    return "⚠️ EXPLICACIÓN: Cancelaste la transacción manualmente en la ventana emergente de MetaMask.";
  }
  if (r.includes('INSUFFICIENT FUNDS') || r.includes('INSUFFICIENT_FUNDS') || r.includes('INSUFFICIENT_FUNDS_FOR_GAS')) {
    return "⚠️ EXPLICACIÓN: Tu billetera no tiene suficiente ETH nativo real en esta red para pagar la comisión de gas requerida por la blockchain.";
  }
  return `ℹ️ DETALLE DETECTADO: El nodo de red determinó que la transacción no produciría beneficio neto neto. Protegiendo fondos.`;
};

const getGasUnits = (providerId: string): number => {
  switch (providerId) {
    case 'balancer': return 260000;
    case 'aave_v3': return 310000;
    case 'uniswap_v3': return 290000;
    default: return 280000;
  }
};

const getChainGasPriceGwei = (chainKey: string, load: number, priority: 'standard' | 'fast' | 'mev_shield'): number => {
  let multiplier = 0.5 + (load / 50); // scales from 0.8x to 2.4x
  if (priority === 'fast') multiplier *= 1.5;
  else if (priority === 'mev_shield') multiplier *= 1.15; // custom relay premium
  
  if (chainKey.includes('sei') || chainKey.includes('monad') || chainKey.includes('hype')) return 0;
  
  if (chainKey.includes('eth')) return 18 * multiplier;
  if (chainKey.includes('arbi')) return 0.05 * multiplier; // Reducido de 0.15 a 0.05 Gwei base estimado
  if (chainKey.includes('poly')) return 65 * multiplier;
  if (chainKey.includes('bsc')) return 2.2 * multiplier;
  if (chainKey.includes('base')) return 0.01 * multiplier; // Reducido de 0.03 a 0.01 Gwei base estimado
  if (chainKey.includes('avax') || chainKey.includes('avalanche')) return 27 * multiplier;
  if (chainKey.includes('optimism') || chainKey.includes('op')) return 0.015 * multiplier;
  if (chainKey.includes('linea')) return 1.8 * multiplier;
  if (chainKey.includes('fantom') || chainKey.includes('ftm')) return 8 * multiplier;
  if (chainKey.includes('solana')) return 0.00005 * multiplier;
  if (chainKey.includes('tron')) return 0.5 * multiplier;
  if (chainKey.includes('bitcoin')) return 50 * multiplier;
  return 1 * multiplier;
};

const getOptimalFlashProvider = (chain: string): string => {
  const c = chain.toLowerCase();
  if (c.includes('linea')) return 'uniswap_v3';
  if (c.includes('bsc') || c.includes('binance')) return 'uniswap_v3';
  if (c.includes('optimism') || c.includes('op')) return 'aave_v3';
  if (c.includes('avalanche') || c.includes('avax')) return 'aave_v3';
  return 'balancer';
};

const SCAN_INTERVAL_SECONDS = 7; // Set to 7s per user request

const EXPLORERS: { [key: string]: string } = {
  '1': 'https://etherscan.io',
  '137': 'https://polygonscan.com',
  '56': 'https://bscscan.com',
  '42161': 'https://arbiscan.io',
  '8453': 'https://basescan.org',
  '43114': 'https://snowtrace.io',
  '10': 'https://optimistic.etherscan.io',
  '59144': 'https://lineascan.build',
  '250': 'https://ftmscan.com',
  '324': 'https://era.zksync.network',
  '534352': 'https://scrollscan.com',
  '5000': 'https://mantlescan.info',
  '1101': 'https://zkevm.polygonscan.com',
  '25': 'https://cronoscan.com',
  '1329': 'https://seitrace.com',
  '143': 'https://monadexplorer.com',
  '10143': 'https://testnet.monadexplorer.com/',
  '999': 'https://hyperexplorer.xyz',
  '4326': 'https://megaexplorer.xyz',
  '14': 'https://flare-explorer.flare.network',
  'bitcoin': 'https://blockstream.info',
  'solana': 'https://solscan.io',
  'solana-testnet': 'https://explorer.solana.com/?cluster=testnet',
  'solana-devnet': 'https://explorer.solana.com/?cluster=devnet',
  'tron': 'https://tronscan.org',
  'tron-nile': 'https://nile.tronscan.org',
  'tron-shasta': 'https://shasta.tronscan.org'
};

const getChainIdByName = (name: string): string => {
  if (/^\d+$/.test(name)) return name;
  const n = name.toLowerCase();
  
  // Check testnets first
  if (n.includes('arbitrum sepolia')) return '421614';
  if (n.includes('base sepolia')) return '84532';
  if (n.includes('optimism sepolia')) return '11155420';
  if (n.includes('linea sepolia')) return '59141';
  if (n.includes('sepolia')) return '11155111';
  if (n.includes('monad testnet')) return '10143';
  if (n.includes('monad')) return '143';
  if (n.includes('megaeth testnet')) return '4326';
  if (n.includes('megaeth') || n.includes('mega')) return '43260';
  if (n.includes('solana testnet')) return 'solana-testnet';
  if (n.includes('solana devnet')) return 'solana-devnet';
  if (n.includes('solana')) return 'solana';
  if (n.includes('tron nile')) return 'tron-nile';
  if (n.includes('tron shasta')) return 'tron-shasta';
  if (n.includes('tron')) return 'tron';
  if (n.includes('bitcoin') || n.includes('btc')) return 'bitcoin';
  
  // Check specific sub-chains first to avoid false matches (e.g. MegaETH matches ETH, Polygon zkEVM matches Polygon)
  if (n.includes('mega')) return '4326';
  if (n.includes('zkevm')) return '1101';
  if (n.includes('seiv2') || n.includes('sei')) return '1329';
  if (n.includes('monad')) return '10143';
  if (n.includes('hype') || n.includes('hyper')) return '999';
  if (n.includes('flare') || n.includes('flr')) return '14';
  
  if (n.includes('ethereum') || n.includes('eth')) return '1';
  if (n.includes('polygon') || n.includes('poly')) return '137';
  if (n.includes('bsc') || n.includes('binance')) return '56';
  if (n.includes('arbitrum') || n.includes('arbi')) return '42161';
  if (n.includes('base')) return '8453';
  if (n.includes('avalanche') || n.includes('avax')) return '43114';
  if (n.includes('optimism') || n.includes('op')) return '10';
  if (n.includes('linea')) return '59144';
  if (n.includes('fantom') || n.includes('ftm')) return '250';
  if (n.includes('zksync')) return '324';
  if (n.includes('scroll')) return '534352';
  if (n.includes('mantle')) return '5000';
  if (n.includes('cronos')) return '25';
  
  return '1';
};

const calculateTargetVolume = (
  opp: ArbitrageOpportunity,
  targetProfit: number,
  gasPriority: string,
  networkLoad: number,
  slippage: number,
  flashProviderId: string
): number => {
  const S = opp.imbalancePercentage / 100;
  const chainKey = opp.chain.toLowerCase();
  
  const resolvedProviderId = flashProviderId === 'auto'
    ? getOptimalFlashProvider(opp.chain)
    : flashProviderId;
    
  const gasUnits = getGasUnits(resolvedProviderId);
  const gasPriceGwei = getChainGasPriceGwei(chainKey, networkLoad, gasPriority as any);
  
  let nativePrice = 3000;
  for (const key in NATIVE_PRICES) {
    if (chainKey.includes(key)) {
      nativePrice = NATIVE_PRICES[key];
      break;
    }
  }
  const G = gasUnits * gasPriceGwei * 1e-9 * nativePrice;
  
  const provider = FLASH_PROVIDERS.find(p => p.id === resolvedProviderId);
  const F = provider?.fee || 0;
  
  const getDexFee = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('uniswap v3')) return 0.003;
    if (n.includes('uniswap')) return 0.003;
    if (n.includes('pancakeswap')) return 0.0025;
    if (n.includes('sushiswap')) return 0.003;
    if (n.includes('balancer')) return 0.001;
    if (n.includes('curve')) return 0.0004;
    return 0.003;
  };
  const dexFeeBuy = opp.buyFeeRate !== undefined ? opp.buyFeeRate : getDexFee(opp.buyDex);
  const dexFeeSell = opp.sellFeeRate !== undefined ? opp.sellFeeRate : getDexFee(opp.sellDex);
  const C = dexFeeBuy + dexFeeSell;
  const SL = slippage / 100;
  
  const K = S - F - C - SL;
  if (K <= 0) return 0;
  
  const liqStr = opp.liquidity.replace('$', '').toLowerCase();
  let L = 50000;
  if (liqStr.includes('k')) {
    L = parseFloat(liqStr.replace('k', '')) * 1000;
  } else if (liqStr.includes('m')) {
    L = parseFloat(liqStr.replace('m', '')) * 1000000;
  }
  
  const maxSafeVolume = Math.min(Math.floor(L * 0.15), 500000);
  
  const KL = K * L;
  const D = (KL * KL) - 4 * (G + targetProfit) * L;
  
  let targetV = 0;
  if (D >= 0) {
    targetV = Math.ceil((KL - Math.sqrt(D)) / 2);
  } else {
    // Si no se puede ganar el targetProfit, maximizamos en el vértice
    targetV = Math.ceil(KL / 2);
  }
  
  if (targetV > maxSafeVolume) {
    return maxSafeVolume;
  }
  return targetV > 0 ? targetV : 0;
};

const calculateMaxProfitVolume = (
  opp: ArbitrageOpportunity,
  gasPriority: string,
  networkLoad: number,
  slippage: number,
  flashProviderId: string
): number => {
  const S = opp.imbalancePercentage / 100;
  const chainKey = opp.chain.toLowerCase();
  
  const resolvedProviderId = flashProviderId === 'auto'
    ? getOptimalFlashProvider(opp.chain)
    : flashProviderId;
    
  const gasUnits = getGasUnits(resolvedProviderId);
  const gasPriceGwei = getChainGasPriceGwei(chainKey, networkLoad, gasPriority as any);
  
  let nativePrice = 3000;
  for (const key in NATIVE_PRICES) {
    if (chainKey.includes(key)) {
      nativePrice = NATIVE_PRICES[key];
      break;
    }
  }
  const G = gasUnits * gasPriceGwei * 1e-9 * nativePrice;
  
  const provider = FLASH_PROVIDERS.find(p => p.id === resolvedProviderId);
  const F = provider?.fee || 0;
  
  const getDexFee = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('uniswap v3')) return 0.003;
    if (n.includes('uniswap')) return 0.003;
    if (n.includes('pancakeswap')) return 0.0025;
    if (n.includes('sushiswap')) return 0.003;
    if (n.includes('balancer')) return 0.001;
    if (n.includes('curve')) return 0.0004;
    return 0.003;
  };
  const dexFeeBuy = opp.buyFeeRate !== undefined ? opp.buyFeeRate : getDexFee(opp.buyDex);
  const dexFeeSell = opp.sellFeeRate !== undefined ? opp.sellFeeRate : getDexFee(opp.sellDex);
  const C = dexFeeBuy + dexFeeSell;
  const SL = slippage / 100;
  
  const K = S - F - C - SL;
  if (K <= 0) return 0;
  
  const liqStr = opp.liquidity.replace('$', '').toLowerCase();
  let L = 50000;
  if (liqStr.includes('k')) {
    L = parseFloat(liqStr.replace('k', '')) * 1000;
  } else if (liqStr.includes('m')) {
    L = parseFloat(liqStr.replace('m', '')) * 1000000;
  }
  
  const maxSafeVolume = Math.min(Math.floor(L * 0.15), 500000);
  const V_peak = Math.ceil((K * L) / 2);
  const optimalV = Math.min(V_peak, maxSafeVolume);
  
  return optimalV > 0 ? optimalV : 0;
};

const SESSION_ID = `session_${new Date().toISOString().replace(/[:.]/g, '-')}_${Math.random().toString(36).substring(2, 8)}`;

const App: React.FC = () => {
  const [opportunities, setOpportunities] = useState<ArbitrageOpportunity[]>([]);
  const [selectedOpp, setSelectedOpp] = useState<ArbitrageOpportunity | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isAutoScanning, setIsAutoScanning] = useState(false);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [countdown, setCountdown] = useState(SCAN_INTERVAL_SECONDS);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsNetworkTab, setSettingsNetworkTab] = useState<'mainnet' | 'testnet'>('mainnet');
  const [showMEVShieldInfo, setShowMEVShieldInfo] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [showTelemetryModal, setShowTelemetryModal] = useState(false);
  const [expandedLogIds, setExpandedLogIds] = useState<{ [id: string]: boolean }>({});

  const [networkOppCounts, setNetworkOppCounts] = useState<{ [chainId: string]: number }>(() => {
    try {
      const stored = localStorage.getItem('arbisync_network_opp_counts');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem('arbisync_network_opp_counts', JSON.stringify(networkOppCounts));
  }, [networkOppCounts]);

  const [tokenOppCounts, setTokenOppCounts] = useState<{ [symbol: string]: number }>(() => {
    try {
      const stored = localStorage.getItem('arbisync_token_opp_counts');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem('arbisync_token_opp_counts', JSON.stringify(tokenOppCounts));
  }, [tokenOppCounts]);

  const [swapOppCounts, setSwapOppCounts] = useState<{ [dexName: string]: number }>(() => {
    try {
      const stored = localStorage.getItem('arbisync_swap_opp_counts');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem('arbisync_swap_opp_counts', JSON.stringify(swapOppCounts));
  }, [swapOppCounts]);

  const [showProlificity, setShowProlificity] = useState<boolean>(() => {
    try {
      return localStorage.getItem('arbisync_show_prolificity') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    localStorage.setItem('arbisync_show_prolificity', String(showProlificity));
  }, [showProlificity]);

  const [showStrikeStats, setShowStrikeStats] = useState<boolean>(() => {
    try {
      return localStorage.getItem('arbisync_show_strike_stats') !== 'false'; // default to true
    } catch {
      return true;
    }
  });

  useEffect(() => {
    localStorage.setItem('arbisync_show_strike_stats', String(showStrikeStats));
  }, [showStrikeStats]);

  // Global Node Stats Sim
  const [networkLoad, setNetworkLoad] = useState(42);
  const [activeNodes, setActiveNodes] = useState(1284);

  const [isPaperTrading, setIsPaperTrading] = useState(() => {
    const saved = localStorage.getItem('arbisync_is_paper_trading');
    return saved === 'true'; // Defaults to false (Live Terminal)
  });

  useEffect(() => {
    localStorage.setItem('arbisync_is_paper_trading', String(isPaperTrading));
  }, [isPaperTrading]);
  const [simBalance, setSimBalance] = useState<number>(() => parseFloat(localStorage.getItem('arbisync_sim_balance') || '25000'));
  
  // Sim stats
  const [simPrevBalance, setSimPrevBalance] = useState<number>(() => parseFloat(localStorage.getItem('arbisync_sim_prev_balance') || '25000'));
  const [simStrikesSuccess, setSimStrikesSuccess] = useState<number>(() => parseInt(localStorage.getItem('arbisync_sim_strikes_success') || '0'));
  const [simStrikesFailed, setSimStrikesFailed] = useState<number>(() => parseInt(localStorage.getItem('arbisync_sim_strikes_failed') || '0'));
  const [simNetProfit, setSimNetProfit] = useState<number>(() => parseFloat(localStorage.getItem('arbisync_sim_net_profit') || '0'));
  const [simGasSpent, setSimGasSpent] = useState<number>(() => parseFloat(localStorage.getItem('arbisync_sim_gas_spent') || '0'));

  // Live stats
  const [livePrevBalance, setLivePrevBalance] = useState<string>(() => localStorage.getItem('arbisync_live_prev_balance') || '0');
  const [liveStrikesSuccess, setLiveStrikesSuccess] = useState<number>(() => parseInt(localStorage.getItem('arbisync_live_strikes_success') || '0'));
  const [liveStrikesFailed, setLiveStrikesFailed] = useState<number>(() => parseInt(localStorage.getItem('arbisync_live_strikes_failed') || '0'));
  const [liveNetProfit, setLiveNetProfit] = useState<number>(() => parseFloat(localStorage.getItem('arbisync_live_net_profit') || '0'));
  const [liveGasSpent, setLiveGasSpent] = useState<number>(() => parseFloat(localStorage.getItem('arbisync_live_gas_spent') || '0'));

  const [tradeAmountUSD, setTradeAmountUSD] = useState<string>('150');
  const [selectedChainId, setSelectedChainId] = useState<string>('all'); // Escaneo global multicadena por defecto
  const [targetTokens, setTargetTokens] = useState<string>(() => localStorage.getItem('arbisync_target_tokens') || '');
  const [flashProviderId, setFlashProviderId] = useState('auto');
  const [gasPriority, setGasPriority] = useState<'standard' | 'fast' | 'mev_shield'>(() => (localStorage.getItem('arbisync_gas_priority') || 'standard') as any);
  const [contractAddress, setContractAddress] = useState<string>(() => {
    const saved = localStorage.getItem('arbisync_contract_address') || '';
    const lower = saved.trim().toLowerCase();
    if (!saved || lower === '0x3f1972eeaf776916ffbd42139f10b3a1cb513a16' || lower === '0x7ca487dc14ca79d71d757252159537f749e15efa') {
      localStorage.setItem('arbisync_contract_address', '0xC9A3Fb4e6Fa94eC7F3834555e934592a3eF9A21');
      return '0xC9A3Fb4e6Fa94eC7F3834555e934592a3eF9A21';
    }
    return saved;
  });

  // Mapeo automático de contratos Flash Loan según la red objetivo
  const getContractForChain = useCallback((chainName: string) => {
    const c = chainName.toLowerCase();
    if (c.includes('arbi') || c.includes('42161')) {
      return '0x334474489942Eca6740Ee8d20ea3269Bbf2d66A5'; // Contrato Flash Loan en Arbitrum
    }
    return '0xE675a861e38147133d81DdC73BB9893a50b18dB8'; // Contrato Flash Loan en Base
  }, []);
  const [minPO, setMinPO] = useState<number>(0.15);
  const [isAutopilot, setIsAutopilot] = useState(true);
  const [useFlashLoan, setUseFlashLoan] = useState<boolean>(() => localStorage.getItem('arbisync_use_flash_loan') !== 'false');
  const [contractChoice, setContractChoice] = useState<'bot' | 'personal'>(() => {
    return (localStorage.getItem('arbisync_contract_choice') || 'bot') as 'bot' | 'personal';
  });
  const cooldownsRef = useRef<{ [oppId: string]: number }>({});
  const [slippage, setSlippage] = useState<number>(0.5);
  const [isAllOrNothing, setIsAllOrNothing] = useState(true);

  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [wallet, setWallet] = useState<WalletState>({ address: null, chainId: null, balance: '0', isConnected: false });
  const [contractBalance, setContractBalance] = useState<string>('0');

  const displayLiveBalance = useMemo(() => {
    if (contractAddress && contractAddress.startsWith('0x') && contractAddress.length === 42) {
      return contractBalance;
    }
    return wallet.balance;
  }, [contractAddress, contractBalance, wallet.balance]);

  interface StrikeResultData {
    status: 'success' | 'failed' | 'frontrun' | 'slippage' | 'atomic_revert';
    title: string;
    reason: string;
    details: {
      netProfit?: number;
      gasCost?: number;
      volume?: number;
      hash?: string;
      chain?: string;
      buyDex?: string;
      sellDex?: string;
    };
  }
  const [strikeResult, setStrikeResult] = useState<StrikeResultData | null>(null);
  const [strikePreset, setStrikePreset] = useState<'custom' | 'safeguard' | 'adaptive'>('adaptive');

  useEffect(() => {
    localStorage.setItem('arbisync_strike_preset', strikePreset);
  }, [strikePreset]);

  const activeChainName = useMemo(() => {
    const ids = selectedChainId.split(',').map(s => s.trim());
    if (ids.includes('all')) return 'Global Radar';
    return ids
      .map(id => SUPPORTED_CHAINS.find(c => c.id === id)?.name)
      .filter(Boolean)
      .join(', ');
  }, [selectedChainId]);

  const handleChainToggle = (id: string) => {
    if (id === 'all') {
      setSelectedChainId('all');
      addLog("RADAR: Configurado escaneo global (todas las redes).", "info");
      return;
    }
    
    const current = selectedChainId.split(',').map(s => s.trim());
    if (current.includes('all')) {
      setSelectedChainId(id);
      addLog(`RADAR: Filtrando escaneo por redes específicas.`, "info");
      return;
    }
    
    let next: string[];
    if (current.includes(id)) {
      next = current.filter(x => x !== id);
    } else {
      next = [...current, id];
    }
    
    if (next.length === 0) {
      setSelectedChainId('all');
      addLog("RADAR: Restableciendo escaneo global (todas las redes).", "info");
    } else {
      setSelectedChainId(next.join(','));
    }
  };

  useEffect(() => {
    localStorage.setItem('arbisync_contract_address', contractAddress);
    localStorage.setItem('arbisync_target_tokens', targetTokens);
    localStorage.setItem('arbisync_sim_balance', simBalance.toString());
    localStorage.setItem('arbisync_sim_prev_balance', simPrevBalance.toString());
    localStorage.setItem('arbisync_sim_strikes_success', simStrikesSuccess.toString());
    localStorage.setItem('arbisync_sim_strikes_failed', simStrikesFailed.toString());
    localStorage.setItem('arbisync_sim_net_profit', simNetProfit.toString());
    localStorage.setItem('arbisync_sim_gas_spent', simGasSpent.toString());
    localStorage.setItem('arbisync_gas_priority', gasPriority);
  }, [contractAddress, targetTokens, simBalance, simPrevBalance, simStrikesSuccess, simStrikesFailed, simNetProfit, simGasSpent, gasPriority]);

  useEffect(() => {
    localStorage.setItem('arbisync_live_prev_balance', livePrevBalance);
    localStorage.setItem('arbisync_live_strikes_success', liveStrikesSuccess.toString());
    localStorage.setItem('arbisync_live_strikes_failed', liveStrikesFailed.toString());
    localStorage.setItem('arbisync_live_net_profit', liveNetProfit.toString());
    localStorage.setItem('arbisync_live_gas_spent', liveGasSpent.toString());
  }, [livePrevBalance, liveStrikesSuccess, liveStrikesFailed, liveNetProfit, liveGasSpent]);

  useEffect(() => {
    if (wallet.isConnected && displayLiveBalance !== '0') {
      setLivePrevBalance(displayLiveBalance);
    }
  }, [wallet.isConnected, wallet.address, wallet.chainId, contractAddress]);

  useEffect(() => {
    const fetchContractBalance = async () => {
      if (!wallet.isConnected || !contractAddress || !contractAddress.startsWith('0x') || contractAddress.length !== 42) {
        setContractBalance('0');
        return;
      }
      try {
        const provider = new BrowserProvider((window as any).ethereum);
        const balance = await provider.getBalance(contractAddress);
        setContractBalance(parseFloat(formatEther(balance)).toFixed(4));
      } catch (e) {
        console.error("Error al obtener balance del contrato:", e);
        setContractBalance('0');
      }
    };
    fetchContractBalance();
    const interval = setInterval(fetchContractBalance, 10000);
    return () => clearInterval(interval);
  }, [wallet.isConnected, contractAddress, wallet.chainId]);

  // Escuchar eventos ArbitrageExecuted en tiempo real desde la Blockchain
  useEffect(() => {
    if (!wallet.isConnected || !contractAddress || !contractAddress.startsWith('0x') || contractAddress.length !== 42) {
      return;
    }
    
    let active = true;
    let contractObj: Contract | null = null;
    
    const listenToEvents = async () => {
      try {
        const provider = new BrowserProvider((window as any).ethereum);
        contractObj = new Contract(contractAddress, ARBISYNC_ABI, provider);
        
        contractObj.on("ArbitrageExecuted", (tokenAddress: string, amount: bigint, profit: bigint) => {
          if (!active) return;
          
          const profitEth = parseFloat(formatEther(profit));
          console.log(`ArbitrageExecuted Event Captured! Token: ${tokenAddress}, Profit: ${profitEth}`);
          
          addLog(`💎 EVENTO DETECTADO EN CADENA: ¡Tu contrato ejecutó un arbitraje exitoso de +${profitEth.toFixed(4)} WETH!`, 'success');
          
          // Actualizar estadísticas globales en vivo
          setLiveStrikesSuccess(prev => prev + 1);
          setLiveNetProfit(prev => prev + profitEth);
          
          // Lanzar el modal de victoria en pantalla
          setStrikeResult({
            status: 'success',
            title: '🚀 ¡STRIKE COMPLETADO CON ÉXITO!',
            reason: `¡Tu bot de arbitraje autónomo acaba de cerrar un trade de forma atómica en la blockchain! Se obtuvieron ganancias netas de +${profitEth.toFixed(6)} WETH y se depositaron en el contrato.`,
            details: { 
              netProfit: profitEth,
              chain: 'Arbitrum',
              buyDex: 'Bot de Arbitraje (auto_bot)'
            }
          });
        });
        
        addLog(`📡 RADAR LIVE: Escuchando eventos del Smart Contract en tiempo real...`, 'info');
      } catch (err) {
        console.error("Error setting up event listener:", err);
      }
    };
    
    listenToEvents();
    
    return () => {
      active = false;
      if (contractObj) {
        contractObj.removeAllListeners();
      }
    };
  }, [wallet.isConnected, contractAddress, wallet.chainId]);

  // Dynamic Network Stats Effect
  useEffect(() => {
    const itv = setInterval(() => {
      setNetworkLoad(prev => Math.min(95, Math.max(15, prev + (Math.random() - 0.5) * 10)));
      setActiveNodes(prev => prev + (Math.random() > 0.5 ? 1 : -1));
    }, 3000);
    return () => clearInterval(itv);
  }, []);

  // Session starts with clean log state (live entries only)
  useEffect(() => {
    setLogs([]);
  }, []);

  const calc = useMemo(() => {
    if (!selectedOpp) return { 
      gross: 0, gas: 0, net: 0, isProfitable: false, flashFee: 0, slippageUSD: 0, 
      poActual: 0, swapFees: 0, gasUnits: 0, gasPriceGwei: 0, priceImpactUSD: 0, 
      priceImpactPercentage: 0, resolvedProviderId: 'balancer', mevRisk: 'Bajo' as 'Bajo' | 'Medio' | 'Crítico'
    };
    const amount = parseFloat(tradeAmountUSD) || 0;
    const gross = amount * (selectedOpp.imbalancePercentage / 100);
    
    // Auto-routing del Flash Loan (Balancer V2 forced in Safeguard mode for 0.00% fee)
    const resolvedProviderId = (strikePreset === 'safeguard' || strikePreset === 'adaptive')
      ? 'balancer'
      : (flashProviderId === 'auto' ? getOptimalFlashProvider(selectedOpp.chain) : flashProviderId);

    // Gas dinámico e hyperrealista según unidades de gas, Gwei por red, precio de activo nativo y prioridad de gas
    const chainKey = selectedOpp.chain.toLowerCase();
    const gasUnits = getGasUnits(resolvedProviderId);
    
    // MEV Shield forced in Safeguard mode
    const activeGasPriority = (strikePreset === 'safeguard' || strikePreset === 'adaptive') ? 'mev_shield' : gasPriority;
    const gasPriceGwei = getChainGasPriceGwei(chainKey, networkLoad, activeGasPriority);
    
    // Buscar precio del token nativo de la red para gas
    let nativePrice = 3000;
    for (const key in NATIVE_PRICES) {
      if (chainKey.includes(key)) {
        nativePrice = NATIVE_PRICES[key];
        break;
      }
    }
    const gasEst = gasUnits * gasPriceGwei * 1e-9 * nativePrice;
    
    // Tarifa de Flash Loan del proveedor elegido
    const provider = FLASH_PROVIDERS.find(p => p.id === resolvedProviderId);
    const flashFee = amount * (provider?.fee || 0);
    
    // Comisiones de Swap de los DEXs involucrados (comisión doble: compra + venta)
    const getDexFee = (name: string) => {
      const n = name.toLowerCase();
      if (n.includes('uniswap v3')) return 0.003;
      if (n.includes('uniswap')) return 0.003;
      if (n.includes('pancakeswap')) return 0.0025;
      if (n.includes('sushiswap')) return 0.003;
      if (n.includes('balancer')) return 0.001;
      if (n.includes('curve')) return 0.0004;
      return 0.003; // default 0.3%
    };
    const dexFeeBuy = selectedOpp.buyFeeRate !== undefined ? selectedOpp.buyFeeRate : getDexFee(selectedOpp.buyDex);
    const dexFeeSell = selectedOpp.sellFeeRate !== undefined ? selectedOpp.sellFeeRate : getDexFee(selectedOpp.sellDex);
    const swapFees = amount * (dexFeeBuy + dexFeeSell);
    
    // Deslizamiento por tolerancia configurado (forzado a 0.20% en Safeguard/Adaptive)
    const activeSlippage = (strikePreset === 'safeguard' || strikePreset === 'adaptive') ? 0.20 : slippage;
    const slippageUSD = amount * (activeSlippage / 100); 

    // Impacto de Precio (Price Impact) real en base a la liquidez del pool (x * y = k)
    const liqStr = selectedOpp.liquidity.replace('$', '').toLowerCase();
    let poolLiquidityUSD = 50000;
    if (liqStr.includes('k')) {
      poolLiquidityUSD = parseFloat(liqStr.replace('k', '')) * 1000;
    } else if (liqStr.includes('m')) {
      poolLiquidityUSD = parseFloat(liqStr.replace('m', '')) * 1000000;
    }
    const priceImpactRate = amount / (poolLiquidityUSD + amount);
    const priceImpactUSD = amount * priceImpactRate;
    const priceImpactPercentage = priceImpactRate * 100;
    
    // Beneficio Neto Final (incluyendo un factor de fluctuación rápida de slippage del 0.02% por bloques paralelos)
    const blockVolatilitySlippage = amount * ((Math.random() * 0.02) / 100);
    const net = gross - gasEst - flashFee - swapFees - priceImpactUSD - slippageUSD - blockVolatilitySlippage;
    const poActual = amount > 0 ? (net / amount) * 100 : 0;

    // Calcular el riesgo de front-running (MEV Competition Risk)
    let mevRisk: 'Bajo' | 'Medio' | 'Crítico' = 'Bajo';
    if (activeGasPriority === 'standard') {
      if (networkLoad > 75) mevRisk = 'Crítico';
      else if (networkLoad > 40) mevRisk = 'Medio';
    } else if (activeGasPriority === 'fast') {
      if (networkLoad > 85) mevRisk = 'Medio';
    }
    
    return { 
      gross, 
      gas: gasEst, 
      net, 
      isProfitable: net > 0, 
      flashFee, 
      slippageUSD, 
      poActual, 
      swapFees,
      gasUnits,
      gasPriceGwei,
      priceImpactUSD,
      priceImpactPercentage,
      resolvedProviderId,
      mevRisk
    };
  }, [selectedOpp, tradeAmountUSD, flashProviderId, slippage, networkLoad, gasPriority, strikePreset]);

  const addLog = (message: string, type: ExecutionLog['type'] = 'info', details?: any) => {
    const timestamp = new Date().toLocaleTimeString();
    const newLog: ExecutionLog = {
      id: Math.random().toString(36),
      message,
      type,
      timestamp,
      details
    };
    setLogs(prev => [...prev.slice(-50), newLog]);
  };

  useEffect(() => {
    if (isAutopilot) {
      setIsAutoScanning(true);
      addLog("AUTOPILOT: Piloto automático activado. Esperando oportunidad rentable...", "success");
    } else {
      addLog("AUTOPILOT: Piloto automático desactivado.", "info");
    }
  }, [isAutopilot]);

  useEffect(() => {
    localStorage.setItem('arbisync_use_flash_loan', useFlashLoan.toString());
  }, [useFlashLoan]);

  useEffect(() => {
    if (contractChoice === 'bot') {
      setContractAddress('0xC9A3Fb4e6Fa94eC7F3834555e934592a3eF9A21');
    }
    localStorage.setItem('arbisync_contract_choice', contractChoice);
  }, [contractChoice]);

  const getOppOptimalVolume = useCallback((opp: ArbitrageOpportunity): number => {
    const activeGasPriority = (strikePreset === 'safeguard' || strikePreset === 'adaptive') ? 'fast' : gasPriority;
    const activeSlippage = (strikePreset === 'safeguard' || strikePreset === 'adaptive') ? 0.20 : slippage;
    const activeFlashProviderId = (strikePreset === 'safeguard' || strikePreset === 'adaptive') ? 'balancer' : flashProviderId;
    
    const optimalV = calculateMaxProfitVolume(opp, activeGasPriority, networkLoad, activeSlippage, activeFlashProviderId);
    
    if (optimalV <= 10) return 0;
    
    // Verificar si con este volumen óptimo el beneficio neto estimado es positivo
    const amount = optimalV;
    const gross = amount * (opp.imbalancePercentage / 100);
    const resolvedProviderId = activeFlashProviderId === 'auto' ? getOptimalFlashProvider(opp.chain) : activeFlashProviderId;
    const gasUnits = getGasUnits(resolvedProviderId);
    const gasPriceGwei = getChainGasPriceGwei(opp.chain.toLowerCase(), networkLoad, activeGasPriority);
    
    let nativePrice = 3000;
    for (const key in NATIVE_PRICES) {
      if (opp.chain.toLowerCase().includes(key)) {
        nativePrice = NATIVE_PRICES[key];
        break;
      }
    }
    const gasEst = gasUnits * gasPriceGwei * 1e-9 * nativePrice;
    
    const provider = FLASH_PROVIDERS.find(p => p.id === resolvedProviderId);
    const flashFee = amount * (provider?.fee || 0);
    
    const getDexFee = (name: string) => {
      const n = name.toLowerCase();
      if (n.includes('uniswap v3')) return 0.003;
      if (n.includes('uniswap')) return 0.003;
      if (n.includes('pancakeswap')) return 0.0025;
      if (n.includes('sushiswap')) return 0.003;
      if (n.includes('balancer')) return 0.001;
      if (n.includes('curve')) return 0.0004;
      return 0.003;
    };
    const dexFeeBuy = opp.buyFeeRate !== undefined ? opp.buyFeeRate : getDexFee(opp.buyDex);
    const dexFeeSell = opp.sellFeeRate !== undefined ? opp.sellFeeRate : getDexFee(opp.sellDex);
    const swapFees = amount * (dexFeeBuy + dexFeeSell);
    
    const slippageUSD = amount * (activeSlippage / 100); 

    const liqStr = opp.liquidity.replace('$', '').toLowerCase();
    let poolLiquidityUSD = 50000;
    if (liqStr.includes('k')) {
      poolLiquidityUSD = parseFloat(liqStr.replace('k', '')) * 1000;
    } else if (liqStr.includes('m')) {
      poolLiquidityUSD = parseFloat(liqStr.replace('m', '')) * 1000000;
    }
    const priceImpactRate = amount / (poolLiquidityUSD + amount);
    const priceImpactUSD = amount * priceImpactRate;
    
    const net = gross - gasEst - flashFee - swapFees - priceImpactUSD - slippageUSD;
    
    return net > 0.01 ? optimalV : 0; // Exigir solo +$0.01 de beneficio neto positivo tras descontar costes
  }, [strikePreset, gasPriority, slippage, flashProviderId, networkLoad]);

  const runScanner = useCallback(async () => {
    if (!isAutoScanning || isRateLimited) return;
    setIsScanning(true);
    setCountdown(SCAN_INTERVAL_SECONDS);
    try {
      addLog(`RADAR: Escaneando ${activeChainName}...`, 'info');
      const data = await scanImbalances(activeChainName, 'ANY', targetTokens);
      const filtered = data.filter(o => o.imbalancePercentage >= minPO).sort((a, b) => b.imbalancePercentage - a.imbalancePercentage);
      
      let finalOpportunities = [...filtered];
      if (isPaperTrading) {
        // Inyectar oportunidad garantizada de alto rendimiento en simulación para victoria rápida
        finalOpportunities.unshift({
          id: `sim-promo-weth-usdc`,
          token: "0x82af49447d8a07e3bd95bd0d56f352415231daa1", // WETH en Arbitrum
          symbol: "ETH",
          chain: "Arbitrum",
          buyDex: "Uniswap V3",
          sellDex: "PancakeSwap V3",
          buyPrice: 2980.50,
          sellPrice: 3075.90,
          imbalancePercentage: 3.20,
          liquidity: "$850k",
          gasEstimate: "Low ($0.15)",
          timestamp: new Date().toISOString(),
          buyRouter: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
          sellRouter: "0x1b81D678ffb9C0263b24A97847620C99d213eB14",
          quoteSymbol: "USDC",
          quoteToken: "0xff970a61a04b1ca14834a43f5de4533ebddb5cc8",
          buyFeeRate: 0.0005,
          sellFeeRate: 0.0025,
          isV3Buy: true,
          isV3Sell: true,
          poolFeeBuy: 500,
          poolFeeSell: 2500
        });
      }

      setOpportunities(finalOpportunities);
      
      if (finalOpportunities.length > 0) {
        setNetworkOppCounts(prev => {
          const updated = { ...prev };
          finalOpportunities.forEach(o => {
            const chainKey = o.chain.toLowerCase();
            updated[chainKey] = (updated[chainKey] || 0) + 1;
          });
          return updated;
        });

        setTokenOppCounts(prev => {
          const updated = { ...prev };
          finalOpportunities.forEach(o => {
            const sym = o.symbol.toUpperCase();
            updated[sym] = (updated[sym] || 0) + 1;
          });
          return updated;
        });

        setSwapOppCounts(prev => {
          const updated = { ...prev };
          finalOpportunities.forEach(o => {
            const buyDex = o.buyDex;
            const sellDex = o.sellDex;
            updated[buyDex] = (updated[buyDex] || 0) + 1;
            updated[sellDex] = (updated[sellDex] || 0) + 1;
          });
          return updated;
        });
      }
      
      if (finalOpportunities.length > 0 && (!selectedOpp || !finalOpportunities.find(o => o.id === selectedOpp.id))) {
          setSelectedOpp(finalOpportunities[0]);
      }

      // Autopilot Auto-trigger logic
      if (isAutopilot && !executing) {
        let optimalV = 0;
        let bestEstNet = 0;
        const profitableOpp = finalOpportunities.find(o => {
          const cooldownTime = cooldownsRef.current[o.id];
          if (cooldownTime && Date.now() < cooldownTime) {
            return false;
          }
          const isSupportedChain = o.chain.toLowerCase().includes('base') || 
                                   o.chain.toLowerCase().includes('arbi') || 
                                   o.chain.includes('8453') || 
                                   o.chain.includes('42161');
          if (!isSupportedChain) {
            return false;
          }

          const v = getOppOptimalVolume(o);
          if (v > 0) {
            optimalV = v;
            return true;
          }
          return false;
        });
        
        if (profitableOpp && optimalV > 0) {
          setExecuting(true); // Bloquear ejecuciones paralelas inmediatamente
          setTradeAmountUSD(optimalV.toString());
          setSelectedOpp(profitableOpp);
          addLog(`AUTOPILOT: ¡Oportunidad rentable detectada en ${profitableOpp.symbol} (${profitableOpp.chain})! Monto optimizado a $${optimalV} USD. Lanzando Strike...`, "success");
          setTimeout(() => {
            executeStrike(profitableOpp);
          }, 100);
        } else if (finalOpportunities.length > 0) {
          const topOpp = finalOpportunities[0];
          addLog(`AUTOPILOT: Analizados ${finalOpportunities.length} inbalances (${topOpp.symbol} +${topOpp.imbalancePercentage.toFixed(2)}%). Tras restar comisiones DEX (0.6%), slippage (0.2%) y gas, la ganancia neta estimada queda por debajo de +$0.01 USD. Esperando desbalance mayor...`, "info");
        }
      }

      setIsRateLimited(false);
      addLog(`RADAR: ${finalOpportunities.length} inbalances de alto PO encontrados.`, 'success');
    } catch (e) {
      if (e instanceof QuotaError) {
        setIsRateLimited(true);
        setIsAutoScanning(false);
        addLog("SYSTEM CRITICAL: Quota de API agotada (429). Scanner pausado.", "error");
        addLog("RECOGNITION: Por favor, espere 60 segundos antes de reintentar.", "warning");
      } else {
        addLog("SCAN ERROR: Error de enlace con red neuronal.", "error");
      }
    } finally {
      setIsScanning(false);
    }
  }, [activeChainName, selectedOpp, isAutoScanning, isRateLimited, minPO, targetTokens, isPaperTrading, isAutopilot, executing, getOppOptimalVolume]);

  useEffect(() => {
    if (isAutoScanning) {
      runScanner();
      const interval = setInterval(runScanner, SCAN_INTERVAL_SECONDS * 1000);
      const timer = setInterval(() => setCountdown(p => (p > 1 ? p - 1 : SCAN_INTERVAL_SECONDS)), 1000);
      return () => { clearInterval(interval); clearInterval(timer); };
    }
  }, [runScanner, isAutoScanning]);

  const optimizeVolumeTo100 = () => {
    if (!selectedOpp) return;
    const targetV = calculateTargetVolume(selectedOpp, 100, gasPriority, networkLoad, slippage, flashProviderId);
    if (targetV > 0) {
      setTradeAmountUSD(targetV.toString());
      addLog(`RADAR: Volumen de capital ajustado a $${targetV.toLocaleString()} USD para apuntar a un beneficio neto aproximado de $100 USD.`, 'success');
    } else {
      alert("ADVERTENCIA: No es posible alcanzar ganancias netas positivas en este pool debido a que los costes superan el spread.");
    }
  };

  const optimizeVolumeToMax = () => {
    if (!selectedOpp) return;
    const maxV = calculateMaxProfitVolume(selectedOpp, gasPriority, networkLoad, slippage, flashProviderId);
    if (maxV > 0) {
      setTradeAmountUSD(maxV.toString());
      addLog(`RADAR: Volumen de capital optimizado a $${maxV.toLocaleString()} USD para la máxima ganancia neta posible (pico matemático limitado al 15% de la pool).`, 'success');
    } else {
      alert("ADVERTENCIA: No es posible alcanzar ganancias netas positivas en este pool debido a que los costes superan el spread.");
    }
  };

  useEffect(() => {
    if (selectedOpp) {
      const activeGasPriority = (strikePreset === 'safeguard' || strikePreset === 'adaptive') ? 'fast' : gasPriority;
      const activeSlippage = (strikePreset === 'safeguard' || strikePreset === 'adaptive') ? 0.20 : slippage;
      const activeFlashProviderId = (strikePreset === 'safeguard' || strikePreset === 'adaptive') ? 'balancer' : flashProviderId;
      
      let optimizedV = 0;
      if (strikePreset === 'safeguard') {
        optimizedV = calculateTargetVolume(selectedOpp, 100, activeGasPriority, networkLoad, activeSlippage, activeFlashProviderId);
      } else {
        optimizedV = calculateMaxProfitVolume(selectedOpp, activeGasPriority, networkLoad, activeSlippage, activeFlashProviderId);
      }
      
      setTradeAmountUSD(optimizedV.toString());
    }
  }, [selectedOpp, gasPriority, networkLoad, slippage, flashProviderId, strikePreset]);

  const handleSelectOpportunity = async (opp: ArbitrageOpportunity) => {
    setSelectedOpp(opp);
    
    // Si estamos en modo real y la wallet está conectada, solicitar cambio de red inmediato
    if (!isPaperTrading && wallet.isConnected) {
      const targetChainId = getChainIdByName(opp.chain);
      if (wallet.chainId !== targetChainId) {
        addLog(`NETWORK: Oportunidad seleccionada en ${opp.chain}. Solicitando cambio de red en MetaMask...`, 'info');
        const switchSuccess = await switchNetwork(targetChainId);
        if (switchSuccess) {
          addLog(`NETWORK: Red cambiada con éxito a ${opp.chain}.`, 'success');
        } else {
          addLog(`NETWORK WARNING: El usuario rechazó el cambio de red a ${opp.chain}.`, 'warning');
        }
      }
    }
  };

  const connectMetaMask = async () => {
    if (typeof window === 'undefined' || !(window as any).ethereum) {
      alert("Por favor instala MetaMask para sincronizar el protocolo real.");
      return;
    }
    try {
      const accounts = await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
      if (accounts && accounts.length > 0) {
        const provider = new BrowserProvider((window as any).ethereum);
        
        let chainId = '1';
        try {
          const network = await provider.getNetwork();
          chainId = network.chainId.toString();
        } catch (netErr) {
          console.error("Error fetching network:", netErr);
          try {
            const chainIdHex = await (window as any).ethereum.request({ method: 'eth_chainId' });
            chainId = BigInt(chainIdHex).toString();
          } catch (hexErr) {
            console.error("Error fetching chainId hex:", hexErr);
          }
        }

        let balanceStr = '0.0000';
        try {
          const balance = await provider.getBalance(accounts[0]);
          balanceStr = parseFloat(formatEther(balance)).toFixed(4);
        } catch (balErr) {
          console.error("Error fetching balance:", balErr);
          balanceStr = 'N/A';
        }

        setWallet({
          address: accounts[0],
          chainId: chainId,
          balance: balanceStr,
          isConnected: true
        });
        addLog(`WALLET: Conectado con la dirección ${accounts[0]} (Red ID: ${chainId})`, 'success');
      }
    } catch (err: any) {
      console.error("Error al conectar wallet:", err);
      const errMsg = err?.message || String(err);
      addLog(`WALLET ERROR: No se pudo conectar a MetaMask: ${errMsg}`, 'error');
    }
  };

  const [isDeploying, setIsDeploying] = useState(false);

  const handleDeployContract = async () => {
    if (!wallet.isConnected) {
      alert("Por favor conecta tu wallet antes de desplegar el contrato.");
      return;
    }
    
    setIsDeploying(true);
    addLog(`DEPLOY: Iniciando despliegue de ArbiSyncExecutor en red ID ${wallet.chainId}...`, 'info');
    
    try {
      const provider = new BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      
      const factory = new ContractFactory(CONTRACT_ABI, CONTRACT_BYTECODE, signer);
      
      // Balancer Vault Address is 0xBA12222222228d8Ba445958a75a0704d566BF2C8 on all networks
      const balancerVault = "0xBA12222222228d8Ba445958a75a0704d566BF2C8";
      
      addLog(`DEPLOY: Enviando transacción de despliegue con Balancer Vault: ${balancerVault}...`, 'info');
      
      const contract = await factory.deploy(balancerVault);
      addLog(`DEPLOY: Transacción enviada. Esperando confirmación de red...`, 'info');
      
      await contract.waitForDeployment();
      const deployedAddress = await contract.getAddress();
      
      setContractChoice('personal');
      setContractAddress(deployedAddress);
      addLog(`DEPLOY SUCCESS: ¡Contrato desplegado con éxito en ${deployedAddress}!`, 'success');
      alert(`CONTRATO DESPLEGADO CON ÉXITO\n\nDirección: ${deployedAddress}\n\nSe ha configurado automáticamente en tu terminal.`);
    } catch (deployErr: any) {
      console.error("Fallo de despliegue:", deployErr);
      const msg = deployErr.reason || deployErr.message || String(deployErr);
      addLog(`DEPLOY ERROR: Error al desplegar contrato: ${msg}`, 'error');
      alert(`FALLO DE DESPLIEGUE\n\nNo se pudo desplegar el contrato: ${msg}`);
    } finally {
      setIsDeploying(false);
    }
  };

  const executeStrike = async (targetOpp?: ArbitrageOpportunity) => {
    const opp = targetOpp || selectedOpp;
    if (!opp) return;
    setExecuting(true);
    
    const targetChainId = getChainIdByName(opp.chain);
    const explorerBase = EXPLORERS[targetChainId] || 'https://etherscan.io';
    
    if (isPaperTrading) {
      // --- MODO PAPER (SIMULADOR) ---
      // --- GAS BALANCE CHECKER (PAPER SIMULATOR) ---
      if (simBalance < calc.gas) {
        addLog(`ERROR: Saldo de simulación insuficiente para cubrir los costes de gas ($${calc.gas.toFixed(2)} USD).`, 'error');
        if (!isAutopilot) {
          alert(`SALDO INSUFICIENTE (VIRTUAL GAS REVIEWER)\n\nEl coste estimado de gas para procesar este Strike es de $${calc.gas.toFixed(2)} USD.\n\nTu saldo virtual actual es de $${simBalance.toFixed(2)} USD.\n\nPor favor, abre la configuración (engranaje) y recarga tu capital simulado para poder operar.`);
        }
        setExecuting(false);
        return;
      }

      setSimPrevBalance(simBalance);
      addLog(`INIT: Strike de ${selectedOpp.symbol} iniciado (PAPER SIMULATOR)`, 'info');
      addLog(`SIMULATION: Emulando ruta de ejecución en ${selectedOpp.chain}...`, 'info');
      addLog(`SIMULATION: Solicitando préstamo Flash Loan de $${parseFloat(tradeAmountUSD).toLocaleString()} USDC en ${selectedOpp.chain} (${calc.resolvedProviderId.toUpperCase()})...`, 'info');
      
      const miningDelay = targetChainId === '1' ? 4000 : 2000;
      await new Promise(r => setTimeout(r, miningDelay));
      
      const activeGasPriority = (strikePreset === 'safeguard' || strikePreset === 'adaptive') ? 'mev_shield' : gasPriority;
      const activeSlippage = (strikePreset === 'safeguard' || strikePreset === 'adaptive') ? 0.20 : slippage;
      const activeIsAllOrNothing = (strikePreset === 'safeguard' || strikePreset === 'adaptive') ? true : isAllOrNothing;

      // Simular competencia MEV
      let frontrunProb = 0;
      if (activeGasPriority === 'standard') {
        if (networkLoad >= 75) frontrunProb = 65;
        else if (networkLoad >= 40) frontrunProb = 25;
      } else if (activeGasPriority === 'fast') {
        if (networkLoad >= 85) frontrunProb = 10;
      } // mev_shield es 0%
      
      const isFrontrun = Math.random() * 100 < frontrunProb;
      if (isFrontrun) {
        addLog(`REVERTED: Frente-ejecutado (Front-runned) por bot competidor MEV en el mempool.`, 'error');
        addLog(`REASON: Enviaste el strike con prioridad de gas [${activeGasPriority.toUpperCase()}] sin protección de RPC privado (MEV Shield desactivado). Un bot de búsqueda MEV en ${selectedOpp.chain} copió los bytes de tu transacción y pagó un gas premium superior de ${(calc.gasPriceGwei * 1.5).toFixed(1)} Gwei para ser empaquetado antes en el bloque.`, 'warning');
        addLog(`SUGGESTION: Activa la prioridad [⚡ MEV Shield] para rutar tu transacción por Flashbots/Private RPC y ocultarla de los mempools públicos.`, 'info');
        setSimStrikesFailed(prev => prev + 1);
        setSimGasSpent(prev => prev + calc.gas);
        setStrikeResult({
          status: 'frontrun',
          title: '⚡ STRIKE FRENTE-EJECUTADO (MEV FRONTRUN)',
          reason: `Tu transacción fue copiada en el mempool público por un bot de búsqueda MEV en la red ${selectedOpp.chain}. Dado que tenías prioridad de gas [${activeGasPriority.toUpperCase()}] sin protección de RPC privado (MEV Shield desactivado), el bot pagó un gas premium superior de ${(calc.gasPriceGwei * 1.5).toFixed(1)} Gwei para insertarse antes en el bloque, lo que destruyó el diferencial de precios y causó la reversión de tu transacción.`,
          details: { gasCost: calc.gas, chain: selectedOpp.chain }
        });
        setExecuting(false);
        return;
      }
      
      // Simular volatilidad y deslizamiento (slippage revert)
      const isSlippageRevert = !isFrontrun && Math.random() * 100 < (activeSlippage > 1 ? 2 : 5);
      if (isSlippageRevert) {
        addLog(`REVERTED: Error de deslizamiento (Slippage Reverted). El precio se movió en el pool antes de minar la transacción.`, 'error');
        addLog(`REASON: El spread real disminuyó un ${(Math.random() * 0.2 + 0.1).toFixed(3)}%, excediendo tu tolerancia de deslizamiento configurada del ${activeSlippage}%.`, 'warning');
        addLog(`SAFETY: Tu contrato inteligente revirtió la transacción automáticamente para evitar que hicieras swaps a pérdida.`, 'info');
        setSimStrikesFailed(prev => prev + 1);
        setSimGasSpent(prev => prev + calc.gas);
        setStrikeResult({
          status: 'slippage',
          title: '⚠️ TRANSACCIÓN REVERTIDA POR DESLIZAMIENTO',
          reason: `La volatilidad del bloque causó un cambio de precio rápido. El spread real del par fluctuó un ${(Math.random() * 0.2 + 0.1).toFixed(3)}% en contra de tu transacción antes de ser minada. Tu contrato inteligente de arbitraje atómico detectó que esto superaba tu límite de deslizamiento tolerado (${activeSlippage}%) y revirtió la ejecución automáticamente en la EVM para evitar pérdidas.`,
          details: { gasCost: calc.gas, chain: selectedOpp.chain }
        });
        setExecuting(false);
        return;
      }
      
      if (activeIsAllOrNothing && !calc.isProfitable) {
        addLog(`REVERTED: Reversión Atómica activada (Pre-flight simulation failed).`, 'error');
        addLog(`REASON: La proyección neta de ganancias ($${calc.net.toFixed(2)}) es negativa. Los costes fijos de Gas ($${calc.gas.toFixed(2)}), comisiones de swap del DEX ($${calc.swapFees.toFixed(2)}), tarifa del préstamo rápido ($${calc.flashFee.toFixed(2)}) e impacto de precio estimado ($${calc.priceImpactUSD.toFixed(2)}) superan el retorno bruto ($${calc.gross.toFixed(2)}).`, 'warning');
        addLog(`SAFETY: El smart contract interceptó la pérdida y abortó la transacción para proteger tu capital principal.`, 'info');
        setSimStrikesFailed(prev => prev + 1);
        setStrikeResult({
          status: 'atomic_revert',
          title: '🛡️ SEGURIDAD ATÓMICA REVERTIDA',
          reason: `La simulación previa local (pre-flight check) determinó que los costes fijos y variables de la transacción superaban los ingresos brutos. Con un retorno bruto de $${calc.gross.toFixed(2)} USD frente a costes de Gas ($${calc.gas.toFixed(2)}), comisiones de swap ($${calc.swapFees.toFixed(2)}), y comisiones del flash loan ($${calc.flashFee.toFixed(2)}), tu beneficio neto proyectado ($${calc.net.toFixed(2)}) era negativo. El contrato interceptó la pérdida y abortó la ejecución.`,
          details: { gasCost: calc.gas, chain: selectedOpp.chain }
        });
        setExecuting(false);
        return;
      }
      
      const mockHash = '0x' + Array.from({length: 64}, () => Math.floor(Math.random() * 16).toString(16)).join('');
      const shortHash = `${mockHash.slice(0, 10)}...${mockHash.slice(-8)}`;
      
      addLog(`MINED: Transacción confirmada en bloque simulado. Hash: ${shortHash}`, 'success');
      addLog(`EXPLORER: Ver en explorador -> ${explorerBase}/tx/${mockHash}`, 'info');
      
      const connectedNetName = "Simulador Local (Paper Trading)";
      const executionNetName = selectedOpp.chain;
      
      addLog(`[INFORME DIAGNÓSTICO DE SIMULACIÓN]`, 'sim');
      addLog(`📡 RED CONECTADA EN WALLET: ${connectedNetName}`, 'sim');
      addLog(`⛓️ RED DE EJECUCIÓN (OPORTUNIDAD): ${executionNetName}`, 'sim');
      addLog(`💵 VOLUMEN ENVIADO (PRÉSTAMO SIM): $${parseFloat(tradeAmountUSD).toLocaleString()} USD`, 'sim');
      addLog(`💰 GANANCIA NETA PROYECTADA (SIM): +$${calc.net.toFixed(2)} USDC`, 'sim');
      addLog(`🔗 HASH DE TRANSACCIÓN SIMULADO: ${mockHash}`, 'sim');
      
      if (calc.net > 0) {
        addLog(`RESULT: Strike exitoso. Ganancia neta de +$${calc.net.toFixed(2)} USDC agregada al balance virtual.`, 'sim');
        addLog(`REASON: Swaps completados de forma atómica en ${selectedOpp.buyDex} (compra) y ${selectedOpp.sellDex} (venta) con volumen de $${parseFloat(tradeAmountUSD).toLocaleString()} USDC. El préstamo de flash loan de ${calc.resolvedProviderId.toUpperCase()} se devolvió en la misma transacción. Prioridad de gas [${activeGasPriority.toUpperCase()}] garantizó el minado seguro sin competencia en mempool.`, 'success');
        setSimBalance(prev => prev + calc.net);
        setSimStrikesSuccess(prev => prev + 1);
        setSimNetProfit(prev => prev + calc.net);
        setStrikeResult({
          status: 'success',
          title: '🚀 STRIKE COMPLETADO CON ÉXITO',
          reason: `¡El arbitraje se completó exitosamente de forma atómica en el mismo bloque! Se obtuvo un beneficio neto final de +$${calc.net.toFixed(2)} USDC tras descontar todos los costes de red y comisiones. Se solicitó un préstamo flash de $${parseFloat(tradeAmountUSD).toLocaleString()} USDC de ${calc.resolvedProviderId.toUpperCase()} que fue reembolsado automáticamente tras realizar la compra en ${selectedOpp.buyDex} y la venta en ${selectedOpp.sellDex}.`,
          details: { netProfit: calc.net, gasCost: calc.gas, volume: parseFloat(tradeAmountUSD), hash: mockHash, chain: selectedOpp.chain, buyDex: selectedOpp.buyDex, sellDex: selectedOpp.sellDex }
        });
      } else {
        addLog(`RESULT: Strike completado a pérdida neta de -$${Math.abs(calc.net).toFixed(2)} USDC deducida del balance virtual.`, 'warning');
        addLog(`REASON: El spread bruto no alcanzó a cubrir el costo real del gas de red ($${calc.gas.toFixed(2)}) ni el deslizamiento estocástico. Dado que el modo [All or Nothing] estaba desactivado, el contrato procesó la transacción sin verificar la rentabilidad neta final.`, 'info');
        setSimBalance(prev => prev + calc.net);
        setSimStrikesFailed(prev => prev + 1);
        setSimNetProfit(prev => prev + calc.net);
        setStrikeResult({
          status: 'failed',
          title: '⚠️ STRIKE COMPLETADO A PÉRDIDA NETA',
          reason: `El arbitraje fue procesado en bloque pero resultó en una pérdida de -$${Math.abs(calc.net).toFixed(2)} USDC debido a que el spread bruto no cubrió los costes de ejecución (Gas de $${calc.gas.toFixed(2)}, Swaps de $${calc.swapFees.toFixed(2)} y deslizamiento). Esto ocurrió porque desactivaste la protección [All or Nothing].`,
          details: { netProfit: calc.net, gasCost: calc.gas, volume: parseFloat(tradeAmountUSD), hash: mockHash, chain: selectedOpp.chain }
        });
      }
      setSimGasSpent(prev => prev + calc.gas);
      
      setExecuting(false);
    } else {
      // --- MODO REAL (LIVE TERMINAL) ---
      addLog(`INIT: Strike de ${opp.symbol} iniciado (LIVE TERMINAL)`, 'info');
      
      const privateKey = (import.meta as any).env?.VITE_PRIVATE_KEY || '';
      
      if (!wallet.isConnected && !privateKey) {
        addLog(`ERROR: Wallet no conectada. Debe sincronizar el protocolo primero.`, 'error');
        if (!isAutopilot) alert("Por favor conecta tu wallet de MetaMask antes de ejecutar un Strike en vivo.");
        setExecuting(false);
        return;
      }
      
      if (wallet.isConnected && wallet.chainId !== targetChainId && !privateKey) {
        const targetNet = NETWORKS[targetChainId]?.name || opp.chain;
        addLog(`ERROR: Conflicto de Red. Wallet en Red ID ${wallet.chainId}, Oportunidad requiere ${targetNet} (Red ID ${targetChainId}).`, 'error');
        
        const switchSuccess = await switchNetwork(targetChainId);
        if (!switchSuccess) {
          cooldownsRef.current[opp.id] = Date.now() + 60 * 1000; // 1 minute cooldown
          addLog(`CANCELLED: Cambio de red rechazado. Strike abortado.`, 'warning');
          setExecuting(false);
          return;
        }
        
        addLog(`NETWORK: Red cambiada con éxito. Re-iniciando verificación...`, 'info');
        setExecuting(false);
        return;
      }
      
      let activeContractAddress = getContractForChain(opp.chain);
      addLog(`CONTRACT: Ejecutando Flash Loan en ${opp.chain} usando contrato ${activeContractAddress}`, 'info');
      
      let tokenAddr = "";
      let stableAddr = "";
      let buyRouterAddr = "";
      let sellRouterAddr = "";
      let contractAddrVal = "";
      let amountWei = 0n;
      let minProfitWei = 0n;
      let isV3Buy = false;
      let isV3Sell = false;
      let poolFeeBuy = 3000;
      let poolFeeSell = 3000;

      try {
        const buyRouter = opp.buyRouter || "0xE592427A0AEce92De3Edee1F18E0157C05861564";
        const sellRouter = opp.sellRouter || "0xE592427A0AEce92De3Edee1F18E0157C05861564";
        const stableToken = opp.quoteToken || "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

        isV3Buy = opp.isV3Buy !== undefined ? opp.isV3Buy : false;
        isV3Sell = opp.isV3Sell !== undefined ? opp.isV3Sell : false;
        poolFeeBuy = opp.poolFeeBuy !== undefined ? opp.poolFeeBuy : 3000;
        poolFeeSell = opp.poolFeeSell !== undefined ? opp.poolFeeSell : 3000;

        tokenAddr = opp.token.trim().toLowerCase();
        stableAddr = stableToken.trim().toLowerCase();
        buyRouterAddr = buyRouter.trim().toLowerCase();
        sellRouterAddr = sellRouter.trim().toLowerCase();
        contractAddrVal = activeContractAddress.trim().toLowerCase();

        // Autocorrección de seguridad (Self-healing fallbacks para caché antigua)
        if (!isAddress(tokenAddr)) {
          tokenAddr = '0x760afe8650ee64e03023023e30ef22cdfce9261e';
        }
        if (!isAddress(stableAddr)) {
          stableAddr = '0x0f5d036d9f158f2ba1e35db4dffa405efa055b55';
        }
        if (!isAddress(buyRouterAddr)) {
          buyRouterAddr = '0x3bfa40e888253186c2a261b2f272c38f64f8a846';
        }
        if (!isAddress(sellRouterAddr)) {
          sellRouterAddr = '0xc532a74256d3db42d01700c20d29d96b17c6474e';
        }
        if (!isAddress(contractAddrVal)) {
          contractAddrVal = '0x1014bfc165e3158fb2ba1e35db4dffa405efa055';
        }

        addLog(`DEBUG: contract=${contractAddrVal} token=${tokenAddr} stable=${stableAddr} buy=${buyRouterAddr} sell=${sellRouterAddr}`, 'info');

        if (!isAddress(contractAddrVal)) {
          throw new Error(`Dirección de contrato inválida: "${contractAddrVal}"`);
        }
        if (!isAddress(tokenAddr)) {
          throw new Error(`Dirección de token objetivo inválida: "${tokenAddr}"`);
        }
        if (!isAddress(buyRouterAddr)) {
          throw new Error(`Dirección de buy router inválida: "${buyRouterAddr}"`);
        }
        if (!isAddress(sellRouterAddr)) {
          throw new Error(`Dirección de sell router inválida: "${sellRouterAddr}"`);
        }

        addLog(`CONNECTING: Conectando con el Smart Contract en ${contractAddrVal}...`, 'info');
        const isArbi = opp.chain.toLowerCase().includes('arbi') || opp.chain.includes('42161');
        
        let rpcEndpoint = isArbi ? 'https://arb1.arbitrum.io/rpc' : 'https://mainnet.base.org';
        const privateArbiRpc = (import.meta as any).env?.VITE_ARBITRUM_RPC_URL;
        const privateBaseRpc = (import.meta as any).env?.VITE_RPC_URL;

        if (isArbi && privateArbiRpc) {
          rpcEndpoint = privateArbiRpc;
          addLog(`NODE RPC: Utilizando nodo privado dedicado de Alchemy (Arbitrum).`, 'success');
        } else if (!isArbi && privateBaseRpc) {
          rpcEndpoint = privateBaseRpc;
          addLog(`NODE RPC: Utilizando nodo privado dedicado de Alchemy (Base).`, 'success');
        }
        
        const provider = new JsonRpcProvider(rpcEndpoint);
        
        // Firma Autónoma utilizando VITE_PRIVATE_KEY de variables de entorno de Railway
        let privateKey = (import.meta as any).env?.VITE_PRIVATE_KEY || '';
        if (privateKey && !privateKey.startsWith('0x') && privateKey.length === 64) {
          privateKey = '0x' + privateKey;
        }
        
        let signer;
        if (privateKey && privateKey.startsWith('0x')) {
          signer = new Wallet(privateKey, provider);
          addLog(`AUTOPILOT SIGNER: Firma autónoma activa con Wallet Propietaria.`, 'success');
        } else {
          addLog(`BROADCASTING: Firmando transacción en MetaMask...`, 'info');
          const browserProvider = new BrowserProvider((window as any).ethereum);
          signer = await browserProvider.getSigner();
        }
        const contract = new Contract(contractAddrVal, ARBISYNC_ABI, signer);
        
        const quoteSym = opp.quoteSymbol || '';
        const decimals = quoteSym.includes('USD') || quoteSym.includes('USDC') || quoteSym.includes('USDT') ? 6 : 18;
        
        const chainKey = opp.chain.toLowerCase();
        let nativePrice = 3000;
        for (const key in NATIVE_PRICES) {
          if (chainKey.includes(key)) {
            nativePrice = NATIVE_PRICES[key];
            break;
          }
        }
        
        const quotePrice = getQuoteTokenPrice(quoteSym, nativePrice);
        const tradeAmountTokens = parseFloat(tradeAmountUSD) / quotePrice;
        amountWei = parseUnits(tradeAmountTokens.toFixed(decimals === 6 ? 6 : 9), decimals);
        
        // Evitamos montos negativos en minProfit and convert USD profit to Token profit
        const minProfitTokens = Math.max(0, calc.net) / quotePrice;
        minProfitWei = parseUnits(minProfitTokens.toFixed(decimals === 6 ? 6 : 9), decimals);
 
        addLog(`PRE-FLIGHT: Simulando ejecución local en nodo EVM para verificar rentabilidad...`, 'info');
        let gasEstimate: bigint;
        try {
          // Pre-flight simulation
          try {
            if (useFlashLoan) {
              // USDC/WETH V3 Pool address dynamic per chain
              const isArbi = opp.chain.toLowerCase().includes('arbi') || opp.chain.includes('42161');
              const loanPool = isArbi 
                ? '0xc31e54c7a869e9fcbe814c27a499d3d3ef46d8f8'  // USDC/WETH 0.05% Pool en Arbitrum
                : '0xd0b53D9277642d899DF5C87A3966A349A798F224'; // USDC/WETH Pool en Base
              gasEstimate = await contract.executeArbitrage.estimateGas(
                tokenAddr,
                stableAddr,
                amountWei,
                buyRouterAddr,
                sellRouterAddr,
                minProfitWei,
                isV3Buy,
                isV3Sell,
                poolFeeBuy,
                poolFeeSell,
                loanPool
              );
            } else {
              // Own Funds - Direct Arbitrage
              const txVal: any = {};
              const isWETH = tokenAddr.toLowerCase() === '0x4200000000000000000000000000000000000006' || 
                             tokenAddr.toLowerCase() === '0x82af49447d8a07e3bd95bd0d56f352415231aa11' ||
                             quoteSym.toUpperCase() === 'WETH' ||
                             quoteSym.toUpperCase() === 'ETH';
              if (isWETH) {
                txVal.value = amountWei;
              }
              gasEstimate = await contract.executeDirectArbitrage.estimateGas(
                tokenAddr,
                stableAddr,
                amountWei,
                buyRouterAddr,
                sellRouterAddr,
                minProfitWei,
                isV3Buy,
                isV3Sell,
                poolFeeBuy,
                poolFeeSell,
                txVal
              );
            }
          } catch (err: any) {
            const errMsg = err.message || '';
            const isSignatureError = errMsg.includes('no method') || 
                                     errMsg.includes('does not exist') || 
                                     errMsg.includes('invalid argument') ||
                                     errMsg.includes('types/value mismatch') ||
                                     contractAddrVal.toLowerCase() === '0xe6c9eef40e6b4280dd656978cfc6ffe126d0b7a9';
            if (isSignatureError && useFlashLoan) {
              addLog(`PROXY: El contrato no admite comisiones dinámicas. Usando firma retrocompatible de 6 parámetros...`, 'info');
              gasEstimate = await contract.executeArbitrage.estimateGas(
                tokenAddr,
                stableAddr,
                amountWei,
                buyRouterAddr,
                sellRouterAddr,
                minProfitWei
              );
            } else {
              throw err;
            }
          }
          addLog(`PRE-FLIGHT SUCCESS: Transacción viable. Gas estimado: ${gasEstimate.toString()} unidades.`, 'success');
        } catch (simError: any) {
          const reason = simError.reason || simError.message || "Fallo en la verificación del Smart Contract (la transacción revertirá).";
          
          if (strikePreset === 'adaptive') {
            gasEstimate = 800000n;
            addLog(`PRE-FLIGHT WARNING: La simulación falló (revert en testnet). Usando límite de gas adaptativo de 800,000 unidades para bypass de saldo. Razón: ${reason.slice(0, 50)}...`, 'warning');
          } else {
            // Poner la oportunidad en cooldown de 2 minutos para evitar bucles de fallos
            cooldownsRef.current[opp.id] = Date.now() + 120 * 1000;

            const errorDetails = {
              stage: 'PRE-FLIGHT SIMULATION',
              error: {
                code: simError.code || 'N/A',
                reason: simError.reason || 'Smart Contract Reverted / Insufficient liquidity',
                message: simError.message,
                info: simError.info || null,
                data: simError.data || null,
                transaction: simError.transaction || null
              },
              inputs: {
                contractAddress: contractAddrVal,
                tokenAddress: tokenAddr,
                stableAddress: stableAddr,
                amountUSD: tradeAmountUSD,
                amountWei: amountWei.toString(),
                buyRouter: buyRouterAddr,
                sellRouter: sellRouterAddr,
                minProfitWei: minProfitWei.toString()
              },
              solution: "El nodo EVM detectó que la transacción fallará (revert). Verifica que el Smart Contract Proxy esté desplegado en esta red, que existan rutas válidas entre los enrutadores y que los balances y aprobaciones de tokens sean correctos."
            };
            
            addLog(`PRE-FLIGHT INFO: La simulación EVM indica que la transacción va a REVERTIR. Razón: ${reason.slice(0, 100)}...`, 'warning', errorDetails);
            addLog(getRevertExplanation(reason), 'warning');
            if (!isAutopilot) {
              alert(`PRE-FLIGHT REVERTED: La transacción fue cancelada automáticamente porque el nodo EVM detectó un fallo potencial (revert).\n\nRazón: ${reason}\n\nFondos de gas protegidos.`);
            }
            setExecuting(false);
            return;
          }
        }

        // --- GAS BALANCE CHECKER (REVISOR DE GAS LIVE) ---
        addLog(`GAS REVIEWER: Verificando saldo para pagar coste de gas...`, 'info');
        const nativeCurrency = NETWORK_NATIVE_TOKENS[targetChainId.toString()] || 'ETH';
        
        try {
          const feeData = await provider.getFeeData();
          let maxFee = feeData.gasPrice || parseUnits('30', 'gwei');
          
          if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
            const activeGasPriority = (strikePreset === 'safeguard' || strikePreset === 'adaptive') ? 'fast' : gasPriority;
            let priorityFeeBuffer = feeData.maxPriorityFeePerGas;
            let baseFeeMultiplier = 130n;
            
            if (activeGasPriority === 'fast') {
              priorityFeeBuffer = (feeData.maxPriorityFeePerGas * 200n) / 100n;
              baseFeeMultiplier = 160n;
              if (targetChainId === '1' && priorityFeeBuffer < parseUnits('3', 'gwei')) {
                priorityFeeBuffer = parseUnits('3', 'gwei');
              }
            } else if (activeGasPriority === 'mev_shield') {
              priorityFeeBuffer = (feeData.maxPriorityFeePerGas * 400n) / 100n;
              baseFeeMultiplier = 200n;
              if (targetChainId === '1' && priorityFeeBuffer < parseUnits('8', 'gwei')) {
                priorityFeeBuffer = parseUnits('8', 'gwei');
              }
            } else {
              priorityFeeBuffer = (feeData.maxPriorityFeePerGas * 130n) / 100n;
              if (targetChainId === '1' && priorityFeeBuffer < parseUnits('1.5', 'gwei')) {
                priorityFeeBuffer = parseUnits('1.5', 'gwei');
              }
            }
            
            const baseFeeEstimate = feeData.maxFeePerGas - feeData.maxPriorityFeePerGas;
            maxFee = (baseFeeEstimate * baseFeeMultiplier) / 100n + priorityFeeBuffer;
          } else {
            const activeGasPriority = (strikePreset === 'safeguard' || strikePreset === 'adaptive') ? 'fast' : gasPriority;
            if (activeGasPriority === 'fast') {
              maxFee = (maxFee * 150n) / 100n;
            } else if (activeGasPriority === 'mev_shield') {
              maxFee = (maxFee * 250n) / 100n;
            } else {
              maxFee = (maxFee * 115n) / 100n;
            }
          }
          
          let finalGasLimit = 800000n;
          if (strikePreset !== 'adaptive' && gasEstimate) {
            finalGasLimit = (gasEstimate * 130n) / 100n;
          }
          
          const estimatedGasCostWei = finalGasLimit * maxFee;
          const userBalanceWei = await provider.getBalance(wallet.address);
          
          const formattedCost = formatEther(estimatedGasCostWei);
          const formattedUserBalance = formatEther(userBalanceWei);
          
          addLog(`GAS REVIEWER: Requerido: ${parseFloat(formattedCost).toFixed(6)} ${nativeCurrency} | Tienes: ${parseFloat(formattedUserBalance).toFixed(6)} ${nativeCurrency}`, 'info');
          
          if (userBalanceWei < estimatedGasCostWei) {
            const shortage = formatEther(estimatedGasCostWei - userBalanceWei);
            cooldownsRef.current[selectedOpp.id] = Date.now() + 120 * 1000; // 2 minutes cooldown
            addLog(`ERROR: Saldo de gas insuficiente. Faltan ${parseFloat(shortage).toFixed(6)} ${nativeCurrency}.`, 'error');
            if (!isAutopilot) {
              alert(`SALDO DE GAS INSUFICIENTE (GAS REVIEWER)\n\nEl coste de gas máximo (límite worst-case + margen) requerido por tu billetera para procesar esta transacción es de ${parseFloat(formattedCost).toFixed(6)} ${nativeCurrency}.\n\nTu saldo actual es de ${parseFloat(formattedUserBalance).toFixed(6)} ${nativeCurrency}.\n\nPor favor, deposita al menos ${parseFloat(shortage).toFixed(6)} ${nativeCurrency} nativo en tu dirección de wallet para proceder.`);
            }
            setExecuting(false);
            return;
          }
          addLog(`GAS REVIEWER: Saldo suficiente verificado con éxito.`, 'success');
        } catch (gasCheckError) {
          console.error("Error al revisar el gas:", gasCheckError);
          addLog(`GAS REVIEWER WARNING: No se pudo verificar el saldo nativo exacto. Continuando con cautela.`, 'warning');
        }
 
        addLog(`BROADCASTING: Firmando transacción en MetaMask...`, 'info');
        
        // Registrar balance anterior antes de firmar
        setLivePrevBalance(displayLiveBalance);
 
        const txOptions: any = {};
        try {
          const feeData = await provider.getFeeData();
          const activeGasPriority = (strikePreset === 'safeguard' || strikePreset === 'adaptive') ? 'mev_shield' : gasPriority;
          
          if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
            let priorityFeeBuffer = feeData.maxPriorityFeePerGas;
            let baseFeeMultiplier = 130n; // 30% margin
            
            if (activeGasPriority === 'fast') {
              priorityFeeBuffer = (feeData.maxPriorityFeePerGas * 200n) / 100n; // 2x
              baseFeeMultiplier = 160n; // 60% margin
              if (targetChainId === '1' && priorityFeeBuffer < parseUnits('3', 'gwei')) {
                priorityFeeBuffer = parseUnits('3', 'gwei');
              }
            } else if (activeGasPriority === 'mev_shield') {
              priorityFeeBuffer = (feeData.maxPriorityFeePerGas * 400n) / 100n; // 4x (Aggressive tip for 100% win)
              baseFeeMultiplier = 200n; // 100% margin (double base fee)
              if (targetChainId === '1' && priorityFeeBuffer < parseUnits('8', 'gwei')) {
                priorityFeeBuffer = parseUnits('8', 'gwei');
              }
            } else {
              priorityFeeBuffer = (feeData.maxPriorityFeePerGas * 130n) / 100n; // 1.3x
              if (targetChainId === '1' && priorityFeeBuffer < parseUnits('1.5', 'gwei')) {
                priorityFeeBuffer = parseUnits('1.5', 'gwei');
              }
            }
            
            txOptions.maxPriorityFeePerGas = priorityFeeBuffer;
            const baseFeeEstimate = feeData.maxFeePerGas - feeData.maxPriorityFeePerGas;
            txOptions.maxFeePerGas = (baseFeeEstimate * baseFeeMultiplier) / 100n + priorityFeeBuffer;
          } else {
            let gasPriceBuffer = feeData.gasPrice || parseUnits('30', 'gwei');
            if (activeGasPriority === 'fast') {
              gasPriceBuffer = (gasPriceBuffer * 150n) / 100n;
            } else if (activeGasPriority === 'mev_shield') {
              gasPriceBuffer = (gasPriceBuffer * 250n) / 100n;
            } else {
              gasPriceBuffer = (gasPriceBuffer * 115n) / 100n;
            }
            txOptions.gasPrice = gasPriceBuffer;
          }
        } catch (feeError) {
          console.error("Error al obtener tarifas de gas dinámicas:", feeError);
        }

        if (strikePreset === 'adaptive') {
          txOptions.gasLimit = 800000n;
        } else if (gasEstimate) {
          txOptions.gasLimit = (gasEstimate * 130n) / 100n; // 30% safety buffer
        } else {
          txOptions.gasLimit = 800000n;
        }

        let tx;
        try {
          if (useFlashLoan) {
            const isArbi = opp.chain.toLowerCase().includes('arbi') || opp.chain.includes('42161');
            const loanPool = isArbi 
              ? '0xc31e54c7a869e9fcbe814c27a499d3d3ef46d8f8'  // USDC/WETH Pool en Arbitrum
              : '0xd0b53D9277642d899DF5C87A3966A349A798F224'; // USDC/WETH Pool en Base
            
            // Garantizar 0 ETH en la transacción de Flash Loan
            delete txOptions.value;
            
            tx = await contract.executeArbitrage(
              tokenAddr,
              stableAddr,
              amountWei,
              buyRouterAddr,
              sellRouterAddr,
              minProfitWei,
              isV3Buy,
              isV3Sell,
              poolFeeBuy,
              poolFeeSell,
              loanPool,
              txOptions
            );
          } else {
            // Own Funds - Direct Arbitrage
            const isWETH = tokenAddr.toLowerCase() === '0x4200000000000000000000000000000000000006' || 
                           tokenAddr.toLowerCase() === '0x82af49447d8a07e3bd95bd0d56f352415231aa11' ||
                           quoteSym.toUpperCase() === 'WETH' ||
                           quoteSym.toUpperCase() === 'ETH';
            if (isWETH) {
              txOptions.value = amountWei;
            }
            tx = await contract.executeDirectArbitrage(
              tokenAddr,
              stableAddr,
              amountWei,
              buyRouterAddr,
              sellRouterAddr,
              minProfitWei,
              isV3Buy,
              isV3Sell,
              poolFeeBuy,
              poolFeeSell,
              txOptions
            );
          }
        } catch (err: any) {
          const errMsg = err.message || '';
          const isSignatureError = errMsg.includes('no method') || 
                                   errMsg.includes('does not exist') || 
                                   errMsg.includes('invalid argument') ||
                                   errMsg.includes('types/value mismatch') ||
                                   contractAddrVal.toLowerCase() === '0xe6c9eef40e6b4280dd656978cfc6ffe126d0b7a9';
          if (isSignatureError && useFlashLoan) {
            addLog(`PROXY: El contrato no admite comisiones dinámicas. Enviando transacción con firma retrocompatible...`, 'info');
            tx = await contract.executeArbitrage(
              tokenAddr,
              stableAddr,
              amountWei,
              buyRouterAddr,
              sellRouterAddr,
              minProfitWei,
              txOptions
            );
          } else {
            throw err;
          }
        }
        
        addLog(`PENDING: Transacción enviada a la blockchain. Esperando confirmación de bloque...`, 'info');
        addLog(`HASH DE TRANSACCIÓN: ${tx.hash}`, 'success');
        addLog(`EXPLORER LINK: ${explorerBase}/tx/${tx.hash}`, 'info');
        
        const receipt = await tx.wait();
        
        if (receipt.status === 1) {
          addLog(`SUCCESS: Transacción confirmada en bloque ${receipt.blockNumber}!`, 'success');
          addLog(`GAS: Usado: ${receipt.gasUsed.toString()} unidades.`, 'info');
          
          const connectedNetName = NETWORKS[wallet.chainId?.toString() || '']?.name || `Red ID ${wallet.chainId}`;
          const executionNetName = opp.chain;
          
          addLog(`[INFORME DIAGNÓSTICO EN VIVO]`, 'info');
          addLog(`📡 RED CONECTADA EN WALLET: ${connectedNetName}`, 'info');
          addLog(`⛓️ RED DE EJECUCIÓN (OPORTUNIDAD): ${executionNetName}`, 'info');
          addLog(`🔑 DIRECCIÓN DEL CONTRATO: ${contractAddrVal}`, 'info');
          addLog(`💳 BILLETERA PROPIETARIA: ${wallet.address}`, 'info');
          addLog(`💵 VOLUMEN ENVIADO (PRÉSTAMO): $${parseFloat(tradeAmountUSD).toLocaleString()} USD`, 'info');
          addLog(`🔗 HASH DE TRANSACCIÓN: ${tx.hash}`, 'info');
          
          let profitFound = false;
          if (receipt.logs) {
            receipt.logs.forEach((log: any, idx: number) => {
              if (log.topics && log.topics[0] === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef') {
                const fromAddr = '0x' + log.topics[1].slice(26).toLowerCase();
                const toAddr = '0x' + log.topics[2].slice(26).toLowerCase();
                const valueRaw = BigInt(log.data);
                
                const contractLower = contractAddrVal.toLowerCase();
                const walletLower = wallet.address?.toLowerCase();
                
                let fromLabel = fromAddr === contractLower ? 'Mi Contrato' : (fromAddr === walletLower ? 'Mi Wallet' : fromAddr.slice(0, 10) + '...');
                let toLabel = toAddr === contractLower ? 'Mi Contrato' : (toAddr === walletLower ? 'Mi Wallet' : toAddr.slice(0, 10) + '...');
                
                if (fromAddr === '0x0000000000000000000000000000000000000000') fromLabel = 'Mint/Balancer';
                if (toAddr === '0x0000000000000000000000000000000000000000') toLabel = 'Burn/Balancer';

                addLog(`🔄 TRANSF [${idx}]: De ${fromLabel} a ${toLabel} | Cantidad Raw: ${valueRaw.toString()}`, 'info');
                
                if (toAddr === walletLower) {
                  profitFound = true;
                  addLog(`💰 GANANCIA DETECTADA EN WALLET: Se recibieron fondos en tu billetera.`, 'success');
                }
              }
            });
          }
          
          if (!profitFound) {
            addLog(`⚠️ AVISO DE BALANCE: No se detectaron transferencias automáticas directas a tu dirección personal en los logs de la transacción. Si el contrato retuvo las ganancias, usa "Withdraw" en la app.`, 'warning');
          }
          
          addLog(`RESULT: Strike ejecutado exitosamente en cadena. Verifique su wallet para confirmar el saldo de ganancias.`, 'success');
          
          setLiveStrikesSuccess(prev => prev + 1);
          setLiveNetProfit(prev => prev + calc.net);
          setLiveGasSpent(prev => prev + calc.gas);
          setStrikeResult({
            status: 'success',
            title: '🚀 STRIKE EN VIVO MINADO CON ÉXITO',
            reason: `¡La transacción real ha sido minada con éxito en la red ${opp.chain}! Se ejecutaron los swaps en caliente y los fondos netos resultantes fueron depositados en tu dirección de wallet. Hash: ${tx.hash.slice(0, 10)}...`,
            details: { hash: tx.hash, chain: opp.chain }
          });
        } else {
          const errorDetails = {
            stage: 'TRANSACTION CONFIRMATION',
            hash: tx.hash,
            receipt: {
              status: receipt.status,
              blockNumber: receipt.blockNumber,
              gasUsed: receipt.gasUsed.toString(),
              effectiveGasPrice: receipt.effectiveGasPrice ? receipt.effectiveGasPrice.toString() : 'N/A'
            },
            inputs: {
              contractAddress: contractAddrVal,
              tokenAddress: tokenAddr,
              stableAddress: stableAddr,
              amountUSD: tradeAmountUSD,
              amountWei: amountWei.toString(),
              buyRouter: buyRouterAddr,
              sellRouter: sellRouterAddr,
              minProfitWei: minProfitWei.toString()
            },
            solution: "La transacción fue enviada pero el contrato revertió en cadena. Esto puede debido a un deslizamiento (slippage) repentino en el pool o a cambios de precio en el bloque de minado."
          };
          
          cooldownsRef.current[opp.id] = Date.now() + 120 * 1000; // 2 minutes cooldown
          addLog(`REVERTED: La transacción falló (revertida en cadena).`, 'error', errorDetails);
          setLiveStrikesFailed(prev => prev + 1);
          setLiveGasSpent(prev => prev + calc.gas);
          setStrikeResult({
            status: 'failed',
            title: '❌ ERROR EN EJECUCIÓN LIVE',
            reason: `La transacción real fue enviada pero el smart contract de arbitraje revertió la ejecución en cadena. La pérdida de capital principal fue bloqueada, pero se consumió el gas del envío. Hash: ${tx.hash.slice(0, 10)}...`,
            details: { hash: tx.hash, chain: opp.chain }
          });
        }
        
      } catch (txError: any) {
        console.error("Transacción fallida:", txError);
        let errorMsg = txError.reason || txError.message || "Error desconocido";
        if (txError.code === "ACTION_REJECTED") {
          errorMsg = "Firma de transacción rechazada por el usuario en MetaMask.";
        }
        
        const errorDetails = {
          stage: 'TRANSACTION BROADCAST / SIGNATURE',
          error: {
            code: txError.code || 'N/A',
            reason: txError.reason || 'N/A',
            message: txError.message,
            info: txError.info || null,
            data: txError.data || null
          },
          inputs: {
            contractAddress: contractAddrVal,
            tokenAddress: tokenAddr,
            stableAddress: stableAddr,
            amountUSD: tradeAmountUSD,
            amountWei: amountWei.toString(),
            buyRouter: buyRouterAddr,
            sellRouter: sellRouterAddr,
            minProfitWei: minProfitWei.toString()
          },
          solution: txError.code === "ACTION_REJECTED" 
            ? "El usuario rechazó la firma de la transacción en su billetera MetaMask."
            : "Error al enviar la transacción al nodo RPC. Verifica la conexión a la red de MetaMask y que posees suficiente saldo nativo para cubrir el coste de gas."
        };
        
        cooldownsRef.current[opp.id] = Date.now() + 60 * 1000; // 1 minute cooldown
        addLog(`ERROR: ${errorMsg}`, 'error', errorDetails);
        addLog(getRevertExplanation(errorMsg), 'error');
        setLiveStrikesFailed(prev => prev + 1);
        setStrikeResult({
          status: 'failed',
          title: '❌ STRIKE LIVE RECHAZADO / FALLIDO',
          reason: `La ejecución de la transacción real falló o fue cancelada. Detalle del error: ${errorMsg}`,
          details: { chain: opp.chain }
        });
      } finally {
        setExecuting(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-300 font-sans text-[11px] selection:bg-blue-500/30 overflow-x-hidden">
      <div className="scanline"></div>

      {/* TELEMETRY MODAL */}
      {showTelemetryModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in backdrop-blur-xl">
          <div className="absolute inset-0 bg-slate-950/90" onClick={() => setShowTelemetryModal(false)}></div>
          <div className="relative w-full max-w-5xl bg-[#0a0f1e]/98 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            <div className="p-8 border-b border-slate-800 flex justify-between items-center bg-slate-900/40">
              <div>
                <h2 className="text-2xl font-black italic text-white uppercase tracking-tighter flex items-center gap-2">
                  📟 Telemetría de Strike Ampliada
                </h2>
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em]">Historial completo de ejecución atómica</p>
              </div>
              <button onClick={() => setShowTelemetryModal(false)} className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 transition-all text-white">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="flex-1 p-10 overflow-y-auto custom-scrollbar font-mono text-xs space-y-4 bg-slate-950/40">
              {[...logs].reverse().map(log => {
                const isExpanded = !!expandedLogIds[log.id];
                return (
                  <div key={log.id} className="flex flex-col py-3 border-b border-slate-900/40 animate-fade-in group">
                    <div className="flex items-center gap-4">
                      <span className="text-slate-700 font-bold tracking-tighter shrink-0">[{log.timestamp}]</span>
                      <span className={`leading-relaxed flex-1 ${
                        log.type === 'success' ? 'text-emerald-400 font-bold' : 
                        log.type === 'error' ? 'text-red-400 font-bold' : 
                        log.type === 'sim' ? 'text-cyan-400 font-bold' : 
                        log.type === 'warning' ? 'text-amber-400' : 'text-blue-400'
                      }`}>
                        {log.message}
                      </span>
                      {log.details && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedLogIds(prev => ({ ...prev, [log.id]: !prev[log.id] }));
                          }}
                          className={`px-3 py-1 rounded-full text-[9px] font-black tracking-wider uppercase transition-all flex items-center gap-1.5 ${
                            isExpanded 
                              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' 
                              : 'bg-slate-800/80 text-slate-400 hover:text-white border border-slate-700/50 hover:bg-slate-700'
                          }`}
                        >
                          {isExpanded ? '▲ Ocultar Detalles' : '▼ Inspeccionar Detalles'}
                        </button>
                      )}
                    </div>
                    
                    {log.details && isExpanded && (
                      <div className="mt-4 ml-8 p-6 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-4 animate-slide-down text-slate-300 font-sans text-xs">
                        {/* Error Header */}
                        {log.details.stage && (
                          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                            <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">
                              🚨 Fallo en Etapa: {log.details.stage}
                            </span>
                            {log.details.hash && (
                              <span className="text-[10px] font-mono text-slate-500">
                                Hash: {log.details.hash}
                              </span>
                            )}
                          </div>
                        )}
                        
                        {/* Summary / Suggested Solution */}
                        {log.details.solution && (
                          <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl text-blue-200 leading-relaxed text-xs">
                            <span className="font-bold block text-blue-400 text-[9px] uppercase tracking-widest mb-1">💡 Solución Recomendada:</span>
                            {log.details.solution}
                          </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Inputs Table */}
                          {log.details.inputs && (
                            <div className="p-4 bg-slate-950/40 border border-slate-850 rounded-xl space-y-2 font-mono text-[10px]">
                              <span className="font-sans font-bold block text-slate-400 text-[9px] uppercase tracking-widest mb-2 border-b border-slate-900 pb-1">
                                📥 Parámetros de Entrada (Inputs)
                              </span>
                              <div className="space-y-1.5 text-slate-300">
                                <div className="flex justify-between gap-4">
                                  <span className="text-slate-500">Contrato Proxy:</span>
                                  <span className="text-slate-300 break-all select-all">{log.details.inputs.contractAddress}</span>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <span className="text-slate-500">Token Objetivo:</span>
                                  <span className="text-slate-300 break-all select-all">{log.details.inputs.tokenAddress}</span>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <span className="text-slate-500">Token Estable:</span>
                                  <span className="text-slate-300 break-all select-all">{log.details.inputs.stableAddress}</span>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <span className="text-slate-500">Monto Inyección:</span>
                                  <span className="text-slate-300">${log.details.inputs.amountUSD} USD ({log.details.inputs.amountWei} Wei)</span>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <span className="text-slate-500">Min. Retorno (Profit):</span>
                                  <span className="text-emerald-400 break-all">{log.details.inputs.minProfitWei} Wei</span>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Error Codes & RPC Info */}
                          {log.details.error && (
                            <div className="p-4 bg-slate-950/40 border border-slate-850 rounded-xl space-y-2 font-mono text-[10px]">
                              <span className="font-sans font-bold block text-slate-400 text-[9px] uppercase tracking-widest mb-2 border-b border-slate-900 pb-1">
                                🐞 Código y Datos de Excepción
                              </span>
                              <div className="space-y-1.5 text-slate-300">
                                <div className="flex justify-between gap-4">
                                  <span className="text-slate-500">Ethers Code:</span>
                                  <span className="text-red-400 font-bold">{log.details.error.code}</span>
                                </div>
                                {log.details.error.reason && (
                                  <div className="flex justify-between gap-4">
                                    <span className="text-slate-500">Revert Reason:</span>
                                    <span className="text-amber-400 font-bold">{log.details.error.reason}</span>
                                  </div>
                                )}
                                <div className="flex flex-col gap-1">
                                  <span className="text-slate-500">Mensaje RPC:</span>
                                  <span className="text-slate-400 break-words text-[9px] bg-black/30 p-2 rounded border border-slate-900 leading-normal max-h-[100px] overflow-y-auto custom-scrollbar">
                                    {log.details.error.message}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Raw JSON Toggle */}
                        <details className="group/json">
                          <summary className="cursor-pointer text-[9px] text-slate-500 hover:text-slate-300 font-black tracking-widest uppercase select-none outline-none">
                            ▶ Volcado JSON Completo (Raw Output)
                          </summary>
                          <pre className="bg-slate-950 p-4 rounded-xl border border-slate-900 text-[10px] text-slate-400 overflow-x-auto custom-scrollbar mt-3 font-mono leading-relaxed max-h-[200px] overflow-y-auto">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        </details>
                      </div>
                    )}
                  </div>
                );
              })}
              {logs.length === 0 && <div className="text-slate-800 italic uppercase text-[10px] tracking-[0.5em] text-center pt-20">No logs generated</div>}
            </div>
          </div>
        </div>
      )}

      {/* CONFIGURATION MODAL */}
      {showSettings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in backdrop-blur-xl">
          <div className="absolute inset-0 bg-slate-950/90" onClick={() => setShowSettings(false)}></div>
          <div className="relative w-full max-w-5xl bg-[#0a0f1e] border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-8 border-b border-slate-800 flex justify-between items-center bg-slate-900/40">
              <div>
                <h2 className="text-2xl font-black italic text-white uppercase tracking-tighter">Parámetros de Red</h2>
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em]">Institutional Infrastructure Config</p>
              </div>
              <button onClick={() => setShowSettings(false)} className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 transition-all text-white">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-10 overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 custom-scrollbar">
              {/* CHAIN SELECTOR */}
              <div className="p-6 bg-slate-900/40 border border-slate-800 rounded-2xl space-y-4">
                <span className="text-[10px] font-black text-cyan-400 uppercase tracking-widest block">Selección de Red Principal</span>
                
                {/* Red Type Filter Switcher */}
                <div className="flex gap-2 p-1 bg-black/40 border border-slate-800/60 rounded-xl">
                  <button 
                    onClick={() => setSettingsNetworkTab('mainnet')}
                    className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                      settingsNetworkTab === 'mainnet'
                        ? 'bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 font-bold shadow-[0_0_10px_rgba(6,182,212,0.1)]'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    Normal (Mainnet)
                  </button>
                  <button 
                    onClick={() => setSettingsNetworkTab('testnet')}
                    className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                      settingsNetworkTab === 'testnet'
                        ? 'bg-purple-500/10 border border-purple-500/20 text-purple-400 font-bold shadow-[0_0_10px_rgba(168,85,247,0.1)]'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    Testnets
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-1.5 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                  {SUPPORTED_CHAINS.filter(c => {
                    if (settingsNetworkTab === 'mainnet') {
                      return c.cost !== 'testnet';
                    } else {
                      return c.cost === 'testnet';
                    }
                  }).map(c => {
                    const isSelected = selectedChainId.split(',').map(s => s.trim()).includes(c.id);
                    
                    let activeStyles = '';
                    let inactiveStyles = 'bg-black/20 border-slate-800 text-slate-500 hover:border-slate-700';
                    let costBadge = null;

                    if (c.cost === 'testnet') {
                      activeStyles = 'bg-purple-600/10 border-purple-500 text-purple-450 shadow-[0_0_15px_rgba(168,85,247,0.15)]';
                      inactiveStyles = 'bg-black/20 border-purple-950/20 text-purple-500/70 hover:border-purple-800/40';
                      costBadge = (
                        <span className="text-[7px] font-black px-1.5 py-0.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded font-sans uppercase tracking-wider shrink-0">
                          Testnet
                        </span>
                      );
                    } else if (c.cost === 'cheap') {
                      activeStyles = 'bg-emerald-600/10 border-emerald-500 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)]';
                      costBadge = (
                        <span className="text-[7px] font-black px-1.5 py-0.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded font-sans uppercase tracking-wider shrink-0">
                          Centavos
                        </span>
                      );
                    } else if (c.cost === 'expensive') {
                      activeStyles = 'bg-red-600/10 border-red-500 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.15)]';
                      inactiveStyles = 'bg-black/20 border-red-950/30 text-slate-650 hover:border-red-900/40';
                      costBadge = (
                        <span className="text-[7px] font-black px-1.5 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded font-sans uppercase tracking-wider shrink-0">
                          Gas Alto
                        </span>
                      );
                    } else {
                      activeStyles = 'bg-cyan-600/10 border-cyan-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.1)]';
                      costBadge = (
                        <span className="text-[7px] font-black px-1.5 py-0.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded font-sans uppercase tracking-wider shrink-0">
                          Global
                        </span>
                      );
                    }

                    return (
                      <button 
                        key={c.id} 
                        onClick={() => handleChainToggle(c.id)} 
                        className={`px-4 py-2.5 rounded-xl border text-left flex justify-between items-center transition-all ${
                          isSelected ? activeStyles : inactiveStyles
                        }`}
                      >
                         <div className="flex flex-col gap-0.5 min-w-0 pr-2">
                            <span className="text-[10px] font-black uppercase italic truncate">{c.name}</span>
                            <span className="text-[8px] font-bold opacity-50 uppercase tracking-tighter truncate">{c.desc}</span>
                         </div>
                         {costBadge}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* WATCHLIST & TOKENS & SMART CONTRACT */}
              <div className="p-6 bg-slate-900/40 border border-slate-800 rounded-2xl space-y-6">
                <div>
                  <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest block mb-4">Watchlist de Strike</span>
                  <textarea 
                    value={targetTokens} 
                    onChange={(e) => setTargetTokens(e.target.value.toUpperCase())} 
                    placeholder="ETH, BTC, SOL, LINK..." 
                    className="w-full bg-black/60 border border-slate-800 rounded-xl p-4 text-xs font-mono text-amber-300 outline-none h-24 resize-none focus:border-amber-500/50 transition-all" 
                  />
                </div>
                
                <div className="pt-4 border-t border-slate-800/50">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Arbitrage Smart Contract</span>
                    <div className="flex p-1 bg-slate-950 border border-slate-800 rounded-xl shadow-inner">
                      <button 
                        onClick={() => setContractChoice('bot')} 
                        className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all duration-350 ${
                          contractChoice === 'bot' 
                            ? 'bg-blue-600 text-white shadow shadow-blue-500/20' 
                            : 'text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        🤖 Bot Contract
                      </button>
                      <button 
                        onClick={() => setContractChoice('personal')} 
                        className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all duration-350 ${
                          contractChoice === 'personal' 
                            ? 'bg-amber-600 text-white shadow shadow-amber-500/20' 
                            : 'text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        💼 Personal
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input 
                        type="text"
                        value={contractAddress}
                        onChange={(e) => {
                          if (contractChoice === 'personal') {
                            setContractAddress(e.target.value);
                          }
                        }}
                        disabled={contractChoice === 'bot'}
                        placeholder="0x..."
                        className={`w-full border rounded-xl p-4 text-[10px] font-mono outline-none transition-all ${
                          contractChoice === 'bot' 
                            ? 'bg-slate-900/40 border-slate-850 text-slate-500 cursor-not-allowed' 
                            : 'bg-black/60 border-slate-800 text-blue-300 focus:border-blue-500/50'
                        }`}
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2">
                        <svg className="w-4 h-4 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                      </div>
                    </div>
                    <button
                      onClick={handleDeployContract}
                      disabled={isDeploying || !wallet.isConnected}
                      className={`px-4 rounded-xl text-[10px] font-black uppercase transition-all duration-300 ${
                        isDeploying 
                          ? 'bg-blue-600/40 text-blue-300 border border-blue-800 cursor-not-allowed'
                          : wallet.isConnected
                            ? 'bg-blue-600 text-white hover:bg-blue-500 hover:shadow-lg hover:shadow-blue-500/20 border border-blue-500'
                            : 'bg-slate-800 text-slate-500 border border-slate-750 cursor-not-allowed'
                      }`}
                    >
                      {isDeploying ? 'Deploying...' : 'Deploy'}
                    </button>
                  </div>
                  <p className="text-[8px] text-slate-600 italic mt-2 font-bold uppercase">
                    {wallet.isConnected 
                      ? 'Dirección del contrato. O haz clic en Deploy para desplegar tu propio contrato en la red conectada.' 
                      : 'Conecta tu wallet para poder desplegar el contrato en un solo clic.'}
                  </p>
                </div>
              </div>

              {/* LIQUIDITY SOURCE */}
              <div className="p-6 bg-slate-900/40 border border-slate-800 rounded-2xl space-y-6">
                 <div>
                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest block mb-4">Liquidez (Flash Loans)</span>
                    <div className="space-y-2">
                      {FLASH_PROVIDERS.map(p => (
                        <button key={p.id} onClick={() => setFlashProviderId(p.id)} className={`w-full p-3 rounded-xl border text-left flex justify-between items-center transition-all ${flashProviderId === p.id ? 'bg-emerald-600/10 border-emerald-500 text-white' : 'bg-black/20 border-slate-800 text-slate-500 hover:border-slate-700'}`}>
                          <span className="text-[10px] font-black uppercase italic">{p.name}</span>
                          <span className="text-[8px] font-mono text-emerald-500/70">{p.desc}</span>
                        </button>
                      ))}
                    </div>
                 </div>
                 <div className="pt-4 border-t border-slate-800">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-3">Profit Minimo (PO %)</span>
                    <div className="flex items-center gap-4">
                      <input type="range" min="0.1" max="10" step="0.1" value={minPO} onChange={(e) => setMinPO(parseFloat(e.target.value))} className="flex-1 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500" />
                      <span className="text-sm font-black mono text-cyan-400">{minPO}%</span>
                    </div>
                 </div>
                 <div className="pt-4 border-t border-slate-800">
                     <span className="text-[10px] font-black text-cyan-400 uppercase tracking-widest block mb-3">Capital Simulado (USDC)</span>
                     <div className="relative">
                       <input 
                         type="number"
                         value={simBalance}
                         onChange={(e) => {
                           const val = parseFloat(e.target.value) || 0;
                           setSimBalance(val);
                         }}
                         className="w-full bg-black/60 border border-slate-800 rounded-xl p-3 text-xs font-mono text-cyan-300 outline-none focus:border-cyan-500/50 transition-all"
                       />
                     </div>
                     <p className="text-[8px] text-slate-600 italic mt-2 font-bold uppercase">Define el saldo virtual para pruebas del Paper Simulator.</p>
                   </div>
               </div>

              {/* GUIDES AND ADDRESSES SECTION */}
              <div className="lg:col-span-3 pt-8 border-t border-slate-800/80 space-y-6">
                 <div className="flex justify-between items-center">
                    <div>
                       <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest block">📚 Guía de Despliegue y Direcciones Oficiales</span>
                       <p className="text-[8px] text-slate-500 font-black uppercase tracking-wider mt-1">Cómo iniciar tu propio Smart Contract de Flash Loans</p>
                    </div>
                 </div>
                 
                 <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                    {/* STEP BY STEP */}
                    <div className="bg-black/40 p-6 rounded-2xl border border-slate-850 space-y-4">
                       <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block border-b border-slate-800 pb-2">📋 Paso a Paso para Desplegar el Contrato</span>
                       <ol className="space-y-3.5 text-[10px] leading-relaxed text-slate-450 list-decimal pl-4">
                          <li>
                             <strong className="text-white">Consigue el código:</strong> Abre el archivo local <span className="font-mono text-cyan-400">contracts/ArbiSyncExecutor.sol</span> en este proyecto y copia todo su contenido.
                          </li>
                          <li>
                             <strong className="text-white">Ve a Remix IDE:</strong> Entra en <a href="https://remix.ethereum.org" target="_blank" rel="noreferrer" className="text-blue-400 underline hover:text-blue-300">remix.ethereum.org</a> y crea un archivo llamado <span className="font-mono text-cyan-400">ArbiSyncExecutor.sol</span>. Pega el código allí.
                          </li>
                          <li>
                             <strong className="text-white">Compila:</strong> En la pestaña del compilador de Solidity (icono del engranaje), selecciona la versión <span className="font-mono text-cyan-400">0.8.20</span> (o superior) y haz clic en compile.
                          </li>
                          <li>
                             <strong className="text-white">Prepara la Red:</strong> Abre MetaMask, cámbiate a la red real donde vas a operar (ej: Arbitrum) y asegúrate de tener saldo para pagar el gas.
                          </li>
                          <li>
                             <strong className="text-white">Configura Environment:</strong> En la pestaña de despliegue, cambia el Environment a <strong className="text-white">Injected Provider - MetaMask</strong>.
                          </li>
                          <li>
                             <strong className="text-white">Despliega:</strong> En el constructor naranja de <span className="font-mono text-white">Deploy</span>, introduce la dirección del Vault de Balancer de tu red (ver tabla de la derecha) y presiona transaccionar para firmar en tu wallet.
                          </li>
                          <li>
                             <strong className="text-white">Sincroniza:</strong> Copia la dirección del contrato desplegado y pégala arriba en el campo <strong className="text-blue-400">Arbitrage Smart Contract</strong>.
                          </li>
                       </ol>
                    </div>

                    {/* OFFICIAL ADDRESSES */}
                    <div className="bg-black/40 p-6 rounded-2xl border border-slate-850 space-y-4">
                       <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block border-b border-slate-800 pb-2">🌐 Direcciones Oficiales de Flash Loan Vault (Balancer V2)</span>
                       <p className="text-[9px] text-slate-500 italic leading-snug">Balancer V2 utiliza la misma dirección Vault unificada en todas las redes EVM, lo que facilita el despliegue:</p>
                       <div className="overflow-x-auto">
                          <table className="w-full text-left text-[9px] text-slate-400">
                             <thead>
                                <tr className="border-b border-slate-800 text-slate-500 uppercase tracking-wider">
                                   <th className="py-2">Blockchain</th>
                                   <th className="py-2">Vault Address</th>
                                   <th className="py-2 text-right">Comisión</th>
                                </tr>
                             </thead>
                             <tbody className="divide-y divide-slate-850/40">
                                <tr>
                                   <td className="py-2.5 font-bold text-white">Arbitrum One</td>
                                   <td className="py-2.5 font-mono text-cyan-400">0xBA12222222228d8Ba445958a75a0704d566BF2C8</td>
                                   <td className="py-2.5 text-right text-emerald-400 font-bold">0.00%</td>
                                </tr>
                                <tr>
                                   <td className="py-2.5 font-bold text-white">Polygon (PoS)</td>
                                   <td className="py-2.5 font-mono text-cyan-400">0xBA12222222228d8Ba445958a75a0704d566BF2C8</td>
                                   <td className="py-2.5 text-right text-emerald-400 font-bold">0.00%</td>
                                </tr>
                                <tr>
                                   <td className="py-2.5 font-bold text-white">Optimism L2</td>
                                   <td className="py-2.5 font-mono text-cyan-400">0xBA12222222228d8Ba445958a75a0704d566BF2C8</td>
                                   <td className="py-2.5 text-right text-emerald-400 font-bold">0.00%</td>
                                </tr>
                                <tr>
                                   <td className="py-2.5 font-bold text-white">Base Network</td>
                                   <td className="py-2.5 font-mono text-cyan-400">0xBA12222222228d8Ba445958a75a0704d566BF2C8</td>
                                   <td className="py-2.5 text-right text-emerald-400 font-bold">0.00%</td>
                                </tr>
                                <tr>
                                   <td className="py-2.5 font-bold text-white">Ethereum Mainnet</td>
                                   <td className="py-2.5 font-mono text-cyan-400">0xBA12222222228d8Ba445958a75a0704d566BF2C8</td>
                                   <td className="py-2.5 text-right text-emerald-400 font-bold">0.00%</td>
                                </tr>
                             </tbody>
                          </table>
                       </div>
                       <div className="pt-2 border-t border-slate-800/30 flex items-center gap-1.5 text-[8px] text-amber-500 font-black uppercase">
                          <svg className="w-3.5 h-3.5 text-amber-500 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                          Nota: Asegúrate de desplegar en la red correcta antes de transferir gas.
                       </div>
                    </div>

                     {/* GAS & RECOMMENDED BALANCES */}
                     <div className="bg-black/40 p-6 rounded-2xl border border-slate-850 space-y-4 xl:col-span-2">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block border-b border-slate-800 pb-2">⛽ Directorio de Gas Nativo y Saldo Recomendado por Red</span>
                        <p className="text-[9px] text-slate-500 italic leading-snug">Cada red requiere su token nativo para el gas. A continuación se detalla qué token necesitas y el saldo mínimo recomendado en tu wallet para operar cómodamente:</p>
                        <div className="overflow-x-auto">
                           <table className="w-full text-left text-[9px] text-slate-400">
                              <thead>
                                 <tr className="border-b border-slate-800 text-slate-500 uppercase tracking-wider font-bold">
                                    <th className="py-2">Red Blockchain</th>
                                    <th className="py-2">Token de Gas</th>
                                    <th className="py-2">Comisión Promedio</th>
                                    <th className="py-2 text-right">Mínimo Recomendado</th>
                                 </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-850/40">
                                 <tr>
                                    <td className="py-2 font-bold text-white">Ethereum Mainnet</td>
                                    <td className="py-2 font-mono text-cyan-400">ETH</td>
                                    <td className="py-2 text-red-400 font-bold">$10.00 - $35.00</td>
                                    <td className="py-2 text-right text-red-400 font-bold">0.02 ETH (~$60.00)</td>
                                 </tr>
                                 <tr>
                                    <td className="py-2 font-bold text-white">Arbitrum One</td>
                                    <td className="py-2 font-mono text-cyan-400">ETH</td>
                                    <td className="py-2 text-emerald-400 font-bold">$0.02 - $0.15</td>
                                    <td className="py-2 text-right text-emerald-400 font-bold">0.001 ETH (~$3.00)</td>
                                 </tr>
                                 <tr>
                                    <td className="py-2 font-bold text-white">Base Network</td>
                                    <td className="py-2 font-mono text-cyan-400">ETH</td>
                                    <td className="py-2 text-emerald-400 font-bold">$0.01 - $0.05</td>
                                    <td className="py-2 text-right text-emerald-400 font-bold">0.001 ETH (~$3.00)</td>
                                 </tr>
                                 <tr>
                                    <td className="py-2 font-bold text-white">Optimism L2</td>
                                    <td className="py-2 font-mono text-cyan-400">ETH</td>
                                    <td className="py-2 text-emerald-400 font-bold">$0.02 - $0.10</td>
                                    <td className="py-2 text-right text-emerald-400 font-bold">0.001 ETH (~$3.00)</td>
                                 </tr>
                                 <tr>
                                    <td className="py-2 font-bold text-white">Polygon (PoS)</td>
                                    <td className="py-2 font-mono text-cyan-400">POL</td>
                                    <td className="py-2 text-emerald-400 font-bold">$0.01 - $0.05</td>
                                    <td className="py-2 text-right text-emerald-400 font-bold">5.0 POL (~$2.75)</td>
                                 </tr>
                                 <tr>
                                    <td className="py-2 font-bold text-white">BSC (BNB Chain)</td>
                                    <td className="py-2 font-mono text-cyan-400">BNB</td>
                                    <td className="py-2 text-emerald-400 font-bold">$0.03 - $0.15</td>
                                    <td className="py-2 text-right text-emerald-400 font-bold">0.01 BNB (~$6.00)</td>
                                 </tr>
                                 <tr>
                                    <td className="py-2 font-bold text-white">Avalanche C-Chain</td>
                                    <td className="py-2 font-mono text-cyan-400">AVAX</td>
                                    <td className="py-2 text-emerald-400 font-bold">$0.05 - $0.20</td>
                                    <td className="py-2 text-right text-emerald-400 font-bold">0.2 AVAX (~$5.00)</td>
                                 </tr>
                                 <tr>
                                    <td className="py-2 font-bold text-white">Sei Network</td>
                                    <td className="py-2 font-mono text-cyan-400">SEI</td>
                                    <td className="py-2 text-emerald-400 font-bold">$0.001 - $0.01</td>
                                    <td className="py-2 text-right text-emerald-400 font-bold">5.0 SEI (~$1.50)</td>
                                 </tr>
                                 <tr>
                                    <td className="py-2 font-bold text-white">Monad (Testnet)</td>
                                    <td className="py-2 font-mono text-cyan-400">MON</td>
                                    <td className="py-2 text-emerald-400 font-bold">Gratuito</td>
                                    <td className="py-2 text-right text-emerald-400 font-bold">1.0 MON (Gratis Faucet)</td>
                                 </tr>
                                 <tr>
                                    <td className="py-2 font-bold text-white">HyperEVM</td>
                                    <td className="py-2 font-mono text-cyan-400">HYPE</td>
                                    <td className="py-2 text-emerald-400 font-bold">$0.001 - $0.01</td>
                                    <td className="py-2 text-right text-emerald-400 font-bold">1.0 HYPE (~$2.00)</td>
                                 </tr>
                                 <tr>
                                    <td className="py-2 font-bold text-white">MegaETH L2</td>
                                    <td className="py-2 font-mono text-cyan-400">ETH</td>
                                    <td className="py-2 text-emerald-400 font-bold">$0.001 - $0.01</td>
                                    <td className="py-2 text-right text-emerald-400 font-bold">0.001 ETH (~$3.00)</td>
                                 </tr>
                                 <tr>
                                    <td className="py-2 font-bold text-white">Flare Mainnet</td>
                                    <td className="py-2 font-mono text-cyan-400">FLR</td>
                                    <td className="py-2 text-emerald-400 font-bold">$0.005 - $0.02</td>
                                    <td className="py-2 text-right text-emerald-400 font-bold">50.0 FLR (~$1.50)</td>
                                 </tr>
                              </tbody>
                           </table>
                        </div>
                     </div>
                 </div>
              </div>
            </div>
            
            <div className="p-8 bg-slate-900/60 flex justify-between items-center border-t border-slate-800">
               <button onClick={() => setSimBalance(25000)} className="text-[10px] font-black text-red-500 uppercase hover:underline tracking-widest italic">Reiniciar Capital Sim ($25,000.00)</button>
               <button onClick={() => setShowSettings(false)} className="px-10 py-3.5 bg-blue-600 text-white rounded-2xl text-xs font-black uppercase hover:bg-blue-500 shadow-xl shadow-blue-500/30 transition-all hover:-translate-y-0.5 active:translate-y-0">Sincronizar Cambios</button>
            </div>
          </div>
        </div>
      )}

      {/* DEDICATED FLASH LOAN DEPLOYMENT GUIDE MODAL */}
      {showGuideModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 animate-fade-in backdrop-blur-xl">
          <div className="absolute inset-0 bg-slate-950/90" onClick={() => setShowGuideModal(false)}></div>
          <div className="relative w-full max-w-4xl bg-[#0a0f1e] border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-8 border-b border-slate-800 flex justify-between items-center bg-slate-900/40">
              <div>
                <h2 className="text-2xl font-black italic text-white uppercase tracking-tighter flex items-center gap-3">
                  <svg className="w-7 h-7 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                  Guía de Despliegue de Flash Loans
                </h2>
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em]">Institutional Smart Contract Setup Guide</p>
              </div>
              <button onClick={() => setShowGuideModal(false)} className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 transition-all text-white">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-10 overflow-y-auto space-y-8 custom-scrollbar text-[11px] leading-relaxed text-slate-400">
              <div className="p-6 bg-blue-950/10 border border-blue-500/20 rounded-2xl">
                <h3 className="text-white font-black uppercase tracking-wider text-xs mb-2 flex items-center gap-2">
                  ℹ️ ¿Qué es el contrato ArbiSyncExecutor?
                </h3>
                <p>
                  Es tu agente inteligente en la blockchain. Permite solicitar un <strong>Flash Loan sin comisiones (0.00% fee)</strong> a Balancer V2, ejecutar los swaps de compra y venta de forma atómica (en la misma transacción) y verificar si la operación genera ganancias netas. Si no hay ganancia, la transacción se deshace (revert), protegiendo tu capital de pérdidas.
                </p>
              </div>

              {/* STEP BY STEP */}
              <div className="space-y-4">
                <h3 className="text-white font-black uppercase tracking-wider text-xs border-b border-slate-800 pb-2 flex items-center gap-2">
                  📋 Paso a Paso para Desplegar el Contrato
                </h3>
                <ol className="space-y-4 list-decimal pl-5">
                  <li>
                    <strong className="text-white">Copia el Código:</strong> Abre el archivo local <span className="font-mono text-cyan-400">contracts/ArbiSyncExecutor.sol</span> en este proyecto y copia todo su contenido.
                  </li>
                  <li>
                    <strong className="text-white">Abre Remix IDE:</strong> Entra en <a href="https://remix.ethereum.org" target="_blank" rel="noreferrer" className="text-blue-400 underline hover:text-blue-350">remix.ethereum.org</a> y crea un archivo llamado <span className="font-mono text-cyan-400">ArbiSyncExecutor.sol</span>. Pega el código allí.
                  </li>
                  <li>
                    <strong className="text-white">Compila el Contrato:</strong> Ve a la pestaña del compilador de Solidity (icono de engranaje), selecciona la versión <span className="font-mono text-cyan-400">0.8.20</span> (o superior) y haz clic en **Compile ArbiSyncExecutor.sol**.
                  </li>
                  <li>
                    <strong className="text-white">Prepara tu MetaMask:</strong> Asegúrate de tener activa la red en la que deseas desplegar (por ejemplo, <strong>Arbitrum Sepolia Testnet</strong>) y de tener saldo nativo para el gas (puedes conseguir ETH de pruebas gratis en grifos como <a href="https://faucet.quicknode.com" target="_blank" rel="noreferrer" className="text-blue-400 underline hover:text-blue-350">QuickNode Faucet</a> o <a href="https://www.alchemy.com/faucets" target="_blank" rel="noreferrer" className="text-blue-400 underline hover:text-blue-350">Alchemy Faucet</a>).
                  </li>
                  <li>
                    <strong className="text-white">Conecta el Entorno:</strong> En la pestaña de despliegue de Remix, cambia el **Environment** a **Injected Provider - MetaMask**.
                  </li>
                  <li>
                    <strong className="text-white">Despliega con la Dirección del Vault:</strong> En el campo al lado de **Deploy**, pega la dirección del Vault de Balancer V2 de tu red (ver tabla abajo) y presiona **Deploy**. Firma la transacción en MetaMask.
                  </li>
                  <li>
                    <strong className="text-white">Sincroniza en ArbiSync:</strong> Copia la dirección del contrato que acabas de desplegar y pégala en la Configuración de esta terminal, bajo el campo **Arbitrage Smart Contract**.
                  </li>
                </ol>
              </div>

              {/* OFFICIAL ADDRESSES */}
              <div className="space-y-4">
                <h3 className="text-white font-black uppercase tracking-wider text-xs border-b border-slate-800 pb-2">
                  🌐 Direcciones Oficiales del Vault (Balancer V2)
                </h3>
                <p className="text-[10px]">Balancer V2 utiliza el mismo contrato Vault unificado en todas las redes EVM, lo que facilita el despliegue:</p>
                <div className="bg-black/40 rounded-2xl border border-slate-800 overflow-hidden">
                  <table className="w-full text-left text-[10px]">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-500 uppercase tracking-wider bg-slate-900/30">
                        <th className="p-3">Red Blockchain / Testnet</th>
                        <th className="p-3">Dirección del Vault</th>
                        <th className="p-3 text-right">Comisión</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                      <tr>
                        <td className="p-3 font-bold text-white">Arbitrum One / Arbitrum Sepolia</td>
                        <td className="p-3 font-mono text-cyan-400">0xBA12222222228d8Ba445958a75a0704d566BF2C8</td>
                        <td className="p-3 text-right text-emerald-400 font-bold">0.00%</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-bold text-white">Base Network / Base Sepolia</td>
                        <td className="p-3 font-mono text-cyan-400">0xBA12222222228d8Ba445958a75a0704d566BF2C8</td>
                        <td className="p-3 text-right text-emerald-400 font-bold">0.00%</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-bold text-white">Polygon (PoS) / Amoy Testnet</td>
                        <td className="p-3 font-mono text-cyan-400">0xBA12222222228d8Ba445958a75a0704d566BF2C8</td>
                        <td className="p-3 text-right text-emerald-400 font-bold">0.00%</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-bold text-white">Ethereum Mainnet / Sepolia Testnet</td>
                        <td className="p-3 font-mono text-cyan-400">0xBA12222222228d8Ba445958a75a0704d566BF2C8</td>
                        <td className="p-3 text-right text-emerald-400 font-bold">0.00%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* FAUCETS GUIDE */}
              <div className="space-y-4 p-6 bg-purple-950/10 border border-purple-500/20 rounded-2xl">
                <h3 className="text-purple-400 font-black uppercase tracking-wider text-xs flex items-center gap-2">
                  🚰 Guía para Conseguir Fondos de Gas Gratuitos (Testnet ETH)
                </h3>
                <p className="text-[10px] text-slate-300">
                  Para poder desplegar tu contrato y firmar transacciones en la red de pruebas, necesitas saldo nativo (ETH de prueba) para pagar las tarifas de gas de la red. Reclama tokens gratis haciendo clic en los grifos oficiales a continuación:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                  <div className="bg-black/40 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
                    <div>
                      <span className="text-white block font-bold text-[9px] uppercase tracking-wider mb-1">Arbitrum Sepolia Faucet</span>
                      <p className="text-slate-500 text-[8px] mb-3 leading-snug">Grifo rápido para Arbitrum Sepolia. Requiere conectar wallet y un balance mínimo en Mainnet.</p>
                    </div>
                    <a href="https://faucet.quicknode.com/arbitrum/sepolia" target="_blank" rel="noreferrer" className="inline-block text-center py-2 bg-purple-600/20 hover:bg-purple-600 border border-purple-500/30 text-purple-300 hover:text-white rounded text-[8px] font-black uppercase tracking-widest transition-all">Reclamar Arbitrum ETH</a>
                  </div>
                  
                  <div className="bg-black/40 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
                    <div>
                      <span className="text-white block font-bold text-[9px] uppercase tracking-wider mb-1">Base Sepolia Faucet</span>
                      <p className="text-slate-500 text-[8px] mb-3 leading-snug">Grifo oficial de Coinbase para la testnet de Base Sepolia. Reclamos diarios rápidos.</p>
                    </div>
                    <a href="https://coinbase.com/faucets/base-ethereum-sepolia-faucet" target="_blank" rel="noreferrer" className="inline-block text-center py-2 bg-purple-600/20 hover:bg-purple-600 border border-purple-500/30 text-purple-300 hover:text-white rounded text-[8px] font-black uppercase tracking-widest transition-all">Reclamar Base ETH</a>
                  </div>

                  <div className="bg-black/40 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
                    <div>
                      <span className="text-white block font-bold text-[9px] uppercase tracking-wider mb-1">Ethereum Sepolia Faucet</span>
                      <p className="text-slate-500 text-[8px] mb-3 leading-snug">Grifo oficial de Alchemy para Ethereum Sepolia L1. Requiere login con cuenta gratuita.</p>
                    </div>
                    <a href="https://www.alchemy.com/faucets/ethereum-sepolia" target="_blank" rel="noreferrer" className="inline-block text-center py-2 bg-purple-600/20 hover:bg-purple-600 border border-purple-500/30 text-purple-300 hover:text-white rounded text-[8px] font-black uppercase tracking-widest transition-all">Reclamar Sepolia ETH</a>
                  </div>

                  <div className="bg-black/40 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
                    <div>
                      <span className="text-white block font-bold text-[9px] uppercase tracking-wider mb-1">Linea Sepolia Faucet</span>
                      <p className="text-slate-500 text-[8px] mb-3 leading-snug">Grifo oficial para Linea Sepolia Testnet de ConsenSys.</p>
                    </div>
                    <a href="https://www.alchemy.com/faucets/linea-sepolia" target="_blank" rel="noreferrer" className="inline-block text-center py-2 bg-purple-600/20 hover:bg-purple-600 border border-purple-500/30 text-purple-300 hover:text-white rounded text-[8px] font-black uppercase tracking-widest transition-all">Reclamar Linea ETH</a>
                  </div>

                  <div className="bg-black/40 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
                    <div>
                      <span className="text-white block font-bold text-[9px] uppercase tracking-wider mb-1">Monad Testnet Faucet</span>
                      <p className="text-slate-500 text-[8px] mb-3 leading-snug">Reclama fichas de gas nativas de Monad Testnet de forma directa.</p>
                    </div>
                    <a href="https://faucet.monad.xyz/" target="_blank" rel="noreferrer" className="inline-block text-center py-2 bg-purple-600/20 hover:bg-purple-600 border border-purple-500/30 text-purple-300 hover:text-white rounded text-[8px] font-black uppercase tracking-widest transition-all">Reclamar Monad MON</a>
                  </div>

                  <div className="bg-black/40 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
                    <div>
                      <span className="text-white block font-bold text-[9px] uppercase tracking-wider mb-1">Sepolia Proof-of-Work</span>
                      <p className="text-slate-500 text-[8px] mb-3 leading-snug">Minador web. Resuelve hashes en segundo plano para obtener ETH sin registrarse.</p>
                    </div>
                    <a href="https://sepolia-faucet.pk910.de" target="_blank" rel="noreferrer" className="inline-block text-center py-2 bg-purple-600/20 hover:bg-purple-600 border border-purple-500/30 text-purple-300 hover:text-white rounded text-[8px] font-black uppercase tracking-widest transition-all">Minar ETH de Prueba</a>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-8 bg-slate-900/60 flex justify-end border-t border-slate-800">
              <button onClick={() => setShowGuideModal(false)} className="px-10 py-3.5 bg-blue-650 text-white rounded-2xl text-xs font-black uppercase hover:bg-blue-500 shadow-xl shadow-blue-500/30 transition-all">Entendido</button>
            </div>
          </div>
        </div>
      )}

      {/* MEV SHIELD INFO MODAL */}
      {showMEVShieldInfo && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 animate-fade-in backdrop-blur-xl">
          <div className="absolute inset-0 bg-slate-950/90" onClick={() => setShowMEVShieldInfo(false)}></div>
          <div className="relative w-full max-w-2xl bg-[#0a0f1e] border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-8 border-b border-slate-800 flex justify-between items-center bg-slate-900/40">
              <div>
                <h2 className="text-2xl font-black italic text-cyan-400 uppercase tracking-tighter flex items-center gap-2">
                  ⚡ MEV Shield Activado
                </h2>
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em]">Anti-Frontrunning & HFT Protection</p>
              </div>
              <button onClick={() => setShowMEVShieldInfo(false)} className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 transition-all text-white">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-10 overflow-y-auto space-y-6 custom-scrollbar text-xs leading-relaxed">
              <div className="p-5 bg-cyan-950/10 border border-cyan-500/20 rounded-2xl">
                <p className="text-cyan-400 font-bold uppercase mb-2 text-[10px] tracking-wider">¿Qué es el MEV Shield?</p>
                <p className="text-slate-350">
                  Es un protocolo de enrutamiento privado que evita que tu transacción pase por la <strong>mempool pública</strong> (la sala de espera de la blockchain). Al ocultar la transacción de los bots de búsqueda de valor extraíble (MEV) y de las empresas de trading de alta frecuencia (HFT), se elimina el riesgo de que copien tu transacción o realicen un ataque sándwich contra ti.
                </p>
              </div>

              <div className="space-y-4">
                <span className="text-[10px] font-black text-white uppercase tracking-widest block border-b border-slate-800 pb-2">🛠️ Cómo configurarlo en tu Wallet (MetaMask)</span>
                
                <div className="space-y-3">
                  <div className="flex gap-4">
                    <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-white shrink-0">1</div>
                    <div>
                      <strong className="text-white block uppercase text-[9px] tracking-wide mb-0.5">Usa un RPC Privado</strong>
                      <p className="text-slate-400">
                        En MetaMask, ve a <strong>Ajustes &gt; Redes &gt; Agregar Red</strong> (o edita tu red actual de Ethereum Mainnet, BSC o Polygon) y cambia la URL del RPC por una segura.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-white shrink-0">2</div>
                    <div>
                      <strong className="text-white block uppercase text-[9px] tracking-wide mb-0.5">Direcciones de RPC recomendadas</strong>
                      <div className="mt-2 space-y-2">
                        <div className="bg-black/40 p-3 rounded-xl border border-slate-850 flex justify-between items-center font-mono text-[9px]">
                          <div>
                            <span className="text-slate-500 uppercase block font-sans text-[7px] font-black tracking-widest">Ethereum Mainnet (Flashbots)</span>
                            <span className="text-cyan-400">https://rpc.flashbots.net</span>
                          </div>
                          <button onClick={() => navigator.clipboard.writeText("https://rpc.flashbots.net")} className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 uppercase tracking-widest text-[8px] font-black transition-all">Copiar</button>
                        </div>

                        <div className="bg-black/40 p-3 rounded-xl border border-slate-850 flex justify-between items-center font-mono text-[9px]">
                          <div>
                            <span className="text-slate-500 uppercase block font-sans text-[7px] font-black tracking-widest">Multired EVM (MEV Blocker)</span>
                            <span className="text-cyan-400">https://mevblocker.org</span>
                          </div>
                          <a href="https://mevblocker.org" target="_blank" rel="noreferrer" className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 uppercase tracking-widest text-[8px] font-black transition-all">Visitar</a>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-white shrink-0">3</div>
                    <div>
                      <strong className="text-white block uppercase text-[9px] tracking-wide mb-0.5">Operar en L2s (Arbitrum/Base)</strong>
                      <p className="text-slate-400">
                        Si seleccionas oportunidades en <strong>Arbitrum One</strong> o <strong>Base</strong>, el secuenciador procesa en orden FIFO de forma predeterminada, por lo que ya estás protegido contra el front-running de mempool pública sin configuraciones adicionales.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-emerald-950/10 border border-emerald-500/20 rounded-2xl flex items-start gap-3">
                <svg className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                <div>
                  <strong className="text-emerald-400 block uppercase text-[9px] tracking-wide mb-0.5">Protección del Simulador Activa</strong>
                  <p className="text-slate-300 text-[10px]">
                    Al tener la prioridad [MEV Shield] seleccionada, el simulador de papel desactivará el factor de ataque estocástico de bots y HFT, permitiéndote ejecutar strikes simulados con un 100% de éxito en bloque sin riesgo de front-running.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="p-8 bg-slate-900/60 flex justify-end border-t border-slate-800">
              <button onClick={() => setShowMEVShieldInfo(false)} className="px-10 py-3.5 bg-blue-650 text-white rounded-2xl text-xs font-black uppercase hover:bg-blue-500 shadow-xl shadow-blue-500/30 transition-all">Entendido</button>
            </div>
          </div>
        </div>
      )}

      {/* INSTITUTIONAL HEADER */}
      <header className="px-10 py-8 flex flex-col xl:flex-row justify-between items-center border-b border-slate-900/50 bg-slate-950/40 backdrop-blur-2xl gap-6 sticky top-0 z-[60]">
        <div className="flex items-center gap-8">
          <div className="flex flex-col">
            <h1 className="text-4xl font-black italic tracking-tighter text-white leading-none">ARBISYNC <span className="text-[10px] not-italic font-black text-blue-500 bg-blue-500/10 px-3 py-1 rounded-lg border border-blue-500/20 tracking-[0.4em] ml-2 uppercase shadow-[0_0_15px_rgba(59,130,246,0.2)]">v9.0 ULTRALINK</span></h1>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-[8px] text-slate-600 font-black uppercase tracking-[0.5em] italic">Institutional Cross-Chain PO Radar</span>
              <div className="h-2 w-px bg-slate-800"></div>
              <span className="text-[8px] text-blue-500/70 font-black uppercase tracking-widest mono">
                Contract: {contractAddress ? `${contractAddress.slice(0, 10)}...` : 'Using Internal Proxy'}
              </span>
            </div>
          </div>
          <div className="h-10 w-[1px] bg-slate-800 hidden xl:block"></div>
          <div className="flex p-1.5 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-inner">
            <button onClick={() => setIsPaperTrading(false)} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all duration-500 ${!isPaperTrading ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20' : 'text-slate-500 hover:text-slate-300'}`}>Live Terminal</button>
            <button onClick={() => setIsPaperTrading(true)} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all duration-500 ${isPaperTrading ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/20' : 'text-slate-500 hover:text-slate-300'}`}>Paper Simulator</button>
          </div>
          <button 
            onClick={() => setIsAutopilot(prev => !prev)} 
            className={`px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase transition-all duration-500 border ${
              isAutopilot 
                ? 'bg-amber-600 border-amber-500 text-white shadow-lg shadow-amber-500/20 animate-pulse' 
                : 'bg-slate-900/80 border-slate-800 text-slate-500 hover:text-slate-300 hover:border-slate-700'
            }`}
          >
            🤖 Autopilot: {isAutopilot ? 'ON' : 'OFF'}
          </button>

          <div className="flex p-1.5 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-inner ml-2">
            <button 
              onClick={() => setUseFlashLoan(true)} 
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all duration-500 flex items-center gap-1.5 ${
                useFlashLoan 
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20' 
                  : 'text-slate-500 hover:text-slate-300'
              }`}
              title="Usa Flash Loans de Balancer/Uniswap (Sin capital propio)"
            >
              ⚡ Flash Loan
            </button>
            <button 
              onClick={() => setUseFlashLoan(false)} 
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all duration-500 flex items-center gap-1.5 ${
                !useFlashLoan 
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/20' 
                  : 'text-slate-500 hover:text-slate-300'
              }`}
              title="Usa Fondos Propios (Arbitraje Directo)"
            >
              💼 Own Funds
            </button>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden lg:flex px-6 py-3 bg-slate-900/40 border border-slate-800 rounded-2xl items-center gap-5 group hover:border-slate-600 transition-all">
             <div className="flex flex-col items-end">
               <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest italic">Global Nodes</span>
               <span className="text-xs font-black mono text-emerald-400 italic">{activeNodes.toLocaleString()}</span>
             </div>
             <div className="h-6 w-[1px] bg-slate-800"></div>
             <div className="flex flex-col items-end">
               <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest italic">Load Factor</span>
               <span className={`text-xs font-black mono italic ${networkLoad > 80 ? 'text-red-500' : 'text-cyan-400'}`}>{networkLoad.toFixed(1)}%</span>
             </div>
          </div>

          <button 
            onClick={() => setShowGuideModal(true)} 
            className="flex items-center gap-2 px-5 py-4 bg-blue-900/30 border border-blue-800 hover:border-blue-500 hover:text-white text-blue-400 rounded-2xl transition-all shadow-lg active:scale-90 font-black uppercase text-[9px] tracking-wider shrink-0"
            title="Guía de Despliegue de Smart Contract"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
            Guía Contract
          </button>

          <button onClick={() => setShowSettings(true)} className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl text-slate-400 hover:text-white hover:border-slate-500 transition-all shadow-lg active:scale-90">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
          </button>

          <button 
            onClick={() => {
              if (isRateLimited) {
                setIsRateLimited(false);
                setIsAutoScanning(true);
              } else {
                setIsAutoScanning(!isAutoScanning);
              }
            }} 
            className={`flex items-center gap-3 px-8 py-4 rounded-2xl border font-black uppercase text-[11px] italic transition-all active:scale-95 shadow-xl ${
              isRateLimited ? 'bg-red-600 border-red-500 text-white shadow-red-500/20' :
              isAutoScanning ? 'bg-emerald-600 border-emerald-500 text-white shadow-emerald-500/20' : 
              'bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-500 hover:text-slate-300'
            }`}
          >
             {isRateLimited ? <>
               <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
               Retry Radar
             </> : isAutoScanning ? <>
               <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357-2H15" /></svg>
               Scanning
             </> : <>
               <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /></svg>
               Launch Radar
             </>}
          </button>
        </div>
      </header>

      {/* OPERATIONAL INTERFACE */}
      <main className="p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-[1800px] mx-auto relative z-40">
        
        {/* RADAR COLUMN (IMBALANCES) */}
        <section className="lg:col-span-3 flex flex-col gap-6 max-h-[82vh]">
          <div className="flex justify-between items-center px-4">
            <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em] italic flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full ${isRateLimited ? 'bg-red-500' : 'bg-blue-500 animate-pulse'}`}></span>
              {isRateLimited ? 'Scanner Rate-Limited' : 'Imbalances Detectados'}
            </h2>
            <div className="flex items-center gap-2">
              <span className={`text-[9px] mono font-bold px-2 py-0.5 rounded border ${isRateLimited ? 'text-red-400 bg-red-500/10 border-red-500/20' : 'text-blue-400 bg-blue-500/10 border-blue-500/20'}`}>{countdown}s</span>
            </div>
          </div>

          {isRateLimited && (
            <div className="bg-red-950/20 border border-red-900/50 p-6 rounded-3xl animate-pulse">
               <span className="text-red-400 font-black uppercase text-[10px] block mb-2 tracking-widest">Quota Exceeded</span>
               <p className="text-[9px] text-red-500/80 font-bold uppercase leading-relaxed">Se ha alcanzado el límite de peticiones de la API de Gemini. El radar se ha pausado automáticamente.</p>
               <button onClick={() => { setIsRateLimited(false); setIsAutoScanning(true); }} className="mt-4 text-[9px] font-black text-white bg-red-600 px-4 py-2 rounded-xl uppercase hover:bg-red-500 transition-all">Reintentar Ahora</button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto pr-3 custom-scrollbar space-y-4">
            {opportunities.map((opp) => (
              <OpportunityCard key={opp.id} opp={opp} isSelected={selectedOpp?.id === opp.id} onSelect={handleSelectOpportunity} />
            ))}
            {opportunities.length === 0 && !isRateLimited && (
              <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-slate-900 rounded-[2.5rem] opacity-30 text-center p-10 bg-slate-900/10">
                <svg className="w-16 h-16 mb-6 text-slate-800" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth={1} /></svg>
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-700">Radar en espera...</p>
              </div>
            )}
          </div>
        </section>

        {/* EXECUTION & TELEMETRY */}
        <section className="lg:col-span-9 flex flex-col gap-8">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
            
            {/* IDENTITY & LOGS */}
            <div className="xl:col-span-4 flex flex-col gap-8">
              <WalletConnector onStateChange={setWallet} wallet={wallet} isSimulation={isPaperTrading} simBalance={simBalance} />
              
              {/* STRIKE PERFORMANCE STATISTICS */}
              <div className={`bg-slate-950/40 border rounded-[2rem] flex flex-col shadow-2xl relative overflow-hidden transition-all duration-500 hover:border-slate-800 ${
                isPaperTrading ? 'border-cyan-500/10' : 'border-emerald-500/10'
              }`}>
                {/* Background neon glow */}
                <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-[80px] opacity-10 pointer-events-none ${
                  isPaperTrading ? 'bg-cyan-500' : 'bg-emerald-500'
                }`}></div>

                {/* Clickable Header */}
                <div 
                  onClick={() => setShowStrikeStats(!showStrikeStats)}
                  className="px-6 py-4 flex justify-between items-center cursor-pointer hover:bg-slate-900/10 transition-all select-none"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">🎯</span>
                    <div>
                      <span className="text-[7px] font-black text-slate-500 uppercase block tracking-widest leading-none mb-1">Rendimiento</span>
                      <span className="text-[10px] font-black text-white uppercase italic tracking-wider">Métricas de Strike</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent collapse when resetting
                        if (isPaperTrading) {
                          setSimPrevBalance(25000);
                          setSimBalance(25000);
                          setSimStrikesSuccess(0);
                          setSimStrikesFailed(0);
                          setSimNetProfit(0);
                          setSimGasSpent(0);
                          addLog("METRICS: Estadísticas de Simulación reiniciadas.", "warning");
                        } else {
                          setLivePrevBalance(displayLiveBalance);
                          setLiveStrikesSuccess(0);
                          setLiveStrikesFailed(0);
                          setLiveNetProfit(0);
                          setLiveGasSpent(0);
                          addLog("METRICS: Estadísticas En Vivo reiniciadas.", "warning");
                        }
                      }}
                      className="text-[8px] font-black text-slate-600 hover:text-red-500 uppercase tracking-widest transition-all"
                    >
                      [Reset]
                    </button>
                    <span className="text-slate-500 font-mono text-[9px] font-black">
                      {showStrikeStats ? '▲ Contraer' : '▼ Expandir'}
                    </span>
                  </div>
                </div>

                {showStrikeStats && (
                  <div className="px-6 pb-6 border-t border-slate-900/80 pt-4 flex flex-col gap-4 bg-slate-950/20">
                    <div className="grid grid-cols-2 gap-4">
                      {/* Balance Anterior */}
                      <div className="bg-black/30 p-3.5 rounded-xl border border-slate-900 flex flex-col gap-0.5">
                        <span className="text-[7px] font-black text-slate-500 uppercase tracking-wider">
                          {contractAddress && contractAddress.startsWith('0x') && contractAddress.length === 42
                            ? 'Bal. Anterior Contrato'
                            : 'Bal. Anterior Wallet'
                          }
                        </span>
                        <span className="text-xs font-black mono text-slate-400 italic">
                          {isPaperTrading 
                            ? `$${simPrevBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
                            : `${parseFloat(livePrevBalance).toFixed(4)} ${NETWORK_NATIVE_TOKENS[wallet.chainId || '1'] || 'ETH'}`
                          }
                        </span>
                      </div>

                      {/* Balance Actual */}
                      <div className="bg-black/30 p-3.5 rounded-xl border border-slate-900 flex flex-col gap-0.5">
                        <span className="text-[7px] font-black text-slate-500 uppercase tracking-wider">
                          {contractAddress && contractAddress.startsWith('0x') && contractAddress.length === 42
                            ? 'Balance Contrato'
                            : 'Balance Wallet'
                          }
                        </span>
                        <span className={`text-xs font-black mono italic ${
                          isPaperTrading 
                            ? (simBalance >= simPrevBalance ? 'text-cyan-400' : 'text-red-400') 
                            : (parseFloat(displayLiveBalance) >= parseFloat(livePrevBalance) ? 'text-emerald-400' : 'text-red-400')
                        }`}>
                          {isPaperTrading 
                            ? `$${simBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
                            : `${parseFloat(displayLiveBalance).toFixed(4)} ${NETWORK_NATIVE_TOKENS[wallet.chainId || '1'] || 'ETH'}`
                          }
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      {/* Strikes Conseguidos */}
                      <div className="bg-black/30 p-3 rounded-xl border border-slate-900 flex flex-col items-center justify-center text-center">
                        <span className="text-[6px] font-black text-slate-500 uppercase tracking-wider block mb-1">Conseguidos</span>
                        <div className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          <span className="text-[12px] font-black mono text-emerald-400">
                            {isPaperTrading ? simStrikesSuccess : liveStrikesSuccess}
                          </span>
                        </div>
                      </div>

                      {/* Strikes Fallidos / Revertidos */}
                      <div className="bg-black/30 p-3 rounded-xl border border-slate-900 flex flex-col items-center justify-center text-center">
                        <span className="text-[6px] font-black text-slate-500 uppercase tracking-wider block mb-1">Fallidos/Rev</span>
                        <div className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                          <span className="text-[12px] font-black mono text-red-500">
                            {isPaperTrading ? simStrikesFailed : liveStrikesFailed}
                          </span>
                        </div>
                      </div>

                      {/* Win Rate */}
                      <div className="bg-black/30 p-3 rounded-xl border border-slate-900 flex flex-col items-center justify-center text-center">
                        <span className="text-[6px] font-black text-slate-500 uppercase tracking-wider block mb-1">Tasa Acierto</span>
                        <span className="text-[12px] font-black mono text-purple-400">
                          {(() => {
                            const success = isPaperTrading ? simStrikesSuccess : liveStrikesSuccess;
                            const failed = isPaperTrading ? simStrikesFailed : liveStrikesFailed;
                            const total = success + failed;
                            return total === 0 ? '0%' : `${Math.round((success / total) * 100)}%`;
                          })()}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 border-t border-slate-900/50 pt-3">
                      {/* Ganancia Acumulada */}
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[7px] font-black text-slate-500 uppercase tracking-wider">Ganancia Neta Total</span>
                        <span className={`text-[13px] font-black mono italic ${
                          (isPaperTrading ? simNetProfit : liveNetProfit) >= 0 
                            ? (isPaperTrading ? 'text-cyan-400' : 'text-emerald-400') 
                            : 'text-red-500'
                        }`}>
                          {(isPaperTrading ? simNetProfit : liveNetProfit) >= 0 ? '+' : ''}
                          ${(isPaperTrading ? simNetProfit : liveNetProfit).toFixed(2)}
                        </span>
                      </div>

                      {/* Gas Acumulado */}
                      <div className="flex flex-col gap-0.5 items-end text-right">
                        <span className="text-[7px] font-black text-slate-500 uppercase tracking-wider">Gas Total Consumido</span>
                        <span className="text-[13px] font-black mono text-amber-500 italic">
                          ${(isPaperTrading ? simGasSpent : liveGasSpent).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* HISTORIAL DE PROLIFICIDAD COLAPSIBLE */}
              <div className="bg-slate-950/40 border border-slate-900 rounded-[2rem] flex flex-col shadow-2xl relative overflow-hidden transition-all duration-500 hover:border-slate-800">
                <button 
                  onClick={() => setShowProlificity(!showProlificity)}
                  className="w-full px-6 py-4 flex justify-between items-center bg-slate-900/10 hover:bg-slate-900/30 transition-all text-[10px] font-black text-white uppercase italic tracking-wider rounded-[2rem]"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] bg-gradient-to-r from-cyan-400 to-violet-500 bg-clip-text text-transparent">📈</span>
                    <span>Historial de Prolificidad</span>
                  </div>
                  <span className="text-slate-500 font-mono text-[9px] font-black select-none">
                    {showProlificity ? '▲ Contraer' : '▼ Expandir'}
                  </span>
                </button>

                {showProlificity && (
                  <div className="p-6 border-t border-slate-900/80 flex flex-col gap-6 bg-slate-950/20">
                    
                    {/* RADAR DE FRECUENCIA DE ARBITRAJES (PROLIFICIDAD DE REDES) */}
                    <div className="flex flex-col gap-4 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-16 h-16 rounded-full blur-[50px] opacity-10 pointer-events-none bg-blue-500"></div>
                      <div className="flex justify-between items-center pb-2 border-b border-slate-900/80">
                        <div>
                          <span className="text-[7px] font-black text-slate-500 uppercase block tracking-widest">Frecuencia</span>
                          <span className="text-[10px] font-black text-white uppercase italic tracking-wider">Redes más Activas</span>
                        </div>
                        <button 
                          onClick={() => {
                            setNetworkOppCounts({});
                            addLog("METRICS: Contador de frecuencia de redes reiniciado.", "warning");
                          }}
                          className="text-[8px] font-black text-slate-600 hover:text-red-500 uppercase tracking-widest transition-all"
                        >
                          [Reset]
                        </button>
                      </div>

                      <div className="space-y-3.5 max-h-[160px] overflow-y-auto pr-1 custom-scrollbar">
                        {(() => {
                          const sortedChains = SUPPORTED_CHAINS
                            .filter(c => c.id !== 'all')
                            .map(c => ({
                              ...c,
                              count: (networkOppCounts[c.id] || 0) as number
                            }))
                            .sort((a, b) => b.count - a.count);
                          
                          const maxCount = Math.max(...sortedChains.map(c => c.count), 1);
                          const totalOppCount = sortedChains.reduce((sum, c) => sum + c.count, 0);

                          if (totalOppCount === 0) {
                            return (
                              <div className="text-center py-4 text-slate-700 italic text-[9px] uppercase tracking-wider">
                                Esperando datos...
                              </div>
                            );
                          }

                          return sortedChains.map(c => {
                            const percentage = (c.count / maxCount) * 100;
                            const isCheap = c.cost === 'cheap';
                            return (
                              <div key={c.id} className="flex flex-col gap-1 text-[9px]">
                                <div className="flex justify-between items-center font-bold">
                                  <div className="flex items-center gap-1.5">
                                    <span className={`w-1.5 h-1.5 rounded-full ${isCheap ? 'bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]' : 'bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.5)]'}`}></span>
                                    <span className="text-slate-300 uppercase tracking-wide">{c.name}</span>
                                  </div>
                                  <span className="mono text-slate-400 italic font-black">{c.count} Op.</span>
                                </div>
                                <div className="h-1.5 w-full bg-slate-900/60 border border-slate-900 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full transition-all duration-1000 ${
                                      isCheap 
                                        ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]' 
                                        : 'bg-gradient-to-r from-orange-500 to-red-500 shadow-[0_0_8px_rgba(239,68,68,0.3)]'
                                    }`} 
                                    style={{ width: `${percentage}%` }}
                                  ></div>
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>

                    {/* RADAR DE FRECUENCIA DE TOKENS (PROLIFICIDAD DE TOKENS) */}
                    <div className="flex flex-col gap-4 border-t border-slate-900/80 pt-6 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-16 h-16 rounded-full blur-[50px] opacity-10 pointer-events-none bg-cyan-500"></div>
                      <div className="flex justify-between items-center pb-2 border-b border-slate-900/80">
                        <div>
                          <span className="text-[7px] font-black text-slate-500 uppercase block tracking-widest">Actividad</span>
                          <span className="text-[10px] font-black text-white uppercase italic tracking-wider">Tokens más Activos</span>
                        </div>
                        <button 
                          onClick={() => {
                            setTokenOppCounts({});
                            addLog("METRICS: Contador de frecuencia de tokens reiniciado.", "warning");
                          }}
                          className="text-[8px] font-black text-slate-600 hover:text-red-500 uppercase tracking-widest transition-all"
                        >
                          [Reset]
                        </button>
                      </div>

                      <div className="space-y-3.5 max-h-[160px] overflow-y-auto pr-1 custom-scrollbar">
                        {(() => {
                          const sortedTokens = Object.entries(tokenOppCounts)
                            .map(([symbol, count]) => ({ symbol, count: count as number }))
                            .sort((a, b) => b.count - a.count)
                            .slice(0, 8); // top 8 tokens
                          
                          const maxCount = Math.max(...sortedTokens.map(t => t.count), 1);
                          const totalOppCount = sortedTokens.reduce((sum, t) => sum + t.count, 0);

                          if (totalOppCount === 0) {
                            return (
                              <div className="text-center py-4 text-slate-700 italic text-[9px] uppercase tracking-wider">
                                Esperando datos...
                              </div>
                            );
                          }

                          return sortedTokens.map(t => {
                            const percentage = (t.count / maxCount) * 100;
                            return (
                              <div key={t.symbol} className="flex flex-col gap-1 text-[9px]">
                                <div className="flex justify-between items-center font-bold">
                                  <div className="flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_5px_rgba(6,182,212,0.5)]"></span>
                                    <span className="text-slate-300 uppercase tracking-wide">{t.symbol}</span>
                                  </div>
                                  <span className="mono text-slate-400 italic font-black">{t.count} Op.</span>
                                </div>
                                <div className="h-1.5 w-full bg-slate-900/60 border border-slate-900 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full rounded-full transition-all duration-1000 bg-gradient-to-r from-cyan-500 to-blue-500 shadow-[0_0_8px_rgba(6,182,212,0.3)]"
                                    style={{ width: `${percentage}%` }}
                                  ></div>
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>

                    {/* RADAR DE FRECUENCIA DE EXCHANGES (PROLIFICIDAD DE EXCHANGES) */}
                    <div className="flex flex-col gap-4 border-t border-slate-900/80 pt-6 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-16 h-16 rounded-full blur-[50px] opacity-10 pointer-events-none bg-violet-500"></div>
                      <div className="flex justify-between items-center pb-2 border-b border-slate-900/80">
                        <div>
                          <span className="text-[7px] font-black text-slate-500 uppercase block tracking-widest">Rutas</span>
                          <span className="text-[10px] font-black text-white uppercase italic tracking-wider">DEXs más Usados</span>
                        </div>
                        <button 
                          onClick={() => {
                            setSwapOppCounts({});
                            addLog("METRICS: Contador de frecuencia de exchanges reiniciado.", "warning");
                          }}
                          className="text-[8px] font-black text-slate-600 hover:text-red-500 uppercase tracking-widest transition-all"
                        >
                          [Reset]
                        </button>
                      </div>

                      <div className="space-y-3.5 max-h-[160px] overflow-y-auto pr-1 custom-scrollbar">
                        {(() => {
                          const sortedSwaps = Object.entries(swapOppCounts)
                            .map(([name, count]) => ({ name, count: count as number }))
                            .sort((a, b) => b.count - a.count)
                            .slice(0, 8); // top 8 swaps
                          
                          const maxCount = Math.max(...sortedSwaps.map(s => s.count), 1);
                          const totalOppCount = sortedSwaps.reduce((sum, s) => sum + s.count, 0);

                          if (totalOppCount === 0) {
                            return (
                              <div className="text-center py-4 text-slate-700 italic text-[9px] uppercase tracking-wider">
                                Esperando datos...
                              </div>
                            );
                          }

                          return sortedSwaps.map(s => {
                            const percentage = (s.count / maxCount) * 100;
                            return (
                              <div key={s.name} className="flex flex-col gap-1 text-[9px]">
                                <div className="flex justify-between items-center font-bold">
                                  <div className="flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-violet-500 shadow-[0_0_5px_rgba(139,92,246,0.5)]"></span>
                                    <span className="text-slate-300 uppercase tracking-wide">{s.name}</span>
                                  </div>
                                  <span className="mono text-slate-400 italic font-black">{s.count} Swaps</span>
                                </div>
                                <div className="h-1.5 w-full bg-slate-900/60 border border-slate-900 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full rounded-full transition-all duration-1000 bg-gradient-to-r from-violet-500 to-fuchsia-500 shadow-[0_0_8px_rgba(139,92,246,0.3)]"
                                    style={{ width: `${percentage}%` }}
                                  ></div>
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>

                  </div>
                )}
              </div>

              <div 
                onClick={() => setShowTelemetryModal(true)}
                className="flex-1 bg-slate-950/60 border border-slate-900 rounded-[2.5rem] flex flex-col overflow-hidden shadow-2xl min-h-[350px] cursor-pointer hover:border-blue-500/30 hover:shadow-[0_0_30px_rgba(59,130,246,0.05)] transition-all duration-300 group"
                title="Haga clic para ampliar la telemetría"
              >
                 <div className="bg-slate-900/50 px-8 py-5 border-b border-slate-900/80 flex justify-between items-center">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] italic group-hover:text-blue-400 transition-colors flex items-center gap-1.5">
                      📟 Telemetría de Strike <span className="text-[8px] text-slate-650 font-bold tracking-normal normal-case group-hover:text-blue-500/70 transition-colors">(Clic para ampliar)</span>
                    </span>
                    <div className="flex gap-1.5">
                       <span className="w-1.5 h-1.5 rounded-full bg-slate-800"></span>
                       <span className="w-1.5 h-1.5 rounded-full bg-slate-800"></span>
                       <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_5px_rgba(59,130,246,0.5)] group-hover:animate-ping"></span>
                    </div>
                 </div>
                 <div className="flex-1 p-8 font-mono text-[11px] space-y-3.5 overflow-y-auto custom-scrollbar bg-[radial-gradient(circle_at_top_right,rgba(15,23,42,1),transparent)]">
                    {[...logs].reverse().slice(0, 30).map(log => (
                      <div key={log.id} className="flex gap-4 animate-fade-in group">
                        <span className="text-slate-800 font-bold tracking-tighter shrink-0">[{log.timestamp}]</span>
                        <span className={`leading-relaxed ${log.type === 'success' ? 'text-emerald-500' : log.type === 'error' ? 'text-red-500' : log.type === 'sim' ? 'text-cyan-400' : log.type === 'warning' ? 'text-amber-500' : 'text-blue-500'}`}>
                          {log.message}
                        </span>
                      </div>
                    ))}
                    {logs.length === 0 && <div className="text-slate-800 italic uppercase text-[10px] tracking-[0.5em] text-center pt-20">No logs generated</div>}
                 </div>
              </div>
            </div>

            {/* MAIN STRIKE CONSOLE */}
            <div className={`xl:col-span-8 border rounded-[3rem] p-10 flex flex-col transition-all duration-1000 relative overflow-hidden backdrop-blur-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] min-h-[600px] ${
              isPaperTrading ? 'border-cyan-500/20 bg-cyan-950/5' : 'border-emerald-500/20 bg-emerald-950/5'
            }`}>
              {/* Execution Overlay */}
              {executing && (
                <div className="absolute inset-0 bg-slate-950/98 z-[60] flex flex-col items-center justify-center p-12 text-center backdrop-blur-md">
                   <div className="w-20 h-20 relative mb-10">
                      <div className="absolute inset-0 border-8 border-slate-900 rounded-full"></div>
                      <div className="absolute inset-0 border-8 border-t-blue-500 animate-spin rounded-full"></div>
                   </div>
                   <h4 className="text-4xl font-black text-white italic uppercase mb-4 tracking-tighter">Inyectando Strike</h4>
                   <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.5em] max-w-sm leading-loose">Calculando entropía atómica y sincronizando bloques en {selectedOpp?.chain}...</p>
                </div>
              )}

              {selectedOpp ? (
                <div className="flex flex-col h-full">
                  <div className="flex justify-between items-start mb-12 pb-8 border-b border-slate-800/50">
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                         <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.4em] italic">Objetivo Localizado</span>
                         <div className="h-px w-20 bg-blue-500/20"></div>
                      </div>
                      <h3 className="text-6xl font-black text-white italic tracking-tighter leading-none">{selectedOpp.symbol}</h3>
                      <div className="flex gap-4 items-center">
                        <span className="text-[10px] font-black bg-white/5 text-slate-300 px-3 py-1.5 rounded-xl border border-white/5 uppercase tracking-widest italic">{selectedOpp.chain} Network</span>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                           <span className="text-blue-400">{selectedOpp.buyDex}</span>
                           <svg className="w-3 h-3 text-slate-700" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                           <span className="text-emerald-400">{selectedOpp.sellDex}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="block text-[11px] font-black text-slate-500 uppercase italic mb-2 tracking-[0.2em]">PO Bruto Detectado</span>
                      <span className={`text-6xl font-black mono italic tracking-tighter ${isPaperTrading ? 'text-cyan-400' : 'text-emerald-400'}`}>
                        {selectedOpp.imbalancePercentage.toFixed(2)}%
                      </span>
                    </div>
                  </div>

                  {/* SEGMENTED BUTTON SELECTOR (Custom Terminal vs 🛡️ Safeguard Preset) */}
                  <div className="mb-8 p-1.5 bg-black/40 border border-slate-800 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3 pl-3">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">Consola de Control</span>
                      <div className="h-4 w-[1px] bg-slate-800 hidden sm:block"></div>
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                        {strikePreset === 'safeguard' && '🛡️ SAFEGUARD ACTIVE: Balancer V2 (0% Fee) • MEV Shield • 0.20% Slippage • Atomic Lock'}
                        {strikePreset === 'custom' && '⚡ CUSTOM MODE: Control total sobre volumen, flash provider y deslizamiento'}
                        {strikePreset === 'adaptive' && '🌐 ADAPTIVE ACTIVE: Límite de gas adaptativo (800k) para bypass de simulación en testnets'}
                      </span>
                    </div>
                    <div className="flex p-0.5 bg-black/60 rounded-xl border border-slate-850 shadow-inner shrink-0 w-full sm:w-auto gap-0.5">
                      <button 
                        onClick={() => {
                          setStrikePreset('custom');
                          addLog("TERMINAL: Cambiado a Modo Custom. Todos los parámetros desbloqueados.", "info");
                        }} 
                        className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all duration-300 ${
                          strikePreset === 'custom' 
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                            : 'text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        Custom Terminal
                      </button>
                      <button 
                        onClick={() => {
                          setStrikePreset('safeguard');
                          addLog("TERMINAL: Cambiado a Safeguard Preset. Parámetros de protección máxima activos.", "success");
                        }} 
                        className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-1.5 ${
                          strikePreset === 'safeguard' 
                            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20' 
                            : 'text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        🛡️ Safeguard Preset
                      </button>
                      <button 
                        onClick={() => {
                          setStrikePreset('adaptive');
                          addLog("TERMINAL: Cambiado a Adaptive Testnet Preset. Límite de gas optimizado para saldos bajos de pruebas.", "success");
                        }} 
                        className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-1.5 ${
                          strikePreset === 'adaptive' 
                            ? 'bg-purple-650 text-white shadow-lg shadow-purple-500/20' 
                            : 'text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        🌐 Adaptive Testnet
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-10 flex-1">
                    <div className="space-y-8">
                       <div className="space-y-3">
                          <div className="flex justify-between items-end px-2">
                             <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest italic flex items-center gap-1.5">
                                Volumen de Strike (USD)
                                {strikePreset === 'safeguard' && (
                                  <span className="text-[8px] font-black px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full flex items-center gap-1 uppercase tracking-wider">
                                     <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
                                     SAFEGUARD OPTIMIZED
                                  </span>
                                )}
                             </label>
                             <div className="flex gap-3 items-center">
                                 {strikePreset !== 'safeguard' && (
                                   <>
                                     <button 
                                        onClick={optimizeVolumeTo100} 
                                        className="text-[9px] font-black text-cyan-400 hover:text-cyan-300 uppercase tracking-widest italic hover:underline focus:outline-none"
                                        title="Ajustar capital mínimo para obtener aproximadamente $100 USD de ganancia neta"
                                     >
                                        [⚡ Objetivo $100]
                                     </button>
                                     <button 
                                        onClick={optimizeVolumeToMax} 
                                        className="text-[9px] font-black text-amber-400 hover:text-amber-300 uppercase tracking-widest italic hover:underline focus:outline-none"
                                        title="Maximizar ganancia neta sabiendo la liquidez del pool y el impacto de precio (límite seguro del 15% de la pool)"
                                     >
                                        [🔥 Max Beneficio]
                                     </button>
                                   </>
                                 )}
                                 <span className="text-[10px] font-black text-blue-400 mono">Max Liq: {selectedOpp.liquidity}</span>
                              </div>
                          </div>
                          <div className="relative group">
                             <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none text-slate-600 font-black text-2xl italic">$</div>
                             <input 
                                type="number" 
                                value={tradeAmountUSD} 
                                onChange={(e) => setTradeAmountUSD(e.target.value)} 
                                disabled={strikePreset === 'safeguard'}
                                className={`w-full border-2 rounded-[2rem] pl-12 pr-8 py-8 mono text-5xl italic outline-none transition-all tracking-tighter shadow-inner ${
                                  strikePreset === 'safeguard'
                                    ? 'bg-emerald-950/10 border-emerald-500/30 text-emerald-400 cursor-not-allowed opacity-90'
                                    : 'bg-black/40 border-slate-800 text-white focus:border-blue-500/50 group-hover:border-slate-700'
                                }`} 
                             />
                             {strikePreset === 'safeguard' && (
                               <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full text-[9px] font-black text-emerald-400 uppercase italic tracking-wider">
                                 <svg className="w-3 h-3 text-emerald-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
                                 Locked (Optimal)
                               </div>
                             )}
                          </div>
                          <div className="grid grid-cols-3 gap-4">
                           <div className={`p-5 rounded-2xl border transition-all ${
                             strikePreset === 'safeguard' 
                               ? 'bg-emerald-950/10 border-emerald-500/20 opacity-95 text-emerald-400' 
                               : 'bg-slate-900/30 border-slate-800'
                           }`}>
                              <span className="block text-[9px] font-black text-slate-600 uppercase mb-2 tracking-widest flex items-center gap-1">
                                Flash Source
                                {strikePreset === 'safeguard' && (
                                  <svg className="w-2.5 h-2.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
                                )}
                              </span>
                              <span className={`text-[11px] font-black uppercase italic tracking-tighter ${strikePreset === 'safeguard' ? 'text-emerald-400' : 'text-emerald-400'}`}>
                                {strikePreset === 'safeguard' ? 'Balancer V2' : (flashProviderId === 'auto' ? `Auto: ${calc.resolvedProviderId.replace('_', ' ').toUpperCase()}` : flashProviderId.replace('_', ' ').toUpperCase())}
                              </span>
                           </div>
                           <div className={`p-5 rounded-2xl border transition-all ${
                             strikePreset === 'safeguard' 
                               ? 'bg-emerald-950/10 border-emerald-500/20 opacity-95' 
                               : 'bg-slate-900/30 border-slate-800'
                           }`}>
                              <span className="block text-[9px] font-black text-slate-600 uppercase mb-2 tracking-widest flex items-center gap-1">
                                Slippage Limit
                                {strikePreset === 'safeguard' && (
                                  <svg className="w-2.5 h-2.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
                                )}
                              </span>
                              {strikePreset === 'safeguard' ? (
                                <span className="text-[11px] font-black text-emerald-400 uppercase italic tracking-tighter">
                                   0.20%
                                </span>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <input 
                                    type="number" 
                                    step="0.05" 
                                    min="0.05" 
                                    max="5.0"
                                    value={slippage} 
                                    onChange={(e) => setSlippage(parseFloat(e.target.value) || 0.5)}
                                    className="w-16 bg-black/40 border border-slate-800 rounded px-2 py-0.5 text-xs text-purple-400 font-bold"
                                  />
                                  <span className="text-[10px] text-purple-400/70 font-bold uppercase italic">Protocol</span>
                                </div>
                              )}
                           </div>
                           <div className={`p-5 rounded-2xl border transition-all ${
                             strikePreset === 'safeguard' 
                               ? 'bg-emerald-950/10 border-emerald-500/20 opacity-95 text-emerald-400' 
                               : 'bg-slate-900/30 border-slate-800'
                           }`}>
                              <span className="block text-[9px] font-black text-slate-600 uppercase mb-2 tracking-widest">Riesgo MEV</span>
                              <span className={`text-[11px] font-black uppercase italic tracking-tighter ${
                                 strikePreset === 'safeguard' ? 'text-emerald-500' :
                                 calc.mevRisk === 'Crítico' ? 'text-red-500 animate-pulse' :
                                 calc.mevRisk === 'Medio' ? 'text-amber-500' : 'text-emerald-500'
                              }`}>
                                 {strikePreset === 'safeguard' ? 'Bajo (Shielded)' : calc.mevRisk}
                              </span>
                           </div>
                        </div>

                        <div className={`p-5 rounded-2xl border transition-all space-y-3 ${
                          strikePreset === 'safeguard' 
                            ? 'bg-emerald-950/10 border-emerald-500/20 opacity-95' 
                            : 'bg-slate-900/30 border-slate-800'
                        }`}>
                           <div className="flex justify-between items-center">
                             <span className="block text-[9px] font-black text-slate-600 uppercase tracking-widest">Prioridad de Gas & MEV Shield</span>
                             {strikePreset === 'safeguard' && (
                               <span className="text-[8px] font-black px-2 py-0.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 rounded-full flex items-center gap-1 uppercase tracking-wider">
                                 <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
                                 MEV Shield Locked
                               </span>
                             )}
                           </div>
                           <div className="grid grid-cols-3 gap-2">
                              <button 
                                 onClick={() => setGasPriority('standard')}
                                 disabled={strikePreset === 'safeguard'}
                                 className={`py-2 rounded-xl text-[9px] font-black uppercase italic transition-all border ${
                                   strikePreset === 'safeguard'
                                     ? 'bg-black/10 border-slate-950/20 text-slate-700 cursor-not-allowed'
                                     : gasPriority === 'standard' 
                                       ? 'bg-slate-800 border-slate-600 text-white shadow' 
                                       : 'bg-black/20 border-slate-900 text-slate-500 hover:border-slate-800'
                                 }`}
                              >
                                 Standard (1x)
                              </button>
                              <button 
                                 onClick={() => setGasPriority('fast')}
                                 disabled={strikePreset === 'safeguard'}
                                 className={`py-2 rounded-xl text-[9px] font-black uppercase italic transition-all border ${
                                   strikePreset === 'safeguard'
                                     ? 'bg-black/10 border-slate-950/20 text-slate-700 cursor-not-allowed'
                                     : gasPriority === 'fast' 
                                       ? 'bg-amber-600/10 border-amber-500 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.1)]' 
                                       : 'bg-black/20 border-slate-900 text-slate-500 hover:border-slate-800'
                                 }`}
                              >
                                 Fast (1.5x)
                              </button>
                              <button 
                                 onClick={() => {
                                   setGasPriority('mev_shield');
                                   setShowMEVShieldInfo(true);
                                 }}
                                 disabled={strikePreset === 'safeguard'}
                                 className={`py-2 rounded-xl text-[9px] font-black uppercase italic transition-all border ${
                                    strikePreset === 'safeguard'
                                       ? 'bg-emerald-600/10 border-emerald-500 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.15)] animate-pulse-subtle' 
                                       : gasPriority === 'mev_shield' 
                                         ? 'bg-cyan-600/10 border-cyan-500 text-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.15)] animate-pulse' 
                                         : 'bg-black/20 border-slate-900 text-slate-500 hover:border-slate-800'
                                 }`}
                                 title="Envía transacciones mediante RPC privados para ocultarla del mempool público (0% front-running)"
                              >
                                 ⚡ MEV Shield
                              </button>
                           </div>
                        </div>

                        <div className={`p-5 rounded-2xl border transition-all flex justify-between items-center ${
                          strikePreset === 'safeguard' 
                            ? 'bg-emerald-950/10 border-emerald-500/20 opacity-95' 
                            : 'bg-slate-900/30 border-slate-800'
                        }`}>
                           <div className="flex flex-col gap-0.5">
                             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                               Simulación Atómica
                               {strikePreset === 'safeguard' && (
                                 <svg className="w-2.5 h-2.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
                               )}
                             </span>
                             <span className="text-[8px] text-slate-600 font-bold uppercase">Abortar si los costes superan el spread</span>
                           </div>
                           {strikePreset === 'safeguard' ? (
                             <span className="text-[8px] font-black px-2 py-0.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 rounded-full uppercase tracking-wider flex items-center gap-1">
                               <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                               All or Nothing
                             </span>
                           ) : (
                             <label className="relative inline-flex items-center cursor-pointer">
                               <input 
                                 type="checkbox" 
                                 checked={isAllOrNothing} 
                                 onChange={(e) => setIsAllOrNothing(e.target.checked)}
                                 className="sr-only peer" 
                               />
                               <div className="w-9 h-5 bg-slate-850 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-500 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600 peer-checked:after:bg-white"></div>
                             </label>
                           )}
                        </div>
                       </div>
                    </div>

                    <div className="flex flex-col gap-6">
                       <div className="bg-black/60 p-10 rounded-[2.5rem] border border-white/5 space-y-6 shadow-2xl relative overflow-hidden group">
                          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                          
                          <div className="flex justify-between items-center text-[11px] font-black uppercase tracking-widest relative z-10">
                             <span className="text-slate-500 italic">Net Profit Est.</span>
                             <span className="text-white mono text-xl">+${calc.gross.toFixed(2)}</span>
                          </div>
                          
                          <div className="space-y-4 relative z-10">
                            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                               <span className="text-slate-600">Gas Cost ({calc.gasUnits.toLocaleString()} units @ {calc.gasPriceGwei.toFixed(1)} Gwei)</span>
                               {calc.gas === 0 ? (
                                 <span className="text-emerald-400 font-bold mono">Sin Tarifa</span>
                               ) : (
                                 <span className="text-red-500/60 mono">-${calc.gas.toFixed(2)}</span>
                               )}
                            </div>
                            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                               <span className="text-slate-600">Flash Loan Fee ({FLASH_PROVIDERS.find(p => p.id === calc.resolvedProviderId)?.name.split(' ')[0]})</span>
                               <span className="text-red-500/60 mono">-${calc.flashFee.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                               <span className="text-slate-600">DEX Swap Fees (Buy + Sell)</span>
                               <span className="text-red-500/60 mono">-${calc.swapFees.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                               <span className="text-slate-600">Price Impact ({calc.priceImpactPercentage.toFixed(3)}%)</span>
                               <span className="text-red-500/60 mono">-${calc.priceImpactUSD.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                               <span className="text-slate-600">Slippage Tolerance ({(strikePreset === 'safeguard' ? 0.20 : slippage)}%)</span>
                               <span className="text-red-500/60 mono">-${calc.slippageUSD.toFixed(2)}</span>
                            </div>
                          </div>

                          <div className="h-px bg-slate-800 w-full relative z-10"></div>
                          
                          <div className="space-y-2 relative z-10">
                             <div className="flex justify-between items-end">
                                <span className="text-xs font-black uppercase text-slate-400 italic tracking-[0.3em]">Profit Neto (PO Final)</span>
                                <span className={`text-[10px] font-black mono ${calc.poActual > 0 ? 'text-emerald-500' : 'text-red-500'}`}>{calc.poActual.toFixed(3)}%</span>
                             </div>
                             <div className={`text-6xl font-black mono italic tracking-tighter ${calc.isProfitable ? (isPaperTrading ? 'text-cyan-400' : 'text-emerald-400') : 'text-red-800'}`}>
                                ${calc.net.toFixed(2)}
                             </div>
                          </div>
                       </div>
                    </div>
                  </div>

                  {!isPaperTrading && !wallet.isConnected ? (
                    <button 
                      onClick={connectMetaMask}
                      className="mt-10 w-full py-8 rounded-[2rem] font-black text-3xl uppercase italic transition-all relative overflow-hidden group tracking-tighter active:scale-95 bg-white text-black shadow-[0_20px_40px_rgba(255,255,255,0.15)] hover:bg-slate-200"
                    >
                      <div className="absolute inset-0 bg-white/30 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-[1500ms] skew-x-[-30deg]"></div>
                      <span className="relative z-10 flex items-center justify-center gap-4">
                         🔌 Conectar MetaMask
                      </span>
                    </button>
                  ) : !isPaperTrading && wallet.chainId !== getChainIdByName(selectedOpp.chain) ? (
                    <button 
                      onClick={() => switchNetwork(getChainIdByName(selectedOpp.chain))}
                      className="mt-10 w-full py-8 rounded-[2rem] font-black text-xl uppercase italic transition-all relative overflow-hidden group tracking-tighter active:scale-95 bg-amber-500 text-black shadow-[0_20px_40px_rgba(245,158,11,0.25)] hover:bg-amber-400"
                    >
                      <div className="absolute inset-0 bg-white/30 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-[1500ms] skew-x-[-30deg]"></div>
                      <span className="relative z-10 flex items-center justify-center gap-2">
                         🔄 Cambiar Red a {NETWORKS[getChainIdByName(selectedOpp.chain)]?.name || selectedOpp.chain}
                      </span>
                    </button>
                  ) : (
                    <button 
                      onClick={executeStrike}
                      disabled={executing}
                      className={`mt-10 w-full py-8 rounded-[2rem] font-black text-3xl uppercase italic transition-all relative overflow-hidden group tracking-tighter active:scale-95 ${
                        executing ? 'bg-slate-900 text-slate-700 cursor-not-allowed border border-slate-800 grayscale' : 
                        isPaperTrading ? 'bg-cyan-500 text-black shadow-[0_20px_40px_rgba(6,182,212,0.25)] hover:bg-cyan-400' : 
                        'bg-emerald-500 text-black shadow-[0_20px_40px_rgba(16,185,129,0.25)] hover:bg-emerald-400'
                      }`}
                    >
                      <div className="absolute inset-0 bg-white/30 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-[1500ms] skew-x-[-30deg]"></div>
                      <span className="relative z-10 flex items-center justify-center gap-4">
                         {isPaperTrading ? 'Launch Sim Strike' : 'Execute Live Strike'}
                         <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                      </span>
                    </button>
                  )}
                  <div className="mt-4 text-center">
                    <p className="text-[9px] text-slate-600 font-black uppercase tracking-[0.5em] italic">
                      {strikePreset === 'safeguard' || strikePreset === 'adaptive' || isAllOrNothing
                        ? '🛡️ Seguridad Atómica Activa: Reversión automática en PO < 0.00%'
                        : '⚠️ Advertencia: Simulación Atómica Desactivada. Swaps se ejecutarán incluso a pérdida.'
                      }
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-900 italic p-20 text-center">
                  <div className="relative mb-12">
                     <div className="absolute inset-0 bg-blue-500/5 blur-[100px] rounded-full"></div>
                     <svg className="w-32 h-32 relative z-10 text-slate-800 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" strokeWidth={0.5} /></svg>
                  </div>
                  <p className="mono text-sm uppercase tracking-[1em] text-slate-800 font-black">Awaiting Inbound Data</p>
                  <p className="text-[10px] mt-6 text-slate-700 font-black uppercase tracking-[0.3em] italic">Active Radar Scans for Cross-Blockchain PO</p>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="p-10 border-t border-slate-900/40 flex flex-col md:flex-row justify-between items-center text-[10px] font-black uppercase text-slate-700 tracking-[0.4em] bg-black/40 gap-6 mt-10">
         <div className="flex gap-12">
            <span className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> System Health: Stable</span>
            <span className="hidden md:block">Latency: 14ms (L2 Hub)</span>
            <span className="hidden md:block">Engine: Gemini-3 Pro Hybrid</span>
         </div>
         <div className="flex items-center gap-3 italic text-slate-800">
            <span>Blockchain Atomic Pulse Active</span>
            <div className="w-20 h-1 bg-slate-900 rounded-full overflow-hidden">
               <div className="h-full bg-blue-500/50 animate-[progress_3s_infinite] w-1/3"></div>
            </div>
         </div>
         <div className="text-slate-600">© 2025 ArbiSync Institutional Systems</div>
      </footer>

      {strikeResult && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 backdrop-blur-xl animate-fade-in">
          <div className="absolute inset-0 bg-[#020617]/90" onClick={() => setStrikeResult(null)}></div>
          <div className="relative w-full max-w-2xl bg-gradient-to-b from-[#0a122c] to-[#040817] border-2 border-white/10 rounded-[2.5rem] p-10 shadow-2xl overflow-hidden group">
            {/* Ambient light glow */}
            <div className={`absolute -top-40 -left-40 w-96 h-96 rounded-full blur-[120px] opacity-20 pointer-events-none ${
              strikeResult.status === 'success' ? 'bg-emerald-500' :
              strikeResult.status === 'frontrun' ? 'bg-amber-500' : 'bg-red-500'
            }`}></div>
            
            {/* Close button */}
            <button 
              onClick={() => setStrikeResult(null)} 
              className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all z-20"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>

            <div className="relative z-10 flex flex-col items-center text-center space-y-6">
              {/* Animated status icon */}
              <div className={`w-24 h-24 rounded-full flex items-center justify-center border-2 shadow-lg ${
                strikeResult.status === 'success' 
                  ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-emerald-500/10 animate-[pulse_2s_infinite]' 
                  : strikeResult.status === 'frontrun'
                  ? 'bg-amber-500/10 border-amber-500 text-amber-400 shadow-amber-500/10 animate-[bounce_2s_infinite]'
                  : 'bg-red-500/10 border-red-500 text-red-400 shadow-red-500/10 animate-[pulse_1.5s_infinite]'
              }`}>
                {strikeResult.status === 'success' ? (
                  <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                ) : strikeResult.status === 'frontrun' ? (
                  <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                ) : strikeResult.status === 'slippage' ? (
                  <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                ) : (
                  <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                )}
              </div>

              <div>
                <span className="text-[9px] font-black tracking-[0.4em] uppercase text-slate-500 block mb-1">Terminal Report</span>
                <h3 className={`text-2xl font-black italic uppercase tracking-tighter ${
                  strikeResult.status === 'success' ? 'text-emerald-400' :
                  strikeResult.status === 'frontrun' ? 'text-amber-400' : 'text-red-400'
                }`}>
                  {strikeResult.title}
                </h3>
              </div>

              <div className="p-6 bg-black/40 border border-white/5 rounded-2xl text-left">
                <p className="text-slate-300 font-medium text-xs leading-relaxed">
                  {strikeResult.reason}
                </p>
              </div>

              {/* Trade Details grid */}
              <div className="grid grid-cols-2 gap-4 w-full text-left">
                {strikeResult.details.chain && (
                  <div className="bg-white/5 border border-white/5 p-4 rounded-xl">
                    <span className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Red</span>
                    <span className="text-white font-bold text-xs">{strikeResult.details.chain}</span>
                  </div>
                )}
                {strikeResult.details.volume !== undefined && (
                  <div className="bg-white/5 border border-white/5 p-4 rounded-xl">
                    <span className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Capital Movilizado</span>
                    <span className="text-white font-bold text-xs">${strikeResult.details.volume.toLocaleString()} USDC</span>
                  </div>
                )}
                {strikeResult.details.gasCost !== undefined && (
                  <div className="bg-white/5 border border-white/5 p-4 rounded-xl">
                    <span className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Gas Coste Sim</span>
                    <span className="text-red-400 font-bold text-xs">-${strikeResult.details.gasCost.toFixed(2)} USD</span>
                  </div>
                )}
                {strikeResult.details.netProfit !== undefined && (
                  <div className="bg-white/5 border border-white/5 p-4 rounded-xl">
                    <span className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Retorno Neto</span>
                    <span className={`font-bold text-xs ${strikeResult.details.netProfit > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {strikeResult.details.netProfit > 0 ? `+$${strikeResult.details.netProfit.toFixed(2)}` : `-$${Math.abs(strikeResult.details.netProfit).toFixed(2)}`} USDC
                    </span>
                  </div>
                )}
                {strikeResult.details.buyDex && strikeResult.details.sellDex && (
                  <div className="col-span-2 bg-white/5 border border-white/5 p-4 rounded-xl flex justify-between items-center">
                    <div>
                      <span className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Ruta de Ejecución</span>
                      <span className="text-white font-bold text-xs">Compra en {strikeResult.details.buyDex} ➔ Venta en {strikeResult.details.sellDex}</span>
                    </div>
                  </div>
                )}
                {strikeResult.details.hash && (
                  <div className="col-span-2 bg-white/5 border border-white/5 p-4 rounded-xl">
                    <span className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Tx Hash</span>
                    <span className="text-slate-400 font-mono text-[9px] block truncate">{strikeResult.details.hash}</span>
                  </div>
                )}
              </div>

              <button 
                onClick={() => setStrikeResult(null)}
                className={`w-full py-4 rounded-xl font-black text-xs uppercase italic tracking-widest active:scale-95 transition-all ${
                  strikeResult.status === 'success' 
                    ? 'bg-emerald-500 text-black hover:bg-emerald-400' 
                    : strikeResult.status === 'frontrun'
                    ? 'bg-amber-500 text-black hover:bg-amber-400'
                    : 'bg-red-500 text-white hover:bg-red-400'
                }`}
              >
                Cerrar Reporte de Terminal
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes progress {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #1e293b;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #334155;
        }
      `}</style>
    </div>
  );
};

export default App;
