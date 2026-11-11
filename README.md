# @uzolabs/sdk

Typed, viem-native toolkit for building on BOT Chain.

```bash
npm i @uzolabs/sdk viem
```

`viem` v2 is a peer dependency. The SDK never touches private keys or signs anything.

## Quick start

```ts
import { createPublicClient, http } from 'viem'
import { botChain } from '@uzolabs/sdk/chains'

const client = createPublicClient({
  chain: botChain,
  transport: http(),
})

const blockNumber = await client.getBlockNumber()
console.log(blockNumber)
```

Swap `botChain` for `botChainTestnet` to use testnet.

## Networks

|                 | Mainnet (`botChain`)       | Testnet (`botChainTestnet`) |
| --------------- | -------------------------- | --------------------------- |
| Chain ID        | 677                        | 968                         |
| Native currency | BOT (18 decimals)          | tBOT (18 decimals)          |
| RPC             | `https://rpc.botchain.ai`  | `https://rpc.bohr.life`     |
| Explorer        | `https://scan.botchain.ai` | `https://scan.bohr.life`    |
| Faucet          |                            | https://faucet.botchain.ai/basic |

## Subpath exports

| Import                   | Contents                                 | Status         |
| ------------------------ | ---------------------------------------- | -------------- |
| `@uzolabs/sdk`           | Re-exports everything                    | Available      |
| `@uzolabs/sdk/chains`    | `botChain`, `botChainTestnet`            | Available      |
| `@uzolabs/sdk/contracts` | Addresses, constants, typed ABIs         | Available      |
| `@uzolabs/sdk/explorer`  | BOTScan API client                       | Available      |
| `@uzolabs/sdk/bdex`      | BDEX V2/V3 quotes and swaps              | Available      |
| `@uzolabs/sdk/bridge`    | USDT bridge status, limits and deposits  | Available      |
| `@uzolabs/sdk/paymaster` | EOA paymaster client                     | On hold        |

Import from the narrowest subpath you need. `@uzolabs/sdk/chains` is under 2 KB gzipped.

## Examples

### chains

```ts
import { createWalletClient, custom } from 'viem'
import { botChainTestnet } from '@uzolabs/sdk/chains'

// Browser wallet on testnet. The user's wallet does all signing.
const wallet = createWalletClient({
  chain: botChainTestnet,
  transport: custom(window.ethereum),
})
await wallet.addChain({ chain: botChainTestnet })
```

### contracts

```ts
import { createPublicClient, http } from 'viem'
import { botChain } from '@uzolabs/sdk/chains'
import { addresses, bdexV2Router02Abi, getAddresses } from '@uzolabs/sdk/contracts'

const client = createPublicClient({ chain: botChain, transport: http() })

// Addresses are typed as exact literals. getAddresses throws for chains other than 677 and 968.
const { wbot, usdt } = getAddresses(677)

const [, usdtOut] = await client.readContract({
  address: addresses[677].bdexV2Router02,
  abi: bdexV2Router02Abi,
  functionName: 'getAmountsOut',
  args: [10n ** 18n, [wbot, usdt]],
})
```

ABIs are generated from verified contracts on BOTScan by `scripts/fetch-abis.ts`. CI fails if the
committed ABIs drift from the explorer, which catches proxy upgrades. ERC-20 uses viem's `erc20Abi`.
An integration test checks every event's topic0 against a real log on chain.

`addresses` also lists the StakeHub (`stakeHub`) and govBOT (`govBOT`) system contracts and the
Uzo Deploy factories (`uzoTokenFactory`, `uzoNftFactory`, `uzoTipJarFactory`). Their ABIs are not
bundled yet.

`permit2` is the BDEX Permit2 deployment on each network, the one its Universal Router calls. It is
not the canonical Uniswap address.

`botBridgeLegacyEventsAbi` is for decoding historical bridge logs only. Older bridge
implementations emitted `ExecuteEvent` and `Refunded` with fewer arguments, so combine it with
`botBridgeAbi` when reading logs from the bridge's deployment block onward. Do not use it to build
transactions.

`universalRouterAbi` merges the mainnet and testnet deployments. Testnet adds three errors
(`InvalidHopSlippageLength`, `V4TooLittleReceivedPerHop`, `V4TooMuchRequestedPerHop`), so reverts
from either network decode.

