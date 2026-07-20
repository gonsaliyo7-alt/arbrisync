
import React, { useState, useEffect, useMemo } from 'react';
import { WalletState } from '../types';
import { BrowserProvider, formatEther } from 'ethers';

interface Props {
  onStateChange: (state: WalletState) => void;
  wallet: WalletState;
  isSimulation: boolean;
  simBalance: number;
}

export const NETWORKS: { [key: string]: { name: string; hex: string } } = {
  '1': { name: 'Ethereum', hex: '0x1' },
  '137': { name: 'Polygon', hex: '0x89' },
  '56': { name: 'BNB Chain', hex: '0x38' },
  '42161': { name: 'Arbitrum', hex: '0xa4b1' },
  '8453': { name: 'Base', hex: '0x2105' },
  '43114': { name: 'Avalanche', hex: '0xa86a' },
  '10': { name: 'OP', hex: '0x0a' },
  '59144': { name: 'Linea', hex: '0xe708' },
  '250': { name: 'Fantom', hex: '0xfa' },
  '324': { name: 'zkSync Era', hex: '0x144' },
  '534352': { name: 'Scroll', hex: '0x82750' },
  '5000': { name: 'Mantle', hex: '0x1388' },
  '1101': { name: 'Polygon zkEVM', hex: '0x44d' },
  '25': { name: 'Cronos', hex: '0x19' },
  '1329': { name: 'Sei', hex: '0x531' },
  '143': { name: 'Monad', hex: '0x8f' },
  '10143': { name: 'Monad Testnet', hex: '0x279f' },
  '999': { name: 'HyperEVM', hex: '0x3e7' },
  '43260': { name: 'MegaETH', hex: '0xa904' },
  '4326': { name: 'MegaETH Testnet', hex: '0x10e6' },
  '14': { name: 'Flare Mainnet', hex: '0xe' },
  '11155111': { name: 'Sepolia', hex: '0xaa36a7' },
  '421614': { name: 'Arbitrum Sepolia', hex: '0x66eee' },
  '84532': { name: 'Base Sepolia', hex: '0x14a34' },
  '11155420': { name: 'Optimism Sepolia', hex: '0xaa36a0' },
  '59141': { name: 'Linea Sepolia', hex: '0xe6f9' },
  'bitcoin': { name: 'Bitcoin', hex: '0x205c' },
  'solana': { name: 'Solana', hex: '0x501' },
  'solana-testnet': { name: 'Solana Testnet', hex: '0x502' },
  'solana-devnet': { name: 'Solana Devnet', hex: '0x503' },
  'tron': { name: 'Tron', hex: '0x2b0f' },
  'tron-nile': { name: 'Tron Nile', hex: '0x2b10' },
  'tron-shasta': { name: 'Tron Shasta', hex: '0x2b11' }
};

