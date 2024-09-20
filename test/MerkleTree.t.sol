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

    function hash(uint256 value) public pure returns (uint256) {
        return uint256(keccak256(value));
    }
}

contract KeccakMerkleTree is MerkleTree(3) {
    function _hash(
        uint256 left,
        uint256 right
    ) public override pure returns (uint256) {
        return Hash.hash(left, right);
    }

    function _hash(uint256 value) public override pure returns (uint256) {
        return Hash.hash(value);
    }

    function insert(uint256 value, uint256[] memory proof) public {
        super._insert(value, proof);
    }
}

contract MerkleTreeTest is Test {
    function test_zero() public {
        KeccakMerkleTree tree = new KeccakMerkleTree();
        assertEq(tree.root(), 0);
    }

    function test_add_one() public {
        KeccakMerkleTree tree = new KeccakMerkleTree();
        tree.insert(1, new uint256[](0));

        assertEq(tree.root(), Hash.hash(Hash.hash(Hash.hash(1, 0), 0), 0));
    }

    function test_add_two() public {
        KeccakMerkleTree tree = new KeccakMerkleTree();
        tree.insert(1, new uint256[](0));

        uint256[] memory proof = new uint256[](3);
        proof[0] = 1;
        proof[1] = 0;
        proof[2] = 0;
        tree.insert(2, proof);

        assertEq(tree.root(), Hash.hash(Hash.hash(Hash.hash(1, 2), 0), 0));
    }

    function test_add_three() public {
        KeccakMerkleTree tree = new KeccakMerkleTree();
        tree.insert(1, new uint256[](0));

        uint256[] memory proof = new uint256[](3);
        proof[0] = 1;
        proof[1] = 0;
        proof[2] = 0;
        tree.insert(2, proof);

        proof = new uint256[](2);
        proof[0] = Hash.hash(1, 2);
        proof[1] = 0;
        tree.insert(3, proof);

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
        tree.insert(1, new uint256[](0));

        uint256[] memory proof = new uint256[](3);
        proof[0] = 1;
        proof[1] = 0;
        proof[2] = 0;
        tree.insert(2, proof);

        proof = new uint256[](2);
        proof[0] = Hash.hash(1, 2);
        proof[1] = 0;
        tree.insert(3, proof);

        proof = new uint256[](3);
        proof[0] = 3;
        proof[1] = Hash.hash(1, 2);
        proof[2] = 0;
        tree.insert(4, proof);

        uint256 leftSubtree = Hash.hash(
            Hash.hash(1, 2),
            Hash.hash(3, 4)
        );

        proof = new uint256[](1);
        proof[0] = leftSubtree;
        tree.insert(5, proof);

        proof = new uint256[](3);
        proof[0] = 5;
        proof[1] = 0;
        proof[2] = leftSubtree;
        tree.insert(6, proof);

        proof = new uint256[](2);
        proof[0] = Hash.hash(5, 6);
        proof[1] = leftSubtree;
        tree.insert(7, proof);

        proof = new uint256[](3);
        proof[0] = 7;
        proof[1] = Hash.hash(5, 6);
        proof[2] = leftSubtree;
        tree.insert(8, proof);

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
