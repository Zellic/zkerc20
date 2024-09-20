pragma solidity ^0.8.27;

import {console} from "forge-std/Test.sol";

abstract contract MerkleTree {
    uint8 public targetHeight;
    uint256 public root = 0;
    uint256 public transactions = 0;

    constructor(uint8 _targetHeight) {
        targetHeight = _targetHeight;
    }

    function _insert(uint256 value, uint256[] memory proof) internal {
        require(proof.length <= targetHeight, "Invalid proof length");

        uint256 elevation = targetHeight - proof.length;
        verifyProof(root, 0, transactions >> elevation, proof);

        uint256[] memory newProof = new uint256[](targetHeight);
        for (uint i = 0; i < elevation; i++) newProof[i] = 0;
        for (uint i = 0; i < proof.length; i++) {
            newProof[i + elevation] = proof[i];
        }

        root = buildProof(value, transactions, newProof);
        transactions++;
    }

    function buildProof(
        uint256 value,
        uint256 index,
        uint256[] memory proof
    ) public pure returns (uint256) {
        uint256 current = value;
        for (uint256 i = 0; i < proof.length; i++) {
            if (index % 2 == 0) {
                current = _hash(current, proof[i]);
            } else {
                current = _hash(proof[i], current);
            }
            index >>= 1;
        }
        return current;
    }

    function verifyProof(
        uint256 tree,
        uint256 value,
        uint256 index,
        uint256[] memory proof
    ) public pure {
        require(
            buildProof(value, index, proof) == tree,
            "Invalid proof"
        );
    }

    function _hash(
        uint256 left,
        uint256 right
    ) public virtual pure returns (uint256);
}
