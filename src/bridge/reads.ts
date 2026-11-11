import type { Address, Client, Hex } from 'viem'
import { readContract } from 'viem/actions'
import { clientChainId } from '../bdex/shared'
import { addresses } from '../contracts/addresses'
import { USDT_RESOURCE_ID } from '../contracts/constants'
import { BridgeValidationError } from '../utils/errors'
import type { SupportedChainId } from '../utils/validation'
import { botBridgeFragment, coreBridgeFragment } from './abis'

/** Whether deposits are currently open. */
export type BridgeStatus = {
  /** The whole bridge is paused. Every deposit reverts. */
  bridgePaused: boolean
  /** USDT bridging is paused. USDT deposits revert. */
  usdtPaused: boolean
}

/** Per-deposit bounds for USDT, read from the contract. */
export type BridgeLimits = {
  /** Smallest deposit, in USDT base units (6 decimals). */
  minAmount: bigint
  /** Largest deposit, in USDT base units (6 decimals). */
  maxAmount: bigint
  /** Smallest non-zero fee, in USDT base units. A fee below this is raised to it. */
  minFee: bigint
  /** The raw bounds the contract stores, in whole USD. */
  minAmountUsd: bigint
  maxAmountUsd: bigint
  minFeeUsd: bigint
}

/** The bridge's BOT gas config. See `getBotGasConfig`. */
export type BotGasConfig = {
  enabled: boolean
  destinationChainId: bigint
  resourceId: Hex
  /** Native BOT paid out on the destination, in wei. */
  amount: bigint
  oracle: Address
  baseToken: Address
  quoteToken: Address
  twapWindow: number
}

function router(chainId: SupportedChainId) {
  return { address: addresses[chainId].bridgeRouter, abi: botBridgeFragment } as const
}

/**
 * Reads whether the bridge and USDT bridging are paused on the client's network.
 *
 * @example
 * ```ts
 * const { bridgePaused, usdtPaused } = await getBridgeStatus(client)
 * ```
 */
export async function getBridgeStatus(client: Client): Promise<BridgeStatus> {
  const bridge = router(clientChainId(client))
  const [bridgePaused, usdtPaused] = await Promise.all([
    readContract(client, { ...bridge, functionName: 'getBridgePause' }),
    readContract(client, {
      ...bridge,
      functionName: 'getTokenPauseByResourceId',
      args: [USDT_RESOURCE_ID],
    }),
  ])
  return { bridgePaused, usdtPaused }
}

/**
 * Reads the core Bridge address from `BotBridge.Bridge()` and the USDT token info from it.
 * Throws if the resource ID does not map to the USDT address the SDK knows, so a
 * misconfigured bridge is never approved.
 *
 * @internal
 */
export async function readUsdtTokenInfo(client: Client, chainId: SupportedChainId) {
  const core = await readContract(client, { ...router(chainId), functionName: 'Bridge' })
  const [assetsType, token, pause, decimalScale] = await readContract(client, {
    address: core,
    abi: coreBridgeFragment,
    functionName: 'getTokenInfoByResourceId',
    args: [USDT_RESOURCE_ID],
  })
  if (assetsType === 0 || token.toLowerCase() !== addresses[chainId].usdt.toLowerCase()) {
    throw new BridgeValidationError(
      'TOKEN_MISMATCH',
      `The bridge maps the USDT resource ID to ${token}, not USDT ${addresses[chainId].usdt}. Do not deposit until this is resolved.`,
    )
  }
  if (decimalScale === 0n) {
    throw new BridgeValidationError(
      'TOKEN_MISMATCH',
      'The bridge reports a USDT decimal scale of 0.',
    )
  }
  return { core, pause, decimalScale }
}

/**
 * Reads the USDT deposit bounds and the minimum fee. The contract stores them in whole USD
 * and scales them by the token's decimal scale (1e6 for USDT); both forms are returned.
 *
 * A deposit must be at least `minAmount` and at most `maxAmount`.
 *
 * @example
 * ```ts
 * const { minAmount, maxAmount } = await getBridgeLimits(client)
 * ```
 */
export async function getBridgeLimits(client: Client): Promise<BridgeLimits> {
  const chainId = clientChainId(client)
  const bridge = router(chainId)
  const [{ decimalScale }, minAmountUsd, maxAmountUsd, minFeeUsd] = await Promise.all([
    readUsdtTokenInfo(client, chainId),
    readContract(client, { ...bridge, functionName: 'getMinAmountUsd' }),
    readContract(client, { ...bridge, functionName: 'getMaxAmountUsd' }),
    readContract(client, { ...bridge, functionName: 'getMinFee' }),
  ])
  return {
    minAmount: minAmountUsd * decimalScale,
    maxAmount: maxAmountUsd * decimalScale,
    minFee: minFeeUsd * decimalScale,
    minAmountUsd,
    maxAmountUsd,
    minFeeUsd,
  }
}

/**
 * Reads the bridge's BOT gas config, for display only.
 *
 * With BOT gas, the destination pays out `amount` of native BOT and takes its USDT cost,
 * quoted from a TWAP oracle, out of the bridged USDT (the `botAmount` and `botCostUsdt`
 * fields of `ExecuteEvent`). On both networks the config's destination is BOT Chain itself,
 * so it applies to bridging into BOT Chain, which the SDK does not build. That is why
 * there is no BOT gas option on `buildBridgeDeposit`.
 *
 * @example
 * ```ts
 * const { enabled, amount } = await getBotGasConfig(client)
 * ```
 */
export async function getBotGasConfig(client: Client): Promise<BotGasConfig> {
  const [cfg, enabled] = await readContract(client, {
    ...router(clientChainId(client)),
    functionName: 'getBotGasConfig',
  })
  return { enabled, ...cfg }
}
