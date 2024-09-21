pragma solidity ^0.8.27;

interface IZKERC20 {
    function mint(address asset, address to, uint256 amount) external;
    function mint(uint256 commitment) external;
    function burn(address asset, address from, uint256 amount, uint256 nullifier, uint256[] memory proof) external;    
    function transferFrom(uint256 _nullifier, uint256[] memory proof) external;
}
