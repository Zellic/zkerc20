// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.27;

import { Node } from "../Node.sol";

/*

Not implementing this for now, because I realized this could be done two ways, 
and I don't know what's best yet.

- could share erc20+erc721 lock/unlock logic in the same contract. This is 
  safe because the asset addr.transfer would just abort since it's 
  hash(token addr, token id). This is just fine IMO but complicates the 
  existing code since we'd have to duplicate all of the functions (erc721 
  interfaces slightly different).
- alternatively, could have it be a separate contract. This still requires 
  duplicating code :(

Don't wanna dup code rn since we're rapidly developing this. But it shouldn't 
be hard to implement later.

*/

/*
contract ERC721Node is Node {
    
}
*/
