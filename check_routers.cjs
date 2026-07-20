const { JsonRpcProvider } = require('ethers');

const provider = new JsonRpcProvider('https://1rpc.io/base');

const routers = {
  'UniV3_Old': '0xe592427a0aece92de3edee1f18e0157c05861564',
  'UniV3_SwapRouter02': '0x2626664c2602f22952463b98778a486774f150cf',
  'PancakeV3_Router': '0x1b81d678ffb9c0263b24a97847620c99d213eb14',
  'Aerodrome_Router': '0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43'
};

async function main() {
  for (const [name, addr] of Object.entries(routers)) {
    const code = await provider.getCode(addr);
    console.log(`${name} (${addr}): bytecode length = ${code.length}`);
  }
}

main();
