import {
  type AbiEvent,
  type Address,
  createPublicClient,
  decodeEventLog,
  type Hash,
  http,
  isAddressEqual,
  toEventSelector,
} from 'viem'
import { describe, expect, it } from 'vitest'
import { botChain, botChainTestnet } from '../../src/chains'
import {
  addresses,
  bdexV2FactoryAbi,
  bdexV2PairAbi,
  bdexV3FactoryAbi,
  bdexV3PoolAbi,
  botBridgeAbi,
  botBridgeLegacyEventsAbi,
  permit2Abi,
  universalRouterAbi,
  wbotAbi,
} from '../../src/contracts'

// Read only. Every event in an SDK ABI is checked against a real log on chain: its topic0
// must equal the selector computed from the ABI, and the log must decode with named args.
// Events that have never been emitted on either network are listed in NOT_EMITTED instead.

const clients = {
  677: createPublicClient({ chain: botChain, transport: http() }),
  968: createPublicClient({ chain: botChainTestnet, transport: http() }),
} as const

type ChainId = keyof typeof clients
type Contract =
  | 'wbot'
  | 'bdexV2Factory'
  | 'bdexV2Pair'
  | 'bdexV3Factory'
  | 'bdexV3Pool'
  | 'permit2'
  | 'universalRouter'
  | 'bridgeRouter'

const abis = {
  wbot: wbotAbi,
  bdexV2Factory: bdexV2FactoryAbi,
  bdexV2Pair: bdexV2PairAbi,
  bdexV3Factory: bdexV3FactoryAbi,
  bdexV3Pool: bdexV3PoolAbi,
  permit2: permit2Abi,
  universalRouter: universalRouterAbi,
  bridgeRouter: botBridgeAbi,
} as const

const events = (abi: readonly unknown[]) =>
  (abi as readonly { type: string }[]).filter((e): e is AbiEvent => e.type === 'event')

const legacy = (name: string) => {
  const event = events(botBridgeLegacyEventsAbi).find((e) => e.name === name)
  if (!event) throw new Error(`No legacy event ${name}.`)
  return event
}

// Pairs and pools have no fixed address in the SDK. These are the instances the ABIs were
// generated from (scripts/fetch-abis.ts): the first mainnet V2 pair and the mainnet
// WBOT/USDT 0.3% V3 pool. Test data only.
const INSTANCES: Partial<Record<Contract, Address>> = {
  bdexV2Pair: '0xdc7547f3cEa82C6Af7fd420656cE532C6da9b98d',
  bdexV3Pool: '0x64F418471a1A7932a190E10da5A8551dB5AbeC05',
}

const contractAddress = (chainId: ChainId, contract: Contract): Address => {
  const instance = INSTANCES[contract]
  if (instance) return instance
  return addresses[chainId][contract as keyof (typeof addresses)[ChainId]]
}

type Fixture = { chainId: ChainId; contract: Contract; event: string | AbiEvent; tx: Hash }

