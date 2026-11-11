import { type Address, encodeFunctionData, erc20Abi, maxUint160 } from 'viem'
import { addresses } from '../contracts/addresses'
import { assertAddress, assertChainId, type SupportedChainId } from '../utils/validation'
import { permit2ApproveFragment } from './abis'
import {
  approvedRouters,
  assertAllowedSpender,
  assertAmount,
  invalidArgument,
  type TxRequest,
} from './shared'

const MAX_UINT48 = 2 ** 48 - 1

/**
 * Builds an unsigned ERC-20 `approve` call. `spender` must be a BDEX router (V2 Router02,
 * V3 SwapRouter or Universal Router) or Permit2 on `chainId`; anything else throws
 * `RouterNotAllowedError`. Approve the exact amount you are about to swap.
 *
 * @example
 * ```ts
 * const { usdt, bdexV2Router02 } = addresses[677]
 * const tx = buildErc20Approve({ chainId: 677, token: usdt, spender: bdexV2Router02, amount })
 * ```
 */
export function buildErc20Approve({
  chainId,
  token,
  spender,
  amount,
}: {
  chainId: SupportedChainId
  token: Address
  spender: Address
  amount: bigint
}): TxRequest {
  assertChainId(chainId)
  return {
    to: assertAddress(token, 'token'),
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: 'approve',
      args: [
        assertAllowedSpender(spender, [...approvedRouters(chainId), addresses[chainId].permit2]),
        assertAmount(amount, 'amount', { allowZero: true }),
      ],
    }),
    value: 0n,
  }
}

/**
 * Builds an unsigned `Permit2.approve(token, spender, amount, expiration)` call against the
 * BDEX Permit2 for `chainId`. `spender` must be a BDEX router on that network, normally the
 * Universal Router; anything else throws `RouterNotAllowedError`.
 *
 * The token must already be ERC-20 approved to Permit2 (see `buildErc20Approve`).
 * `amount` is a uint160 and `expiration` is a unix timestamp in seconds (uint48).
 *
 * @example
 * ```ts
 * const { usdt, universalRouter } = addresses[677]
 * const tx = buildPermit2Approve({
 *   chainId: 677,
 *   token: usdt,
 *   spender: universalRouter,
 *   amount,
 *   expiration: Math.floor(Date.now() / 1000) + 3600,
 * })
 * ```
 */
export function buildPermit2Approve({
  chainId,
  token,
  spender,
  amount,
  expiration,
}: {
  chainId: SupportedChainId
  token: Address
  spender: Address
  amount: bigint
  expiration: number
}): TxRequest {
  assertChainId(chainId)
  if (!Number.isInteger(expiration) || expiration <= 0 || expiration > MAX_UINT48) {
    throw invalidArgument('expiration', 'must be a unix timestamp in seconds that fits in a uint48')
  }
  return {
    to: addresses[chainId].permit2,
    data: encodeFunctionData({
      abi: permit2ApproveFragment,
      functionName: 'approve',
      args: [
        assertAddress(token, 'token'),
        assertAllowedSpender(spender, approvedRouters(chainId)),
        assertAmount(amount, 'amount', { max: maxUint160, allowZero: true }),
        expiration,
      ],
    }),
    value: 0n,
  }
}
