const { JsonRpcProvider } = require('ethers');

async function main() {
  const provider = new JsonRpcProvider('https://mainnet.base.org');
  const addrs = [
    '0x1b81d678ffb9c0263b24a97847620c99d213eb14', // Router 1
    '0xD70C70AD87aa8D45b8D59600342FB3AEe76E3c68', // Router 2
    '0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865', // Factory
    '0x0227628f3F023d03d1aCC8440544171d9f4e2f6F'  // Is this another Pancake Factory?
  ];

  for (const a of addrs) {
    const code = await provider.getCode(a);
    console.log(`${a} bytecode length: ${code.length}`);
  }
}
main();