const fixtures: Fixture[] = [
  // Mainnet
  {
    chainId: 677,
    contract: 'wbot',
    event: 'Deposit',
    tx: '0x1213cfde53fa2e9fbfba45b616d548007e025f508626575fae20a317743e33f0',
  },
  {
    chainId: 677,
    contract: 'wbot',
    event: 'Transfer',
    tx: '0x1213cfde53fa2e9fbfba45b616d548007e025f508626575fae20a317743e33f0',
  },
  {
    chainId: 677,
    contract: 'wbot',
    event: 'Approval',
    tx: '0x2a68cd86334a8458a57f99b1cc640b6e1758aaf7ef1395fb257b982b3c3a9037',
  },
  {
    chainId: 677,
    contract: 'wbot',
    event: 'Withdrawal',
    tx: '0x1614736d3a7ff8740a590e7802190275909b0e0d41d5851156b669ae9fc1e49a',
  },
  {
    chainId: 677,
    contract: 'bdexV2Factory',
    event: 'PairCreated',
    tx: '0xf9f68654639cbf3c3e5b4164f6fedf512c2fe72764f35ee633130cbdd65549db',
  },
  {
    chainId: 677,
    contract: 'bdexV3Factory',
    event: 'PoolCreated',
    tx: '0xc55a26738a332a4b74af424d65728ea21c05ad1f72f7b0f1698571250eeba6e0',
  },
  {
    chainId: 677,
    contract: 'bdexV3Factory',
    event: 'OwnerChanged',
    tx: '0x66b680b0f5ed9eb03d8e475e9851be7e304a9d1c59eecc43a9a43d5ada69e0ff',
  },
  {
    chainId: 677,
    contract: 'bdexV3Factory',
    event: 'FeeAmountEnabled',
    tx: '0x201b4b35e5db2a49bcc6e1e49f15f3a5cdc61507f70cc37589e019300f0f9286',
  },
  {
    chainId: 677,
    contract: 'permit2',
    event: 'Approval',
    tx: '0x10cba773cf07f3decbecbe9959e0986ba52b1f27248598f3563e400b7f5070b8',
  },
  {
    chainId: 677,
    contract: 'bdexV2Pair',
    event: 'Approval',
    tx: '0x8da34bb377f7cbdccdeb89d775d288a906bd982b5d2945e5041830586c72ce08',
  },
  {
    chainId: 677,
    contract: 'bdexV2Pair',
    event: 'Burn',
    tx: '0x8da34bb377f7cbdccdeb89d775d288a906bd982b5d2945e5041830586c72ce08',
  },
  {
    chainId: 677,
    contract: 'bdexV2Pair',
    event: 'Mint',
    tx: '0x85a303df44466800defbf84cdfe7c0c8871c77009ef17bb0c76fb5acab738b08',
  },
  {
    chainId: 677,
    contract: 'bdexV2Pair',
    event: 'Swap',
    tx: '0x173be3747f0cdf78e5db5fa68329bf34e7438c94dd7d342be196d42ba0bd1ad7',
  },
  {
    chainId: 677,
    contract: 'bdexV2Pair',
    event: 'Sync',
    tx: '0x85a303df44466800defbf84cdfe7c0c8871c77009ef17bb0c76fb5acab738b08',
  },
  {
    chainId: 677,
    contract: 'bdexV2Pair',
    event: 'Transfer',
    tx: '0x85a303df44466800defbf84cdfe7c0c8871c77009ef17bb0c76fb5acab738b08',
  },
  {
    chainId: 677,
    contract: 'bdexV3Pool',
    event: 'Initialize',
    tx: '0xae23190343bc93ec8aa1decf6d5907eb14b8040c2274c757bbc0094f7d21e4d5',
  },
  {
    chainId: 677,
    contract: 'bdexV3Pool',
    event: 'Mint',
    tx: '0xae23190343bc93ec8aa1decf6d5907eb14b8040c2274c757bbc0094f7d21e4d5',
  },
  {
    chainId: 677,
    contract: 'bdexV3Pool',
    event: 'Swap',
    tx: '0x3dce0824598e2422f018191f3129d9a8aae46594c25a18ac57dc9e203b5581c3',
  },
  {
    chainId: 677,
    contract: 'bdexV3Pool',
    event: 'Burn',
    tx: '0x27779f4f1ea01d3b85e96d12ce13c55a0bcc032b35b3ffbeb62fa955c92c2e64',
  },
  {
    chainId: 677,
    contract: 'bdexV3Pool',
    event: 'Collect',
    tx: '0x27779f4f1ea01d3b85e96d12ce13c55a0bcc032b35b3ffbeb62fa955c92c2e64',
  },
  {
    chainId: 677,
    contract: 'bdexV3Pool',
    event: 'Flash',
    tx: '0x4b5b1a7e6edb0d2787dc58c3777563cbdb84e816896cd69edfe6c51b73672d85',
  },
  {
    chainId: 677,
    contract: 'bdexV3Pool',
    event: 'IncreaseObservationCardinalityNext',
    tx: '0x8c2d0a6ea65c3573034688899353f49c6818b05e1b9df0b6a60afa19dde77c14',
  },
  {
    chainId: 677,
    contract: 'bridgeRouter',
    event: 'DepositEvent',
    tx: '0x2feb4ecaa00c3bc0d99ced382a508042267e8557d2450cf84041d83216e0e6e8',
  },
  {
    chainId: 677,
    contract: 'bridgeRouter',
    event: 'ExecuteEvent',
    tx: '0x0e2401f2d5a6cb39e100b4f792ff0936eaf2ae805d61d68012830b269b5f55d2',
  },
  {
    chainId: 677,
    contract: 'bridgeRouter',
    event: 'ExecutionConfirmed',
    tx: '0xb9d93282aedeed79aff9d55719ee27cda27985e6e737439afab8cc70a6ff8e54',
  },
  {
    chainId: 677,
    contract: 'bridgeRouter',
    event: 'Refunded',
    tx: '0xcde61c4572ed182277363336509ff654280c8116c6d186a335477fc0c3c45011',
  },
  {
    chainId: 677,
    contract: 'bridgeRouter',
    event: 'BotGasConfigUpdated',
    tx: '0xb5af5c7358867a9f04ebe1003a0df204f393c4d3e0c64413eb4cd74ae0ff2f84',
  },
  {
    chainId: 677,
    contract: 'bridgeRouter',
    event: 'Initialized',
    tx: '0x7d344708fea7cac682da360e07f1ed65aea402c9cd549b3c418199ed88c825e5',
  },
  {
    chainId: 677,
    contract: 'bridgeRouter',
    event: 'ReceivedEth',
    tx: '0xdcfca3837379e11c26801dca19fafaa047f0ec9de192441cafa52571174752e4',
  },
  {
    chainId: 677,
    contract: 'bridgeRouter',
    event: 'RoleGranted',
    tx: '0x1cabe84a34ed7856b92bc3a466791002b3217353350987b62d71443f61d8e084',
  },
  {
    chainId: 677,
    contract: 'bridgeRouter',
    event: 'RoleRevoked',
    tx: '0x7f03bf3f3983439cf83a456ba6d6a458f5d805e8acaa2bb839b2cc13eaef89f0',
  },
  {
    chainId: 677,
    contract: 'bridgeRouter',
    event: 'VoteRefUpdated',
    tx: '0x0a588d12f5635a64c8561eb5414024e06d27a094f3f83d08bb1c838e39139302',
  },
  {
    chainId: 677,
    contract: 'bridgeRouter',
    event: legacy('ExecuteEvent'),
    tx: '0x31f983eded97cbc8171f857cb9875ae2332237871ea9d2f547f774305a1ca25e',
  },
  // Testnet
  {
    chainId: 968,
    contract: 'wbot',
    event: 'Approval',
    tx: '0x68885365ee4fd25f7b6bf38b50915b899c60899cf4ab9896b8ba14468993e3f8',
  },
  {
    chainId: 968,
    contract: 'wbot',
    event: 'Withdrawal',
    tx: '0xaf37bc3b18ed56bd28620555d282b375d0e46e32d844620c0c307bb9faec5cf1',
  },
  {
    chainId: 968,
    contract: 'bdexV2Factory',
    event: 'PairCreated',
    tx: '0xe73aececc7cbac8e2cedc8074682ee769ab592d391e0b3a2d34eaa9c6b480e63',
  },
  {
    chainId: 968,
    contract: 'bdexV3Factory',
    event: 'PoolCreated',
    tx: '0x4dce8f48a3966985559a812f090cde46b87173007aff7b2d9b42dbaf0f6b9288',
  },
  {
    chainId: 968,
    contract: 'permit2',
    event: 'Approval',
    tx: '0xd8f8f764c6593a427005b9916369ee0e222894cd3cd17441af7b2d807502161c',
  },
  {
    chainId: 968,
    contract: 'bridgeRouter',
    event: 'ApprovedWithdrawal',
    tx: '0xcdab00013e062c893b32612a76bc55b6104ec3a6b6cd0178c43b6625b0501011',
  },
  {
    chainId: 968,
    contract: 'bridgeRouter',
    event: 'ExecutedWithdrawal',
    tx: '0xcdab00013e062c893b32612a76bc55b6104ec3a6b6cd0178c43b6625b0501011',
  },
  {
    chainId: 968,
    contract: 'bridgeRouter',
    event: 'CreatedWithdrawal',
    tx: '0x09bf8dff499e3a4173e17a50ea665b9f8651456a28892dda05215b2657190d97',
  },
  {
    chainId: 968,
    contract: 'bridgeRouter',
    event: 'DepositEvent',
    tx: '0x3a30a391074d9b6720f53b2914206138311a3fd8fe0f9fd91e0bc868c4ae9c65',
  },
  {
    chainId: 968,
    contract: 'bridgeRouter',
    event: 'ExecuteEvent',
    tx: '0x3675dfbd2a2b75a419790a4e618e20961abea174f6f2ad3159e3ab42a4281e2a',
  },
  {
    chainId: 968,
    contract: 'bridgeRouter',
    event: 'ExecutionConfirmed',
    tx: '0x035ce7309c2d5530b6d3587b1204733436b81e0303a14037eeabf1e7289c11e6',
  },
  {
    chainId: 968,
    contract: 'bridgeRouter',
    event: 'Refunded',
    tx: '0xc62022bcef480e25fd9d25302ebe6105ab6c4496a4e3c3db7e84d4ef9126d38e',
  },
  {
    chainId: 968,
    contract: 'bridgeRouter',
    event: legacy('ExecuteEvent'),
    tx: '0x243a9db8c3cf5ccf7f1dd2d946f817c57794d7139da538470539753bc47cea01',
  },
  {
    chainId: 968,
    contract: 'bridgeRouter',
    event: legacy('Refunded'),
    tx: '0x8557778673819ae9f8fa6e6cce2420bccab0dd6f0b2a1f4c87a4dc0e2fc87d39',
  },
]

