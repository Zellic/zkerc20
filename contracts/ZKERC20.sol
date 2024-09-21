pragma solidity ^0.8.27;

import { MerkleTree } from "./MerkleTree.sol";
import { IZKERC20 } from "./interfaces/IZKERC20.sol";

contract ZKERC20 is IZKERC20, MerkleTree {
    address public immutable node;
    uint256 public constant DEFAULT_SECRET = 0;

    mapping(uint256 => bool) public usedNullifiers;

    event Mint(address indexed asset, address indexed to, uint256 amount);
    event Mint();
    event Burn(address indexed asset, address indexed from, uint256 amount);
    event Transfer();

    modifier onlyNode() {
        require(msg.sender == node, "ZKERC20: caller is not the node");
        _;
    }

    constructor() MerkleTree(20) {
        node = msg.sender;
    }


    //////////////////////////
    // NODE-ONLY FUNCTIONS
    

    // TODO: refactor
    function mint(address asset, address to, uint256 amount) external onlyNode {
        uint256 newLeaf = _commitment(to, asset, amount, DEFAULT_SECRET);
        _insert(newLeaf);
        emit Mint(asset, to, amount);
    }

    function mint(uint256 commitment) external onlyNode {
        _insert(commitment);
        emit Mint();
    }

    function burn(address asset, address from, uint256 amount, uint256 nullifier, uint256[] memory proof) external onlyNode {
        require(!usedNullifiers[nullifier], "ZKERC20: nullifier already used");

        // TODO: verify proof

        usedNullifiers[nullifier] = true;
        emit Burn(asset, from, amount);
    }


    //////////////////////////
    // PUBLIC FUNCTIONS


    function transferFrom(uint256 nullifier, uint256[] memory proof) external {
        // TODO
        emit Transfer();
    }


    function name() public pure returns (string memory) {
        return "ZKERC20";
    }
    function symbol() public pure returns (string memory) {
        return "ZKERC20";
    }
    function decimals() public pure returns (uint8) {
        revert("ZKERC20: decimals not supported");
    }
    function totalSupply() public pure returns (uint256) {
        revert("ZKERC20: totalSupply not supported");
    }
    function balanceOf(address account) public pure returns (uint256) {
        revert("ZKERC20: balanceOf not supported");
    }
    function allowance(address owner, address spender) public pure returns (uint256) {
        revert("ZKERC20: allowance not supported");
    }


    //////////////////////////
    // HELPER FUNCTIONS

    
    // nullifier || salt
    function _commitment(address to, address asset, uint256 amount, uint256 salt) public pure returns (uint256 leaf) {
        uint256 nullifier = _nullifier(to, asset, amount, salt);
        leaf = _hash(abi.encodePacked(nullifier, salt));
    }


    // sender || asset || amount || salt
    function _nullifier(address sender, address asset, uint256 amount, uint256 salt) public pure returns (uint256) {
        return _hash(abi.encodePacked(sender, asset, amount, salt));
    }

    
    // MIMC
    function _hash(
        uint256 left,
        uint256 right
    ) public override pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(left, right))); // TODO
    }


    // Posiden
    function _hash(bytes memory data) public pure returns (uint256) {
        return uint256(keccak256(data)); // TODO
    }
}
