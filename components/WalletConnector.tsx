
import React, { useState, useEffect, useMemo } from 'react';
import { WalletState } from '../types';
import { BrowserProvider, formatEther } from 'ethers';

interface Props {
  onStateChange: (state: WalletState) => void;
  wallet: WalletState;
  isSimulation: boolean;
}

const WalletConnector: React.FC<Props> = ({ onStateChange, wallet, isSimulation }) => {
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
          const network = await provider.getNetwork();
          const balance = await provider.getBalance(address);
          onStateChange({
            address,
            chainId: network.chainId.toString(),
            balance: parseFloat(formatEther(balance)).toFixed(4),
            isConnected: true
          });
        }
      } catch (error) { console.error(error); }
    }
  };

  useEffect(() => { if (!isSimulation) updateWalletState(); }, [isSimulation]);

  const connectWallet = async () => {
    if (!(window as any).ethereum) return alert("Instala MetaMask");
    setLoading(true);
    try {
      await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
      await updateWalletState();
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const displayAddress = isSimulation ? simIdentity.address : wallet.address;
  const displayBalance = isSimulation ? simIdentity.balance : wallet.balance;
  const displayLabel = isSimulation ? simIdentity.ens : (wallet.address ? `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}` : 'OFFLINE');

  return (
    <div className={`p-4 rounded-2xl border transition-all duration-500 relative overflow-hidden ${
      isSimulation ? 'bg-cyan-500/5 border-cyan-500/30' : (wallet.isConnected ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-slate-900 border-slate-800')
    }`}>
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isSimulation ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-800 text-slate-500'}`}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
          </div>
          <div>
            <span className="text-[7px] font-black text-slate-500 uppercase block tracking-widest">Identidad {isSimulation ? 'Sim' : 'Live'}</span>
            <span className="text-[10px] font-black text-white uppercase italic">{isSimulation ? `Whale: ${simIdentity.tier}` : 'Global Node'}</span>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[14px] font-black mono text-white">{displayBalance} <span className="text-[8px] text-slate-500">ETH</span></span>
        </div>
      </div>
      
      {!wallet.isConnected && !isSimulation ? (
        <button onClick={connectWallet} className="w-full py-2 bg-white text-black rounded-lg font-black text-[10px] uppercase hover:bg-slate-200 transition-all">Sincronizar Protocolo</button>
      ) : (
        <div className="flex items-center justify-between p-2 bg-black/40 rounded-lg border border-white/5">
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${isSimulation ? 'bg-cyan-400' : 'bg-emerald-400'}`}></div>
            <span className="mono text-[9px] font-bold text-slate-300">{displayLabel}</span>
          </div>
          <span className="text-[7px] text-slate-600 font-mono">{displayAddress?.slice(0, 12)}...</span>
        </div>
      )}
    </div>
  );
};

// Fix: Added missing default export for WalletConnector
export default WalletConnector;
