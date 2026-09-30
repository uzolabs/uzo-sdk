import { describe, expect, it } from 'vitest'
import * as root from '../../src'
import { botChain, botChainTestnet } from '../../src/chains'

describe('botChain', () => {
  it('matches the verified mainnet parameters', () => {
    expect(botChain.id).toBe(677)
    expect(botChain.name).toBe('BOT Chain')
    expect(botChain.nativeCurrency).toEqual({ name: 'BOT', symbol: 'BOT', decimals: 18 })
    expect(botChain.rpcUrls.default.http).toEqual(['https://rpc.botchain.ai'])
    expect(botChain.rpcUrls.default).not.toHaveProperty('webSocket')
    expect(botChain.blockExplorers.default).toEqual({
      name: 'BOTScan',
      url: 'https://scan.botchain.ai',
      apiUrl: 'https://scan.botchain.ai/api/v2',
    })
    expect(botChain.contracts.multicall3.address).toBe('0x47FA21f684bBAD707A53a0f9BE59F1422F46C265')
    expect(botChain.testnet).toBeUndefined()
  })
})

describe('botChainTestnet', () => {
  it('matches the verified testnet parameters', () => {
    expect(botChainTestnet.id).toBe(968)
    expect(botChainTestnet.name).toBe('BOT Chain Testnet')
    expect(botChainTestnet.nativeCurrency).toEqual({ name: 'tBOT', symbol: 'tBOT', decimals: 18 })
    expect(botChainTestnet.rpcUrls.default.http).toEqual(['https://rpc.bohr.life'])
    expect(botChainTestnet.rpcUrls.default).not.toHaveProperty('webSocket')
    expect(botChainTestnet.blockExplorers.default).toEqual({
      name: 'BOTScan',
      url: 'https://scan.bohr.life',
      apiUrl: 'https://scan.bohr.life/api/v2',
    })
    expect(botChainTestnet.contracts.multicall3.address).toBe(
      '0x47FA21f684bBAD707A53a0f9BE59F1422F46C265',
    )
    expect(botChainTestnet.testnet).toBe(true)
  })
})

describe('root export', () => {
  it('re-exports the chains', () => {
    expect(root.botChain).toBe(botChain)
    expect(root.botChainTestnet).toBe(botChainTestnet)
  })
})
