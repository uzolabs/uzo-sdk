import { assertChainId, type SupportedChainId } from '../utils/validation'
import { addresses } from './addresses'

/**
 * Returns the contract address book for a BOT Chain network.
 * Throws `UnsupportedChainError` for any chain other than 677 or 968.
 *
 * @example
 * ```ts
 * import { getAddresses } from '@uzolabs/sdk/contracts'
 *
 * const { usdt, bdexV2Router02 } = getAddresses(await client.getChainId() as 677 | 968)
 * ```
 */
export function getAddresses<chainId extends SupportedChainId>(
  chainId: chainId,
): (typeof addresses)[chainId] {
  assertChainId(chainId)
  return addresses[chainId]
}
