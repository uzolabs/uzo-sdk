import { describe, expect, it } from 'vitest'
import * as errors from '../../src/utils/errors'

const cases: [errors.UzoError, string][] = [
  [new errors.UnsupportedChainError(1), 'UNSUPPORTED_CHAIN'],
  [new errors.InvalidAddressError('0x123'), 'INVALID_ADDRESS'],
  [new errors.SlippageTooHighError(900, 500), 'SLIPPAGE_TOO_HIGH'],
  [new errors.RouterNotAllowedError('0xabc'), 'ROUTER_NOT_ALLOWED'],
  [new errors.MissingConfigError('routingApiUrl'), 'MISSING_CONFIG'],
  [new errors.ExplorerError('Boom. Retry later.', { url: 'https://x' }), 'EXPLORER_ERROR'],
  [new errors.PaymasterError('Not sponsorable. Pay gas yourself.'), 'PAYMASTER_ERROR'],
  [new errors.BridgeValidationError('paused', 'Bridge is paused. Try later.'), 'BRIDGE_VALIDATION'],
]

describe('errors', () => {
  it.each(cases)('%s has code %s and extends UzoError', (error, code) => {
    expect(error).toBeInstanceOf(errors.UzoError)
    expect(error).toBeInstanceOf(Error)
    expect(error.code).toBe(code)
    expect(error.name).toBe(error.constructor.name)
    // Every message says what went wrong and how to fix it, with no em dashes.
    expect(error.message.split('. ').length).toBeGreaterThan(1)
    expect(error.message).not.toContain(String.fromCharCode(0x2014))
  })
})
