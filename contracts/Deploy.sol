pragma solidity ^0.8.27;

import { Node } from "../contracts/Node.sol";
import { LZBridge } from "../contracts/bridges/LZBridge.sol";
import { CCIPBridge } from "../contracts/bridges/CCIPBridge.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

contract GM is ERC20 {
    constructor(address sender) ERC20("GM", "GM") {
        _mint(sender, 100000000000);
    }
}


contract Deploy is Ownable {
    event Deployed(address node, address lzBridge, address ccipBridge);

    Node public node;
    LZBridge public lzBridge;
    CCIPBridge public ccipBridge;
    address public memecoin;

    // DO NOT CHANGE. ONLY ADD NEW BRIDGE TYPES
    uint8 public constant LZ_BRIDGE = 10;
    uint8 public constant CCIP_BRIDGE = 20;

    constructor() {
        transferOwnership(msg.sender);
    }


    function initialize(address _hashContracts, address payable _node, address _lzBridge, address _ccipBridge) public onlyOwner {
        require(address(node) == address(0), "Already initialized");
        node = Node(_node);
        lzBridge = LZBridge(_lzBridge);
        ccipBridge = CCIPBridge(_ccipBridge);
    }


    function connectLz(uint256 destChainId, uint32 eid, address counterparty) public onlyOwner {
        lzBridge.configureChainId(destChainId, eid);
        // NOTE: we are leaving the default LZ config as is
        lzBridge.setPeer(eid, bytes32(bytes20(counterparty)));
    }


    function connectCCIP(uint256 destChainId, uint64 selector, address counterparty) public onlyOwner {
        ccipBridge.configureChainId(destChainId, selector, counterparty);
    }


    function demo() public onlyOwner returns (address) {
        // create new memecoin and mint to sender
        memecoin = _createMemecoin();
        return memecoin;
    }


    // create new memecoin and mint to sender
    function _createMemecoin() internal returns (address) {
        GM gm = new GM(msg.sender);
        return address(gm);
    }


    function renounce() public onlyOwner {
        // remove ability for this contract to configure Node/BridgeManager
        // NOTE: commented out because we want ability to add bridges later
        //node.renounceOwnership();

        // remove ability to call connect function on this contract.
        renounceOwnership();

        // LZBridge will retain the deployer as owner
        // TODO: should transfer ownership to multisig/governance later
    }
}
