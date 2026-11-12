/**
 * Fetches verified ABIs from BOTScan and writes them to `src/contracts/abis/`.
 *
 *   npx tsx scripts/fetch-abis.ts          write the ABI files
 *   npx tsx scripts/fetch-abis.ts --check  fail if the committed files differ from the explorer
 *
 * Check mode catches proxy upgrades: if the bridge router points at a new
 * implementation, or its ABI changes, the check fails.
 *
 * PATCHES lists the only hand changes. Each one is applied after the fetch, named in
 * the file header, and fails loudly if the explorer ABI no longer has the expected shape.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createPublicClient, http } from 'viem'
import { botChain, botChainTestnet } from '../src/chains'
import { addresses } from '../src/contracts/addresses'

const EXPLORER_API = {
  677: botChain.blockExplorers.default.apiUrl,
  968: botChainTestnet.blockExplorers.default.apiUrl,
} as const

type Source = {
  name: string
  chainId: 677 | 968
  /**
   * The contract to read the ABI from. A function resolves it on chain, for contracts the
   * SDK has no fixed address for (BDEX pairs and pools are created by their factories).
   */
  address: string | (() => Promise<string>)
  /** A second deployment whose ABI entries missing from the primary are appended. */
  mergeFrom?: { chainId: 677 | 968; address: string }
}

const mainnet = createPublicClient({ chain: botChain, transport: http() })

const factoryRead = [
  {
    type: 'function',
    name: 'allPairs',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'getPool',
    stateMutability: 'view',
    inputs: [
      { name: '', type: 'address' },
      { name: '', type: 'address' },
      { name: '', type: 'uint24' },
    ],
    outputs: [{ name: '', type: 'address' }],
  },
] as const

// The first pair the mainnet V2 factory created. Every pair is the same UniswapV2Pair bytecode.
const firstV2Pair = () =>
  mainnet.readContract({
    address: addresses[677].bdexV2Factory,
    abi: factoryRead,
    functionName: 'allPairs',
    args: [0n],
  })

// The mainnet WBOT/USDT 0.3% pool. Every pool is the same UniswapV3Pool bytecode.
const wbotUsdtV3Pool = () =>
  mainnet.readContract({
    address: addresses[677].bdexV3Factory,
    abi: factoryRead,
    functionName: 'getPool',
    args: [addresses[677].wbot, addresses[677].usdt, 3000],
  })

// Mainnet by default. One source merges in a second deployment, noted inline.
const SOURCES: Source[] = [
  { name: 'wbot', chainId: 677, address: addresses[677].wbot },
  { name: 'bdexV2Factory', chainId: 677, address: addresses[677].bdexV2Factory },
  { name: 'bdexV2Pair', chainId: 677, address: firstV2Pair },
  { name: 'bdexV2Router02', chainId: 677, address: addresses[677].bdexV2Router02 },
  { name: 'bdexV3Factory', chainId: 677, address: addresses[677].bdexV3Factory },
  { name: 'bdexV3Pool', chainId: 677, address: wbotUsdtV3Pool },
  { name: 'bdexV3QuoterV2', chainId: 677, address: addresses[677].bdexV3QuoterV2 },
  { name: 'bdexV3SwapRouter', chainId: 677, address: addresses[677].bdexV3SwapRouter },
  { name: 'permit2', chainId: 677, address: addresses[677].permit2 },
  // Testnet runs a newer build whose ABI is the mainnet ABI plus three custom errors
  // (InvalidHopSlippageLength, V4TooLittleReceivedPerHop, V4TooMuchRequestedPerHop).
  // Functions and events are identical. The merged ABI decodes reverts from both
  // networks, and the drift check watches both contracts.
  {
    name: 'universalRouter',
    chainId: 677,
    address: addresses[677].universalRouter,
    mergeFrom: { chainId: 968, address: addresses[968].universalRouter },
  },
  { name: 'botBridge', chainId: 677, address: addresses[677].bridgeRouter },
]

type AbiEntry = { type?: string; name?: string; inputs?: { name?: string; type?: string }[] }
type Patch = { note: string; apply: (abi: AbiEntry[]) => void }

const PATCHES: Record<string, Patch> = {
  bdexV2Factory: {
    // The verified source is the original UniswapV2Factory, which leaves this argument
    // unnamed. viem then decodes PairCreated args as an array instead of an object.
    // The name does not change the event signature or topic0.
    note: 'PairCreated uint256 argument named allPairsLength (unnamed in the verified source).',
    apply(abi) {
      const event = abi.find((e) => e.type === 'event' && e.name === 'PairCreated')
      const arg = event?.inputs?.[3]
      if (arg?.type !== 'uint256' || arg.name !== '') {
        throw new Error('bdexV2Factory PairCreated no longer has an unnamed uint256 at index 3.')
      }
      arg.name = 'allPairsLength'
    },
  },
}

const OUT_DIR = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'src', 'contracts', 'abis')

type SmartContract = {
  name?: string | null
  is_verified?: boolean
  abi?: unknown[] | null
  proxy_type?: string | null
  implementations?: { address?: string; address_hash?: string; name?: string | null }[]
}

async function getSmartContract(chainId: 677 | 968, address: string): Promise<SmartContract> {
  const url = `${EXPLORER_API[chainId]}/smart-contracts/${address}`
  const res = await fetch(url, { headers: { accept: 'application/json' } })
  if (!res.ok) throw new Error(`GET ${url} returned HTTP ${res.status}.`)
  return (await res.json()) as SmartContract
}