// No log with these topic0 values exists at the SDK addresses on either network
// (BOTScan getLogs over the full history, checked 2026-11-11). Revisit when one appears.
const NOT_EMITTED: Partial<Record<Contract, string[]>> = {
  // No pool on either network has emitted these (BOTScan getLogs by topic0 alone, all
  // addresses, full history, checked 2026-11-12).
  bdexV3Pool: ['CollectProtocol', 'SetFeeProtocol'],
  permit2: ['Lockdown', 'NonceInvalidation', 'Permit', 'UnorderedNonceInvalidation'],
  universalRouter: ['EIP712DomainChanged'],
  bridgeRouter: [
    'AddBlacklist',
    'RemoveBlacklist',
    'EnvUpdated',
    'RoleAdminChanged',
    'SetTokenEvent',
  ],
}

// EIP-1967 proxy admin events. Emitted by the bridge proxies, not part of the BotBridge ABI.
const PROXY_ADMIN_TOPICS = new Set([
  toEventSelector('Upgraded(address)'),
  toEventSelector('AdminChanged(address,address)'),
])

const resolve = ({ contract, event }: Fixture): AbiEvent => {
  if (typeof event !== 'string') return event
  const found = events(abis[contract]).find((e) => e.name === event)
  if (!found) throw new Error(`${contract} ABI has no ${event} event.`)
  return found
}

