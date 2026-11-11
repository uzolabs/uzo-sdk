import { parseAbi } from 'viem'

/**
 * The BotBridge (bridge router) functions the bridge module calls. Checked against the
 * generated `botBridgeAbi` in the unit tests.
 *
 * @internal
 */
export const botBridgeFragment = parseAbi([
  'function Bridge() view returns (address)',
  'function deposit(uint256 destinationChainId, bytes32 resourceId, address recipient, uint256 amount) payable',
  'function getBridgePause() view returns (bool)',
  'function getTokenPauseByResourceId(bytes32 resourceId) view returns (bool)',
  'function getMinAmountUsd() view returns (uint256)',
  'function getMaxAmountUsd() view returns (uint256)',
  'function getMinFee() view returns (uint256)',
  'function getBotGasConfig() view returns ((uint256 destinationChainId, bytes32 resourceId, uint256 amount, address oracle, address baseToken, address quoteToken, uint32 twapWindow) cfg, bool enabled)',
])

/**
 * The core Bridge functions BotBridge itself calls during `deposit`, taken from the
 * verified `IBridge` interface. The core Bridge address is read from `BotBridge.Bridge()`
 * at call time, never hard-coded.
 *
 * @internal
 */
export const coreBridgeFragment = parseAbi([
  'function getTokenInfoByResourceId(bytes32 resourceId) view returns (uint8 assetsType, address token, bool pause, uint256 decimalScale, bool burnable, bool mintable)',
  'function chainAndTokenFee(uint256 destinationChainId, bytes32 resourceId) view returns (uint256)',
  'function isSupportedRoute(uint256 sourceChainId, uint256 destinationChainId) view returns (bool)',
])
