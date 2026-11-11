// Quotes 1 USDT to WBOT on BOT Chain mainnet through BDEX V2 and V3, then builds the
// unsigned approve and swap calls. Read only: nothing is signed or sent, no keys needed.
//   npx tsx examples/quote-swap.ts

import {
  applySlippage,
  buildErc20Approve,
  buildSwapExactTokensForTokensV2,
  getAmountsOutV2,
  getFeeTiersV3,
  getPoolV3,
  quoteExactInputSingleV3,
} from '@uzolabs/sdk/bdex'
import { botChain } from '@uzolabs/sdk/chains'
import { addresses } from '@uzolabs/sdk/contracts'
import { createPublicClient, formatUnits, http } from 'viem'

const client = createPublicClient({ chain: botChain, transport: http() })
const { usdt, wbot, bdexV2Router02 } = addresses[677]
const amountIn = 1_000_000n // 1 USDT, 6 decimals
// Placeholder recipient. Use the connected wallet's address in an app.
const recipient = '0x000000000000000000000000000000000000dEaD'

const v2Out = (await getAmountsOutV2(client, { amountIn, path: [usdt, wbot] })).at(-1) ?? 0n
console.log(`V2: 1 USDT = ${formatUnits(v2Out, 18)} WBOT`)

for (const { fee } of await getFeeTiersV3(client)) {
  if (!(await getPoolV3(client, { tokenA: usdt, tokenB: wbot, fee }))) continue
  try {
    const { amountOut } = await quoteExactInputSingleV3(client, {
      tokenIn: usdt,
      tokenOut: wbot,
      fee,
      amountIn,
    })
    console.log(`V3 ${fee / 10_000}%: 1 USDT = ${formatUnits(amountOut, 18)} WBOT`)
  } catch {
    console.log(`V3 ${fee / 10_000}%: pool cannot fill this amount`)
  }
}

// Unsigned calls for the user's wallet. The swap builder takes the quote and computes the
// minimum itself: 0.5% default slippage, 5% hard cap. applySlippage is only for display here.
console.log(`Minimum received at 0.5%: ${formatUnits(applySlippage(v2Out), 18)} WBOT`)
const approve = buildErc20Approve({
  chainId: 677,
  token: usdt,
  spender: bdexV2Router02,
  amount: amountIn,
})
const swap = buildSwapExactTokensForTokensV2({
  chainId: 677,
  amountIn,
  quotedAmountOut: v2Out,
  path: [usdt, wbot],
  to: recipient,
  deadline: BigInt(Math.floor(Date.now() / 1000) + 1200), // at most 1 hour ahead
})
console.log({ approve, swap })
