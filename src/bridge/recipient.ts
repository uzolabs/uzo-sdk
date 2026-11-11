import { type Address, bytesToHex, getAddress, isAddress, sha256, zeroAddress } from 'viem'
import { BridgeValidationError } from '../utils/errors'
import type { SupportedChainId } from '../utils/validation'

/** How a destination chain expects the recipient to be written. */
export type BridgeRecipientFormat = 'evm' | 'tron'

/** A destination the bridge supports from a BOT Chain network. */
export type BridgeDestination = {
  chainId: number
  name: string
  recipientFormat: BridgeRecipientFormat
}

/**
 * Destinations the SDK builds deposits for, per source network. Each one is a route the
 * contract reports from `getSupportedDestinationChains` and that a real, successful deposit
 * has used. For five routes the payout was found on the destination chain (`ExecuteEvent`
 * with the deposit's nonce and amount). For BNB Smart Chain Testnet (97) it was confirmed
 * only from the BOT Chain side, by the relayer's `markExecutionConfirmed` for that deposit.
 *
 * - `evm`: pass a 0x address. It arrives at the same 20-byte address.
 * - `tron`: pass a base58 `T...` address. The contract stores its 20-byte body (the base58check
 *   payload without the 0x41 prefix and checksum), and the gateway pays the `T...` address.
 *   A plain 0x address is rejected, so funds cannot be sent to a Tron account nobody chose.
 */
// Evidence per route (BOT Chain deposit tx, then what confirmed it):
// 677 -> 1 Ethereum: deposit 0xf0ccb5c16ddc6bcb840920a8570437ee38de5e28b7422aa950dca3db36826201
//   (local nonce 280234). Ethereum ExecuteEvent 0x6994dae3df256386ae6a3de2748f78d3ee1c17fad25e1af406f9e50b17f23aae.
//   Also markExecutionConfirmed on BOT Chain 0xe6f74115a73efdd96beb0c2b5b425b93dc40ae65001e131e8c185b4a874b7f73.
// 677 -> 56 BNB Smart Chain: deposit 0x5fae441b76ddf9df59cb064c5bb2847bb3cb58a085041d796aebe05f3920e82f
//   (local nonce 280260). BSC ExecuteEvent 0xcd199d1eabaf771cb649055e233f391df7ff135cf9aae8b5780631a345787ddf.
//   Also markExecutionConfirmed on BOT Chain 0x3bc46658e7b5db966e583f6418a4573f7ab6d6b9ec2a2e770146cfb09e39275b.
// 677 -> 728126428 Tron: deposit 0x5cc68cecda74200bb83196eb34ce280d6baea4c36557a17673133e7a58982ba9
//   (local nonce 280212). Tron ExecuteEvent and 23 USDT transfer in
//   9fd57d2f5a4f478dc92c00acb594f8f69052bb953c38fbb96f6e30d36e80ecee. The relayer does not call
//   markExecutionConfirmed for Tron routes, so there is no BOT Chain side confirmation.
// 968 -> 97 BNB Smart Chain Testnet: deposit 0x6f9bfa80eabcb9dfe6bfe9770dba049e06d75c27ed22d24137419c7532ae272c
//   (local nonce 1138). markExecutionConfirmed on BOT Chain testnet
//   0xc44ce6b9ead74d649335cfaef72fd11af95f29bf6edcf5d67c4e7c5fd2e11407. BOT Chain side only: the
//   destination tx was not read (no public BSC testnet log access).
// 968 -> 11155111 Sepolia: deposit 0xdc4ee434ac45e4d8175f946db6d60bf90ab9d4c6dcdaf1823c8f004cd5057511
//   (local nonce 1000). Sepolia ExecuteEvent 0xec97a7e0e3c5a230ffe886fe586b96756b3316f14e7c2c2b88c312b777a9bd4d.
//   Also markExecutionConfirmed on BOT Chain testnet 0x83d10a51dac1231cd955f704101f2ffab4bfb8ab1974307caaab4d9ec5a113a3.
// 968 -> 3448148188 Tron Nile: deposit 0x68a397d498865e26cdf0291525e3f14791186bc9cb0cc85e9c8098f91fc9b1bc
//   (local nonce 984). Nile ExecuteEvent and 499 USDT transfer in
//   32a906d7651f41f02d98dbf145aaa49328e0b5809930d00ae87c98b8f53e6006. No BOT Chain side
//   confirmation, as for Tron.
export const BRIDGE_DESTINATIONS = {
  677: [
    { chainId: 1, name: 'Ethereum', recipientFormat: 'evm' },
    { chainId: 56, name: 'BNB Smart Chain', recipientFormat: 'evm' },
    { chainId: 728126428, name: 'Tron', recipientFormat: 'tron' },
  ],
  968: [
    { chainId: 97, name: 'BNB Smart Chain Testnet', recipientFormat: 'evm' },
    { chainId: 11155111, name: 'Sepolia', recipientFormat: 'evm' },
    { chainId: 3448148188, name: 'Tron Nile', recipientFormat: 'tron' },
  ],
} as const satisfies Record<SupportedChainId, readonly BridgeDestination[]>

