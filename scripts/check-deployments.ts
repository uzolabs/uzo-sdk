/**
 * Checks that every address in `src/contracts/addresses.ts` has bytecode on its chain,
 * and that known proxies still point at the implementation the ABIs were generated from.
 *
 *   npx tsx scripts/check-deployments.ts
 */
import { type Address, createPublicClient, getAddress, type Hex, http } from 'viem'
import { botChain, botChainTestnet } from '../src/chains'
import { addresses, knownImplementations } from '../src/contracts/addresses'

// bytes32(uint256(keccak256('eip1967.proxy.implementation')) - 1)
const EIP1967_IMPLEMENTATION_SLOT: Hex =
  '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc'

const clients = {
  677: createPublicClient({ chain: botChain, transport: http() }),
  968: createPublicClient({ chain: botChainTestnet, transport: http() }),
} as const

async function main() {
  const failures: string[] = []

  for (const [id, book] of Object.entries(addresses)) {
    const chainId = Number(id) as 677 | 968
    const client = clients[chainId]
    await Promise.all(
      Object.entries(book).map(async ([key, address]) => {
        const code = await client.getCode({ address: address as Address })
        const ok = code !== undefined && code !== '0x'
        console.log(`${ok ? 'ok  ' : 'FAIL'} ${chainId}.${key} ${address}`)
        if (!ok) failures.push(`${chainId}.${key} has no bytecode`)
      }),
    )
  }

  for (const [id, proxies] of Object.entries(knownImplementations)) {
    const chainId = Number(id) as 677
    for (const [key, expected] of Object.entries(proxies)) {
      const proxy = addresses[chainId][key as keyof (typeof addresses)[677]]
      const slot = await clients[chainId].getStorageAt({
        address: proxy,
        slot: EIP1967_IMPLEMENTATION_SLOT,
      })
      const actual = slot ? getAddress(`0x${slot.slice(-40)}`) : undefined
      const ok = actual === expected
      console.log(`${ok ? 'ok  ' : 'FAIL'} ${chainId}.${key} implementation ${actual ?? 'unset'}`)
      if (!ok) {
        failures.push(
          `${chainId}.${key} implementation is ${actual}, expected ${expected}. Regenerate ABIs and update knownImplementations.`,
        )
      }
    }
  }

  if (failures.length > 0) {
    console.error(`\n${failures.length} deployment check(s) failed:\n- ${failures.join('\n- ')}`)
    process.exit(1)
  }
  console.log('\nAll deployments look good.')
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
