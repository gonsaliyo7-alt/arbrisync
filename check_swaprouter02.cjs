const { JsonRpcProvider } = require('ethers');

const provider = new JsonRpcProvider('https://1rpc.io/base');

const routers = {
  'SwapRouter02': '0x2626664c2603336E57B271c5C0b26F421741e481',
  'SwapRouter01': '0xe592427a0aece92de3edee1f18e0157c05861564'
};

async function main() {
  for (const [name, addr] of Object.entries(routers)) {
    const code = await provider.getCode(addr);
    console.log(`${name} (${addr}): bytecode length = ${code.length}`);
  }
}

main();
