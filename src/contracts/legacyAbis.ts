/**
 * Bridge events emitted by earlier `BotBridge` implementations behind the same proxies.
 *
 * The verified ABI (`botBridgeAbi`) only describes the current implementation. Historical
 * logs from older implementations share an event name but have a different signature,
 * so they do not decode with `botBridgeAbi`. They live here, in a separate ABI, so the
 * names do not collide in viem's types.
 *
 * - `ExecuteEvent` with six arguments: mainnet blocks 930,109 to 14,424,166, and testnet
 *   up to block 13,228,012. Later logs use the ten argument form in `botBridgeAbi`.
 * - `Refunded` with three arguments: testnet only, blocks 5,201,424 to 6,537,130.
 *
 * Written by hand from real logs. Not generated, because no verified source exists for
 * these implementations.
 *
 * @example
 * ```ts
 * import { decodeEventLog } from 'viem'
 * import { botBridgeAbi, botBridgeLegacyEventsAbi } from '@uzolabs/sdk/contracts'
 *
 * const abi = [...botBridgeAbi, ...botBridgeLegacyEventsAbi]
 * ```
 * Spreading both into one array decodes every bridge log by topic0. Narrow the result by
 * `eventName` and the argument shape.
 */
export const botBridgeLegacyEventsAbi = [
  {
    type: 'event',
    name: 'ExecuteEvent',
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'depositer', type: 'address' },
      { indexed: true, internalType: 'address', name: 'recipient', type: 'address' },
      { indexed: true, internalType: 'uint256', name: 'receiveamount', type: 'uint256' },
      { indexed: false, internalType: 'address', name: 'tokenAddress', type: 'address' },
      { indexed: false, internalType: 'uint256', name: 'originDepositNonce', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'originChainId', type: 'uint256' },
    ],
  },
  {
    type: 'event',
    name: 'Refunded',
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'uint256', name: 'localNonce', type: 'uint256' },
      { indexed: true, internalType: 'address', name: 'sender', type: 'address' },
      { indexed: false, internalType: 'uint256', name: 'amount', type: 'uint256' },
    ],
  },
] as const
