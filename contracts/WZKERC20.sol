pragma solidity 0.8.27;

import { IWZKERC20 } from "./interfaces/IWZKERC20.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract WZKERC20 is IWZKERC20, ERC20 {
    address public node;

    constructor() ERC20("WZKERC20", "WZKERC20") {
        node = msg.sender;
    }

    function mint(address to, uint256 amount) external {
        require(msg.sender == node, "WZKERC20: only node can mint");
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external {
        require(msg.sender == node, "WZKERC20: only node can burn");
        _burn(from, amount);
    }
}

