import { defineChain } from 'viem'
import { addresses } from '../contracts/addresses'

/**
 * BOT Chain testnet (chain ID 968), ready to pass to any viem client.
 *
 * Get test tBOT from the faucet at https://faucet.botchain.ai/basic
 * (10 tBOT per address every 24 hours).
 *
 * @example
 * ```ts
 * import { createPublicClient, http } from 'viem'
 * import { botChainTestnet } from '@uzolabs/sdk/chains'
 *
 * const client = createPublicClient({ chain: botChainTestnet, transport: http() })
 * const blockNumber = await client.getBlockNumber()
 * ```
 */
export const botChainTestnet = /*#__PURE__*/ defineChain({
  id: 968,
  name: 'BOT Chain Testnet',
  nativeCurrency: { name: 'tBOT', symbol: 'tBOT', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.bohr.life'] },
  },
  blockExplorers: {
    default: {
      name: 'BOTScan',
      url: 'https://scan.bohr.life',
      apiUrl: 'https://scan.bohr.life/api/v2',
    },
  },
  contracts: {
    multicall3: { address: addresses[968].multicall3 },
  },
  testnet: true,
})
