pragma solidity ^0.8.27;

import "./interfaces/IBridge.sol";
import "./interfaces/IBridgeManager.sol";

abstract contract BridgeManager is IBridgeManager {
    // version
    uint8 public constant VERSION = 1;

    mapping(address => address) public bridgeByToken; // token => bridge contract

    function sendMessage(address token, uint256[] memory proof) internal {
        address bridge = bridgeByToken[token];
        require(bridge != address(0), "Bridge not configured");

        bytes memory data = abi.encode(VERSION, proof);
        IBridge(bridge).sendMessage{value: msg.value}(msg.sender, token, data);
    }

    function receiveMessage(address token, bytes memory data) external {
        require(token != 0 && brdigeByToken[token] != address(0), "Bridge not configured");
        require(bridgeByToken[token] == msg.sender, "Unauthorized bridge");

        (uint8 version, uint256[] memory proof, ) = abi.decode(data, (uint8, uint256[],));
        require(version == VERSION, "Invalid version");

        // TODO
        // [...]
    }
}

