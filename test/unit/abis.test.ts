import { decodeErrorResult, encodeErrorResult } from 'viem'
import { describe, expect, it } from 'vitest'
import { universalRouterAbi } from '../../src/contracts'

describe('universalRouterAbi', () => {
  // These exist only on the testnet build. The ABI merges both deployments so
  // reverts from either network decode.
  it.each([
    ['InvalidHopSlippageLength', []],
    ['V4TooLittleReceivedPerHop', [1n, 2n, 3n]],
    ['V4TooMuchRequestedPerHop', [1n, 2n, 3n]],
    ['V4TooLittleReceived', [1n, 2n]],
  ] as const)('decodes %s', (errorName, args) => {
    const data = encodeErrorResult({ abi: universalRouterAbi, errorName, args } as never)
    const decoded = decodeErrorResult({ abi: universalRouterAbi, data })
    expect(decoded.errorName).toBe(errorName)
    expect(decoded.args ?? []).toEqual(args)
  })
})