### bdex

On-chain quotes and unsigned swap and approval calls for BDEX. Every builder returns a
`TxRequest` (`{ to, data, value }`) for the user's wallet to sign and send. The SDK never signs
and never touches keys.

```ts
import {
  buildErc20Approve,
  buildSwapExactTokensForTokensV2,
  getAmountsOutV2,
} from '@uzolabs/sdk/bdex'
import { addresses } from '@uzolabs/sdk/contracts'

const { usdt, wbot, bdexV2Router02 } = addresses[677]
const amountIn = 1_000_000n // 1 USDT

const quotedAmountOut = (await getAmountsOutV2(client, { amountIn, path: [usdt, wbot] })).at(-1)!

const approve = buildErc20Approve({ chainId: 677, token: usdt, spender: bdexV2Router02, amount: amountIn })
const swap = buildSwapExactTokensForTokensV2({
  chainId: 677,
  amountIn,
  quotedAmountOut, // the minimum is computed from this, 0.5% below by default
  // slippageTolerance: 1, // optional, percent, 5 at most
  path: [usdt, wbot],
  to: account,
  deadline: BigInt(Math.floor(Date.now() / 1000) + 1200),
})

await walletClient.sendTransaction(approve)
await walletClient.sendTransaction(swap)
```

| Function                          | What it does                                                    |
| --------------------------------- | --------------------------------------------------------------- |
| `getAmountsOutV2`                 | V2 quote via `Router02.getAmountsOut`                           |
| `buildSwapExactTokensForTokensV2` | Unsigned V2 swap from a quote, always to the network's Router02 |
| `getFeeTiersV3`                   | Enabled V3 fee tiers and tick spacing, read from the factory    |
| `getPoolV3`                       | V3 pool address from the factory, or `null`                     |
| `quoteExactInputSingleV3`         | V3 quote via QuoterV2, simulated with `eth_call`                |
| `buildExactInputSingleV3`         | Unsigned V3 swap from a quote, always to the network's SwapRouter |
| `buildErc20Approve`               | Unsigned ERC-20 approve to a BDEX router or Permit2             |
| `buildPermit2Approve`             | Unsigned `Permit2.approve` for a BDEX router, normally the Universal Router |
| `applySlippage`                   | Minimum output after slippage, for display                      |

Safety rules:

- **Slippage** defaults to 0.5%. Anything above 5% throws `SlippageTooHighError`. Swap builders
  take `quotedAmountOut` and an optional `slippageTolerance` and compute the minimum themselves.
  They accept no raw minimum, so the cap has no opt-out on any swap builder.
- **Approved routers only.** Swaps always target the BDEX V2 Router02 or V3 SwapRouter from
  `addresses`. Approvals only go to those routers, the Universal Router or Permit2 on the same
  network. Any other spender throws `RouterNotAllowedError`.
- **No zero minimums.** If the computed minimum rounds down to 0, the builder throws.
- **Deadlines** must be in the future and at most 1 hour ahead, in seconds. Milliseconds are rejected.
- **Fee tiers are read on chain.** Mainnet and testnet enable different tiers, so the SDK never hard-codes them.
- The client must be built with `botChain` or `botChainTestnet`. Reads use `eth_call` only, never `eth_getLogs`.

### bridge

USDT bridging out of BOT Chain. `prepareBridgeDeposit` reads the bridge's live state, checks
the deposit against it and returns two unsigned calls for the user's wallet: a USDT approve for
exactly the deposit amount, then the deposit.

```ts
import { prepareBridgeDeposit } from '@uzolabs/sdk/bridge'

const { approve, deposit, fee, receiveAmount } = await prepareBridgeDeposit(client, {
  destinationChainId: 56, // BNB Smart Chain
  recipient: '0x...', // a T... address for Tron
  amount: 25_000_000n, // 25 USDT, the fee comes out of this
})

const hash = await walletClient.sendTransaction(approve)
await publicClient.waitForTransactionReceipt({ hash })
await walletClient.sendTransaction(deposit)
```

It throws `BridgeValidationError` with a `reason` before anything is signed when the bridge or
USDT bridging is paused, the route is closed, the amount is outside the contract's limits or
does not cover the fee, or the destination or recipient is invalid.

