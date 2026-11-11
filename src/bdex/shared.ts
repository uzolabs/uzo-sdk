import { type Address, type Client, type Hex, maxUint256 } from 'viem'
import { addresses } from '../contracts/addresses'
import { RouterNotAllowedError, SlippageTooHighError, UzoError } from '../utils/errors'
import { assertAddress, assertChainId, type SupportedChainId } from '../utils/validation'

/** An unsigned call for the user's wallet to sign and send. The SDK never signs. */
export type TxRequest = { to: Address; data: Hex; value: bigint }

/** Default slippage tolerance, in percent. */
export const DEFAULT_SLIPPAGE_TOLERANCE = 0.5
/** Hard slippage cap, in percent. There is no opt-out. */
export const MAX_SLIPPAGE_TOLERANCE = 5

/**
 * Returns the minimum output to accept for a quoted amount, after slippage.
 *
 * `slippageTolerance` is in percent and defaults to 0.5. Anything above 5 throws
 * `SlippageTooHighError`. The cap has no opt-out.
 *
 * @example
 * ```ts
 * const [, quoted] = await getAmountsOutV2(client, { amountIn, path })
 * const amountOutMin = applySlippage(quoted) // 0.5% below the quote
 * ```
 */
export function applySlippage(
  amountOut: bigint,
  { slippageTolerance = DEFAULT_SLIPPAGE_TOLERANCE }: { slippageTolerance?: number } = {},
): bigint {
  if (typeof amountOut !== 'bigint' || amountOut <= 0n) {
    throw invalidArgument('amountOut', 'must be a bigint above 0. Pass the quoted output amount')
  }
  if (
    typeof slippageTolerance !== 'number' ||
    !Number.isFinite(slippageTolerance) ||
    slippageTolerance < 0
  ) {
    throw invalidArgument('slippageTolerance', 'must be a percent from 0 to 5, for example 0.5')
  }
  const bps = Math.round(slippageTolerance * 100)
  if (slippageTolerance > MAX_SLIPPAGE_TOLERANCE) {
    throw new SlippageTooHighError(bps, MAX_SLIPPAGE_TOLERANCE * 100)
  }
  return (amountOut * BigInt(10_000 - bps)) / 10_000n
}

/** The BDEX routers the SDK builds calls for or approves, per network. */
export function approvedRouters(chainId: SupportedChainId): readonly Address[] {
  const book = addresses[chainId]
  return [book.bdexV2Router02, book.bdexV3SwapRouter, book.universalRouter]
}

/** Checksums `spender` and throws `RouterNotAllowedError` unless it is in `allowed`. */
export function assertAllowedSpender(spender: unknown, allowed: readonly Address[]): Address {
  const address = assertAddress(spender, 'spender')
  if (!allowed.includes(address)) throw new RouterNotAllowedError(address)
  return address
}

/** Reads the chain ID from a viem client built with `botChain` or `botChainTestnet`. */
export function clientChainId(client: Client): SupportedChainId {
  const chainId = client.chain?.id
  assertChainId(chainId)
  return chainId
}

export function invalidArgument(name: string, rule: string): UzoError {
  return new UzoError('INVALID_ARGUMENT', `${name} ${rule}.`)
}

export function assertAmount(
  value: unknown,
  name: string,
  { max = maxUint256, allowZero = false } = {},
): bigint {
  if (typeof value !== 'bigint' || value < 0n || value > max || (!allowZero && value === 0n)) {
    throw invalidArgument(
      name,
      `must be a bigint ${allowZero ? 'from 0' : 'above 0'} that fits in a uint${max === maxUint256 ? 256 : 160}. Pass the amount in base units`,
    )
  }
  return value
}

export function assertFee(fee: unknown): number {
  if (typeof fee !== 'number' || !Number.isInteger(fee) || fee <= 0 || fee >= 2 ** 24) {
    throw invalidArgument(
      'fee',
      'must be a uint24 fee in hundredths of a bip, for example 3000 for 0.3%',
    )
  }
  return fee
}

export function assertDeadline(deadline: unknown): bigint {
  if (typeof deadline !== 'bigint' || deadline <= 0n) {
    throw invalidArgument(
      'deadline',
      'must be a unix timestamp in seconds as a bigint, for example now plus 1200n',
    )
  }
  return deadline
}
