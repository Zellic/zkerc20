pragma solidity ^0.8.27;

import "./MerkleTree.sol";

contract ZKERC20 is IZKERC20, MerkleTree {
    address public immutable node;
    uint256 public constant DEFAULT_SECRET = 0;

    modifier onlyNode() {
        require(msg.sender == node, "ZKERC20: caller is not the node");
        _;
    }

    constructor() {}


    //////////////////////////
    // NODE-ONLY FUNCTIONS
    

    function mint(address asset, address to, uint256 amount) external onlyNode {
        uint256 newLeaf = commitment(asset, to, amount, DEFAULT_SECRET);
        _insert(newLeaf, proof); // TODO where to get proof from
    }

    function burn(address asset, address from, uint256 amount, uint256[] memory proof) external onlyNode {
        // TODO: this will burn the entire balance, then mint the remaining balance
    }

    function burn(address asset, address from, uint256[] memory proof) external onlyNode {
        // TODO: this will burn the entire balance
    }


    //////////////////////////
    // PUBLIC FUNCTIONS


    function transferFrom(uint256[] memory proof) external {
        // TODO
    }


    //////////////////////////
    // HELPER FUNCTIONS

    
    function commitment(address asset, address to, uint256 amount, uint256 secret) public pure returns (uint256 leaf) {
        leaf = hash(abi.encodePacked(asset, to, amount, secret));
    }


    function _hash(
        uint256 left,
        uint256 right
    ) public virtual pure returns (uint256) {
        return _hash(abi.encodePacked(left, right));
    }


    function _hash(uint256 value) public virtual pure returns (uint256) {
        // MIMC hash

    }
}
