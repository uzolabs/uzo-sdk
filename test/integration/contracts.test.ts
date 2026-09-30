import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createPublicClient, erc20Abi, http } from 'viem'
import { describe, expect, it } from 'vitest'
import { botChain, botChainTestnet } from '../../src/chains'
import { addresses } from '../../src/contracts'
import { createExplorerClient } from '../../src/explorer'

// Read only. No keys, no transactions.
const networks = [
  { chain: botChain, book: addresses[677] },
  { chain: botChainTestnet, book: addresses[968] },
] as const

describe.each(networks)('$chain.name contracts', ({ chain, book }) => {
  const client = createPublicClient({ chain, transport: http() })

  it.each(Object.entries(book))('%s has bytecode', async (_key, address) => {
    const code = await client.getCode({ address })
    expect(code?.length ?? 0).toBeGreaterThan(2)
  })

  it('USDT has 6 decimals', async () => {
    const decimals = await client.readContract({
      address: book.usdt,
      abi: erc20Abi,
      functionName: 'decimals',
    })
    expect(decimals).toBe(6)
  })
})

describe('explorer (live)', () => {
  it('reads USDT token info on mainnet', async () => {
    const info = await createExplorerClient({ chainId: 677 }).getAddressInfo(addresses[677].usdt)
    expect(info).toMatchObject({ isContract: true, token: { symbol: 'USDT', decimals: 6 } })
  })

  it('resolves the bridge router proxy to BotBridge', async () => {
    const contract = await createExplorerClient({ chainId: 677 }).getContract(
      addresses[677].bridgeRouter,
    )
    expect(contract.proxyType).toBe('eip1967')
    expect(contract.implementations.length).toBeGreaterThan(0)
  })
})

describe('generated ABIs', () => {
  it('match BOTScan (fetch-abis --check)', async () => {
    const { stdout } = await promisify(execFile)(
      process.execPath,
      ['--import', 'tsx', 'scripts/fetch-abis.ts', '--check'],
      { timeout: 60_000 },
    )
    expect(stdout).toContain('No ABI drift')
  }, 90_000)
})
