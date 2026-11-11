import { createPublicClient, http } from 'viem'
import { describe, expect, it } from 'vitest'
import {
  applySlippage,
  getAmountsOutV2,
  getFeeTiersV3,
  getPoolV3,
  quoteExactInputSingleV3,
} from '../../src/bdex'
import { botChain, botChainTestnet } from '../../src/chains'
import { addresses } from '../../src/contracts'

// Read only. No keys, no transactions.
const mainnet = createPublicClient({ chain: botChain, transport: http() })
const testnet = createPublicClient({ chain: botChainTestnet, transport: http() })
const { usdt, wbot } = addresses[677]

describe('bdex (live)', () => {
  it('getAmountsOutV2 quotes USDT to WBOT on mainnet', async () => {
    const amounts = await getAmountsOutV2(mainnet, { amountIn: 1_000_000n, path: [usdt, wbot] })
    expect(amounts).toHaveLength(2)
    expect(amounts[0]).toBe(1_000_000n)
    expect(amounts[1]).toBeGreaterThan(0n)
    expect(applySlippage(amounts[1] as bigint)).toBeLessThan(amounts[1] as bigint)
  })

  it('getFeeTiersV3 reads the enabled tiers from each factory', async () => {
    expect(await getFeeTiersV3(mainnet)).toEqual(
      expect.arrayContaining([
        { fee: 500, tickSpacing: 10 },
        { fee: 3000, tickSpacing: 60 },
        { fee: 10000, tickSpacing: 200 },
      ]),
    )
    expect(await getFeeTiersV3(testnet)).toEqual(
      expect.arrayContaining([{ fee: 1000, tickSpacing: 20 }]),
    )
    // Not enabled anywhere, so filtered out.
    expect(await getFeeTiersV3(mainnet, { extraCandidates: [7] })).not.toContainEqual(
      expect.objectContaining({ fee: 7 }),
    )
  })

  it('getPoolV3 returns null for a tier that is not enabled', async () => {
    expect(await getPoolV3(mainnet, { tokenA: usdt, tokenB: wbot, fee: 7 })).toBeNull()
  })

  it('getPoolV3 and quoteExactInputSingleV3 agree on mainnet USDT/WBOT', async () => {
    const tiers = await getFeeTiersV3(mainnet)
    const pools = await Promise.all(
      tiers.map(async ({ fee }) => ({
        fee,
        pool: await getPoolV3(mainnet, { tokenA: wbot, tokenB: usdt, fee }),
      })),
    )
    const found = pools.filter((p) => p.pool !== null)
    expect(found.length).toBeGreaterThan(0)

    // Some pools can be empty, so at least one existing pool must quote.
    const quotes = await Promise.allSettled(
      found.map(({ fee }) =>
        quoteExactInputSingleV3(mainnet, { tokenIn: usdt, tokenOut: wbot, fee, amountIn: 1_000n }),
      ),
    )
    const ok = quotes.flatMap((q) => (q.status === 'fulfilled' ? [q.value] : []))
    expect(ok.length).toBeGreaterThan(0)
    expect(ok[0]?.amountOut).toBeGreaterThan(0n)
    expect(ok[0]?.gasEstimate).toBeGreaterThan(0n)
  })
})
