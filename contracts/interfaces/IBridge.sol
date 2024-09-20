pragma solidity ^0.8.27;

interface Bridge {
    function sendMessage(address sender, uint256 destChainId, bytes memory data) external;

    function _sendMessage(uint256 destChainId, bytes memory data) private;
    function receiveMessage(uint256 srcChainId, bytes memory data) private;
}
