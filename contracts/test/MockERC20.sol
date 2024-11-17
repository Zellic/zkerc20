// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.27;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    address public node;

    constructor() ERC20("MockERC20", "MockERC20") {
        node = msg.sender;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external {
        _burn(from, amount);
    }
}