export const NETWORK_NATIVE_TOKENS: { [key: string]: string } = {
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

const getRpcUrl = (chainId: string): string => {
  switch (chainId) {
    case '1': return 'https://rpc.ankr.com/eth';
    case '137': return 'https://polygon-rpc.com';
    case '56': return 'https://bsc-dataseed.binance.org';
    case '42161': return 'https://arb1.arbitrum.io/rpc';
    case '8453': return 'https://mainnet.base.org';
    case '43114': return 'https://api.avax.network/ext/bc/C/rpc';
    case '10': return 'https://mainnet.optimism.io';
    case '59144': return 'https://rpc.linea.build';
    case '250': return 'https://rpc.ftm.tools';
    case '324': return 'https://mainnet.era.zksync.io';
    case '534352': return 'https://rpc.scroll.io';
    case '5000': return 'https://rpc.mantle.xyz';
    case '1101': return 'https://zkevm-rpc.com';
    case '25': return 'https://evm.cronos.org';
    case '1329': return 'https://evm-rpc.sei-apis.com';
    case '143': return 'https://rpc.monad.xyz';
    case '10143': return 'https://testnet-rpc.monad.xyz';
    case '999': return 'https://rpc.hyperevm.xyz';
    case '43260': return 'https://rpc.megaeth.xyz';
    case '4326': return 'https://testnet-rpc.megaeth.xyz';
    case '14': return 'https://flare-api.flare.network/ext/C/rpc';
    case '11155111': return 'https://rpc.ankr.com/eth_sepolia';
    case '421614': return 'https://sepolia-rollup.arbitrum.io/rpc';
    case '84532': return 'https://sepolia.base.org';
    case '11155420': return 'https://sepolia.optimism.io';
    case '59141': return 'https://rpc.sepolia.linea.build';
    default: return 'https://rpc.ankr.com/eth';
  }
};

const getExplorerUrl = (chainId: string): string => {
  switch (chainId) {
    case '1': return 'https://etherscan.io';
    case '137': return 'https://polygonscan.com';
    case '56': return 'https://bscscan.com';
    case '42161': return 'https://arbiscan.io';
    case '8453': return 'https://basescan.org';
    case '43114': return 'https://snowtrace.io';
    case '10': return 'https://optimistic.etherscan.io';
    case '59144': return 'https://lineascan.build';
    case '250': return 'https://ftmscan.com';
    case '324': return 'https://era.zksync.network';
    case '534352': return 'https://scrollscan.com';
    case '5000': return 'https://mantlescan.info';
    case '1101': return 'https://zkevm.polygonscan.com';
    case '25': return 'https://cronoscan.com';
    case '1329': return 'https://seitrace.com';
    case '143': return 'https://monadexplorer.com';
    case '10143': return 'https://testnet.monadexplorer.com/';
    case '999': return 'https://hyperexplorer.xyz';
    case '43260': return 'https://megaexplorer.xyz';
    case '4326': return 'https://megaexplorer.xyz';
    case '14': return 'https://flare-explorer.flare.network';
    case '11155111': return 'https://etherscan.io';
    case '421614': return 'https://sepolia.arbiscan.io';
    case '84532': return 'https://sepolia.basescan.org';
    case '11155420': return 'https://sepolia-optimism.etherscan.io';
    case '59141': return 'https://sepolia.lineascan.build';
    default: return 'https://etherscan.io';
  }
};

export const switchNetwork = async (targetChainId: string): Promise<boolean> => {
  if (typeof window === 'undefined' || !(window as any).ethereum) {
    alert("MetaMask no está instalado.");
    return false;
  }
  const net = NETWORKS[targetChainId];
  if (!net) {
    alert(`Red no soportada en ArbiSync: Chain ID ${targetChainId}`);
    return false;
  }
  try {
    await (window as any).ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: net.hex }]
    });
    return true;
  } catch (switchError: any) {
    // Error 4902: Chain has not been added to MetaMask.
    if (switchError.code === 4902) {
      try {
        const nativeSymbol = NETWORK_NATIVE_TOKENS[targetChainId] || 'ETH';
        await (window as any).ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: net.hex,
            chainName: net.name,
            nativeCurrency: {
              name: nativeSymbol,
              symbol: nativeSymbol,
              decimals: 18
            },
            rpcUrls: [getRpcUrl(targetChainId)],
            blockExplorerUrls: [getExplorerUrl(targetChainId)]
          }]
        });
        return true;
      } catch (addError: any) {
        console.error("Error al agregar la red a MetaMask:", addError);
        alert(`No se pudo agregar la red automáticamente. Por favor agrega la red ${net.name} manualmente.`);
        return false;
      }
    } else {
      console.error("Error al cambiar de red:", switchError);
    }
    return false;
  }
};

