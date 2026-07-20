// Human-readable ABI for the ArbiSyncExecutor smart contract.
// Ethers.js v6 supports parsing this array directly.

export const ARBISYNC_ABI = [
  "function executeArbitrage(address token, address stableToken, uint256 amount, address buyDex, address sellDex, uint256 minProfit) external returns (uint256 profit)",
  "function executeArbitrage(address token, address stableToken, uint256 amount, address buyDex, address sellDex, uint256 minProfit, bool isV3Buy, bool isV3Sell, uint24 poolFeeBuy, uint24 poolFeeSell, address loanPool) external returns (uint256 profit)",
  "function executeDirectArbitrage(address tokenIn, address tokenOut, uint256 amountIn, address buyDex, address sellDex, uint256 minProfit, bool isV3Buy, bool isV3Sell, uint24 poolFeeBuy, uint24 poolFeeSell) external payable returns (uint256 profit)",
  "function owner() external view returns (address)",
  "function withdrawToken(address token) external",
  "function withdrawEther() external",
  "event ArbitrageExecuted(address indexed token, uint256 amount, uint256 profit)"
];
