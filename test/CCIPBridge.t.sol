pragma solidity ^0.8.20;

import { CCIPBridge } from "../contracts/bridges/CCIPBridge.sol";
import { Test } from "forge-std/Test.sol";
import {
    CCIPLocalSimulator,
    IRouterClient,
    BurnMintERC677Helper
} from "@chainlink/local/src/ccip/CCIPLocalSimulator.sol";
import { Client } from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";
import "forge-std/console.sol";

contract CCIPBridgeMock is CCIPBridge {
    constructor(address _origin, address _oapp, address _router) CCIPBridge(_origin, _oapp, _router) {}

    function sendMessage(uint256 destChainId, bytes memory _data) public payable {
        _sendMessage(msg.sender, destChainId, _data);
    }
}

contract LZBridgeTest is Test {
    uint256 public CHAIN_ID_A = 1;
    uint256 public CHAIN_ID_B = 2;

    CCIPLocalSimulator public ccipLocalSimulator;
    address alice;
    address bob;
    IRouterClient router;

    CCIPBridgeMock aBridge;
    CCIPBridgeMock bBridge;

    uint256 receiveCounter = 0; // increments each receive, for test


    function setUp() public {
        ccipLocalSimulator = new CCIPLocalSimulator();
    
        (uint64 chainSelector, IRouterClient sourceRouter,,,,,) =
            ccipLocalSimulator.configuration();
        alice = makeAddr("alice");
        bob = makeAddr("bob");
        vm.deal(alice, 1000 ether);
        vm.deal(bob, 1000 ether);
        router = sourceRouter;

        aBridge = new CCIPBridgeMock(address(this), address(this), address(router));
        bBridge = new CCIPBridgeMock(address(this), address(this), address(router));
        aBridge.configureChainId(CHAIN_ID_B, chainSelector);
        // skipping bBridge configuration for now
    }


    function test_sendMessage() public {
        uint256 fee = aBridge.estimateFee(CHAIN_ID_B, abi.encode(uint256(0)));

        bytes memory payload = abi.encode(uint256(1337));
        uint256 _receiveCounterBefore = receiveCounter;

        vm.prank(alice);
        aLZBridge.sendMessage{ value: fee }(CHAIN_ID_B, payload);

        uint256 _receiveCounterAfter = receiveCounter;
        assertEq(_receiveCounterAfter, _receiveCounterBefore + 1, "receiveCounter not incremented");
    }


    function receiveMessage(uint256 srcChainId, bytes memory data) external {
        receiveCounter++;
        console.log("CCIP: Received message from chain %d", srcChainId);
    }
}
