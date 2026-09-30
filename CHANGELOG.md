# @uzolabs/sdk

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
