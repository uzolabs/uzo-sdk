import {
  type Abi,
  type AbiFunction,
  decodeFunctionData,
  erc20Abi,
  maxUint160,
  toFunctionSignature,
} from 'viem'
import { describe, expect, it } from 'vitest'
import {
  applySlippage,
  buildErc20Approve,
  buildExactInputSingleV3,
  buildPermit2Approve,
  buildSwapExactTokensForTokensV2,
} from '../../src/bdex'
import * as fragments from '../../src/bdex/abis'
import {
  addresses,
  bdexV2Router02Abi,
  bdexV3FactoryAbi,
  bdexV3QuoterV2Abi,
  bdexV3SwapRouterAbi,
  permit2Abi,
} from '../../src/contracts'
import { RouterNotAllowedError, SlippageTooHighError, UzoError } from '../../src/utils'

// Test-only placeholder recipient. Not a real account.
const user = '0x000000000000000000000000000000000000dEaD' as const
type V3Params = { amountOutMinimum: bigint }
const nowSeconds = () => BigInt(Math.floor(Date.now() / 1000))
const deadline = nowSeconds() + 1200n

describe('bdex ABI fragments', () => {
  const sources: [string, Abi, Abi][] = [
    ['v2RouterFragment', fragments.v2RouterFragment, bdexV2Router02Abi],
    ['v3FactoryFragment', fragments.v3FactoryFragment, bdexV3FactoryAbi],
    ['v3QuoterV2Fragment', fragments.v3QuoterV2Fragment, bdexV3QuoterV2Abi],
    ['v3SwapRouterFragment', fragments.v3SwapRouterFragment, bdexV3SwapRouterAbi],
    ['permit2ApproveFragment', fragments.permit2ApproveFragment, permit2Abi],
  ]
  const sig = (f: AbiFunction) =>
    `${toFunctionSignature(f)} ${f.stateMutability} returns (${f.outputs.map((o) => o.type).join(',')})`

  it.each(sources)('%s matches the generated ABI', (_name, fragment, full) => {
    for (const item of fragment as readonly AbiFunction[]) {
      const match = (full as readonly AbiFunction[]).find(
        (e) => e.type === 'function' && toFunctionSignature(e) === toFunctionSignature(item),
      )
      expect(match, toFunctionSignature(item)).toBeDefined()
      expect(sig(item)).toBe(sig(match as AbiFunction))
    }
  })
})

describe('applySlippage', () => {
  it('defaults to 0.5%', () => {
    expect(applySlippage(10_000n)).toBe(9_950n)
  })
  it('accepts 0 and the 5% cap', () => {
    expect(applySlippage(10_000n, { slippageTolerance: 0 })).toBe(10_000n)
    expect(applySlippage(10_000n, { slippageTolerance: 5 })).toBe(9_500n)
  })
  it('rounds down', () => {
    expect(applySlippage(999n, { slippageTolerance: 1 })).toBe(989n)
  })
  it('throws above 5% with no opt-out', () => {
    const error = (() => {
      try {
        // @ts-expect-error allowHighSlippage is not an option
        applySlippage(10_000n, { slippageTolerance: 5.01, allowHighSlippage: true })
      } catch (e) {
        return e
      }
    })()
    expect(error).toBeInstanceOf(SlippageTooHighError)
    expect(error).toMatchObject({ slippageBps: 501, maxBps: 500 })
  })
  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])('rejects %s', (slippageTolerance) => {
    expect(() => applySlippage(10_000n, { slippageTolerance })).toThrow(UzoError)
  })
  it('rejects a zero quote', () => {
    expect(() => applySlippage(0n)).toThrow(/amountOut/)
  })
})

