pragma solidity ^0.8.27;

import "./interface/IBridge.sol";
import "./interface/IBridgeManager.sol";

abstract contract Bridge is IBridge {
    BridgeManager public manager;

    constructor(BridgeManager _manager) {
        manager = _manager;
    }

    function sendMessage(address sender, uint256 destChainId, bytes memory data) external {
        require(msg.sender == address(manager), "Bridge: Only manager can send message");
        _sendMessage(sender, destChainId, data);
    }

    function _sendMessage(uint256 destChainId, bytes memory data) private;

    function receiveMessage(uint256 srcChainId, bytes memory data) private {
        manager.receiveMessage(srcChainId, data);
    }
}
