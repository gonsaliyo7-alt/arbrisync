
import React from 'react';
import { ArbitrageOpportunity } from '../types';

interface Props {
  opp: ArbitrageOpportunity;
  isSelected: boolean;
  onSelect: (opp: ArbitrageOpportunity) => void;
}

const getChainColor = (chain: string) => {
  const c = chain.toLowerCase();
  if (c.includes('eth')) return 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20';
  if (c.includes('bsc')) return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
  if (c.includes('poly')) return 'text-purple-400 bg-purple-500/10 border-purple-500/20';
  if (c.includes('arbi')) return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
  if (c.includes('base')) return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20';
  return 'text-slate-400 bg-slate-500/10 border-slate-500/20';
};

const OpportunityCard: React.FC<Props> = ({ opp, isSelected, onSelect }) => {
  const isHighYield = opp.imbalancePercentage >= 1.5;
  const chainStyles = getChainColor(opp.chain);

  return (
    <div 
      onClick={() => onSelect(opp)}
      className={`p-4 cursor-pointer rounded-2xl border transition-all duration-300 relative group overflow-hidden ${
        isSelected 
          ? 'bg-blue-600/10 border-blue-500 ring-1 ring-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.15)]' 
          : 'bg-slate-900/60 border-slate-800 hover:border-slate-600 hover:bg-slate-900/80'
      }`}
    >
      {/* Decorative scanline for active cards */}
      {isSelected && <div className="absolute inset-0 bg-gradient-to-t from-blue-500/5 to-transparent pointer-events-none"></div>}
      
      <div className="flex justify-between items-start mb-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="font-black text-lg text-white tracking-tight">{opp.symbol}</span>
            <span className={`text-[8px] px-2 py-0.5 rounded-full font-black uppercase border ${chainStyles}`}>
              {opp.chain}
            </span>
          </div>
          <span className="text-[7px] text-slate-500 font-bold uppercase tracking-widest">{opp.token.slice(0, 18)}...</span>
        </div>
        <div className="text-right">
          <div className="text-[7px] font-black text-slate-500 uppercase mb-0.5">Profit Opportunity (PO)</div>
          <span className={`font-black mono text-xl italic tracking-tighter ${isHighYield ? 'text-amber-400' : 'text-emerald-400'}`}>
            +{opp.imbalancePercentage.toFixed(2)}%
          </span>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-3 mb-3 p-2 rounded-xl bg-black/40 border border-white/5">
        <div>
          <span className="text-slate-600 block uppercase font-black text-[7px] mb-1">Entry: {opp.buyDex}</span>
          <span className="mono text-slate-200 font-bold text-xs">${opp.buyPrice.toLocaleString()}</span>
        </div>
        <div className="text-right">
          <span className="text-slate-600 block uppercase font-black text-[7px] mb-1">Exit: {opp.sellDex}</span>
          <span className="mono text-slate-200 font-bold text-xs">${opp.sellPrice.toLocaleString()}</span>
        </div>
      </div>
      
      <div className="flex justify-between items-center text-[8px] uppercase font-black tracking-widest text-slate-500">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/50 shadow-[0_0_5px_rgba(16,185,129,0.5)]"></div>
          Liq: {opp.liquidity}
        </div>
        <div className="flex items-center gap-1.5">
          <svg className="w-2 h-2" fill="currentColor" viewBox="0 0 20 20"><path d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" /></svg>
          Gas: {opp.gasEstimate}
        </div>
      </div>
    </div>
  );
};

export default OpportunityCard;
