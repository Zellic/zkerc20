// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.27;

import { Node } from "../Node.sol";

/*
 * Needs to be separate contract becasue there's no way to determine whether 
 * a token is an ERC20 or ERC721 once it is inside the private circle. 
 */
contract ERC721Node is Node {
    function _deployNewWrappedToken(address token) internal override returns (address) {
        // TODO
    }
}
