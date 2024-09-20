// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

import {Test, console} from "forge-std/Test.sol";
import {MerkleTree} from "../contracts/MerkleTree.sol";

library Hash {
    function hash(
        uint256 left,
        uint256 right
    ) public pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(left, right)));
    }
}

contract KeccakMerkleTree is MerkleTree(3) {
    function _hash(
        uint256 left,
        uint256 right
    ) public override pure returns (uint256) {
        return Hash.hash(left, right);
    }

    function insert(uint256 value) public {
        super._insert(value);
    }
}

contract MerkleTreeTest is Test {
    function test_zero() public {
        KeccakMerkleTree tree = new KeccakMerkleTree();
        assertEq(tree.root(), 0);
    }

    function test_add_one() public {
        KeccakMerkleTree tree = new KeccakMerkleTree();
        tree.insert(1);

        assertEq(tree.root(), Hash.hash(Hash.hash(Hash.hash(1, 0), 0), 0));
    }

    function test_add_two() public {
        KeccakMerkleTree tree = new KeccakMerkleTree();
        tree.insert(1);
        tree.insert(2);

        assertEq(tree.root(), Hash.hash(Hash.hash(Hash.hash(1, 2), 0), 0));
    }

    function test_add_three() public {
        KeccakMerkleTree tree = new KeccakMerkleTree();
        tree.insert(1);
        tree.insert(2);
        tree.insert(3);

        assertEq(
            tree.root(),
            Hash.hash(
                Hash.hash(
                    Hash.hash(1, 2),
                    Hash.hash(3, 0)
                ),
                0
            )
        );
    }

    function test_saturate() public {
        KeccakMerkleTree tree = new KeccakMerkleTree();
        tree.insert(1);
        tree.insert(2);
        tree.insert(3);
        tree.insert(4);
        tree.insert(5);
        tree.insert(6);
        tree.insert(7);
        tree.insert(8);

        assertEq(
            tree.root(),
            Hash.hash(
                Hash.hash(
                    Hash.hash(1, 2),
                    Hash.hash(3, 4)
                ),
                Hash.hash(
                    Hash.hash(5, 6),
                    Hash.hash(7, 8)
                )
            )
        );
    }
}
