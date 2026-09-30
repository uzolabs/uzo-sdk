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
| `@uzolabs/sdk/contracts` | Addresses, constants, typed ABIs         | Planned, 0.2.0 |
| `@uzolabs/sdk/explorer`  | BOTScan API client                       | Planned, 0.2.0 |
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

More runnable scripts live in [`examples/`](./examples).

## Known limitations

- **`eth_getLogs` is disabled** on the public mainnet RPC (`https://rpc.botchain.ai`). Use the BOTScan API or your own RPC for event queries.
- **No public WebSocket RPC.** Pass your own `webSocket` transport if you need subscriptions.
- **No confirmed paymaster** for chain 677. The paymaster client (0.5.0) will require you to supply a URL.
- **Routing API URL required.** The BDEX Routing API base URL is not published, so the routing client (0.3.0) will require it as config.
- **Bridge in from other chains is not supported yet.** The bridge module (0.4.0) supports BOT Chain as the source only.

## License

MIT. See [LICENSE](./LICENSE).

Uzo Labs is an independent project and is not affiliated with or endorsed by BOT Chain.
