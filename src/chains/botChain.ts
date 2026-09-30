import { defineChain } from 'viem'
import { addresses } from '../contracts/addresses'

/**
 * BOT Chain mainnet (chain ID 677), ready to pass to any viem client.
 *
 * Note: `eth_getLogs` is disabled on the public RPC `https://rpc.botchain.ai`.
 * For event queries, use the BOTScan API or supply your own RPC transport.
 *
 * @example
 * ```ts
 * import { createPublicClient, http } from 'viem'
 * import { botChain } from '@uzolabs/sdk/chains'
 *
 * const client = createPublicClient({ chain: botChain, transport: http() })
 * const blockNumber = await client.getBlockNumber()
 * ```
 */
export const botChain = /*#__PURE__*/ defineChain({
  id: 677,
  name: 'BOT Chain',
  nativeCurrency: { name: 'BOT', symbol: 'BOT', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.botchain.ai'] },
  },
  blockExplorers: {
    default: {
      name: 'BOTScan',
      url: 'https://scan.botchain.ai',
      apiUrl: 'https://scan.botchain.ai/api/v2',
    },
  },
  contracts: {
    multicall3: { address: addresses[677].multicall3 },
  },
})
