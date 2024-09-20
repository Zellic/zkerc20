pragma solidity ^0.8.27;

import "./interfaces/IBridge.sol";
import "./interfaces/IBridgeManager.sol";

abstract contract BridgeManager is IBridgeManager {
    // version
    uint8 public constant VERSION = 1;

    // TODO: remove
    mapping(address => address) public bridgeByToken; // token => bridge contract

    function _sendMessage(address sender, address token, uint256 destChainId, uint256[] memory proof) internal {
        address bridge = bridgeByToken[token];
        require(bridge != address(0), "Bridge not configured");

        bytes memory data = abi.encode(VERSION, token, proof);
        IBridge(bridge).sendMessage{value: msg.value}(sender, destChainId, data);
    }

    function receiveMessage(uint256 srcChainId, bytes memory data) external {
        (uint8 version, address token, uint256[] memory proof) = abi.decode(data, (uint8, address, uint256[]));

        require(token != address(0) && bridgeByToken[token] != address(0), "Bridge not configured");
        require(bridgeByToken[token] == msg.sender, "Unauthorized bridge");

        require(version == VERSION, "Invalid version");
        _receiveMessage(srcChainId, token, proof);
    }

    function _receiveMessage(uint256 srcChainId, address token, uint256[] memory proof) internal virtual;
}

