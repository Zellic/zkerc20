pragma solidity ^0.8.27;

import {Test, console} from "forge-std/Test.sol";
import { Node } from "../contracts/Node.sol";

contract TestNode is Node {
    
}

contract NodeTest is Test {
    TestNode node;

    function setup() public {
        node = new TestNode();
    }


}