const WalletConnector: React.FC<Props> = ({ onStateChange, wallet, isSimulation, simBalance }) => {
  const [loading, setLoading] = useState(false);

  const simIdentity = useMemo(() => ({
    address: "0x" + Array.from({length: 40}, () => Math.floor(Math.random() * 16).toString(16)).join(''),
    ens: ["vitalic_vault.eth", "deep_liq.eth", "flash_king.eth", "arb_god.eth", "whale_01.eth"][Math.floor(Math.random() * 5)],
    balance: (Math.random() * 800 + 200).toFixed(2),
    tier: ["PLATINUM", "DIAMOND", "VIP"][Math.floor(Math.random() * 3)]
  }), [isSimulation]);

  const updateWalletState = async () => {
    if (!isSimulation && typeof window !== 'undefined' && (window as any).ethereum) {
      try {
        const provider = new BrowserProvider((window as any).ethereum);
        const accounts = await provider.listAccounts();
        if (accounts.length > 0) {
          const address = accounts[0].address;
          
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
            const balance = await provider.getBalance(address);
            balanceStr = parseFloat(formatEther(balance)).toFixed(4);
          } catch (balErr) {
            console.error("Error fetching balance:", balErr);
            balanceStr = 'N/A';
          }

          onStateChange({
            address,
            chainId,
            balance: balanceStr,
            isConnected: true
          });
        } else {
          onStateChange({
            address: null,
            chainId: null,
            balance: '0',
            isConnected: false
          });
        }
      } catch (error) {
        console.error("Error al actualizar estado de wallet:", error);
      }
    }
  };

  useEffect(() => {
    if (isSimulation) {
      onStateChange({ address: null, chainId: null, balance: '0', isConnected: false });
      return;
    }

    updateWalletState();

    if (typeof window !== 'undefined' && (window as any).ethereum) {
      const eth = (window as any).ethereum;
      
      const handleAccountsChanged = (accounts: any[]) => {
        if (accounts.length === 0) {
          onStateChange({ address: null, chainId: null, balance: '0', isConnected: false });
        } else {
          updateWalletState();
        }
      };

      const handleChainChanged = () => {
        updateWalletState();
      };

      eth.on('accountsChanged', handleAccountsChanged);
      eth.on('chainChanged', handleChainChanged);

      return () => {
        if (eth.removeListener) {
          eth.removeListener('accountsChanged', handleAccountsChanged);
          eth.removeListener('chainChanged', handleChainChanged);
        }
      };
    }
  }, [isSimulation]);

  const connectWallet = async () => {
    if (typeof window === 'undefined' || !(window as any).ethereum) {
      return alert("Por favor instala MetaMask para sincronizar el protocolo real.");
    }
    setLoading(true);
    try {
      await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
      await updateWalletState();
    } catch (err) {
      console.error("Error al conectar wallet:", err);
    } finally {
      setLoading(false);
    }
  };

  const displayAddress = isSimulation ? simIdentity.address : wallet.address;
  const displayBalance = isSimulation 
    ? simBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) 
    : wallet.balance;
  const displayLabel = isSimulation ? simIdentity.ens : (wallet.address ? `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}` : 'OFFLINE');

  const displayDenomination = isSimulation 
    ? 'USDC' 
    : (wallet.chainId ? (NETWORK_NATIVE_TOKENS[wallet.chainId] || 'ETH') : 'ETH');

  const connectedNetworkName = useMemo(() => {
    if (isSimulation) return `Whale: ${simIdentity.tier}`;
    if (!wallet.isConnected || !wallet.chainId) return 'DESCONECTADO';
    return NETWORKS[wallet.chainId]?.name || `Red ID: ${wallet.chainId}`;
  }, [isSimulation, wallet.isConnected, wallet.chainId, simIdentity.tier]);

  const isTestnet = wallet.isConnected && wallet.chainId && ['11155111', '421614', '84532', '11155420', '10143', '4326', '59141', 'solana-testnet', 'solana-devnet', 'tron-nile', 'tron-shasta'].includes(wallet.chainId);
  const borderBgStyle = isSimulation 
    ? 'bg-cyan-500/5 border-cyan-500/30' 
    : (wallet.isConnected 
        ? (isTestnet ? 'bg-purple-500/5 border-purple-500/30' : 'bg-emerald-500/5 border-emerald-500/30') 
        : 'bg-slate-900 border-slate-800');

  const iconBgStyle = isSimulation 
    ? 'bg-cyan-500/20 text-cyan-400' 
    : (wallet.isConnected 
        ? (isTestnet ? 'bg-purple-500/20 text-purple-400' : 'bg-emerald-500/20 text-emerald-400') 
        : 'bg-slate-800 text-slate-500');

  const statusDotStyle = isSimulation 
    ? 'bg-cyan-400' 
    : (isTestnet ? 'bg-purple-400' : 'bg-emerald-400');

  return (
    <div className={`p-4 rounded-2xl border transition-all duration-500 relative overflow-hidden ${borderBgStyle}`}>
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconBgStyle}`}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
          </div>
          <div>
            <span className="text-[7px] font-black text-slate-500 uppercase block tracking-widest">Identidad {isSimulation ? 'Sim' : 'Live'}</span>
            <span className="text-[10px] font-black text-white uppercase italic tracking-wider">{connectedNetworkName}</span>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[14px] font-black mono text-white">{displayBalance} <span className="text-[8px] text-slate-500">{displayDenomination}</span></span>
        </div>
      </div>
      
      {!wallet.isConnected && !isSimulation ? (
        <button onClick={connectWallet} disabled={loading} className="w-full py-2 bg-white text-black rounded-lg font-black text-[10px] uppercase hover:bg-slate-200 transition-all">
          {loading ? "Sincronizando..." : "Sincronizar Protocolo"}
        </button>
      ) : (
        <div className="flex items-center justify-between p-2 bg-black/40 rounded-lg border border-white/5">
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${statusDotStyle}`}></div>
            <span className="mono text-[9px] font-bold text-slate-300">{displayLabel}</span>
          </div>
          <span className="text-[7px] text-slate-650 font-mono">{displayAddress?.slice(0, 12)}...</span>
        </div>
      )}
    </div>
  );
};

export default WalletConnector;

