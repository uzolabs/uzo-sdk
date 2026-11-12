import {
  type Abi,
  type AbiFunction,
  createPublicClient,
  custom,
  decodeFunctionData,
  encodeFunctionResult,
  erc20Abi,
  type Hex,
  toFunctionSignature,
} from 'viem'
import { describe, expect, it } from 'vitest'
import {
  BRIDGE_DESTINATIONS,
  buildBridgeDeposit,
  encodeBridgeRecipient,
  getBotGasConfig,
  getBridgeLimits,
  getBridgeStatus,
  prepareBridgeDeposit,
} from '../../src/bridge'
import { botBridgeFragment, coreBridgeFragment } from '../../src/bridge/abis'
import { botChain, botChainTestnet } from '../../src/chains'
import { addresses, botBridgeAbi, USDT_RESOURCE_ID } from '../../src/contracts'
import { BridgeValidationError, UnsupportedChainError } from '../../src/utils'

// Test-only placeholder recipient. Not a real account.
const user = '0x000000000000000000000000000000000000dEaD' as const

// Recipients of real deposits, read from DepositEvent logs, with the T address that
// received the USDT on Tron (mainnet) and Nile (testnet).
const tronVectors = [
  [
    677,
    728126428,
    'TDYiwV12b4EoXpSUb1EuEu7rLDfFVUovw7',
    '0x273F186A3363462feDcD638c939120eCe62aa289',
  ],
  [
    677,
    728126428,
    'TLkJatKJf3Ak8C3RRYMpAn95tuQfZm6kin',
    '0x7638a3023CC814ffbeA56833A1111e5A960886F0',
  ],
  [
    968,
    3448148188,
    'TFL8RDwjb9BscrnUMcd7fUpaqotcvhSZQ5',
    '0x3aCD89c21e443D40c902435abe279311a65939cF',
  ],
  [
    968,
    3448148188,
    'TX5m3FvfgEhHjqpuK1oBC6i9u8DzYcFXcR',
    '0xE797E1921E5e46F640EE6BcEB954f209184CB510',
  ],
] as const

function reasonOf(fn: () => unknown): string | undefined {
  try {
    fn()
  } catch (e) {
    if (e instanceof BridgeValidationError) return e.reason
    throw e
  }
  return undefined
}

async function rejectsWith(promise: Promise<unknown>, reason: string) {
  await expect(promise).rejects.toBeInstanceOf(BridgeValidationError)
  await expect(promise).rejects.toMatchObject({ reason })
}

describe('bridge ABI fragments', () => {
  const sig = (f: AbiFunction) =>
    `${toFunctionSignature(f)} ${f.stateMutability} returns (${f.outputs.map((o) => o.type).join(',')})`

  it('botBridgeFragment matches the generated BotBridge ABI', () => {
    for (const item of botBridgeFragment as readonly AbiFunction[]) {
      const match = (botBridgeAbi as Abi).find(
        (e) => e.type === 'function' && toFunctionSignature(e) === toFunctionSignature(item),
      ) as AbiFunction | undefined
      expect(match, toFunctionSignature(item)).toBeDefined()
      expect(sig(item)).toBe(sig(match as AbiFunction))
    }
  })
})

describe('BRIDGE_DESTINATIONS', () => {
  it('lists the routes the contracts report', () => {
    expect(BRIDGE_DESTINATIONS[677].map((d) => d.chainId)).toEqual([1, 56, 728126428])
    expect(BRIDGE_DESTINATIONS[968].map((d) => d.chainId)).toEqual([97, 11155111, 3448148188])
  })

  it('marks delivery tracked for EVM routes only', () => {
    for (const d of [...BRIDGE_DESTINATIONS[677], ...BRIDGE_DESTINATIONS[968]]) {
      expect(d.tracksDelivery, String(d.chainId)).toBe(d.recipientFormat !== 'tron')
    }
  })
})

