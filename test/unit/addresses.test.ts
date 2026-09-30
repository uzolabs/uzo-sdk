import { getAddress, isAddress } from 'viem'
import { describe, expect, it } from 'vitest'
import { addresses } from '../../src/contracts/addresses'

const entries = Object.entries(addresses).flatMap(([chainId, book]) =>
  Object.entries(book).map(([key, address]) => ({ chainId, key, address })),
)

describe('addresses', () => {
  it.each(entries)('$chainId.$key is a valid, checksummed address', ({ address }) => {
    expect(isAddress(address, { strict: true })).toBe(true)
    expect(getAddress(address)).toBe(address)
  })
})
