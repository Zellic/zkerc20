pragma solidity ^0.8.27;

import { MerkleTree } from "./MerkleTree.sol";
import { IZKERC20 } from "./interfaces/IZKERC20.sol";

contract ZKERC20 is IZKERC20, MerkleTree {
    address public immutable node;
    uint256 public constant DEFAULT_SECRET = 0;

    event Mint(address indexed asset, address indexed to, uint256 amount);
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
    

    function mint(address asset, address to, uint256 amount) external onlyNode {
        uint256 newLeaf = commitment(to, asset, amount, DEFAULT_SECRET);
        //_insert(newLeaf, proof); // TODO where to get proof from
        emit Mint(asset, to, amount);
    }

    function burn(address asset, address from, uint256 amount, uint256[] memory proof) external onlyNode {
        // TODO: this will burn the entire balance, then mint the remaining balance
        emit Burn(asset, from, amount);
    }

    function burn(address asset, address from, uint256[] memory proof) external onlyNode {
        // TODO: this will burn the entire balance
        emit Burn(asset, from, 0); // TODO
    }


    //////////////////////////
    // PUBLIC FUNCTIONS


    function transferFrom(uint256[] memory proof) external {
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
    function commitment(address to, address asset, uint256 amount, uint256 salt) public pure returns (uint256 leaf) {
        uint256 _nullifier = nullifier(to, asset, amount, salt);
        leaf = _hash(abi.encodePacked(_nullifier, salt));
    }


    // sender || asset || amount || salt
    function nullifier(address sender, address asset, uint256 amount, uint256 salt) public pure returns (uint256) {
        return _hash(abi.encodePacked(sender, asset, amount, salt));
    }

    
    // MIMC
    function _hash(
        uint256 left,
        uint256 right
    ) public override pure returns (uint256) {
        return _hash(abi.encodePacked(left, right));
    }


    // Pedersen
    function _hash(bytes memory data) public pure returns (uint256) {

    }
}
