const { JsonRpcProvider, Contract } = require('ethers');

async function main() {
  const provider = new JsonRpcProvider('https://arb1.arbitrum.io/rpc');
  const contractAddress = '0xe6c9eef40e6b4280dd656978cfc6ffe126d0b7a9';
  const abi = [
    'function owner() view returns (address)',
    'function balancerVault() view returns (address)'
  ];

  try {
    const contract = new Contract(contractAddress, abi, provider);
    const owner = await contract.owner();
    const vault = await contract.balancerVault();
    console.log('Contract Address:', contractAddress);
    console.log('Contract Owner:', owner);
    console.log('Balancer Vault:', vault);
  } catch (error) {
    console.error('Error querying contract:', error);
  }
}

main();
