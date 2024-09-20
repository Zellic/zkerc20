pragma solidity ^0.8.27;

import "../interfaces/IBridge.sol";
import "../interfaces/IBridgeManager.sol";

abstract contract Bridge is IBridge {
    address public manager;

    constructor(address _manager) {
        manager = _manager;
    }

    function sendMessage(address sender, uint256 destChainId, bytes memory data) external payable {
        require(msg.sender == manager, "Bridge: Only manager can send message");
        _sendMessage(sender, destChainId, data);
    }

    function _sendMessage(address sender, uint256 destChainId, bytes memory data) internal virtual;

    function receiveMessage(uint256 srcChainId, bytes memory data) internal {
        IBridgeManager(manager).receiveMessage(srcChainId, data);
    }
}
