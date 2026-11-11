// Prepares a USDT bridge deposit from BOT Chain testnet to Sepolia and prints the calls.
// Read only: nothing is signed or sent, and no keys are needed.
//   npx tsx examples/bridge-deposit.ts

import { getBridgeLimits, getBridgeStatus, prepareBridgeDeposit } from '@uzolabs/sdk/bridge'
import { botChainTestnet } from '@uzolabs/sdk/chains'
import { TOKENS } from '@uzolabs/sdk/contracts'
import { createPublicClient, formatUnits, http } from 'viem'

const client = createPublicClient({ chain: botChainTestnet, transport: http() })
const usdt = (v: bigint) => `${formatUnits(v, TOKENS.USDT.decimals)} USDT`

const status = await getBridgeStatus(client)
const limits = await getBridgeLimits(client)
console.log('Status:', status)
console.log(
  `Limits: ${usdt(limits.minAmount)} to ${usdt(limits.maxAmount)}, min fee ${usdt(limits.minFee)}`,
)

// Placeholder recipient. Replace it with the user's Sepolia address.
const { approve, deposit, fee, receiveAmount } = await prepareBridgeDeposit(client, {
  destinationChainId: 11155111,
  recipient: '0x000000000000000000000000000000000000dEaD',
  amount: limits.minAmount,
})
// receiveAmount is in BOT Chain USDT base units (6 decimals). The recipient receives the same
// value expressed in the destination token's decimals (for example 18 on BSC).
console.log(`Fee ${usdt(fee)}, recipient receives ${usdt(receiveAmount)}`)
// Send approve first, wait for it, then deposit, from the user's wallet.
console.log({ approve, deposit })
