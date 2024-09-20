pragma solidity ^0.8.27;

contract ZKERC20 is IZKERC20 {
    address public immutable node;
    address public immutable token;

    modifier onlyNode() {
        require(msg.sender == node, "ZKERC20: caller is not the node");
        _;
    }

    constructor(address _token) {
        token = _token;
    }


    //////////////////////////
    // NODE-ONLY FUNCTIONS
    

    function mint(address to, uint256 amount) external onlyNode {
        // TODO
    }

    function burn(address from, uint256 amount, uint256[] memory proof) external onlyNode {
        // TODO
    }


    //////////////////////////
    // PUBLIC FUNCTIONS


    function transfer(uint256[] memory proof) external {
        // TODO
    }
}
