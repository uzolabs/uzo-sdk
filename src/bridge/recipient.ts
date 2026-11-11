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
 * contract reports from `getSupportedDestinationChains` and that real deposits have used,
 * with arrivals checked on the destination chain.
 *
 * - `evm`: pass a 0x address. It arrives at the same 20-byte address.
 * - `tron`: pass a base58 `T...` address. The contract stores its 20-byte body (the base58check
 *   payload without the 0x41 prefix and checksum), and the gateway pays the `T...` address.
 *   A plain 0x address is rejected, so funds cannot be sent to a Tron account nobody chose.
 */
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
