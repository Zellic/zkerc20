pragma solidity ^0.8.27;

interface IBridgeManager {
    function bridgeByToken(address token) external view returns (address);
    function receiveMessage(uint256 sourceChainId, bytes memory data) external;
}
