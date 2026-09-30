// Reads the latest block number from BOT Chain mainnet and testnet.
// Run with: npx tsx examples/read-block.ts

import { botChain, botChainTestnet } from '@uzolabs/sdk/chains'
import { createPublicClient, http } from 'viem'

for (const chain of [botChain, botChainTestnet]) {
  const client = createPublicClient({ chain, transport: http() })
  const blockNumber = await client.getBlockNumber()
  console.log(`${chain.name} (${chain.id}): block ${blockNumber}`)
}
