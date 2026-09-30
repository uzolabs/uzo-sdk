import { getAddress, isAddress } from 'viem'
import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  addresses,
  EXTERNAL_BRIDGE,
  getAddresses,
  TOKENS,
  USDT_RESOURCE_ID,
} from '../../src/contracts'
import { externalBridgeAddresses, knownImplementations } from '../../src/contracts/addresses'
import { UnsupportedChainError, UzoError } from '../../src/utils/errors'

const books = { ...addresses, ...externalBridgeAddresses, ...knownImplementations }
const entries = Object.entries(books).flatMap(([chainId, book]) =>
  Object.entries(book).map(([key, address]) => ({ chainId, key, address })),
)

describe('addresses', () => {
  it.each(entries)('$chainId.$key is a valid, checksummed address', ({ address }) => {
    expect(isAddress(address, { strict: true })).toBe(true)
    expect(getAddress(address)).toBe(address)
  })

  it('has narrow literal types', () => {
    expectTypeOf(addresses[677].usdt).toEqualTypeOf<'0xaBabc7Ddc03e501d190C676BF3d92ef0e6e87a3C'>()
  })

  it('does not list a mainnet Universal Router', () => {
    expect('universalRouter' in addresses[677]).toBe(false)
  })
})

describe('getAddresses', () => {
  it('returns the book for each supported chain', () => {
    expect(getAddresses(677)).toBe(addresses[677])
    expect(getAddresses(968)).toBe(addresses[968])
  })

  it.each([1, 56, 0, '677', undefined])('throws UnsupportedChainError for %s', (chainId) => {
    const call = () => getAddresses(chainId as never)
    expect(call).toThrow(UnsupportedChainError)
    expect(call).toThrow(/Use 677 \(BOT Chain\) or 968/)
    try {
      call()
    } catch (error) {
      expect(error).toBeInstanceOf(UzoError)
      expect((error as UzoError).code).toBe('UNSUPPORTED_CHAIN')
    }
  })
})

describe('constants', () => {
  it('matches the verified values', () => {
    expect(USDT_RESOURCE_ID).toBe(
      '0xac589789ed8c9d2c61f17b13369864b5f181e58eba230a6ee4ec4c3e7750cd1d',
    )
    expect(TOKENS).toEqual({ BOT: { decimals: 18 }, USDT: { decimals: 6 } })
    expect(Object.keys(EXTERNAL_BRIDGE)).toEqual(['1', '56'])
  })
})
