pragma solidity ^0.8.27;

import { Node } from "../contracts/Node.sol";
import { LZBridge } from "../contracts/bridges/LZBridge.sol";

contract Deploy {
    constructor(address _lzEndpoint) {
        address deployer = msg.sender;

        Node node = new Node();

        LZBridge lzBridge = new LZBridge(deployer, address(node), _lzEndpoint);
        node.configureBridge(1, address(lzBridge));

        // remove owner
        node.renounceOwnership();
    }
}
