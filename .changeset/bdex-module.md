---
"@uzolabs/sdk": minor
---

Add `@uzolabs/sdk/bdex`: on-chain BDEX quotes and unsigned swap and approval calls.

- V2: `getAmountsOutV2`, `buildSwapExactTokensForTokensV2`.
- V3: `getFeeTiersV3` (enabled tiers read from the factory), `getPoolV3`, `quoteExactInputSingleV3` (QuoterV2 via `eth_call`), `buildExactInputSingleV3`.
- Approvals: `buildErc20Approve`, `buildPermit2Approve`. The spender must be a BDEX router or Permit2 on the same network, otherwise `RouterNotAllowedError`.
- `applySlippage`: 0.5% default, 5% hard cap with no opt-out (`SlippageTooHighError`).
- `SlippageTooHighError` now tells you to lower the slippage, since there is no opt-out.
- No routing API client. The SDK never signs or touches keys.
