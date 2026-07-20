const { JsonRpcProvider, Wallet, Contract, parseUnits, formatEther } = require('ethers');
const fs = require('fs');
const path = require('path');

const WORKSPACE_DIR = "c:\\Users\\carlos\\.gemini\\antigravity\\scratch\\arbrisync";

// Load Environment variables
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

const RPC_URL = 'https://mainnet.base.org';
const provider = new JsonRpcProvider(RPC_URL, undefined, { staticNetwork: true });
const wallet = new Wallet(privateKey, provider);

const executorAddress = '0x3F1972eeaF776916FFbd42139F10b3A1cb513A16';
const executor = new Contract(executorAddress, [
  'function owner() view returns (address)',
  'function executeDirectArbitrage(address tokenIn, address tokenOut, uint256 amountIn, address buyDex, address sellDex, uint256 minProfit, bool isV3Buy, bool isV3Sell, uint24 poolFeeBuy, uint24 poolFeeSell) external payable returns (uint256)'
], wallet);

const WETH = '0x4200000000000000000000000000000000000006';
const AERO = '0x940181a94a35a4569e4529a3cdfb74e38fd98631';

async function main() {
  console.log('Wallet address:', wallet.address);
  console.log('Contract address:', executorAddress);

  try {
    const contractOwner = await executor.owner();
    console.log('Contract owner is:', contractOwner);
  } catch (e) {
    console.error('Failed to get owner from contract:', e.message);
  }

  // Let's run ONE simulation and print the exact error details
  const USDC = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
  console.log('\nRunning test simulation (Uniswap V3 -> Aerodrome for WETH <-> USDC)...');
  const buyDex = '0x2626664c2603336e57b271c5c0b26f421741e481'; // Uniswap V3 SwapRouter02
  const sellDex = '0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43'; // Aerodrome
  const amount = parseUnits('0.0005', 18);

  try {
    const res = await executor.executeDirectArbitrage.staticCall(
      WETH, USDC, amount, buyDex, sellDex, 1n,
      true, false, 500, 0,
      { value: amount, gasLimit: 1000000 }
    );
    console.log('Simulation success! Result:', res.toString());
  } catch (err) {
    console.log('Simulation failed with error:');
    console.log('- Message:', err.message);
    if (err.data) console.log('- Data:', err.data);
    if (err.info) console.log('- Info:', JSON.stringify(err.info));
  }
}

main();