| Source               | Destinations (`destinationChainId`)                                       |
| -------------------- | ------------------------------------------------------------------------- |
| BOT Chain (677)      | Ethereum (1), BNB Smart Chain (56), Tron (728126428)                      |
| BOT Chain testnet (968) | BSC testnet (97), Sepolia (11155111), Tron Nile (3448148188)           |

| Function                | What it does                                                         |
| ----------------------- | -------------------------------------------------------------------- |
| `prepareBridgeDeposit`  | Checks status, route, limits and fee on chain, then builds the calls |
| `buildBridgeDeposit`    | Builds the calls only. **Does not check status or limits.**          |
| `getBridgeStatus`       | Whether the bridge or USDT bridging is paused                        |
| `getBridgeLimits`       | Minimum and maximum deposit and minimum fee, in USDT base units      |
| `getBotGasConfig`       | The bridge's BOT gas config, for display                             |
| `encodeBridgeRecipient` | Validates a recipient and encodes it the way the destination expects |
| `BRIDGE_DESTINATIONS`   | The destinations above, with each one's recipient format             |

How it works:

- **The fee is USDT only.** It is taken out of `amount`: `amount * feeBps / 10000`, raised to
  the minimum fee (currently 1 USDT) when it is above 0. The rate is read per route (10 bps at the time of writing). The
  recipient gets `receiveAmount`. No BOT is charged, and `deposit.value` is always 0.
- **Exact approval.** The contract pulls `amount` in total (the bridged part plus the fee), so
  the approve is for exactly `amount`, never more.
- **Recipients.** EVM destinations take a 0x address. Tron and Nile take a base58 `T...`
  address with a valid checksum; a 0x address is rejected for Tron. The zero address is always
  rejected.
- **Decimals.** `receiveAmount` is in BOT Chain USDT units (6 decimals). BSC USDT has 18, so
  the same value arrives there rescaled.
- **BOT gas** (native BOT paid out on arrival, with its cost in USDT deducted) only applies to
  deposits into BOT Chain, so there is no option for it here.
- The contract also blocks blacklisted senders and recipients, which the SDK cannot see, and
  state can change before the user signs. Reads use `eth_call` only.

### explorer

```ts
import { createExplorerClient } from '@uzolabs/sdk/explorer'

const explorer = createExplorerClient({ chainId: 677 })

const info = await explorer.getAddressInfo('0xaBabc7Ddc03e501d190C676BF3d92ef0e6e87a3C')
// { isContract: true, isVerified: true, name: 'Tether USD', token: { symbol: 'USDT', decimals: 6 } }

const contract = await explorer.getContract('0xef8DC669ECa13E612b67Ff09478352E85bD6CC53')
// { name, abi, isVerified, proxyType: 'eip1967', implementations: ['0xD7F5...'] }
```

An address BOTScan has never seen resolves to `{ isContract: false, isVerified: false, name: null }`
instead of throwing. No API key is needed.

### Errors

Every error extends `UzoError` and has a stable `code`, such as `UNSUPPORTED_CHAIN` or `EXPLORER_ERROR`.

```ts
import { UzoError } from '@uzolabs/sdk'

try {
  await explorer.getContract(address)
} catch (error) {
  if (error instanceof UzoError) console.log(error.code, error.message)
}
```

More runnable scripts live in [`examples/`](./examples).

## Known limitations

- **`eth_getLogs` is disabled** on the public mainnet RPC (`https://rpc.botchain.ai`). Use the BOTScan API or your own RPC for event queries.
- **No public WebSocket RPC.** Pass your own `webSocket` transport if you need subscriptions.
- **No confirmed paymaster** for chain 677, so there is no paymaster module. It is on hold until one exists.
- **No routing client.** The BDEX Routing API base URL is not published. `@uzolabs/sdk/bdex` quotes single V2 paths and single V3 pools on chain; it does not split or route across pools.
- **External bridge gateways are experimental.** `EXTERNAL_BRIDGE` lists the Ethereum and BSC addresses, but their ABIs are not published, so the SDK does not call them.
- **Bridge in from other chains is not supported yet.** `@uzolabs/sdk/bridge` builds deposits with BOT Chain as the source only.

## License

MIT. See [LICENSE](./LICENSE).

Uzo Labs is an independent project and is not affiliated with or endorsed by BOT Chain.
