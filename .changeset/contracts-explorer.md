---
'@uzolabs/sdk': minor
---

Adds `@uzolabs/sdk/contracts` and `@uzolabs/sdk/explorer`.

- `contracts`: `addresses` (narrow literal types), `getAddresses(chainId)`, `USDT_RESOURCE_ID`, `TOKENS`, `EXTERNAL_BRIDGE` (experimental) and typed ABIs generated from BOTScan: `wbotAbi`, `bdexV2FactoryAbi`, `bdexV2Router02Abi`, `bdexV3FactoryAbi`, `bdexV3QuoterV2Abi`, `bdexV3SwapRouterAbi`, `permit2Abi`, `universalRouterAbi`, `botBridgeAbi`, plus viem's `erc20Abi`.
- `explorer`: `createExplorerClient({ chainId })` with `getAddressInfo` and `getContract` for the BOTScan API. No API key needed.
- Errors: `UzoError` and its subclasses, each with a stable `code`.
- The mainnet `bdexV3SwapRouter02` entry is removed. BOTScan verifies that address as a `UniversalRouter`, not a SwapRouter02, and the mainnet Universal Router is not confirmed yet.