/**
 * Returns the destination for `destinationChainId` from `chainId`, or throws
 * `BridgeValidationError` with reason `UNSUPPORTED_DESTINATION`.
 *
 * @internal
 */
export function getBridgeDestination(
  chainId: SupportedChainId,
  destinationChainId: unknown,
): BridgeDestination {
  const destination = (BRIDGE_DESTINATIONS[chainId] as readonly BridgeDestination[]).find(
    (d) => d.chainId === destinationChainId,
  )
  if (!destination) {
    const allowed = BRIDGE_DESTINATIONS[chainId].map((d) => `${d.chainId} (${d.name})`).join(', ')
    throw new BridgeValidationError(
      'UNSUPPORTED_DESTINATION',
      `Destination chain ${String(destinationChainId)} is not supported from chain ${chainId}. Use one of: ${allowed}.`,
    )
  }
  return destination
}

const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const TRON_PREFIX = 0x41

function base58Decode(value: string): Uint8Array | undefined {
  let n = 0n
  for (const char of value) {
    const digit = BASE58.indexOf(char)
    if (digit < 0) return undefined
    n = n * 58n + BigInt(digit)
  }
  const bytes: number[] = []
  while (n > 0n) {
    bytes.unshift(Number(n & 0xffn))
    n >>= 8n
  }
  for (const char of value) {
    if (char !== '1') break
    bytes.unshift(0)
  }
  return Uint8Array.from(bytes)
}

function invalidRecipient(message: string): BridgeValidationError {
  return new BridgeValidationError('INVALID_RECIPIENT', message)
}

function tronToBytes20(recipient: unknown, name: string): Address {
  if (typeof recipient === 'string' && /^0x/i.test(recipient)) {
    throw invalidRecipient(
      `${name} recipients must be a base58 Tron address starting with T, not ${recipient}. A 0x address is not accepted for Tron.`,
    )
  }
  const bytes =
    typeof recipient === 'string' && /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(recipient)
      ? base58Decode(recipient)
      : undefined
  if (bytes === undefined || bytes.length !== 25 || bytes[0] !== TRON_PREFIX) {
    throw invalidRecipient(
      `Invalid ${name} recipient: ${String(recipient)}. Pass a base58 Tron address, 34 characters starting with T.`,
    )
  }
  const payload = bytes.subarray(0, 21)
  const checksum = sha256(sha256(payload, 'bytes'), 'bytes').subarray(0, 4)
  if (!checksum.every((b, i) => b === bytes[21 + i])) {
    throw invalidRecipient(
      `Invalid ${name} recipient: ${recipient}. The checksum does not match, so the address has a typo.`,
    )
  }
  return getAddress(bytesToHex(bytes.subarray(1, 21)))
}

/**
 * Encodes a recipient into the 20-byte `address` that `BotBridge.deposit` takes, following
 * the format of the destination chain. Throws `BridgeValidationError` with reason
 * `UNSUPPORTED_DESTINATION` or `INVALID_RECIPIENT`.
 *
 * - EVM destinations take a 0x address and return it checksummed.
 * - Tron destinations take a base58 `T...` address with a valid checksum. A 0x address
 *   is rejected.
 *
 * The zero address is always rejected.
 *
 * @example
 * ```ts
 * encodeBridgeRecipient({ chainId: 677, destinationChainId: 56, recipient: '0x...' })
 * encodeBridgeRecipient({ chainId: 677, destinationChainId: 728126428, recipient: 'T...' })
 * ```
 */
export function encodeBridgeRecipient({
  chainId,
  destinationChainId,
  recipient,
}: {
  chainId: SupportedChainId
  destinationChainId: number
  recipient: string
}): Address {
  const destination = getBridgeDestination(chainId, destinationChainId)
  let encoded: Address
  if (destination.recipientFormat === 'tron') {
    encoded = tronToBytes20(recipient, destination.name)
  } else {
    if (typeof recipient !== 'string' || !isAddress(recipient, { strict: false })) {
      throw invalidRecipient(
        `Invalid ${destination.name} recipient: ${String(recipient)}. Pass a 0x-prefixed, 20-byte hex address.`,
      )
    }
    encoded = getAddress(recipient)
  }
  if (encoded === zeroAddress) {
    throw invalidRecipient('The recipient is the zero address. Funds sent there are lost.')
  }
  return encoded
}
