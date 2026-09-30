import { createPublicClient, http } from 'viem'
import { describe, expect, it } from 'vitest'
import { botChain, botChainTestnet } from '../../src/chains'

// Read-only. Integration tests never send transactions.
describe.each([botChain, botChainTestnet])('$name RPC', (chain) => {
  const client = createPublicClient({ chain, transport: http() })

  it('returns the expected chain ID', async () => {
    expect(await client.getChainId()).toBe(chain.id)
  })

  it('returns a block number', async () => {
    expect(await client.getBlockNumber()).toBeGreaterThan(0n)
  })

  it('has Multicall3 deployed', async () => {
    const code = await client.getCode({ address: chain.contracts.multicall3.address })
    expect(code && code.length > 2).toBe(true)
  })
})
