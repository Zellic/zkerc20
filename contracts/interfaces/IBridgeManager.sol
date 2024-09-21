pragma solidity ^0.8.27;

interface IBridgeManager {
    function receiveMessage(uint256 srcChainId, bytes memory data) external;
    function configureBridge(uint8 bridgeId, address bridge) external;
}