describe('encodeBridgeRecipient', () => {
  it.each(tronVectors)('encodes %s -> %s %s as its 20-byte body', (chainId, dest, tron, hex) => {
    expect(encodeBridgeRecipient({ chainId, destinationChainId: dest, recipient: tron })).toBe(hex)
  })

  it('rejects a 0x address for Tron', () => {
    const reason = reasonOf(() =>
      encodeBridgeRecipient({ chainId: 677, destinationChainId: 728126428, recipient: user }),
    )
    expect(reason).toBe('INVALID_RECIPIENT')
  })

  it('rejects a Tron address with a bad checksum', () => {
    // Last character changed from 7 to 8.
    const reason = reasonOf(() =>
      encodeBridgeRecipient({
        chainId: 677,
        destinationChainId: 728126428,
        recipient: 'TDYiwV12b4EoXpSUb1EuEu7rLDfFVUovw8',
      }),
    )
    expect(reason).toBe('INVALID_RECIPIENT')
  })

  it.each([
    '',
    'TDYiwV12b4EoXpSUb1EuEu7rLDfFVUovw',
    'TDYiwV12b4EoXpSUb1EuEu7rLDfFVUov0O',
    'ADYiwV12b4EoXpSUb1EuEu7rLDfFVUovw7',
  ])('rejects malformed Tron address %j', (recipient) => {
    expect(
      reasonOf(() =>
        encodeBridgeRecipient({ chainId: 677, destinationChainId: 728126428, recipient }),
      ),
    ).toBe('INVALID_RECIPIENT')
  })

  it('rejects the Tron zero address', () => {
    // 0x41 followed by 20 zero bytes, base58check encoded.
    expect(
      reasonOf(() =>
        encodeBridgeRecipient({
          chainId: 677,
          destinationChainId: 728126428,
          recipient: 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb',
        }),
      ),
    ).toBe('INVALID_RECIPIENT')
  })

  it('checksums EVM recipients and rejects bad ones', () => {
    expect(
      encodeBridgeRecipient({
        chainId: 677,
        destinationChainId: 56,
        recipient: '0x000000000000000000000000000000000000dead',
      }),
    ).toBe(user)
    for (const recipient of [
      '0x1234',
      'TDYiwV12b4EoXpSUb1EuEu7rLDfFVUovw7',
      '0x' + '0'.repeat(40),
    ]) {
      expect(
        reasonOf(() => encodeBridgeRecipient({ chainId: 677, destinationChainId: 1, recipient })),
      ).toBe('INVALID_RECIPIENT')
    }
  })

  it('rejects destinations that are not on the source network', () => {
    for (const [chainId, dest] of [
      [677, 97],
      [677, 677],
      [968, 56],
      [968, 728126428],
      [677, 10],
    ] as const) {
      expect(
        reasonOf(() =>
          encodeBridgeRecipient({ chainId, destinationChainId: dest, recipient: user }),
        ),
      ).toBe('UNSUPPORTED_DESTINATION')
    }
  })
})

describe('buildBridgeDeposit', () => {
  const amount = 25_000_000n

  it('approves exactly the amount and deposits with value 0', () => {
    const { approve, deposit } = buildBridgeDeposit({
      chainId: 677,
      destinationChainId: 728126428,
      recipient: 'TDYiwV12b4EoXpSUb1EuEu7rLDfFVUovw7',
      amount,
    })
    const book = addresses[677]
    expect(approve.to).toBe(book.usdt)
    expect(approve.value).toBe(0n)
    expect(decodeFunctionData({ abi: erc20Abi, data: approve.data })).toEqual({
      functionName: 'approve',
      args: [book.bridgeRouter, amount],
    })
    expect(deposit.to).toBe(book.bridgeRouter)
    expect(deposit.value).toBe(0n)
    expect(decodeFunctionData({ abi: botBridgeFragment, data: deposit.data })).toEqual({
      functionName: 'deposit',
      args: [728126428n, USDT_RESOURCE_ID, '0x273F186A3363462feDcD638c939120eCe62aa289', amount],
    })
  })

  it.each([0n, -1n, 1, '1', undefined])('rejects amount %s', (bad) => {
    expect(
      reasonOf(() =>
        buildBridgeDeposit({
          chainId: 968,
          destinationChainId: 11155111,
          recipient: user,
          amount: bad as bigint,
        }),
      ),
    ).toBe('INVALID_AMOUNT')
  })

  it('rejects unknown source chains', () => {
    expect(() =>
      buildBridgeDeposit({ chainId: 1 as 677, destinationChainId: 56, recipient: user, amount }),
    ).toThrow(UnsupportedChainError)
  })
})

type BridgeState = {
  bridgePaused: boolean
  usdtPaused: boolean
  minUsd: bigint
  maxUsd: bigint
  minFeeUsd: bigint
  feeBps: bigint
  route: boolean
  token: Hex
  assetsType: number
  decimalScale: bigint
}

const core = '0x00000000000000000000000000000000000c0e00' as const
const abi = [...botBridgeFragment, ...coreBridgeFragment] as const

