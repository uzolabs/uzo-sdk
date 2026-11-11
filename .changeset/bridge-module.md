---
"@uzolabs/sdk": minor
---

Add `@uzolabs/sdk/bridge`: USDT bridging out of BOT Chain.

- `prepareBridgeDeposit` reads the pause flags, route, limits and fee on chain and throws `BridgeValidationError` with a `reason` before anything is signed. It returns the approve and deposit calls with the exact `fee` and `receiveAmount`.
- `buildBridgeDeposit` builds the same calls without reading anything. It does not check status or limits.
- The approve is always for exactly the deposit amount, and the deposit's `value` is always 0. The fee is charged in USDT only.
- Destinations are an allowlist per network (`BRIDGE_DESTINATIONS`). Tron and Nile recipients must be base58 `T...` addresses with a valid checksum; `encodeBridgeRecipient` encodes them the way the contract expects.
- Reads: `getBridgeStatus`, `getBridgeLimits`, `getBotGasConfig`.