type ResolvedSource = Source & { address: string }

type Fetched = {
  source: ResolvedSource
  contractName: string
  implementation?: string
  patch?: string
  abi: unknown[]
}

function signature(entry: AbiEntry): string {
  return `${entry.type} ${entry.name ?? ''}(${(entry.inputs ?? []).map((i) => i.type).join(',')})`
}

async function fetchAbi(source: ResolvedSource): Promise<Fetched> {
  const primary = await fetchOne(source)
  if (!source.mergeFrom) return primary
  const other = await fetchOne({ name: source.name, ...source.mergeFrom })
  if (other.contractName !== primary.contractName) {
    throw new Error(
      `${source.name}: cannot merge ${other.contractName} into ${primary.contractName}.`,
    )
  }
  const seen = new Set((primary.abi as AbiEntry[]).map(signature))
  const extra = (other.abi as AbiEntry[]).filter((e) => !seen.has(signature(e)))
  return { ...primary, abi: [...primary.abi, ...extra] }
}

async function fetchOne(source: ResolvedSource): Promise<Fetched> {
  const proxy = await getSmartContract(source.chainId, source.address)
  let target = proxy
  let implementation: string | undefined
  if (proxy.proxy_type) {
    const impl = proxy.implementations?.[0]
    implementation = impl?.address ?? impl?.address_hash
    if (!implementation) {
      throw new Error(
        `${source.name} is a ${proxy.proxy_type} proxy but BOTScan lists no implementation.`,
      )
    }
    target = await getSmartContract(source.chainId, implementation)
  }
  const where = implementation ?? source.address
  if (!target.is_verified || !Array.isArray(target.abi)) {
    throw new Error(
      `${source.name} (${where} on chain ${source.chainId}) is not verified on BOTScan. Verify it before regenerating ABIs.`,
    )
  }
  const patch = PATCHES[source.name]
  patch?.apply(target.abi as AbiEntry[])
  return {
    source,
    contractName: target.name ?? source.name,
    ...(implementation ? { implementation } : {}),
    ...(patch ? { patch: patch.note } : {}),
    abi: target.abi,
  }
}

/** Everything except the fetch date. Check mode compares this part only. */
function body(f: Fetched): string {
  const lines = [
    `// Contract: ${f.contractName}`,
    `// Source: ${f.source.address} (chain ${f.source.chainId})`,
    ...(f.source.mergeFrom
      ? [
          `// Merged: entries only in ${f.source.mergeFrom.address} (chain ${f.source.mergeFrom.chainId}) appended`,
        ]
      : []),
    ...(f.implementation ? [`// Implementation: ${f.implementation}`] : []),
    ...(f.patch ? [`// Patched: ${f.patch}`] : []),
    '',
    `export const ${f.source.name}Abi = ${JSON.stringify(f.abi, null, 2)} as const`,
    '',
  ]
  return lines.join('\n')
}

function render(f: Fetched, date: string): string {
  return [
    '// Generated by scripts/fetch-abis.ts from BOTScan. Do not edit by hand.',
    `// Fetched: ${date}`,
    body(f),
  ].join('\n')
}

function stripHeader(file: string): string {
  return file.split('\n').slice(2).join('\n')
}

function renderIndex(names: string[]): string {
  const lines = names
    .slice()
    .sort()
    .map((n) => `export { ${n}Abi } from './${n}'`)
  return [
    '// Generated by scripts/fetch-abis.ts. Do not edit by hand.',
    "export { erc20Abi } from 'viem'",
    ...lines,
    '',
  ].join('\n')
}

async function main() {
  const check = process.argv.includes('--check')
  const resolved = await Promise.all(
    SOURCES.map(async (s) => ({
      ...s,
      address: typeof s.address === 'function' ? await s.address() : s.address,
    })),
  )
  const fetched = await Promise.all(resolved.map(fetchAbi))
  const date = new Date().toISOString().slice(0, 10)
  const drift: string[] = []

  for (const f of fetched) {
    const path = join(OUT_DIR, `${f.source.name}.ts`)
    if (check) {
      const committed = await readFile(path, 'utf8').catch(() => '')
      if (stripHeader(committed.replace(/\r\n/g, '\n')) !== body(f)) drift.push(f.source.name)
    } else {
      await writeFile(path, render(f, date))
      console.log(
        `wrote ${f.source.name}.ts (${f.contractName}${f.implementation ? ` via ${f.implementation}` : ''})`,
      )
    }
  }

  const indexPath = join(OUT_DIR, 'index.ts')
  const index = renderIndex(SOURCES.map((s) => s.name))
  if (check) {
    const committed = await readFile(indexPath, 'utf8').catch(() => '')
    if (committed.replace(/\r\n/g, '\n') !== index) drift.push('index')
  } else {
    await writeFile(indexPath, index)
  }

  if (drift.length > 0) {
    console.error(
      `ABI drift detected in: ${drift.join(', ')}.\nA contract or proxy implementation changed on BOTScan. Run \`npx tsx scripts/fetch-abis.ts\`, review the diff and commit it.`,
    )
    process.exit(1)
  }
  if (check) console.log(`No ABI drift across ${fetched.length} contracts.`)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
