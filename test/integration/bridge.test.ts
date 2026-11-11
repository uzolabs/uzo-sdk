import { createPublicClient, http } from 'viem'
import { describe, expect, it } from 'vitest'
import { getBotGasConfig, getBridgeLimits, getBridgeStatus } from '../../src/bridge'
import { botChain, botChainTestnet } from '../../src/chains'

// Read only. No keys, no transactions.
const clients = [
  ['mainnet', createPublicClient({ chain: botChain, transport: http() })],
  ['testnet', createPublicClient({ chain: botChainTestnet, transport: http() })],
] as const

describe.each(clients)('bridge (live, %s)', (_name, client) => {
  it('reads the pause flags', async () => {
    const status = await getBridgeStatus(client)
    expect(typeof status.bridgePaused).toBe('boolean')
    expect(typeof status.usdtPaused).toBe('boolean')
  })

  it('reads limits scaled to USDT decimals', async () => {
    const limits = await getBridgeLimits(client)
    expect(limits.minAmount).toBe(limits.minAmountUsd * 1_000_000n)
    expect(limits.maxAmount).toBe(limits.maxAmountUsd * 1_000_000n)
    expect(limits.minFee).toBe(limits.minFeeUsd * 1_000_000n)
    expect(limits.maxAmount).toBeGreaterThan(limits.minAmount)
  })

  it('reads the BOT gas config, which targets BOT Chain itself', async () => {
    const cfg = await getBotGasConfig(client)
    expect(cfg.destinationChainId).toBe(BigInt(client.chain.id))
  })
})
