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
| `@uzolabs/sdk/bdex`      | BDEX V2/V3 quotes, swaps, Routing API    | Planned, 0.3.0 |
| `@uzolabs/sdk/bridge`    | USDT bridge reads and deposits           | Planned, 0.4.0 |
| `@uzolabs/sdk/paymaster` | EOA paymaster client                     | Planned, 0.5.0 |

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
- **No confirmed paymaster** for chain 677. The paymaster client (0.5.0) will require you to supply a URL.
- **Routing API URL required.** The BDEX Routing API base URL is not published, so the routing client (0.3.0) will require it as config.
- **No mainnet Universal Router address.** It is not confirmed, so `addresses[677]` does not list one. Testnet has `addresses[968].universalRouter`.
- **External bridge gateways are experimental.** `EXTERNAL_BRIDGE` lists the Ethereum and BSC addresses, but their ABIs are not published, so the SDK does not call them.
- **Bridge in from other chains is not supported yet.** The bridge module (0.4.0) supports BOT Chain as the source only.

## License

MIT. See [LICENSE](./LICENSE).

Uzo Labs is an independent project and is not affiliated with or endorsed by BOT Chain.
