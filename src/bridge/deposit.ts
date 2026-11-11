import { type Client, encodeFunctionData, erc20Abi, maxUint256 } from 'viem'
import { readContract } from 'viem/actions'
import { clientChainId, type TxRequest } from '../bdex/shared'
import { addresses } from '../contracts/addresses'
import { USDT_RESOURCE_ID } from '../contracts/constants'
import { BridgeValidationError } from '../utils/errors'
import { assertChainId, type SupportedChainId } from '../utils/validation'
import { botBridgeFragment, coreBridgeFragment } from './abis'
import { getBridgeLimits, getBridgeStatus, readUsdtTokenInfo } from './reads'
import { encodeBridgeRecipient } from './recipient'

/** The two calls a bridge deposit needs, in order: approve first, then deposit. */
export type BridgeDepositCalls = {
  /** `USDT.approve(bridgeRouter, amount)`, for exactly the deposit amount. */
  approve: TxRequest
  /** `BotBridge.deposit(...)` with `value` 0. */
  deposit: TxRequest
}

/** What `prepareBridgeDeposit` returns: the calls plus the fee the contract will take. */
export type PreparedBridgeDeposit = BridgeDepositCalls & {
  /** Fee taken from the USDT amount, in USDT base units. No BOT is charged. */
  fee: bigint
  /**
   * `amount - fee`, in BOT Chain USDT base units (6 decimals). The recipient receives the same
   * value expressed in the destination token's decimals (for example 18 on BSC).
   */
  receiveAmount: bigint
  /** The route's fee rate in basis points, before the minimum fee is applied. */
  feeBps: bigint
}

type DepositArgs = {
  destinationChainId: number
  /** 0x address for EVM destinations, base58 `T...` address for Tron. */
  recipient: string
  /** USDT to bridge, in base units (6 decimals). The fee comes out of this. */
  amount: bigint
}

function assertDepositAmount(amount: unknown): bigint {
  if (typeof amount !== 'bigint' || amount <= 0n || amount > maxUint256) {
    throw new BridgeValidationError(
      'INVALID_AMOUNT',
      `amount must be a bigint above 0, in USDT base units (6 decimals), not ${String(amount)}.`,
    )
  }
  return amount
}

/**
 * Builds the unsigned USDT `approve` and `BotBridge.deposit` calls for a deposit from
 * BOT Chain. **It does not check status or limits.** Use `prepareBridgeDeposit` unless you
 * have already read them yourself; a deposit that breaks them reverts and wastes gas.
 *
 * It does validate the destination and recipient (see `encodeBridgeRecipient`), and it
 * approves exactly `amount`, never more. The contract pulls `amount - fee` into the bridge
 * and `fee` to the fee address, `amount` in total, so the exact approval always suffices.
 * `deposit.value` is always 0: the fee is paid in USDT, and BOT sent with a USDT deposit
 * would be stuck in the contract.
 *
 * @example
 * ```ts
 * const { approve, deposit } = buildBridgeDeposit({
 *   chainId: 677,
 *   destinationChainId: 56,
 *   recipient: '0x...',
 *   amount: 25_000_000n, // 25 USDT
 * })
 * ```
 */
export function buildBridgeDeposit({
  chainId,
  destinationChainId,
  recipient,
  amount,
}: DepositArgs & { chainId: SupportedChainId }): BridgeDepositCalls {
  assertChainId(chainId)
  const encodedRecipient = encodeBridgeRecipient({ chainId, destinationChainId, recipient })
  const value = assertDepositAmount(amount)
  const { usdt, bridgeRouter } = addresses[chainId]
  return {
    approve: {
      to: usdt,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [bridgeRouter, value],
      }),
      value: 0n,
    },
    deposit: {
      to: bridgeRouter,
      data: encodeFunctionData({
        abi: botBridgeFragment,
        functionName: 'deposit',
        args: [BigInt(destinationChainId), USDT_RESOURCE_ID, encodedRecipient, value],
      }),
      value: 0n,
    },
  }
}

