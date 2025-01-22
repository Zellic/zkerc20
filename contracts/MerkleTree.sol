// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.27;

abstract contract MerkleTree {
    uint8 public targetHeight;
    uint256 public root = 0;
    uint64 public transactions = 0;

    mapping(uint64 => uint256) public pastRoots;

    mapping(uint256 => uint256) public filledSubtrees; // https://www.zellic.io/blog/how-does-tornado-cash-work/#setup

    constructor(uint8 _targetHeight) {
        require(_targetHeight > 0, "Invalid target height");

        targetHeight = _targetHeight;

        for (uint i = 0; i < targetHeight; i++) {
            filledSubtrees[i] = 0;
        }
    }


    function _insert(uint256 value) public returns (uint256 position) {
        require(transactions < 2**targetHeight, "Tree is full");

        uint256 index = transactions;

        uint256 current = value;
        for (uint256 i = 0; i < targetHeight; i++) {
            if (index % 2 == 0) {
                filledSubtrees[i] = current;
                current = _hash(current, uint256(0));
            } else {
                current = _hash(filledSubtrees[i], current);
            }
            index >>= 1;
        }

        root = current;
        pastRoots[transactions] = root;
        position = transactions;

        transactions++;
    }


    function verifyProof(
        uint256 tree,
        uint256 value,
        uint256 index,
        uint256[] memory proof
    ) public view {
        uint256 current = value;
        for (uint256 i = 0; i < proof.length; i++) {
            if (index % 2 == 0) {
                current = _hash(current, proof[i]);
            } else {
                current = _hash(proof[i], current);
            }
            index >>= 1;
        }

        require(current == tree, "Invalid proof");
    }


    function _hash(
        uint256 left,
        uint256 right
    ) public virtual view returns (uint256);
}
