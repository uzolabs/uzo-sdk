import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'chains/index': 'src/chains/index.ts',
    'contracts/index': 'src/contracts/index.ts',
    'explorer/index': 'src/explorer/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  // Shared chunks for CJS too, so error classes keep one identity across subpaths.
  splitting: true,
  target: 'es2021',
  platform: 'neutral',
})
