
export interface ArbitrageOpportunity {
  id: string;
  token: string;
  symbol: string;
  chain: string;
  buyDex: string;
  sellDex: string;
  buyPrice: number;
  sellPrice: number;
  imbalancePercentage: number;
  liquidity: string;
  gasEstimate: string;
  timestamp: string;
  buyRouter?: string;
  sellRouter?: string;
  quoteSymbol?: string;
  quoteToken?: string;
  buyFeeRate?: number;
  sellFeeRate?: number;
  isV3Buy?: boolean;
  isV3Sell?: boolean;
  poolFeeBuy?: number;
  poolFeeSell?: number;
}

export interface WalletState {
  address: string | null;
  chainId: string | null;
  balance: string;
  isConnected: boolean;
}

export interface ExecutionLog {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'sim';
  timestamp: string;
  details?: any;
}

export interface SessionStats {
  totalTrades: number;
  totalProfitUSD: number;
  gasSpentUSD: number;
}

export interface SimulatedTrade {
  id: string;
  symbol: string;
  profit: number;
  capitalUsed: number;
  status: 'COMPLETED' | 'REVERTED';
  timestamp: string;
}
