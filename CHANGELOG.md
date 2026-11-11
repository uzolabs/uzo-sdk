# @uzolabs/sdk

## 0.4.0

### Minor Changes

- 90e23c7: Add `@uzolabs/sdk/bridge`: USDT bridging out of BOT Chain.
  
  - `prepareBridgeDeposit` reads the pause flags, route, limits and fee on chain and throws `BridgeValidationError` with a `reason` before anything is signed. It returns the approve and deposit calls with the exact `fee` and `receiveAmount`.
  - `buildBridgeDeposit` builds the same calls without reading anything. It does not check status or limits.
  - The approve is always for exactly the deposit amount, and the deposit's `value` is always 0. The fee is charged in USDT only.
  - Destinations are an allowlist per network (`BRIDGE_DESTINATIONS`). Tron and Nile recipients must be base58 `T...` addresses with a valid checksum; `encodeBridgeRecipient` encodes them the way the contract expects.
  - `receiveAmount` is `amount - fee` in BOT Chain USDT base units (6 decimals). The recipient receives the same value expressed in the destination token's decimals (for example 18 on BSC).
  - Reads: `getBridgeStatus`, `getBridgeLimits`, `getBotGasConfig`.
  - Every allowed route was used by a real, successful deposit. Ethereum, BNB Smart Chain, Tron, Sepolia and Tron Nile payouts were found on the destination chain. BNB Smart Chain Testnet (97) was confirmed only from the BOT Chain side, by the relayer's `markExecutionConfirmed` for the deposit; its destination tx was not read.

## 0.3.0

### Minor Changes

- 723b4f7: Add `@uzolabs/sdk/bdex`: on-chain BDEX quotes and unsigned swap and approval calls.
  
  - V2: `getAmountsOutV2`, `buildSwapExactTokensForTokensV2`.
  - V3: `getFeeTiersV3` (enabled tiers read from the factory), `getPoolV3`, `quoteExactInputSingleV3` (QuoterV2 via `eth_call`), `buildExactInputSingleV3`.
  - Swap builders take `quotedAmountOut` and an optional `slippageTolerance` (percent, default 0.5) and compute the minimum output with `applySlippage`. They accept no raw minimum, so the 5% cap cannot be bypassed.
  - Swap deadlines must be in the future and at most 1 hour ahead.
  - Approvals: `buildErc20Approve`, `buildPermit2Approve`. The spender must be a BDEX router or Permit2 on the same network, otherwise `RouterNotAllowedError`.
  - `applySlippage`: 0.5% default, 5% hard cap with no opt-out (`SlippageTooHighError`). Exported for display; the swap builders call it themselves.
  - `SlippageTooHighError` now tells you to lower the slippage, since there is no opt-out.
  - No routing API client. The SDK never signs or touches keys.

## 0.2.1

### Patch Changes

- 54563fd: Fixes the Permit2 address, names the `PairCreated` argument and adds addresses.
  
  - **Permit2.** `addresses[677].permit2` is now `0x8366170f09a04f715a13549D616a06aED16Db7c3` and `addresses[968].permit2` is now `0xaE85b2bc7578F8Ca9217900a2D548151F96447de`. Earlier releases exported the canonical Uniswap address `0x000000000022D473030F116dDEE9F6B43aC78BA3` on both networks. That address does have Permit2 bytecode on both chains, but neither BDEX Universal Router uses it. Each router stores its Permit2 as an immutable, and its runtime bytecode embeds only the BDEX address for its own network. Each BDEX address has no code on the other network. All three contracts are verified on BOTScan as the same Permit2 (solc 0.8.17, identical ABI). If you approved tokens to the canonical address for BDEX swaps, approve the new address instead. An integration test now checks that each Universal Router embeds the exported Permit2.
  - **Mainnet Universal Router.** `addresses[677].universalRouter` is `0xaE6ae8630f7A888dEc0B9195C85F7515d5887655`, as listed in the BDEX docs. Its Permit2 matches the exported address.
  - **`PairCreated`.** The verified V2 factory source leaves the `uint256` argument unnamed, so viem decoded the event's args as an array. `bdexV2FactoryAbi` now names it `allPairsLength`, and logs decode to an object. The event signature and topic0 are unchanged. The rename is applied by `scripts/fetch-abis.ts`, so the drift check still covers the file.
  - **Universal Router ABI.** `universalRouterAbi` is now generated from the mainnet contract, with the three errors that only the testnet build has (`InvalidHopSlippageLength`, `V4TooLittleReceivedPerHop`, `V4TooMuchRequestedPerHop`) merged in. Every revert from either network decodes, and the drift check watches both contracts.
  - **Legacy bridge events.** New `botBridgeLegacyEventsAbi`, for decoding historical bridge logs only. It covers logs from older `BotBridge` implementations: the six argument `ExecuteEvent` (mainnet blocks 930,109 to 14,424,166, and older testnet blocks) and the three argument `Refunded` (testnet only). They do not decode with `botBridgeAbi`. Every other event in the SDK ABIs matches the verified contracts, and a new integration test checks each event's topic0 against a real log on both networks.
  - **New addresses.** `stakeHub` (`0x...2002`) and `govBOT` (`0x...2005`) system contracts, and the Uzo Deploy factories `uzoTokenFactory`, `uzoNftFactory` and `uzoTipJarFactory`. The tip jar factory differs between networks. Mainnet and testnet now list the same keys.

## 0.2.0

### Minor Changes

- b533329: Adds `@uzolabs/sdk/contracts` and `@uzolabs/sdk/explorer`.
  
  - `contracts`: `addresses` (narrow literal types), `getAddresses(chainId)`, `USDT_RESOURCE_ID`, `TOKENS`, `EXTERNAL_BRIDGE` (experimental) and typed ABIs generated from BOTScan: `wbotAbi`, `bdexV2FactoryAbi`, `bdexV2Router02Abi`, `bdexV3FactoryAbi`, `bdexV3QuoterV2Abi`, `bdexV3SwapRouterAbi`, `permit2Abi`, `universalRouterAbi`, `botBridgeAbi`, plus viem's `erc20Abi`.
  - `explorer`: `createExplorerClient({ chainId })` with `getAddressInfo` and `getContract` for the BOTScan API. No API key needed.
  - Errors: `UzoError` and its subclasses, each with a stable `code`.
  - The mainnet `bdexV3SwapRouter02` entry is removed. BOTScan verifies that address as a `UniversalRouter`, not a SwapRouter02, and the mainnet Universal Router is not confirmed yet.

## 0.1.0

### Minor Changes

- 7218e97: First release. Adds `@uzolabs/sdk/chains` with viem chain definitions for BOT Chain mainnet (`botChain`, chain ID 677) and testnet (`botChainTestnet`, chain ID 968), including RPC, BOTScan explorer, and Multicall3 configuration.
