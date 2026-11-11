import { type Address, type Client, encodeFunctionData, zeroAddress } from 'viem'
import { multicall, readContract, simulateContract } from 'viem/actions'
import { addresses } from '../contracts/addresses'
import { assertAddress, assertChainId, type SupportedChainId } from '../utils/validation'
import { v3FactoryFragment, v3QuoterV2Fragment, v3SwapRouterFragment } from './abis'
import {
  assertAmount,
  assertDeadline,
  assertFee,
  clientChainId,
  invalidArgument,
  minimumOut,
  rejectRawMinimum,
  type TxRequest,
} from './shared'

/**
 * Fee tiers checked by `getFeeTiersV3` by default. BDEX enables fee tiers on chain, and the
 * enabled set differs between networks, so the SDK reads it instead of hard-coding it.
 */
const DEFAULT_FEE_CANDIDATES = [100, 500, 1000, 2500, 3000, 10000] as const

/**
 * Reads which V3 fee tiers are enabled on the BDEX V3 factory, with their tick spacing.
 * Checks a default candidate list in one multicall; pass `extraCandidates` to check more.
 * A tier is enabled when `feeAmountTickSpacing(fee)` is not 0.
 *
 * @example
 * ```ts
 * const tiers = await getFeeTiersV3(client)
 * // [{ fee: 500, tickSpacing: 10 }, { fee: 3000, tickSpacing: 60 }, ...]
 * ```
 */
export async function getFeeTiersV3(
  client: Client,
  { extraCandidates = [] }: { extraCandidates?: readonly number[] } = {},
): Promise<{ fee: number; tickSpacing: number }[]> {
  const chainId = clientChainId(client)
  const fees = [...new Set([...DEFAULT_FEE_CANDIDATES, ...extraCandidates.map(assertFee)])].sort(
    (a, b) => a - b,
  )
  const factory = addresses[chainId].bdexV3Factory
  const spacings = await multicall(client, {
    allowFailure: false,
    contracts: fees.map((fee) => ({
      address: factory,
      abi: v3FactoryFragment,
      functionName: 'feeAmountTickSpacing',
      args: [fee],
    })),
  })
  return fees
    .map((fee, i) => ({ fee, tickSpacing: Number(spacings[i]) }))
    .filter(({ tickSpacing }) => tickSpacing !== 0)
}

/**
 * Looks up a BDEX V3 pool on the factory. Returns `null` when no pool exists for the pair
 * and fee tier. Token order does not matter.
 *
 * @example
 * ```ts
 * const pool = await getPoolV3(client, { tokenA: usdt, tokenB: wbot, fee: 3000 })
 * ```
 */
export async function getPoolV3(
  client: Client,
  { tokenA, tokenB, fee }: { tokenA: Address; tokenB: Address; fee: number },
): Promise<Address | null> {
  const chainId = clientChainId(client)
  const pool = await readContract(client, {
    address: addresses[chainId].bdexV3Factory,
    abi: v3FactoryFragment,
    functionName: 'getPool',
    args: [assertAddress(tokenA, 'tokenA'), assertAddress(tokenB, 'tokenB'), assertFee(fee)],
  })
  return pool === zeroAddress ? null : pool
}

/**
 * Quotes a single-pool V3 swap with BDEX QuoterV2. QuoterV2 is not a view function, so
 * this simulates the call (`eth_call`). Nothing is sent and nothing is signed.
 *
 * Reverts when the pool does not exist or cannot fill the amount.
 *
 * @example
 * ```ts
 * const { amountOut, gasEstimate } = await quoteExactInputSingleV3(client, {
 *   tokenIn: usdt,
 *   tokenOut: wbot,
 *   fee: 3000,
 *   amountIn: 1_000_000n,
 * })
 * ```
 */
export async function quoteExactInputSingleV3(
  client: Client,
  {
    tokenIn,
    tokenOut,
    fee,
    amountIn,
  }: { tokenIn: Address; tokenOut: Address; fee: number; amountIn: bigint },
): Promise<{ amountOut: bigint; gasEstimate: bigint }> {
  const chainId = clientChainId(client)
  const { result } = await simulateContract(client, {
    address: addresses[chainId].bdexV3QuoterV2,
    abi: v3QuoterV2Fragment,
    functionName: 'quoteExactInputSingle',
    args: [
      {
        tokenIn: assertAddress(tokenIn, 'tokenIn'),
        tokenOut: assertAddress(tokenOut, 'tokenOut'),
        amountIn: assertAmount(amountIn, 'amountIn'),
        fee: assertFee(fee),
        sqrtPriceLimitX96: 0n,
      },
    ],
  })
  const [amountOut, , , gasEstimate] = result
  return { amountOut, gasEstimate }
}

/**
 * Builds an unsigned `SwapRouter.exactInputSingle` call for a token to token swap. The
 * target is always the BDEX V3 SwapRouter for `chainId`. Approve that router for
 * `amountIn` of `tokenIn` first.
 *
 * Pass the fresh quote as `quotedAmountOut`. The minimum output is computed with
 * `applySlippage`: `slippageTolerance` is in percent, defaults to 0.5 and cannot exceed 5.
 * There is no way to pass a raw minimum. `deadline` must be in the future and at most
 * 1 hour ahead.
 *
 * @example
 * ```ts
 * const { amountOut } = await quoteExactInputSingleV3(client, { tokenIn, tokenOut, fee, amountIn })
 * const tx = buildExactInputSingleV3({
 *   chainId: 677,
 *   tokenIn,
 *   tokenOut,
 *   fee,
 *   amountIn,
 *   quotedAmountOut: amountOut, // minimum is 0.5% below this
 *   recipient: account,
 *   deadline: BigInt(Math.floor(Date.now() / 1000) + 1200),
 * })
 * ```
 */
export function buildExactInputSingleV3(args: {
  chainId: SupportedChainId
  tokenIn: Address
  tokenOut: Address
  fee: number
  amountIn: bigint
  quotedAmountOut: bigint
  slippageTolerance?: number
  recipient: Address
  deadline: bigint
}): TxRequest {
  rejectRawMinimum(args)
  const {
    chainId,
    tokenIn,
    tokenOut,
    fee,
    amountIn,
    quotedAmountOut,
    slippageTolerance,
    recipient,
    deadline,
  } = args
  assertChainId(chainId)
  const params = {
    tokenIn: assertAddress(tokenIn, 'tokenIn'),
    tokenOut: assertAddress(tokenOut, 'tokenOut'),
    fee: assertFee(fee),
    recipient: assertAddress(recipient, 'recipient'),
    deadline: assertDeadline(deadline),
    amountIn: assertAmount(amountIn, 'amountIn'),
    amountOutMinimum: minimumOut(quotedAmountOut, slippageTolerance, 'amountOutMinimum'),
    sqrtPriceLimitX96: 0n,
  }
  if (params.tokenIn === params.tokenOut) {
    throw invalidArgument('tokenOut', 'must differ from tokenIn')
  }
  return {
    to: addresses[chainId].bdexV3SwapRouter,
    data: encodeFunctionData({
      abi: v3SwapRouterFragment,
      functionName: 'exactInputSingle',
      args: [params],
    }),
    value: 0n,
  }
}
