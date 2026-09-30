import { type Address, getAddress, isAddress } from 'viem'
import { InvalidAddressError, UnsupportedChainError } from './errors'

/** Chain IDs the SDK supports: BOT Chain mainnet and testnet. */
export type SupportedChainId = 677 | 968

/**
 * Validates an address and returns it checksummed.
 *
 * @internal
 */
export function assertAddress(value: unknown, label?: string): Address {
  if (typeof value !== 'string' || !isAddress(value, { strict: false })) {
    throw new InvalidAddressError(value, label)
  }
  return getAddress(value)
}

/**
 * Narrows a chain ID to a supported one.
 *
 * @internal
 */
export function assertChainId(chainId: unknown): asserts chainId is SupportedChainId {
  if (chainId !== 677 && chainId !== 968) throw new UnsupportedChainError(chainId)
}
