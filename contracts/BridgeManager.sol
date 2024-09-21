pragma solidity ^0.8.27;

import "./interfaces/IBridge.sol";
import "./interfaces/IBridgeManager.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

abstract contract BridgeManager is IBridgeManager, Ownable {
    // version
    uint8 public constant VERSION = 1;

    mapping(uint8 => address) public bridgeToContract; // bridge id => bridge contract
    mapping(address => uint8) public contractToBridge; // bridge contract => bridge id

    constructor(address _deployer) Ownable() {
        transferOwnership(_deployer);
    }


    function _sendMessage(
        uint8 bridgeId,
        address refundAddress,
        uint256 destChainId, // TODO: share bits with bridgeId for gas opt
        uint256 commitment
    ) internal {
        address bridge = bridgeToContract[bridgeId];
        require(bridge != address(0), "Node: bridge not configured");

        bytes memory data = abi.encode(VERSION, commitment);
        IBridge(bridge).sendMessage{value: msg.value}(refundAddress, destChainId, data);
    }


    function receiveMessage(uint256 srcChainId, bytes memory data) external {
        (uint8 version, uint256 commitment) = abi.decode(data, (uint8, uint256));

        uint8 bridgeId = contractToBridge[msg.sender];
        require(bridgeId != 0, "Node: bridge not configured");

        require(version == VERSION, "Node: invalid version");

        _receiveMessage(srcChainId, commitment);
    }


    function _receiveMessage(uint256 srcChainId, uint256 commitment) internal virtual;
    

    //////////////////////////
    // CONFIGURATION

    function configureBridge(uint8 bridgeId, address bridge) external onlyOwner {
        require(bridgeId != 0, "Node: invalid bridge id"); // 0 must mean unconfigured
        require(bridge != address(0), "Node: invalid bridge address");
        require(bridgeToContract[bridgeId] == address(0), "Node: bridge already configured");
        require(contractToBridge[bridge] == 0, "Node:bridge contract already configured");

        bridgeToContract[bridgeId] = bridge;
        contractToBridge[bridge] = bridgeId;
    }
}

