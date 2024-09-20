pragma solidity ^0.8.27;

contract ZKERC20 is IZKERC20 {
    address public immutable node;

    modifier onlyNode() {
        require(msg.sender == node, "ZKERC20: caller is not the node");
        _;
    }

    constructor() {}


    //////////////////////////
    // NODE-ONLY FUNCTIONS
    

    function mint(address asset, address to, uint256 amount) external onlyNode {
        // TODO
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
}
