import { type Address, type Client, encodeFunctionData } from 'viem'
import { readContract } from 'viem/actions'
import { addresses } from '../contracts/addresses'
import { assertAddress, assertChainId, type SupportedChainId } from '../utils/validation'
import { v2RouterFragment } from './abis'
import {
  assertAmount,
  assertDeadline,
  clientChainId,
  invalidArgument,
  minimumOut,
  rejectRawMinimum,
  type TxRequest,
} from './shared'

function assertPath(path: unknown): Address[] {
  if (!Array.isArray(path) || path.length < 2) {
    throw invalidArgument(
      'path',
      'must list at least 2 token addresses, input first and output last',
    )
  }
  const checked = path.map((token, i) => assertAddress(token, `path[${i}]`))
  for (let i = 1; i < checked.length; i++) {
    if (checked[i] === checked[i - 1]) {
      throw invalidArgument('path', `repeats ${checked[i]} back to back. Remove the duplicate hop`)
    }
  }
  return checked
}

/**
 * Quotes a BDEX V2 swap on chain with `Router02.getAmountsOut`. Returns one amount per
 * token in `path`; the last one is the output.
 *
 * The client must be built with `botChain` or `botChainTestnet`.
 *
 * @example
 * ```ts
 * import { getAmountsOutV2 } from '@uzolabs/sdk/bdex'
 * import { addresses } from '@uzolabs/sdk/contracts'
 *
 * const { usdt, wbot } = addresses[677]
 * const amounts = await getAmountsOutV2(client, { amountIn: 1_000_000n, path: [usdt, wbot] })
 * ```
 */
export async function getAmountsOutV2(
  client: Client,
  { amountIn, path }: { amountIn: bigint; path: readonly Address[] },
): Promise<bigint[]> {
  const chainId = clientChainId(client)
  const amounts = await readContract(client, {
    address: addresses[chainId].bdexV2Router02,
    abi: v2RouterFragment,
    functionName: 'getAmountsOut',
    args: [assertAmount(amountIn, 'amountIn'), assertPath(path)],
  })
  return [...amounts]
}

/**
 * Builds an unsigned `Router02.swapExactTokensForTokens` call. The target is always the
 * BDEX V2 Router02 for `chainId`. Approve that router for `amountIn` of `path[0]` first.
 *
 * Pass the fresh quote as `quotedAmountOut`. The minimum output is computed with
 * `applySlippage`: `slippageTolerance` is in percent, defaults to 0.5 and cannot exceed 5.
 * There is no way to pass a raw minimum. `deadline` must be in the future and at most
 * 1 hour ahead.
 *
 * @example
 * ```ts
 * const quotedAmountOut = (await getAmountsOutV2(client, { amountIn, path })).at(-1)!
 * const tx = buildSwapExactTokensForTokensV2({
 *   chainId: 677,
 *   amountIn,
 *   quotedAmountOut, // minimum is 0.5% below this
 *   path,
 *   to: account,
 *   deadline: BigInt(Math.floor(Date.now() / 1000) + 1200),
 * })
 * await walletClient.sendTransaction(tx) // the user's wallet signs
 * ```
 */
export function buildSwapExactTokensForTokensV2(args: {
  chainId: SupportedChainId
  amountIn: bigint
  quotedAmountOut: bigint
  slippageTolerance?: number
  path: readonly Address[]
  to: Address
  deadline: bigint
}): TxRequest {
  rejectRawMinimum(args)
  const { chainId, amountIn, quotedAmountOut, slippageTolerance, path, to, deadline } = args
  assertChainId(chainId)
  return {
    to: addresses[chainId].bdexV2Router02,
    data: encodeFunctionData({
      abi: v2RouterFragment,
      functionName: 'swapExactTokensForTokens',
      args: [
        assertAmount(amountIn, 'amountIn'),
        minimumOut(quotedAmountOut, slippageTolerance, 'amountOutMin'),
        assertPath(path),
        assertAddress(to, 'to'),
        assertDeadline(deadline),
      ],
    }),
    value: 0n,
  }
}
