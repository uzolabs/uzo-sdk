import type { Abi, Address } from 'viem'
import { botChain } from '../chains/botChain'
import { botChainTestnet } from '../chains/botChainTestnet'
import { ExplorerError } from '../utils/errors'
import { assertAddress, assertChainId, type SupportedChainId } from '../utils/validation'

/** Address metadata returned by `getAddressInfo`. */
export type AddressInfo = {
  isContract: boolean
  isVerified: boolean
  name: string | null
  token?: { symbol: string; decimals: number }
}

/** Verified contract metadata returned by `getContract`. */
export type ContractInfo = {
  name: string
  abi: Abi
  isVerified: boolean
  proxyType: string | null
  implementations: Address[]
}

/** BOTScan (Blockscout v2) client returned by `createExplorerClient`. */
export type ExplorerClient = {
  /**
   * Looks up an address. An address BOTScan has never seen is not an error: it
   * resolves to `{ isContract: false, isVerified: false, name: null }`.
   */
  getAddressInfo(address: Address): Promise<AddressInfo>
  /**
   * Fetches a contract's verified source metadata. For an unverified contract,
   * `isVerified` is `false`, `abi` is empty and `name` is an empty string.
   * Throws `ExplorerError` if the address is not a contract.
   */
  getContract(address: Address): Promise<ContractInfo>
}

type AddressResponse = {
  is_contract?: boolean | null
  is_verified?: boolean | null
  name?: string | null
  token?: { symbol?: string | null; decimals?: string | number | null } | null
}

type SmartContractResponse = {
  name?: string | null
  abi?: Abi | null
  is_verified?: boolean | null
  proxy_type?: string | null
  implementations?: { address?: string | null; address_hash?: string | null }[] | null
}

const API_URL = {
  677: botChain.blockExplorers.default.apiUrl,
  968: botChainTestnet.blockExplorers.default.apiUrl,
} as const

/**
 * Creates a read-only client for the BOTScan API. No API key is needed.
 *
 * @example
 * ```ts
 * import { createExplorerClient } from '@uzolabs/sdk/explorer'
 * import { addresses } from '@uzolabs/sdk/contracts'
 *
 * const explorer = createExplorerClient({ chainId: 677 })
 *
 * const usdt = await explorer.getAddressInfo(addresses[677].usdt)
 * console.log(usdt.token) // { symbol: 'USDT', decimals: 6 }
 *
 * const bridge = await explorer.getContract(addresses[677].bridgeRouter)
 * console.log(bridge.proxyType, bridge.implementations)
 * ```
 */
export function createExplorerClient({ chainId }: { chainId: SupportedChainId }): ExplorerClient {
  assertChainId(chainId)
  const baseUrl = API_URL[chainId]

  async function get<T>(path: string): Promise<{ status: number; data: T | null; url: string }> {
    const url = `${baseUrl}${path}`
    let res: Response
    try {
      res = await fetch(url, { headers: { accept: 'application/json' } })
    } catch (cause) {
      throw new ExplorerError(`Could not reach BOTScan at ${url}. Check your network connection.`, {
        url,
        cause,
      })
    }
    if (res.status === 404) return { status: 404, data: null, url }
    if (!res.ok) {
      throw new ExplorerError(
        `BOTScan returned HTTP ${res.status} for ${url}. Retry later, or check that the address is valid.`,
        { url, status: res.status },
      )
    }
    try {
      return { status: res.status, data: (await res.json()) as T, url }
    } catch (cause) {
      throw new ExplorerError(
        `BOTScan returned a response that is not JSON for ${url}. Retry later.`,
        {
          url,
          status: res.status,
          cause,
        },
      )
    }
  }

  return {
    async getAddressInfo(address) {
      const checksummed = assertAddress(address)
      const { data } = await get<AddressResponse>(`/addresses/${checksummed}`)
      if (!data) return { isContract: false, isVerified: false, name: null }
      const info: AddressInfo = {
        isContract: data.is_contract === true,
        isVerified: data.is_verified === true,
        name: data.name ?? null,
      }
      const decimals = Number(data.token?.decimals)
      if (data.token?.symbol && Number.isInteger(decimals)) {
        info.token = { symbol: data.token.symbol, decimals }
      }
      return info
    },

    async getContract(address) {
      const checksummed = assertAddress(address)
      const { data, url } = await get<SmartContractResponse>(`/smart-contracts/${checksummed}`)
      if (!data) {
        throw new ExplorerError(
          `No contract found at ${checksummed} on chain ${chainId}. Check the address and network.`,
          { url, status: 404 },
        )
      }
      const implementations: Address[] = []
      for (const impl of data.implementations ?? []) {
        const value = impl.address ?? impl.address_hash
        if (value) implementations.push(assertAddress(value, 'implementation address'))
      }
      const isVerified = data.is_verified === true
      return {
        name: data.name ?? '',
        abi: isVerified && Array.isArray(data.abi) ? data.abi : [],
        isVerified,
        proxyType: data.proxy_type ?? null,
        implementations,
      }
    },
  }
}
