---
"@uzolabs/sdk": minor
---

Add `@uzolabs/sdk/bridge`: USDT bridging out of BOT Chain.

- `prepareBridgeDeposit` reads the pause flags, route, limits and fee on chain and throws `BridgeValidationError` with a `reason` before anything is signed. It returns the approve and deposit calls with the exact `fee` and `receiveAmount`.
- `buildBridgeDeposit` builds the same calls without reading anything. It does not check status or limits.
- The approve is always for exactly the deposit amount, and the deposit's `value` is always 0. The fee is charged in USDT only.
- Destinations are an allowlist per network (`BRIDGE_DESTINATIONS`). Tron and Nile recipients must be base58 `T...` addresses with a valid checksum; `encodeBridgeRecipient` encodes them the way the contract expects.
- `receiveAmount` is `amount - fee` in BOT Chain USDT base units (6 decimals). The recipient receives the same value expressed in the destination token's decimals (for example 18 on BSC).
- Reads: `getBridgeStatus`, `getBridgeLimits`, `getBotGasConfig`.
- Every allowed route was used by a real, successful deposit. Ethereum, BNB Smart Chain, Tron, Sepolia and Tron Nile payouts were found on the destination chain. BNB Smart Chain Testnet (97) was confirmed only from the BOT Chain side, by the relayer's `markExecutionConfirmed` for the deposit; its destination tx was not read.
