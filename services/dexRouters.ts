// Registro centralizado de DEX Routers y Contratos de Tokens Envueltos Nativos por Red

export interface DexRouterInfo {
  name: string;
  routerAddress: string;
}

export interface NetworkConfig {
  name: string;
  wrappedNativeSymbol: string;
  wrappedNativeAddress: string;
  routers: { [dexId: string]: string };
}

export const NETWORK_REGISTRY: { [chainId: string]: NetworkConfig } = {
  '1': {
    name: 'Ethereum',
    wrappedNativeSymbol: 'WETH',
    wrappedNativeAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    routers: {
      'uniswap': '0xE592427A0AEce92De3Edee1F18E0157C05861564', // Uniswap V3
      'uniswap v3': '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      'uniswap v2': '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
      'sushiswap': '0xd9e1c153312667247960006526fcF135b7ec6e31',
      'balancer': '0xBA12222222228d8Ba445958a75a0704d566BF2C8', // Balancer V2 Vault
      'curve': '0x99a58482bd757831f153a5c88a8a815a5f15e85c'
    }
  },
  '137': {
    name: 'Polygon',
    wrappedNativeSymbol: 'WMATIC', // o WPOL
    wrappedNativeAddress: '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',
    routers: {
      'uniswap': '0xE592427A0AEce92De3Edee1F18E0157C05861564', // Uniswap V3
      'uniswap v3': '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      'quickswap': '0xa5E0829CaCEd8fFDD4De3c43696c57f7D7A678ff',
      'sushiswap': '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
      'balancer': '0xBA12222222228d8Ba445958a75a0704d566BF2C8'
    }
  },
  '56': {
    name: 'BSC',
    wrappedNativeSymbol: 'WBNB',
    wrappedNativeAddress: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
    routers: {
      'pancakeswap': '0x10ED43C718714eb63d5aA57B78B54704E256024E', // PancakeSwap V2 Router
      'pancakeswap v2': '0x10ED43C718714eb63d5aA57B78B54704E256024E',
      'pancakeswap v3': '0x13f812b9872597bA59c21CE25f3c12758f828a6f',
      'uniswap': '0xE592427A0AEce92De3Edee1F18E0157C05861564', // Uniswap V3
      'uniswap v3': '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      'sushiswap': '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
      'bi-swap': '0x3a6d395b445722440355448288854acb24835697'
    }
  },
  '42161': {
    name: 'Arbitrum',
    wrappedNativeSymbol: 'WETH',
    wrappedNativeAddress: '0x82af49447d8a07e3bd95bd0d56f352415231daa1',
    routers: {
      'uniswap': '0xE592427A0AEce92De3Edee1F18E0157C05861564', // Uniswap V3
      'uniswap v3': '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      'pancakeswap': '0x1b81D678ffb9C0263b24A97847620C99d213eB14', // PancakeSwap V3
      'pancakeswap v3': '0x1b81D678ffb9C0263b24A97847620C99d213eB14',
      'sushiswap': '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
      'camelot': '0xc873fEcbd354f5A56E00E710B90EF4201db2448d',
      'balancer': '0xBA12222222228d8Ba445958a75a0704d566BF2C8'
    }
  },
  '8453': {
    name: 'Base',
    wrappedNativeSymbol: 'WETH',
    wrappedNativeAddress: '0x4200000000000000000000000000000000000006',
    routers: {
      'uniswap': '0xE592427A0AEce92De3Edee1F18E0157C05861564', // Uniswap V3
      'uniswap v3': '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      'aerodrome': '0xcF77a682147983677C3b8e4e5ee6A00742f1cf5A',
      'sushiswap': '0x6bd237f3747d2a588b39414995f50f38bbf200d7',
      'baseswap': '0x327ef899140f7d54b4073e7305961b244247c907'
    }
  },
  '43114': {
    name: 'Avalanche',
    wrappedNativeSymbol: 'WAVAX',
    wrappedNativeAddress: '0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7',
    routers: {
      'traderjoe': '0x60aE616a2155Ee3d9A68541Ba4544862310933d4',
      'sushiswap': '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
      'uniswap': '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      'uniswap v3': '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      'pangolin': '0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89286'
    }
  },
  '10': {
    name: 'Optimism',
    wrappedNativeSymbol: 'WETH',
    wrappedNativeAddress: '0x4200000000000000000000000000000000000006',
    routers: {
      'uniswap': '0xE592427A0AEce92De3Edee1F18E0157C05861564', // Uniswap V3
      'uniswap v3': '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      'velodrome': '0xa062aE85690610df5f269a9D84f09230eeD1409C',
      'sushiswap': '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506'
    }
  },
  '59144': {
    name: 'Linea',
    wrappedNativeSymbol: 'WETH',
    wrappedNativeAddress: '0xe5d1e3315307dd7b266d7732a39281a4d94d3090',
    routers: {
      'uniswap': '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      'uniswap v3': '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      'lynex': '0x23a31c54b736b00688a24555819e917d057a627a',
      'pancakeswap': '0x13f812b9872597bA59c21CE25f3c12758f828a6f'
    }
  },
  '250': {
    name: 'Fantom',
    wrappedNativeSymbol: 'WFTM',
    wrappedNativeAddress: '0x21be370d5312f44cb42ce377bc9b8a0cef1a4c83',
    routers: {
      'spookyswap': '0xF491e7B69E4244ad4002BC14e878a34207E38c29',
      'equalizer': '0xe3d27457788421c4566c3a1b55f1fcdb4329241b',
      'balancer': '0xBA12222222228d8Ba445958a75a0704d566BF2C8'
    }
  },
  '324': {
    name: 'zkSync',
    wrappedNativeSymbol: 'WETH',
    wrappedNativeAddress: '0x5AEa5775959fBC119FD75d930773C1e27c882216',
    routers: {
      'syncswap': '0x2da10A1e27bF85c743F07d216503d42b083d09aE',
      'uniswap': '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      'uniswap v3': '0xE592427A0AEce92De3Edee1F18E0157C05861564'
    }
  },
  '534352': {
    name: 'Scroll',
    wrappedNativeSymbol: 'WETH',
    wrappedNativeAddress: '0x5300000000000000000000000000000000000004',
    routers: {
      'uniswap': '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      'uniswap v3': '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      'sushiswap': '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506'
    }
  },
  '5000': {
    name: 'Mantle',
    wrappedNativeSymbol: 'WMNT',
    wrappedNativeAddress: '0x78c1b35cd8f2433f575236b12065a631a3240243',
    routers: {
      'merchant moe': '0xeaEEe4A5E4459C5a720B9C694Db955F1215B4d11',
      'uniswap': '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      'uniswap v3': '0xE592427A0AEce92De3Edee1F18E0157C05861564'
    }
  },
  '1101': {
    name: 'Polygon zkEVM',
    wrappedNativeSymbol: 'WETH',
    wrappedNativeAddress: '0xa4b1bE56b503065050F69B8fD1609100a0E06305',
    routers: {
      'uniswap': '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      'uniswap v3': '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      'quickswap': '0xa5E0829CaCEd8fFDD4De3c43696c57f7D7A678ff'
    }
  },
  '25': {
    name: 'Cronos',
    wrappedNativeSymbol: 'WCRO',
    wrappedNativeAddress: '0x5c7f8a570d578ed840c3ffd949bc10d3575ff944',
    routers: {
      'vvs finance': '0x145863Eb4296BE127462F4A7596001a1532fCd7e'
    }
  },
  '1329': {
    name: 'Sei',
    wrappedNativeSymbol: 'WSEI',
    wrappedNativeAddress: '0xE30feDd158A2e3b13e9badaeABaFc5516e95e8C7',
    routers: {
      'uniswap': '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      'uniswap v3': '0xE592427A0AEce92De3Edee1F18E0157C05861564'
    }
  },
  '10143': {
    name: 'Monad',
    wrappedNativeSymbol: 'WMON',
    wrappedNativeAddress: '0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A',
    routers: {
      'uniswap': '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      'uniswap v3': '0xE592427A0AEce92De3Edee1F18E0157C05861564'
    }
  },
  '999': {
    name: 'HyperEVM',
    wrappedNativeSymbol: 'WHYPE',
    wrappedNativeAddress: '0x5555555555555555555555555555555555555555',
    routers: {
      'uniswap': '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      'uniswap v3': '0xE592427A0AEce92De3Edee1F18E0157C05861564'
    }
  },
  '4326': {
    name: 'MegaETH',
    wrappedNativeSymbol: 'WETH',
    wrappedNativeAddress: '0x4200000000000000000000000000000000000006',
    routers: {
      'uniswap': '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      'uniswap v3': '0xE592427A0AEce92De3Edee1F18E0157C05861564'
    }
  },
  '14': {
    name: 'Flare',
    wrappedNativeSymbol: 'WFLR',
    wrappedNativeAddress: '0x1D80c49BbBCd1C0911346656B529DF9E5c2F783d',
    routers: {
      'uniswap': '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      'uniswap v3': '0xE592427A0AEce92De3Edee1F18E0157C05861564'
    }
  }
};

// Recupera la dirección de Router adecuada. Devuelve un fallback estándar si no existe mapeado.
export const getDexRouterAddress = (chainName: string, dexId: string): string => {
  const cName = chainName.toLowerCase();
  
  // Encontrar la red
  let config: NetworkConfig | undefined;
  for (const id in NETWORK_REGISTRY) {
    if (NETWORK_REGISTRY[id].name.toLowerCase() === cName || cName.includes(NETWORK_REGISTRY[id].name.toLowerCase())) {
      config = NETWORK_REGISTRY[id];
      break;
    }
  }

  if (!config) {
    return '0xE592427A0AEce92De3Edee1F18E0157C05861564'; // Fallback global (Uniswap V3 Router)
  }

  const dId = dexId.toLowerCase();
  for (const key in config.routers) {
    if (dId.includes(key) || key.includes(dId)) {
      return config.routers[key];
    }
  }

  // Fallback por defecto de la red
  return config.routers['uniswap'] || config.routers['uniswap v3'] || Object.values(config.routers)[0];
};
