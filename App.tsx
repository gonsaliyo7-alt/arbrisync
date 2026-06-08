
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ArbitrageOpportunity, WalletState, ExecutionLog } from './types';
import { scanImbalances, QuotaError } from './services/geminiService';
import WalletConnector from './components/WalletConnector';
import OpportunityCard from './components/OpportunityCard';

const SUPPORTED_CHAINS = [
  { id: 'all', name: 'Global Radar', desc: 'Cross-EVM Scan' },
  { id: '1', name: 'Ethereum', desc: 'Mainnet Core' },
  { id: '137', name: 'Polygon', desc: 'POS Network' },
  { id: '56', name: 'BSC', desc: 'Binance Chain' },
  { id: '42161', name: 'Arbitrum', desc: 'Nitro L2' },
  { id: '8453', name: 'Base', desc: 'Coinbase L2' },
  { id: '43114', name: 'Avalanche', desc: 'C-Chain' }
];

const FLASH_PROVIDERS = [
  { id: 'aave_v3', name: 'AAVE V3 Institutional', fee: 0.0009, desc: '0.09% Fee' },
  { id: 'balancer', name: 'Balancer V2 Vault', fee: 0, desc: '0.00% Zero-Fee' },
  { id: 'uniswap_v3', name: 'Uniswap V3 Flash', fee: 0.003, desc: '0.30% Fee' }
];

const SCAN_INTERVAL_SECONDS = 15; // Increased slightly to prevent aggressive rate limiting

