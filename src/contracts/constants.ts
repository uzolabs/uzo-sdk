import { externalBridgeAddresses } from './addresses'

/**
 * Bridge resource ID for USDT. The same value is used on every bridged network.
 *
 * @example
 * ```ts
 * import { USDT_RESOURCE_ID } from '@uzolabs/sdk/contracts'
 * ```
 */
export const USDT_RESOURCE_ID =
  '0xac589789ed8c9d2c61f17b13369864b5f181e58eba230a6ee4ec4c3e7750cd1d' as const

/**
 * Decimals of the tokens the SDK works with. USDT on BOT Chain uses 6 decimals.
 *
 * @example
 * ```ts
 * import { parseUnits } from 'viem'
 * import { TOKENS } from '@uzolabs/sdk/contracts'
 *
 * const amount = parseUnits('10', TOKENS.USDT.decimals) // 10_000_000n
 * ```
 */
export const TOKENS = {
  BOT: { decimals: 18 },
  USDT: { decimals: 6 },
} as const

/**
 * Bridge gateway and USDT addresses on Ethereum (1) and BNB Smart Chain (56).
 * The gateway ABIs are not published yet, so the SDK does not call these contracts.
 *
 * @experimental
 * @example
 * ```ts
 * import { EXTERNAL_BRIDGE } from '@uzolabs/sdk/contracts'
 *
 * EXTERNAL_BRIDGE[56].bridgeGateway
 * ```
 */
export const EXTERNAL_BRIDGE = externalBridgeAddresses
