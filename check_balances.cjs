const { JsonRpcProvider, Contract, formatUnits } = require('ethers');

async function main() {
  const provider = new JsonRpcProvider('https://arb1.arbitrum.io/rpc');
  
  const vaultAddress = '0xBA12222222228d8Ba445958a75a0704d566BF2C8';
  
  const usdcAddress = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831'; // Native USDC
  const usdceAddress = '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8'; // Bridged USDC.e
  
  const erc20Abi = [
    'function balanceOf(address account) view returns (uint256)',
    'function symbol() view returns (string)',
    'function decimals() view returns (uint8)'
  ];

  try {
    const usdc = new Contract(usdcAddress, erc20Abi, provider);
    const usdce = new Contract(usdceAddress, erc20Abi, provider);
    
    const usdcBal = await usdc.balanceOf(vaultAddress);
    const usdceBal = await usdce.balanceOf(vaultAddress);
    
    console.log('Balancer Vault Native USDC Balance:', formatUnits(usdcBal, 6), 'USDC');
    console.log('Balancer Vault Bridged USDC.e Balance:', formatUnits(usdceBal, 6), 'USDC.e');
  } catch (error) {
    console.error('Error querying balances:', error);
  }
}

main();
