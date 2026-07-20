const { JsonRpcProvider, Wallet, Contract, formatEther, formatUnits } = require('ethers');
const fs = require('fs');
const path = require('path');

const WORKSPACE_DIR = "c:\\Users\\carlos\\.gemini\\antigravity\\scratch\\arbrisync";
let privateKey = '';

try {
  const envContent = fs.readFileSync(path.join(WORKSPACE_DIR, '.env'), 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eq = trimmed.indexOf('=');
      if (eq > 0) {
        const key = trimmed.slice(0, eq).trim();
        const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
        if (key === 'PRIVATE_KEY') privateKey = val;
      }
    }
  });
} catch (e) {
  console.error('Error loading .env:', e);
}

const provider = new JsonRpcProvider('https://mainnet.base.org');
const wallet = new Wallet(privateKey, provider);
const contractAddress = "0x7Ca487DC14Ca79D71d757252159537f749e15eFA";

const erc20Abi = [
  'function balanceOf(address account) view returns (uint256)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)'
];

const wethAddress = '0x4200000000000000000000000000000000000006';
const usdcAddress = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';

async function main() {
  console.log('Wallet address:', wallet.address);
  console.log('Contract address:', contractAddress);

  const ethBalance = await provider.getBalance(wallet.address);
  console.log('Wallet ETH balance:', formatEther(ethBalance), 'ETH');

  const contractEthBalance = await provider.getBalance(contractAddress);
  console.log('Contract ETH balance:', formatEther(contractEthBalance), 'ETH');

  try {
    const weth = new Contract(wethAddress, erc20Abi, provider);
    const usdc = new Contract(usdcAddress, erc20Abi, provider);

    const walletWeth = await weth.balanceOf(wallet.address);
    const contractWeth = await weth.balanceOf(contractAddress);
    console.log('Wallet WETH:', formatEther(walletWeth), 'WETH');
    console.log('Contract WETH:', formatEther(contractWeth), 'WETH');

    const walletUsdc = await usdc.balanceOf(wallet.address);
    const contractUsdc = await usdc.balanceOf(contractAddress);
    console.log('Wallet USDC:', formatUnits(walletUsdc, 6), 'USDC');
    console.log('Contract USDC:', formatUnits(contractUsdc, 6), 'USDC');
  } catch (error) {
    console.error('Error checking ERC20 balances:', error);
  }
}

main();