describe.each([677, 968] as const)('builders on chain %i', (chainId) => {
  const book = addresses[chainId]

  const v2Base = {
    chainId,
    amountIn: 1_000_000n,
    quotedAmountOut: 10_000n,
    path: [book.usdt, book.wbot],
    to: user,
    deadline,
  }
  const v3Base = {
    chainId,
    tokenIn: book.usdt,
    tokenOut: book.wbot,
    fee: 3000,
    amountIn: 5n,
    quotedAmountOut: 10_000n,
    recipient: user,
    deadline,
  }
  const v2Min = (data: `0x${string}`) =>
    decodeFunctionData({ abi: bdexV2Router02Abi, data }).args?.[1]
  const v3Min = (data: `0x${string}`) =>
    (decodeFunctionData({ abi: bdexV3SwapRouterAbi, data }).args as unknown as [V3Params])[0]
      .amountOutMinimum

  it('buildSwapExactTokensForTokensV2 targets Router02 and round-trips', () => {
    const tx = buildSwapExactTokensForTokensV2({
      ...v2Base,
      path: [book.usdt.toLowerCase() as `0x${string}`, book.wbot],
    })
    expect(tx.to).toBe(book.bdexV2Router02)
    expect(tx.value).toBe(0n)
    const { functionName, args } = decodeFunctionData({ abi: bdexV2Router02Abi, data: tx.data })
    expect(functionName).toBe('swapExactTokensForTokens')
    expect(args).toEqual([1_000_000n, 9_950n, [book.usdt, book.wbot], user, deadline])
  })

  it.each([undefined, 0, 0.3, 1, 5])(
    'swap builders encode exactly applySlippage(quotedAmountOut) at %s%%',
    (slippageTolerance) => {
      const quotedAmountOut = 123_456_789n
      const opts = slippageTolerance === undefined ? {} : { slippageTolerance }
      const expected = applySlippage(quotedAmountOut, opts)
      expect(
        v2Min(buildSwapExactTokensForTokensV2({ ...v2Base, ...opts, quotedAmountOut }).data),
      ).toBe(expected)
      expect(v3Min(buildExactInputSingleV3({ ...v3Base, ...opts, quotedAmountOut }).data)).toBe(
        expected,
      )
    },
  )

  it('swap builders throw SlippageTooHighError above 5%', () => {
    expect(() => buildSwapExactTokensForTokensV2({ ...v2Base, slippageTolerance: 5.01 })).toThrow(
      SlippageTooHighError,
    )
    expect(() => buildExactInputSingleV3({ ...v3Base, slippageTolerance: 5.01 })).toThrow(
      SlippageTooHighError,
    )
  })

  it('swap builders accept no raw minimum', () => {
    expect(() =>
      // @ts-expect-error amountOutMin is not a parameter
      buildSwapExactTokensForTokensV2({ ...v2Base, amountOutMin: 1n }),
    ).toThrow(/amountOutMin is not accepted/)
    expect(() =>
      // @ts-expect-error amountOutMinimum is not a parameter
      buildExactInputSingleV3({ ...v3Base, amountOutMinimum: 1n }),
    ).toThrow(/amountOutMinimum is not accepted/)
    // Even alongside a valid quote, a raw minimum is refused rather than ignored.
    expect(() =>
      // @ts-expect-error amountOutMinimum is not a parameter
      buildExactInputSingleV3({ ...v3Base, amountOutMinimum: 1n, slippageTolerance: 0 }),
    ).toThrow(UzoError)
  })

  it('swap builders reject a quote whose minimum rounds to 0', () => {
    expect(() => buildSwapExactTokensForTokensV2({ ...v2Base, quotedAmountOut: 1n })).toThrow(
      /amountOutMin rounds down to 0/,
    )
    expect(() => buildExactInputSingleV3({ ...v3Base, quotedAmountOut: 0n })).toThrow(
      /quotedAmountOut/,
    )
  })

  it.each([
    ['in the past', () => nowSeconds() - 1n, /deadline is in the past/],
    ['now', () => nowSeconds(), /deadline is in the past/],
    ['over 1 hour ahead', () => nowSeconds() + 3700n, /deadline is more than 1 hour ahead/],
    ['in milliseconds', () => BigInt(Date.now() + 60_000), /deadline is more than 1 hour ahead/],
  ])('swap builders reject a deadline %s', (_label, make, message) => {
    expect(() => buildSwapExactTokensForTokensV2({ ...v2Base, deadline: make() })).toThrow(message)
    expect(() => buildExactInputSingleV3({ ...v3Base, deadline: make() })).toThrow(message)
  })

  it('swap builders accept a deadline up to 1 hour ahead', () => {
    const atLimit = nowSeconds() + 3590n
    expect(buildSwapExactTokensForTokensV2({ ...v2Base, deadline: atLimit }).to).toBe(
      book.bdexV2Router02,
    )
  })

  it('buildSwapExactTokensForTokensV2 rejects bad input', () => {
    const base = v2Base
    expect(() => buildSwapExactTokensForTokensV2({ ...base, amountIn: 0n })).toThrow(/amountIn/)
    expect(() => buildSwapExactTokensForTokensV2({ ...base, path: [book.usdt] })).toThrow(/path/)
    expect(() =>
      buildSwapExactTokensForTokensV2({ ...base, path: [book.usdt, book.usdt] }),
    ).toThrow(/path/)
    expect(() => buildSwapExactTokensForTokensV2({ ...base, to: '0x123' })).toThrow(UzoError)
    // @ts-expect-error unsupported chain
    expect(() => buildSwapExactTokensForTokensV2({ ...base, chainId: 1 })).toThrow(UzoError)
  })

  it('buildExactInputSingleV3 targets SwapRouter and round-trips', () => {
    const tx = buildExactInputSingleV3(v3Base)
    expect(tx.to).toBe(book.bdexV3SwapRouter)
    const { functionName, args } = decodeFunctionData({ abi: bdexV3SwapRouterAbi, data: tx.data })
    expect(functionName).toBe('exactInputSingle')
    expect(args).toEqual([
      {
        tokenIn: book.usdt,
        tokenOut: book.wbot,
        fee: 3000,
        recipient: user,
        deadline,
        amountIn: 5n,
        amountOutMinimum: 9_950n,
        sqrtPriceLimitX96: 0n,
      },
    ])
  })

  it('buildExactInputSingleV3 rejects bad input', () => {
    const base = v3Base
    expect(() => buildExactInputSingleV3({ ...base, fee: 2 ** 24 })).toThrow(/fee/)
    expect(() => buildExactInputSingleV3({ ...base, fee: 1.5 })).toThrow(/fee/)
    expect(() => buildExactInputSingleV3({ ...base, tokenOut: book.usdt })).toThrow(/tokenOut/)
  })

  it.each(['bdexV2Router02', 'bdexV3SwapRouter', 'universalRouter', 'permit2'] as const)(
    'buildErc20Approve allows %s',
    (key) => {
      const tx = buildErc20Approve({ chainId, token: book.usdt, spender: book[key], amount: 7n })
      expect(tx).toMatchObject({ to: book.usdt, value: 0n })
      const { functionName, args } = decodeFunctionData({ abi: erc20Abi, data: tx.data })
      expect(functionName).toBe('approve')
      expect(args).toEqual([book[key], 7n])
    },
  )

  it('buildErc20Approve rejects other spenders', () => {
    expect(() =>
      buildErc20Approve({ chainId, token: book.usdt, spender: user, amount: 1n }),
    ).toThrow(RouterNotAllowedError)
    expect(() =>
      buildErc20Approve({ chainId, token: book.usdt, spender: book.bridgeRouter, amount: 1n }),
    ).toThrow(RouterNotAllowedError)
  })

  it('buildPermit2Approve targets this network Permit2 and round-trips', () => {
    const tx = buildPermit2Approve({
      chainId,
      token: book.usdt,
      spender: book.universalRouter,
      amount: maxUint160,
      expiration: 2_000_000_000,
    })
    expect(tx).toMatchObject({ to: book.permit2, value: 0n })
    const { functionName, args } = decodeFunctionData({ abi: permit2Abi, data: tx.data })
    expect(functionName).toBe('approve')
    expect(args).toEqual([book.usdt, book.universalRouter, maxUint160, 2_000_000_000])
  })

  it('buildPermit2Approve rejects bad input', () => {
    const base = {
      chainId,
      token: book.usdt,
      spender: book.universalRouter,
      amount: 1n,
      expiration: 1,
    }
    expect(() => buildPermit2Approve({ ...base, spender: book.permit2 })).toThrow(
      RouterNotAllowedError,
    )
    expect(() => buildPermit2Approve({ ...base, spender: user })).toThrow(RouterNotAllowedError)
    expect(() => buildPermit2Approve({ ...base, amount: maxUint160 + 1n })).toThrow(/amount/)
    expect(() => buildPermit2Approve({ ...base, expiration: 2 ** 48 })).toThrow(/expiration/)
    expect(() => buildPermit2Approve({ ...base, expiration: 0 })).toThrow(/expiration/)
  })
})

it('a Universal Router from the other network is not allowed', () => {
  expect(() =>
    buildPermit2Approve({
      chainId: 677,
      token: addresses[677].usdt,
      spender: addresses[968].universalRouter,
      amount: 1n,
      expiration: 1,
    }),
  ).toThrow(RouterNotAllowedError)
})