/**
 * Checks a USDT deposit against the bridge's live state, then builds its calls. This is
 * the recommended way to bridge out of BOT Chain.
 *
 * It reads, on the client's network:
 * - whether the bridge or USDT bridging is paused,
 * - the route to `destinationChainId` (`isSupportedRoute`),
 * - the deposit bounds, and
 * - the route's fee.
 *
 * It throws `BridgeValidationError` when the deposit would revert, with `reason` set to
 * `UNSUPPORTED_DESTINATION`, `INVALID_RECIPIENT`, `INVALID_AMOUNT`, `BRIDGE_PAUSED`,
 * `TOKEN_PAUSED`, `ROUTE_NOT_SUPPORTED`, `AMOUNT_BELOW_MIN`, `AMOUNT_ABOVE_MAX`,
 * `AMOUNT_NOT_ABOVE_FEE` or `TOKEN_MISMATCH`.
 *
 * **The fee** is charged in USDT only, out of `amount`. It is `amount * feeBps / 10000`,
 * raised to the minimum fee when it is above 0. `receiveAmount` is `amount - fee` in BOT Chain
 * USDT base units (6 decimals); the recipient receives the same value expressed in the
 * destination token's decimals (for example 18 on BSC). No BOT is charged and `value` is
 * always 0.
 *
 * State can change between this call and the user signing, and the contract also blocks
 * blacklisted senders and recipients, which the SDK cannot see. The contract's own checks
 * still apply.
 *
 * @example
 * ```ts
 * import { prepareBridgeDeposit } from '@uzolabs/sdk/bridge'
 *
 * const { approve, deposit, fee, receiveAmount } = await prepareBridgeDeposit(client, {
 *   destinationChainId: 56,
 *   recipient: '0x...',
 *   amount: 25_000_000n, // 25 USDT
 * })
 * // The user's wallet signs and sends approve, waits for it, then deposit.
 * ```
 */
export async function prepareBridgeDeposit(
  client: Client,
  { destinationChainId, recipient, amount }: DepositArgs,
): Promise<PreparedBridgeDeposit> {
  const chainId = clientChainId(client)
  // Input checks first, so bad input never costs an RPC round trip.
  const calls = buildBridgeDeposit({ chainId, destinationChainId, recipient, amount })

  const [status, limits, { core }] = await Promise.all([
    getBridgeStatus(client),
    getBridgeLimits(client),
    readUsdtTokenInfo(client, chainId),
  ])
  if (status.bridgePaused) {
    throw new BridgeValidationError('BRIDGE_PAUSED', 'The bridge is paused. Try again later.')
  }
  if (status.usdtPaused) {
    throw new BridgeValidationError('TOKEN_PAUSED', 'USDT bridging is paused. Try again later.')
  }

  const [routeOpen, feeBps] = await Promise.all([
    readContract(client, {
      address: core,
      abi: coreBridgeFragment,
      functionName: 'isSupportedRoute',
      args: [BigInt(chainId), BigInt(destinationChainId)],
    }),
    readContract(client, {
      address: core,
      abi: coreBridgeFragment,
      functionName: 'chainAndTokenFee',
      args: [BigInt(destinationChainId), USDT_RESOURCE_ID],
    }),
  ])
  if (!routeOpen) {
    throw new BridgeValidationError(
      'ROUTE_NOT_SUPPORTED',
      `The bridge has closed the route from chain ${chainId} to ${destinationChainId}.`,
    )
  }
  if (amount < limits.minAmount) {
    throw new BridgeValidationError(
      'AMOUNT_BELOW_MIN',
      `amount ${amount} is below the minimum deposit of ${limits.minAmount} (${limits.minAmountUsd} USD).`,
    )
  }
  if (amount > limits.maxAmount) {
    throw new BridgeValidationError(
      'AMOUNT_ABOVE_MAX',
      `amount ${amount} is above the maximum deposit of ${limits.maxAmount} (${limits.maxAmountUsd} USD).`,
    )
  }

  // Mirrors BotBridge._computeFeeAmounts in the verified source (feeBps comes from
  // Bridge.chainAndTokenFee in BotBridge._deposit): feeAmount = amount * feeBps / 10000; only
  // when feeAmount > 0 is it raised to Bridge.minFee() (scaled to USDT decimals), so a feeBps of
  // 0 gives a fee of 0; then it requires amount > fee.
  const rawFee = (amount * feeBps) / 10_000n
  const fee = rawFee > 0n && rawFee < limits.minFee ? limits.minFee : rawFee
  if (amount <= fee) {
    throw new BridgeValidationError(
      'AMOUNT_NOT_ABOVE_FEE',
      `amount ${amount} does not cover the fee of ${fee}. Deposit more.`,
    )
  }
  return { ...calls, fee, receiveAmount: amount - fee, feeBps }
}
