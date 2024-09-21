pragma solidity ^0.8.20;

import { LZBridge } from "../contracts/bridges/LZBridge.sol";
import { OApp, Origin, MessagingFee, MessagingReceipt } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/OApp.sol";
import { TestHelper } from "@layerzerolabs/lz-evm-oapp-v2/test/TestHelper.sol";
import "forge-std/console.sol";

contract LZBridgeMock is LZBridge {
    constructor(address _origin, address _oapp, address _endpoint) LZBridge(_origin, _oapp, _endpoint) {}

    function sendMessage(uint256 destChainId, bytes memory _data) public payable {
        _sendMessage(msg.sender, destChainId, _data);
    }
}

contract LZBridgeTest is TestHelper {
    uint256 public CHAIN_ID_A = 1;
    uint256 public CHAIN_ID_B = 2;

    uint32 private aEid = 1;
    uint32 private bEid = 2;

    LZBridgeMock private aLZBridge;
    LZBridgeMock private bLZBridge;

    address private userA = address(0x1);
    address private userB = address(0x2);
    uint256 private initialBalance = 100 ether;

    function setUp() public virtual override {
        // Provide initial Ether balances to users for testing purposes
        vm.deal(userA, 1000 ether);
        vm.deal(userB, 1000 ether);

        // Call the base setup function from the TestHelper contract
        super.setUp();

        // Initialize 2 endpoints, using UltraLightNode as the library type
        setUpEndpoints(2, LibraryType.UltraLightNode);

        // deploy two OApps
        aLZBridge = LZBridgeMock(
            _deployOApp(type(LZBridgeMock).creationCode, abi.encode(address(this), address(this), address(endpoints[aEid])))
        );
        bLZBridge = LZBridgeMock(
            _deployOApp(type(LZBridgeMock).creationCode, abi.encode(address(this), address(this), address(endpoints[bEid])))
        );

        aLZBridge.configureChainId(CHAIN_ID_B, bEid);
        bLZBridge.configureChainId(CHAIN_ID_A, aEid);

        // Configure and wire the OApps together
        address[] memory bridges = new address[](2);
        bridges[0] = address(aLZBridge);
        bridges[1] = address(bLZBridge);
        this.wireOApps(bridges);
    }


    function test_send_message() public {
        // Build options for the send operation
        bytes memory options;

        // Quote the fee for sending tokens
        uint256 nativeFee = aLZBridge.estimateFee(CHAIN_ID_B, abi.encode(uint256(0)));

        // Perform the send operation
        bytes memory payload = abi.encode(uint256(1337));
        vm.prank(userA);
        aLZBridge.sendMessage{ value: nativeFee }(CHAIN_ID_B, payload);

        // Verify that the packets were correctly sent to the destination chain.
        // @param _dstEid The endpoint ID of the destination chain.
        // @param _dstAddress The OApp address on the destination chain.
        verifyPackets(bEid, addressToBytes32(address(bLZBridge)));
    }

    function receiveMessage(uint256 srcChainId, bytes memory data) external {
        //console.log("Received message from chain %d", srcChainId);
    }
}
