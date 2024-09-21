pragma solidity ^0.8.27;

import {TransactionKeeper} from "../contracts/TransactionKeeper.sol";
import {Test, console} from "forge-std/Test.sol";

contract TransactionKeeperTest is Test {
    function test_hash() public {
        TransactionKeeper keeper = new TransactionKeeper();
        assertEq(
            keeper._hash(1, 2),
            0x2bcea035a1251603f1ceaf73cd4ae89427c47075bb8e3a944039ff1e3d6d2a6f
        );
    }

    function test_commitment() public {
        TransactionKeeper keeper = new TransactionKeeper();
        assertEq(
            keeper._commitment(1, 2, 3, 4),
            0x35a3142e0e2fac9617c73a955b1215da65e5aea9ed3ed9fe756ea778cc9ec78
        );
    }
}
