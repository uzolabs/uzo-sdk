// Installs the packed tarball into a throwaway project and checks that both
// the ESM and CJS entry points load. Runs on every supported Node version.
import { execSync } from 'node:child_process'
import { mkdtempSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const tarball = readdirSync('.').find((f) => /^uzolabs-sdk-.*\.tgz$/.test(f))
if (!tarball) throw new Error('No tarball found. Run `npm pack` first.')

const dir = mkdtempSync(join(tmpdir(), 'uzo-smoke-'))
const run = (cmd) => execSync(cmd, { cwd: dir, stdio: 'inherit' })

writeFileSync(join(dir, 'package.json'), '{"name":"smoke","private":true}')
run(`npm i --no-audit --no-fund viem@2 ${JSON.stringify(resolve(tarball))}`)

writeFileSync(
  join(dir, 'esm.mjs'),
  `import { botChain } from '@uzolabs/sdk/chains'
import * as root from '@uzolabs/sdk'
if (botChain.id !== 677 || root.botChainTestnet.id !== 968) process.exit(1)
console.log('ESM ok')`,
)
writeFileSync(
  join(dir, 'cjs.cjs'),
  `const { botChainTestnet } = require('@uzolabs/sdk/chains')
const root = require('@uzolabs/sdk')
if (botChainTestnet.id !== 968 || root.botChain.id !== 677) process.exit(1)
console.log('CJS ok')`,
)
run('node esm.mjs')
run('node cjs.cjs')