const label = (f: Fixture) =>
  `${f.chainId} ${f.contract}.${typeof f.event === 'string' ? f.event : `${f.event.name} (legacy)`}`

describe('event fixtures cover every ABI event', () => {
  it.each(Object.keys(abis) as Contract[])('%s', (contract) => {
    const covered = new Set([
      ...fixtures
        .filter((f) => f.contract === contract && typeof f.event === 'string')
        .map((f) => f.event),
      ...(NOT_EMITTED[contract] ?? []),
    ])
    const missing = events(abis[contract])
      .map((e) => e.name)
      .filter((name) => !covered.has(name))
    expect(missing).toEqual([])
  })

  it('botBridgeLegacyEventsAbi', () => {
    const covered = new Set(
      fixtures
        .filter((f) => f.contract === 'bridgeRouter' && typeof f.event !== 'string')
        .map((f) => toEventSelector(f.event as AbiEvent)),
    )
    const missing = events(botBridgeLegacyEventsAbi)
      .filter((e) => !covered.has(toEventSelector(e)))
      .map((e) => e.name)
    expect(missing).toEqual([])
  })
})

describe.each(fixtures.map((f) => ({ ...f, name: label(f) })))('$name', (fixture) => {
  it('matches topic0 and decodes with named args from a real log', async () => {
    const event = resolve(fixture)
    const address = contractAddress(fixture.chainId, fixture.contract)
    const selector = toEventSelector(event)
    const receipt = await clients[fixture.chainId].getTransactionReceipt({ hash: fixture.tx })
    const log = receipt.logs.find(
      (l) => isAddressEqual(l.address, address) && l.topics[0] === selector,
    )
    expect(log, `${fixture.tx} has no ${event.name} log at ${address}`).toBeDefined()
    if (!log) return

    const decoded = decodeEventLog({
      abi: [event],
      data: log.data,
      topics: log.topics,
      strict: true,
    })
    expect(decoded.eventName).toBe(event.name)
    expect(Array.isArray(decoded.args)).toBe(false)
    expect(Object.keys(decoded.args as object).sort()).toEqual(
      event.inputs.map((i) => i.name).sort(),
    )

    // Every other log this contract emitted in the same tx must also be a known event.
    const known = new Set([
      ...events(abis[fixture.contract]).map((e) => toEventSelector(e)),
      ...(fixture.contract === 'bridgeRouter'
        ? [
            ...events(botBridgeLegacyEventsAbi).map((e) => toEventSelector(e)),
            ...PROXY_ADMIN_TOPICS,
          ]
        : []),
    ])
    const unknown = receipt.logs
      .filter((l) => isAddressEqual(l.address, address))
      .map((l) => l.topics[0])
      .filter((t) => t && !known.has(t))
    expect(unknown).toEqual([])
  })
})
