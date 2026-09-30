// Reads the USDT bridge limits on BOT Chain mainnet. Read only, no keys needed.
//   npx tsx examples/bridge-limits.ts

import { botChain } from '@uzolabs/sdk/chains'
import { addresses, botBridgeAbi, TOKENS, USDT_RESOURCE_ID } from '@uzolabs/sdk/contracts'
import { createPublicClient, formatUnits, http } from 'viem'

const client = createPublicClient({ chain: botChain, transport: http() })
const bridge = { address: addresses[677].bridgeRouter, abi: botBridgeAbi } as const

const [paused, tokenPaused, minUsd, maxUsd] = await Promise.all([
  client.readContract({ ...bridge, functionName: 'getBridgePause' }),
  client.readContract({
    ...bridge,
    functionName: 'getTokenPauseByResourceId',
    args: [USDT_RESOURCE_ID],
  }),
  client.readContract({ ...bridge, functionName: 'getMinAmountUsd' }),
  client.readContract({ ...bridge, functionName: 'getMaxAmountUsd' }),
])

console.log('Bridge paused:', paused)
console.log('USDT paused:  ', tokenPaused)
// The bounds are whole USD. The contract scales them by token decimals, so for USDT the
// smallest allowed deposit in base units is minUsd * 10 ** 6.
const scale = 10n ** BigInt(TOKENS.USDT.decimals)
console.log(
  `Min deposit:   ${minUsd} USD (${formatUnits(minUsd * scale, TOKENS.USDT.decimals)} USDT)`,
)
console.log(
  `Max deposit:   ${maxUsd} USD (${formatUnits(maxUsd * scale, TOKENS.USDT.decimals)} USDT)`,
)
