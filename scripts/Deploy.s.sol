pragma solidity ^0.8.27;

import { Node } from "../contracts/Node.sol";
import { LZBridge } from "../contracts/bridges/LZBridge.sol";
import { MockERC20 } from "forge-std/MockERC20.sol";

contract Deploy {
    emit MockERC20Deployed(address token);
    emit Deployed(address node, address lzBridge);

    constructor(address _lzEndpoint) {
        address deployer = msg.sender;

        Node node = new Node();

        LZBridge lzBridge = new LZBridge(deployer, address(node), _lzEndpoint);
        node.configureBridge(1, address(lzBridge));

        // remove owner
        node.renounceOwnership();
        event Deployed(address(node), address(lzBridge));

        mintDemoERC20();
    }


    function mintDemoERC20() {
        MockERC20 token = new MockERC20("Demo", "DEMO", 18, 1000000000000000000000000000);
        emit MockERC20Deployed(address(token));
    }
}
