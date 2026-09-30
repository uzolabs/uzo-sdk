/**
 * Official BOT Chain contract addresses, keyed by chain ID.
 *
 * This file is the single source of truth for every address in the SDK.
 * Each entry was verified as a deployed contract on BOTScan on 2026-09-30.
 * Do not add an address anywhere else in `src/`.
 *
 * Not part of the public API until 0.2.0 (`@uzolabs/sdk/contracts`).
 *
 * @internal
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
    bdexV3SwapRouter02: '0xaE6ae8630f7A888dEc0B9195C85F7515d5887655',
    bdexV3QuoterV2: '0x034A705b36067cff99ABf5C662Be881cBd8d0176',
    bdexV3PositionManager: '0xDAc3FcFF004d8a8675b94E44941A1a2e3b240090',
    /** EIP-1967 upgradeable proxy. Implementation is `BotBridge`. */
    bridgeRouter: '0xef8DC669ECa13E612b67Ff09478352E85bD6CC53',
  },
  968: {
    wbot: '0xD5452816194a3784dBa983426cCe7c122F4abd30',
    usdt: '0x75edC9335175Fc0552D51D48439F229c10420fe3',
    multicall3: '0x47FA21f684bBAD707A53a0f9BE59F1422F46C265',
    permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
    bdexV2Factory: '0x65b8e98ceA190d8c28B3e4716402027f634d15a3',
    bdexV2Router02: '0xD6425a02f0845B8D99e349C34D2E7A576E177345',
    bdexV3Factory: '0x1C51c173323ec11BB4e3C4fD2314c225Dc4b5419',
    bdexV3SwapRouter: '0x07032d47A1b9f8460cBeE9dC17c1d3E438693929',
    bdexV3QuoterV2: '0x034A705b36067cff99ABf5C662Be881cBd8d0176',
    bdexV3PositionManager: '0xDAc3FcFF004d8a8675b94E44941A1a2e3b240090',
    universalRouter: '0x73Be0A1d8011B335A7aBeF6c45544E8ca4448AB5',
    bridgeRouter: '0x6239404Aa276ba68486E2Fa40E90CDd36ff8ec3A',
  },
} as const
