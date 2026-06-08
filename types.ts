
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