function mockClient(chainId: 677 | 968, overrides: Partial<BridgeState> = {}) {
  const s: BridgeState = {
    bridgePaused: false,
    usdtPaused: false,
    minUsd: 10n,
    maxUsd: 100_000n,
    minFeeUsd: 1n,
    feeBps: 10n,
    route: true,
    token: addresses[chainId].usdt,
    assetsType: 1,
    decimalScale: 1_000_000n,
    ...overrides,
  }
  const results: Record<string, (args: readonly unknown[]) => unknown> = {
    Bridge: () => core,
    getBridgePause: () => s.bridgePaused,
    getTokenPauseByResourceId: () => s.usdtPaused,
    getMinAmountUsd: () => s.minUsd,
    getMaxAmountUsd: () => s.maxUsd,
    getMinFee: () => s.minFeeUsd,
    getBotGasConfig: () => [
      {
        destinationChainId: BigInt(chainId),
        resourceId: USDT_RESOURCE_ID,
        amount: 10n ** 17n,
        oracle: user,
        baseToken: user,
        quoteToken: user,
        twapWindow: 1800,
      },
      true,
    ],
    getTokenInfoByResourceId: () => [
      s.assetsType,
      s.token,
      s.usdtPaused,
      s.decimalScale,
      false,
      false,
    ],
    chainAndTokenFee: () => s.feeBps,
    isSupportedRoute: () => s.route,
  }
  return createPublicClient({
    chain: chainId === 677 ? botChain : botChainTestnet,
    transport: custom({
      async request({ method, params }) {
        if (method !== 'eth_call') throw new Error(`unexpected ${method}`)
        const { functionName, args } = decodeFunctionData({ abi, data: params[0].data })
        const result = results[functionName]?.(args ?? [])
        return encodeFunctionResult({ abi, functionName, result } as never)
      },
    }),
  })
}

describe('bridge reads (mocked)', () => {
  it('reads status, scaled limits and the BOT gas config', async () => {
    const client = mockClient(677, { usdtPaused: true })
    expect(await getBridgeStatus(client)).toEqual({ bridgePaused: false, usdtPaused: true })
    expect(await getBridgeLimits(client)).toEqual({
      minAmount: 10_000_000n,
      maxAmount: 100_000_000_000n,
      minFee: 1_000_000n,
      minAmountUsd: 10n,
      maxAmountUsd: 100_000n,
      minFeeUsd: 1n,
    })
    expect(await getBotGasConfig(client)).toMatchObject({ enabled: true, destinationChainId: 677n })
  })

  it('refuses a bridge that maps the USDT resource ID to another token', async () => {
    await rejectsWith(getBridgeLimits(mockClient(677, { token: user })), 'TOKEN_MISMATCH')
    await rejectsWith(getBridgeLimits(mockClient(677, { assetsType: 0 })), 'TOKEN_MISMATCH')
  })
})

describe('prepareBridgeDeposit (mocked)', () => {
  const args = { destinationChainId: 11155111, recipient: user, amount: 100_000_000n }

  it('returns the calls with the fee the contract will take', async () => {
    const out = await prepareBridgeDeposit(mockClient(968), { ...args, amount: 2_000_000_000n })
    // 10 bps of 2000 USDT is 2 USDT, above the 1 USDT minimum.
    expect(out.fee).toBe(2_000_000n)
    expect(out.receiveAmount).toBe(1_998_000_000n)
    expect(out.feeBps).toBe(10n)
    expect(out.approve.to).toBe(addresses[968].usdt)
    expect(out.deposit.value).toBe(0n)
  })

  it('raises a small fee to the minimum fee', async () => {
    // 10 bps of 100 USDT is 0.1 USDT, raised to 1 USDT.
    const out = await prepareBridgeDeposit(mockClient(968), args)
    expect(out.fee).toBe(1_000_000n)
    expect(out.receiveAmount).toBe(99_000_000n)
  })

  it('charges no fee on a zero-fee route', async () => {
    const out = await prepareBridgeDeposit(mockClient(968, { feeBps: 0n }), args)
    expect(out.fee).toBe(0n)
    expect(out.receiveAmount).toBe(args.amount)
  })

  it.each([
    [{ bridgePaused: true }, 'BRIDGE_PAUSED'],
    [{ usdtPaused: true }, 'TOKEN_PAUSED'],
    [{ route: false }, 'ROUTE_NOT_SUPPORTED'],
    [{ minUsd: 101n }, 'AMOUNT_BELOW_MIN'],
    [{ maxUsd: 99n }, 'AMOUNT_ABOVE_MAX'],
    [{ minUsd: 0n, minFeeUsd: 100n }, 'AMOUNT_NOT_ABOVE_FEE'],
    [{ token: user }, 'TOKEN_MISMATCH'],
  ] as const)('case %# throws the expected reason', async (state, reason) => {
    await rejectsWith(prepareBridgeDeposit(mockClient(968, state), args), reason)
  })

  it('accepts the exact minimum and maximum', async () => {
    await expect(
      prepareBridgeDeposit(mockClient(968, { minUsd: 100n }), args),
    ).resolves.toBeDefined()
    await expect(
      prepareBridgeDeposit(mockClient(968, { maxUsd: 100n }), args),
    ).resolves.toBeDefined()
  })

  it('validates input before any RPC call', async () => {
    const client = createPublicClient({
      chain: botChain,
      transport: custom({
        async request() {
          throw new Error('no RPC expected')
        },
      }),
    })
    await rejectsWith(prepareBridgeDeposit(client, args), 'UNSUPPORTED_DESTINATION')
    await rejectsWith(
      prepareBridgeDeposit(client, { ...args, destinationChainId: 728126428 }),
      'INVALID_RECIPIENT',
    )
  })
})