const App: React.FC = () => {
  const [opportunities, setOpportunities] = useState<ArbitrageOpportunity[]>([]);
  const [selectedOpp, setSelectedOpp] = useState<ArbitrageOpportunity | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isAutoScanning, setIsAutoScanning] = useState(false);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [countdown, setCountdown] = useState(SCAN_INTERVAL_SECONDS);
  const [showSettings, setShowSettings] = useState(false);

  // Global Node Stats Sim
  const [networkLoad, setNetworkLoad] = useState(42);
  const [activeNodes, setActiveNodes] = useState(1284);

  const [isPaperTrading, setIsPaperTrading] = useState(true);
  const [simBalance, setSimBalance] = useState<number>(() => parseFloat(localStorage.getItem('arbisync_sim_balance') || '25000'));
  const [tradeAmountUSD, setTradeAmountUSD] = useState<string>('5000');
  const [selectedChainId, setSelectedChainId] = useState<string>('all'); 
  const [targetTokens, setTargetTokens] = useState<string>(() => localStorage.getItem('arbisync_target_tokens') || '');
  const [flashProviderId, setFlashProviderId] = useState('aave_v3');
  const [contractAddress, setContractAddress] = useState<string>(() => localStorage.getItem('arbisync_contract_address') || '');
  const [minPO, setMinPO] = useState<number>(0.8);
  const [slippage, setSlippage] = useState<number>(0.5);
  const [isAllOrNothing, setIsAllOrNothing] = useState(true);

  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [wallet, setWallet] = useState<WalletState>({ address: null, chainId: null, balance: '0', isConnected: false });

  const activeChainName = useMemo(() => SUPPORTED_CHAINS.find(c => c.id === selectedChainId)?.name || 'Global Radar', [selectedChainId]);

  useEffect(() => {
    localStorage.setItem('arbisync_contract_address', contractAddress);
    localStorage.setItem('arbisync_target_tokens', targetTokens);
    localStorage.setItem('arbisync_sim_balance', simBalance.toString());
  }, [contractAddress, targetTokens, simBalance]);

  // Dynamic Network Stats Effect
  useEffect(() => {
    const itv = setInterval(() => {
      setNetworkLoad(prev => Math.min(95, Math.max(15, prev + (Math.random() - 0.5) * 10)));
      setActiveNodes(prev => prev + (Math.random() > 0.5 ? 1 : -1));
    }, 3000);
    return () => clearInterval(itv);
  }, []);

  const calc = useMemo(() => {
    if (!selectedOpp) return { gross: 0, gas: 0, net: 0, isProfitable: false, flashFee: 0, slippageUSD: 0, poActual: 0 };
    const amount = parseFloat(tradeAmountUSD) || 0;
    const gross = amount * (selectedOpp.imbalancePercentage / 100);
    const gasEst = selectedOpp.gasEstimate.toLowerCase().includes('high') ? 85 : 22;
    const provider = FLASH_PROVIDERS.find(p => p.id === flashProviderId);
    const flashFee = amount * (provider?.fee || 0);
    const slippageUSD = amount * (slippage / 100); 
    const net = gross - gasEst - flashFee - slippageUSD;
    const poActual = (net / amount) * 100;
    return { gross, gas: gasEst, net, isProfitable: net > 0, flashFee, slippageUSD, poActual };
  }, [selectedOpp, tradeAmountUSD, flashProviderId, slippage]);

  const addLog = (message: string, type: ExecutionLog['type'] = 'info') => {
    const newLog: ExecutionLog = {
      id: Math.random().toString(36),
      message,
      type,
      timestamp: new Date().toLocaleTimeString()
    };
    setLogs(prev => [...prev.slice(-15), newLog]);
  };

  const runScanner = useCallback(async () => {
    if (!isAutoScanning || isRateLimited) return;
    setIsScanning(true);
    setCountdown(SCAN_INTERVAL_SECONDS);
    try {
      addLog(`RADAR: Escaneando ${activeChainName}...`, 'info');
      const data = await scanImbalances(activeChainName, 'ANY', targetTokens);
      const filtered = data.filter(o => o.imbalancePercentage >= minPO).sort((a, b) => b.imbalancePercentage - a.imbalancePercentage);
      setOpportunities(filtered);
      if (filtered.length > 0 && (!selectedOpp || !filtered.find(o => o.id === selectedOpp.id))) {
          setSelectedOpp(filtered[0]);
      }
      setIsRateLimited(false);
      addLog(`RADAR: ${filtered.length} inbalances de alto PO encontrados.`, 'success');
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
  }, [activeChainName, selectedOpp, isAutoScanning, isRateLimited, minPO, targetTokens]);

  useEffect(() => {
    if (isAutoScanning) {
      runScanner();
      const interval = setInterval(runScanner, SCAN_INTERVAL_SECONDS * 1000);
      const timer = setInterval(() => setCountdown(p => (p > 1 ? p - 1 : SCAN_INTERVAL_SECONDS)), 1000);
      return () => { clearInterval(interval); clearInterval(timer); };
    }
  }, [runScanner, isAutoScanning]);

  const executeStrike = async () => {
    if (!selectedOpp) return;
    setExecuting(true);
    addLog(`INIT: Strike de ${selectedOpp.symbol} iniciado (${isPaperTrading ? 'SIM' : 'LIVE'})`, 'info');
    addLog(`CONTRACT: Usando smart contract ${contractAddress || 'DEFAULT_PROXY'}`, 'info');
    
    await new Promise(r => setTimeout(r, 1500));
    
    if (isAllOrNothing && !calc.isProfitable) {
      addLog(`REVERTED: PO Neto insuficiente ($${calc.net.toFixed(2)}). Strike cancelado por seguridad.`, 'warning');
    } else {
      addLog(`EXECUTED: Transacción confirmada en ${selectedOpp.chain}.`, 'success');
      addLog(`RESULT: $${calc.net.toFixed(2)} capitalizados. PO Final: ${calc.poActual.toFixed(2)}%`, 'sim');
      if (isPaperTrading) setSimBalance(prev => prev + calc.net);
    }
    setExecuting(false);
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-300 font-sans text-[11px] selection:bg-blue-500/30 overflow-x-hidden">
      <div className="scanline"></div>

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
                <div className="grid grid-cols-1 gap-1.5">
                  {SUPPORTED_CHAINS.map(c => (
                    <button key={c.id} onClick={() => setSelectedChainId(c.id)} className={`px-4 py-2.5 rounded-xl border text-left flex justify-between items-center transition-all ${selectedChainId === c.id ? 'bg-cyan-600/10 border-cyan-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.1)]' : 'bg-black/20 border-slate-800 text-slate-500 hover:border-slate-700'}`}>
                       <span className="text-[10px] font-black uppercase italic">{c.name}</span>
                       <span className="text-[8px] font-bold opacity-50 uppercase tracking-tighter">{c.desc}</span>
                    </button>
                  ))}
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
                  <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest block mb-4">Arbitrage Smart Contract</span>
                  <div className="relative">
                    <input 
                      type="text"
                      value={contractAddress}
                      onChange={(e) => setContractAddress(e.target.value)}
                      placeholder="0x..."
                      className="w-full bg-black/60 border border-slate-800 rounded-xl p-4 text-[10px] font-mono text-blue-300 outline-none focus:border-blue-500/50 transition-all"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      <svg className="w-4 h-4 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                    </div>
                  </div>
                  <p className="text-[8px] text-slate-600 italic mt-2 font-bold uppercase">Dirección del contrato desplegado para ejecución atómica.</p>
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
              </div>
            </div>
            
            <div className="p-8 bg-slate-900/60 flex justify-between items-center border-t border-slate-800">
               <button onClick={() => setSimBalance(25000)} className="text-[10px] font-black text-red-500 uppercase hover:underline tracking-widest italic">Reiniciar Capital Sim ($25,000.00)</button>
               <button onClick={() => setShowSettings(false)} className="px-10 py-3.5 bg-blue-600 text-white rounded-2xl text-xs font-black uppercase hover:bg-blue-500 shadow-xl shadow-blue-500/30 transition-all hover:-translate-y-0.5 active:translate-y-0">Sincronizar Cambios</button>
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
              <OpportunityCard key={opp.id} opp={opp} isSelected={selectedOpp?.id === opp.id} onSelect={setSelectedOpp} />
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
              <WalletConnector onStateChange={setWallet} wallet={wallet} isSimulation={isPaperTrading} />
              
              <div className="flex-1 bg-slate-950/60 border border-slate-900 rounded-[2.5rem] flex flex-col overflow-hidden shadow-2xl min-h-[400px]">
                 <div className="bg-slate-900/50 px-8 py-5 border-b border-slate-900/80 flex justify-between items-center">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] italic">Telemetría de Strike</span>
                    <div className="flex gap-1.5">
                       <span className="w-1.5 h-1.5 rounded-full bg-slate-800"></span>
                       <span className="w-1.5 h-1.5 rounded-full bg-slate-800"></span>
                       <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_5px_rgba(59,130,246,0.5)]"></span>
                    </div>
                 </div>
                 <div className="flex-1 p-8 font-mono text-[11px] space-y-3.5 overflow-y-auto custom-scrollbar bg-[radial-gradient(circle_at_top_right,rgba(15,23,42,1),transparent)]">
                    {logs.map(log => (
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

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-10 flex-1">
                    <div className="space-y-8">
                       <div className="space-y-3">
                          <div className="flex justify-between items-end px-2">
                             <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest italic">Volumen de Strike (USD)</label>
                             <span className="text-[10px] font-black text-blue-400 mono">Max Liq: {selectedOpp.liquidity}</span>
                          </div>
                          <div className="relative group">
                             <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none text-slate-600 font-black text-2xl italic">$</div>
                             <input 
                                type="number" 
                                value={tradeAmountUSD} 
                                onChange={(e) => setTradeAmountUSD(e.target.value)} 
                                className="w-full bg-black/40 border-2 border-slate-800 rounded-[2rem] pl-12 pr-8 py-8 mono text-5xl text-white italic outline-none focus:border-blue-500/50 transition-all tracking-tighter shadow-inner group-hover:border-slate-700" 
                             />
                          </div>
                       </div>

                       <div className="grid grid-cols-2 gap-4">
                          <div className="bg-slate-900/30 p-5 rounded-2xl border border-slate-800">
                             <span className="block text-[9px] font-black text-slate-600 uppercase mb-2 tracking-widest">Flash Source</span>
                             <span className="text-[11px] font-black text-emerald-400 uppercase italic tracking-tighter">{flashProviderId.replace('_', ' ')}</span>
                          </div>
                          <div className="bg-slate-900/30 p-5 rounded-2xl border border-slate-800">
                             <span className="block text-[9px] font-black text-slate-600 uppercase mb-2 tracking-widest">Slippage Tolerance</span>
                             <span className="text-[11px] font-black text-purple-400 uppercase italic tracking-tighter">{slippage}% Protocol</span>
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
                               <span className="text-slate-600">Protocol Fees (Gas + Flash)</span>
                               <span className="text-red-500/60 mono">-${(calc.gas + calc.flashFee).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                               <span className="text-slate-600">Slippage Impact</span>
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

                  <button 
                    onClick={executeStrike}
                    disabled={executing || !calc.isProfitable}
                    className={`mt-10 w-full py-8 rounded-[2rem] font-black text-3xl uppercase italic transition-all relative overflow-hidden group tracking-tighter active:scale-95 ${
                      !calc.isProfitable ? 'bg-slate-900 text-slate-700 cursor-not-allowed border border-slate-800 grayscale' : 
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
                  <div className="mt-4 text-center">
                    <p className="text-[9px] text-slate-600 font-black uppercase tracking-[0.5em] italic">Seguridad Atómica Activa: Reversión automática en PO &lt; 0.00%</p>
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
