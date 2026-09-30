/**
 * Base class for every error the SDK throws. Check `code` to branch on the failure
 * without relying on message text.
 *
 * @example
 * ```ts
 * import { UzoError } from '@uzolabs/sdk'
 *
 * try {
 *   getAddresses(1 as never)
 * } catch (error) {
 *   if (error instanceof UzoError && error.code === 'UNSUPPORTED_CHAIN') {
 *     // ask the user to switch networks
 *   }
 * }
 * ```
 */
export class UzoError extends Error {
  override name = 'UzoError'
  readonly code: string

  constructor(code: string, message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.code = code
  }
}

/**
 * Thrown when a chain ID is not BOT Chain mainnet (677) or testnet (968).
 *
 * @example
 * ```ts
 * import { UnsupportedChainError } from '@uzolabs/sdk'
 *
 * if (error instanceof UnsupportedChainError) console.log(error.chainId)
 * ```
 */
export class UnsupportedChainError extends UzoError {
  override name = 'UnsupportedChainError'
  readonly chainId: unknown

  constructor(chainId: unknown) {
    super(
      'UNSUPPORTED_CHAIN',
      `Chain ID ${String(chainId)} is not supported. Use 677 (BOT Chain) or 968 (BOT Chain Testnet).`,
    )
    this.chainId = chainId
  }
}

/**
 * Thrown when a value is not a valid EVM address.
 *
 * @example
 * ```ts
 * import { InvalidAddressError } from '@uzolabs/sdk'
 *
 * if (error instanceof InvalidAddressError) console.log(error.address)
 * ```
 */
export class InvalidAddressError extends UzoError {
  override name = 'InvalidAddressError'
  readonly address: unknown

  constructor(address: unknown, label = 'address') {
    super(
      'INVALID_ADDRESS',
      `Invalid ${label}: ${String(address)}. Pass a 0x-prefixed, 20-byte hex address.`,
    )
    this.address = address
  }
}

/**
 * Thrown when requested slippage is above the allowed maximum.
 *
 * @example
 * ```ts
 * import { SlippageTooHighError } from '@uzolabs/sdk'
 *
 * if (error instanceof SlippageTooHighError) console.log(error.maxBps)
 * ```
 */
export class SlippageTooHighError extends UzoError {
  override name = 'SlippageTooHighError'
  readonly slippageBps: number
  readonly maxBps: number

  constructor(slippageBps: number, maxBps: number) {
    super(
      'SLIPPAGE_TOO_HIGH',
      `Slippage of ${slippageBps} bps is above the ${maxBps} bps maximum. Lower it, or opt out of the limit explicitly.`,
    )
    this.slippageBps = slippageBps
    this.maxBps = maxBps
  }
}

/**
 * Thrown when calldata targets a router that is not on the configured allowlist.
 *
 * @example
 * ```ts
 * import { RouterNotAllowedError } from '@uzolabs/sdk'
 *
 * if (error instanceof RouterNotAllowedError) console.log(error.router)
 * ```
 */
export class RouterNotAllowedError extends UzoError {
  override name = 'RouterNotAllowedError'
  readonly router: string

  constructor(router: string) {
    super(
      'ROUTER_NOT_ALLOWED',
      `Router ${router} is not on the allowlist. Add it to your router allowlist config if you trust it.`,
    )
    this.router = router
  }
}

/**
 * Thrown when a required config value is missing. The SDK never guesses unknown
 * values such as API URLs, so you must supply them.
 *
 * @example
 * ```ts
 * import { MissingConfigError } from '@uzolabs/sdk'
 *
 * if (error instanceof MissingConfigError) console.log(error.key)
 * ```
 */
export class MissingConfigError extends UzoError {
  override name = 'MissingConfigError'
  readonly key: string

  constructor(key: string, hint?: string) {
    super(
      'MISSING_CONFIG',
      `Missing required config \`${key}\`. ${hint ?? `Pass \`${key}\` when you create the client.`}`,
    )
    this.key = key
  }
}

/**
 * Thrown when the BOTScan API returns an error or an unexpected response.
 *
 * @example
 * ```ts
 * import { ExplorerError } from '@uzolabs/sdk'
 *
 * if (error instanceof ExplorerError) console.log(error.status, error.url)
 * ```
 */
export class ExplorerError extends UzoError {
  override name = 'ExplorerError'
  readonly status: number | undefined
  readonly url: string

  constructor(
    message: string,
    { url, status, cause }: { url: string; status?: number; cause?: unknown },
  ) {
    super('EXPLORER_ERROR', message, { cause })
    this.url = url
    this.status = status
  }
}

/**
 * Thrown when the paymaster rejects or cannot sponsor a transaction.
 *
 * @example
 * ```ts
 * import { PaymasterError } from '@uzolabs/sdk'
 *
 * if (error instanceof PaymasterError) console.log(error.message)
 * ```
 */
export class PaymasterError extends UzoError {
  override name = 'PaymasterError'

  constructor(message: string, options?: { cause?: unknown }) {
    super('PAYMASTER_ERROR', message, options)
  }
}

/**
 * Thrown when bridge input fails validation (paused bridge, amount out of bounds and so on).
 *
 * @example
 * ```ts
 * import { BridgeValidationError } from '@uzolabs/sdk'
 *
 * if (error instanceof BridgeValidationError) console.log(error.reason)
 * ```
 */
export class BridgeValidationError extends UzoError {
  override name = 'BridgeValidationError'
  readonly reason: string

  constructor(reason: string, message: string) {
    super('BRIDGE_VALIDATION', message)
    this.reason = reason
  }
}
