import { afterEach, describe, expect, it, vi } from 'vitest'
import { createExplorerClient } from '../../src/explorer'
import { ExplorerError, InvalidAddressError, UnsupportedChainError } from '../../src/utils/errors'

const ADDR = '0xaBabc7Ddc03e501d190C676BF3d92ef0e6e87a3C'
const IMPL = '0xD7F50Ee55787C8fFA82abD634801E56f0578a2B3'

function mockFetch(status: number, body: unknown) {
  const fn = vi.fn(async (_url: string) => new Response(JSON.stringify(body), { status }))
  vi.stubGlobal('fetch', fn)
  return fn
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('createExplorerClient', () => {
  it('rejects unsupported chains', () => {
    expect(() => createExplorerClient({ chainId: 1 as never })).toThrow(UnsupportedChainError)
  })

  it('uses the mainnet and testnet API base URLs', async () => {
    const fn = mockFetch(200, {})
    await createExplorerClient({ chainId: 677 }).getAddressInfo(ADDR)
    await createExplorerClient({ chainId: 968 }).getAddressInfo(ADDR)
    expect(fn.mock.calls.map((c) => c[0])).toEqual([
      `https://scan.botchain.ai/api/v2/addresses/${ADDR}`,
      `https://scan.bohr.life/api/v2/addresses/${ADDR}`,
    ])
  })
})

describe('getAddressInfo', () => {
  const explorer = createExplorerClient({ chainId: 677 })

  it('maps snake_case fields and parses token decimals', async () => {
    mockFetch(200, {
      is_contract: true,
      is_verified: true,
      name: 'Tether USD',
      token: { symbol: 'USDT', decimals: '6', name: 'Tether USD' },
    })
    await expect(explorer.getAddressInfo(ADDR)).resolves.toEqual({
      isContract: true,
      isVerified: true,
      name: 'Tether USD',
      token: { symbol: 'USDT', decimals: 6 },
    })
  })

  it('omits token for non-token addresses', async () => {
    mockFetch(200, { is_contract: false, is_verified: false, name: null, token: null })
    await expect(explorer.getAddressInfo(ADDR)).resolves.toEqual({
      isContract: false,
      isVerified: false,
      name: null,
    })
  })

  it('treats 404 as not found instead of throwing', async () => {
    mockFetch(404, { message: 'Not found' })
    await expect(explorer.getAddressInfo(ADDR)).resolves.toEqual({
      isContract: false,
      isVerified: false,
      name: null,
    })
  })

  it('checksums lowercase input before calling the API', async () => {
    const fn = mockFetch(200, {})
    await explorer.getAddressInfo(ADDR.toLowerCase() as `0x${string}`)
    expect(fn.mock.calls[0]?.[0]).toContain(ADDR)
  })

  it('rejects invalid addresses without calling the API', async () => {
    const fn = mockFetch(200, {})
    await expect(explorer.getAddressInfo('0x123')).rejects.toThrow(InvalidAddressError)
    expect(fn).not.toHaveBeenCalled()
  })

  it('throws ExplorerError on server errors', async () => {
    mockFetch(500, { message: 'Internal error' })
    await expect(explorer.getAddressInfo(ADDR)).rejects.toMatchObject({
      name: 'ExplorerError',
      status: 500,
    })
  })

  it('throws ExplorerError on network failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed')
      }),
    )
    await expect(explorer.getAddressInfo(ADDR)).rejects.toThrow(ExplorerError)
  })
})

describe('getContract', () => {
  const explorer = createExplorerClient({ chainId: 677 })
  const abi = [
    { type: 'function', name: 'deposit', inputs: [], outputs: [], stateMutability: 'payable' },
  ]

  it('maps a verified proxy', async () => {
    mockFetch(200, {
      name: 'TransparentUpgradeableProxy',
      abi,
      is_verified: true,
      proxy_type: 'eip1967',
      implementations: [{ address: IMPL.toLowerCase(), name: 'BotBridge' }],
      compiler_version: 'v0.8.20',
    })
    await expect(explorer.getContract(ADDR)).resolves.toEqual({
      name: 'TransparentUpgradeableProxy',
      abi,
      isVerified: true,
      proxyType: 'eip1967',
      implementations: [IMPL],
    })
  })

  it('returns an empty ABI for unverified contracts', async () => {
    mockFetch(200, { creation_bytecode: '0x60', is_verified: false })
    await expect(explorer.getContract(ADDR)).resolves.toEqual({
      name: '',
      abi: [],
      isVerified: false,
      proxyType: null,
      implementations: [],
    })
  })

  it('throws ExplorerError with status 404 when there is no contract', async () => {
    mockFetch(404, { message: 'Not found' })
    await expect(explorer.getContract(ADDR)).rejects.toMatchObject({
      name: 'ExplorerError',
      status: 404,
    })
  })
})
