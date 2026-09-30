/**
 * Official BOT Chain contract addresses, keyed by chain ID.
 *
 * This file is the single source of truth for every address in the SDK.
 * Each entry was verified as a deployed contract on BOTScan on 2026-09-30.
 * Do not add an address anywhere else in `src/`.
 *
 * Every value is a checksummed literal type, so `addresses[677].usdt` is typed as
 * `'0xaBabc7Ddc03e501d190C676BF3d92ef0e6e87a3C'`, not `string`.
 *
 * The mainnet Universal Router is not listed. Its address is not confirmed, so the
 * BDEX module takes it as config instead.
 *
 * @example
 * ```ts
 * import { addresses } from '@uzolabs/sdk/contracts'
 *
 * addresses[677].usdt // '0xaBabc7Ddc03e501d190C676BF3d92ef0e6e87a3C'
 * addresses[968].universalRouter // testnet only
 * ```
 */
export const addresses = {
  677: {
    wbot: '0xD5452816194a3784dBa983426cCe7c122F4abd30',
    usdt: '0xaBabc7Ddc03e501d190C676BF3d92ef0e6e87a3C',
    multicall3: '0x47FA21f684bBAD707A53a0f9BE59F1422F46C265',
    permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
    bdexV2Factory: '0x117115f3B72C8d1989178089A67D0C26f8EE0AA3',
    bdexV2Router02: '0x1414eD29FdFD322c3c0a830330ed982E2D629e76',
    bdexV3Factory: '0x1C51c173323ec11BB4e3C4fD2314c225Dc4b5419',
    bdexV3SwapRouter: '0x07032d47A1b9f8460cBeE9dC17c1d3E438693929',
    bdexV3QuoterV2: '0x034A705b36067cff99ABf5C662Be881cBd8d0176',
    bdexV3PositionManager: '0xDAc3FcFF004d8a8675b94E44941A1a2e3b240090',
    /** EIP-1967 upgradeable proxy. Implementation is `BotBridge`. */
    bridgeRouter: '0xef8DC669ECa13E612b67Ff09478352E85bD6CC53',
  },
  968: {
    wbot: '0xD5452816194a3784dBa983426cCe7c122F4abd30',
    usdt: '0x75edC9335175Fc0552D51D48439F229c10420fe3',
    multicall3: '0x47FA21f684bBAD707A53a0f9BE59F1422F46C265',
    /** Deployed at the canonical address. Not verified on the testnet explorer. */
    permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
    bdexV2Factory: '0x65b8e98ceA190d8c28B3e4716402027f634d15a3',
    bdexV2Router02: '0xD6425a02f0845B8D99e349C34D2E7A576E177345',
    bdexV3Factory: '0x1C51c173323ec11BB4e3C4fD2314c225Dc4b5419',
    bdexV3SwapRouter: '0x07032d47A1b9f8460cBeE9dC17c1d3E438693929',
    bdexV3QuoterV2: '0x034A705b36067cff99ABf5C662Be881cBd8d0176',
    bdexV3PositionManager: '0xDAc3FcFF004d8a8675b94E44941A1a2e3b240090',
    universalRouter: '0x73Be0A1d8011B335A7aBeF6c45544E8ca4448AB5',
    /** EIP-1967 upgradeable proxy. Implementation is `BotBridge`. */
    bridgeRouter: '0x6239404Aa276ba68486E2Fa40E90CDd36ff8ec3A',
  },
} as const

/**
 * Bridge contracts on external networks, keyed by chain ID.
 * Public through `EXTERNAL_BRIDGE` in `constants.ts`.
 *
 * @internal
 */
export const externalBridgeAddresses = {
  1: {
    bridgeGateway: '0x2945d3aF6f012e49f7421252b5fB57D1bb7E6Edd',
    usdt: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  },
  56: {
    bridgeGateway: '0x3cd6fB6b0CDdD3610f0f4769AA7Bb686Cd4a4b55',
    usdt: '0x55d398326f99059fF775485246999027B3197955',
  },
} as const

/**
 * Implementation contracts behind upgradeable proxies. Used only by the ABI tooling
 * and deployment checks, never by runtime code, because implementations change on upgrade.
 *
 * @internal
 */
export const knownImplementations = {
  677: { bridgeRouter: '0xD7F50Ee55787C8fFA82abD634801E56f0578a2B3' },
} as const
