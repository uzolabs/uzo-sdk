---
"@uzolabs/sdk": minor
---

Add `@uzolabs/sdk/bdex`: on-chain BDEX quotes and unsigned swap and approval calls.

- V2: `getAmountsOutV2`, `buildSwapExactTokensForTokensV2`.
- V3: `getFeeTiersV3` (enabled tiers read from the factory), `getPoolV3`, `quoteExactInputSingleV3` (QuoterV2 via `eth_call`), `buildExactInputSingleV3`.
- Swap builders take `quotedAmountOut` and an optional `slippageTolerance` (percent, default 0.5) and compute the minimum output with `applySlippage`. They accept no raw minimum, so the 5% cap cannot be bypassed.
- Swap deadlines must be in the future and at most 1 hour ahead.
- Approvals: `buildErc20Approve`, `buildPermit2Approve`. The spender must be a BDEX router or Permit2 on the same network, otherwise `RouterNotAllowedError`.
- `applySlippage`: 0.5% default, 5% hard cap with no opt-out (`SlippageTooHighError`). Exported for display; the swap builders call it themselves.
- `SlippageTooHighError` now tells you to lower the slippage, since there is no opt-out.
- No routing API client. The SDK never signs or touches keys.
