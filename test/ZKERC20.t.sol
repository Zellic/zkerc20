pragma solidity ^0.8.27;

import {Test, console} from "forge-std/Test.sol";
import { ZKERC20 } from "../contracts/ZKERC20.sol";

contract TestZKERC20 is ZKERC20 {

}

contract ZKERC20Test is Test {
    TestZKERC20 zkerc20;
    address asset = address(0x1);

    function setUp() public {
        zkerc20 = new TestZKERC20();
    }

    function test_mint() public {
        uint256 oldRoot = zkerc20.root();
        zkerc20._mint(asset, address(this), 100, 0);
        uint256 newRoot = zkerc20.root();
        assertTrue(oldRoot != newRoot);
    }

    function test_mintBurn() public {
        uint256 salt = 0xdeadbeef;

        uint256 oldRoot = zkerc20.root();
        zkerc20._mint(asset, address(this), 100, salt);
        uint256 newRoot1 = zkerc20.root();
        assertTrue(oldRoot != newRoot1);

        uint256 nullifier = zkerc20._nullifier(
            uint256(uint160(address(this))),
            uint256(uint160(asset)),
            100,
            salt
        );
        /*zkerc20._burn(asset, address(this), 100, nullifier, new uint256[](0));
        uint256 newRoot2 = zkerc20.root();
        assertTrue(newRoot1 == newRoot2);*/
    }
}

