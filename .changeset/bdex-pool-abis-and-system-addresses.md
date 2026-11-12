---
'@uzolabs/sdk': patch
---

Add `bdexV2PairAbi` and `bdexV3PoolAbi`, generated from verified BDEX contracts on BOTScan (the first mainnet V2 pair and the WBOT/USDT 0.3% V3 pool, both resolved from the factories). The V3 pool's `CollectProtocol` and `SetFeeProtocol` events are in the verified source but have never been emitted on either network.

Add `addresses[chainId].validatorSet` (BOTValidatorSet, 0x...1000, the target of each block's gas price 0 fee transaction) and `addresses[chainId].firstStakeCredit` (the first ERC-20 on each network, a StakeCredit proxy created by StakeHub in block 48 on mainnet and 233 on testnet).

`BRIDGE_DESTINATIONS` entries gain `tracksDelivery`: true when the relayer records delivery (`ExecutionConfirmed`) for the route. True for the EVM routes, false for Tron and Nile.
