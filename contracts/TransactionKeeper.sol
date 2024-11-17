// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.27;

import { MerkleTree } from "./MerkleTree.sol";
import { Groth16Verifier } from "../circuits/verifier.sol";
import {
    IPoseidonTwo,
    IPoseidonFour,
    IMimcSponge,
    HashContracts
} from "./HashContracts.sol";

struct ProofCommitment {
    uint256[2] a;
    uint256[2][2] b;
    uint256[2] c;
}

contract TransactionKeeper is MerkleTree(30) {
    event Transaction (
        uint256 commitment,
        uint256 index
    );

    event PublicTransaction (
        uint256 commitment,
        uint256 index,

        address asset,
        uint256 amount
    );


    Groth16Verifier public verifier = new Groth16Verifier();
    mapping(uint256 => bool) public spent;

    IPoseidonTwo public poseidonTwo;
    IPoseidonFour public poseidonFour;
    IMimcSponge public mimcSponge;


    constructor(address _hashContracts) {
        // XXX: have to do this silly multistep deployment because constructor 
        // is too big if we just deploy there.
        HashContracts deployer = HashContracts(_hashContracts);
        poseidonTwo = deployer.poseidonTwo();
        poseidonFour = deployer.poseidonFour();
        mimcSponge = deployer.mimcSponge();
    }


    // Checks the proof, nullifies the nullifiers, and returns true if the proof
    // is valid.
    function _checkProof(
        uint256 leftCommitment,
        uint256 rightCommitment,
        uint256[8] memory nullifiers,
        ProofCommitment memory proof
    ) private returns (bool) {
        bool valid = verifier.verifyProof(
            proof.a,
            proof.b,
            proof.c,
            [
                MerkleTree.root,
                leftCommitment,
                rightCommitment,
                nullifiers[0],
                nullifiers[1],
                nullifiers[2],
                nullifiers[3],
                nullifiers[4],
                nullifiers[5],
                nullifiers[6],
                nullifiers[7]
            ]
        );

        if (!valid) { return false; }

        // ensures nullifiers are unique (no duplicates in the array) after proof 
        // verification
        for (uint256 i = 0; i < nullifiers.length; i++) {
            if (spent[nullifiers[i]]) { return false; }
            spent[nullifiers[i]] = true;
        }

        return true;
    }


    // checks that the leftCommitment simply has the right amount and asset,
    // without revealing the salt. Does not nullify anything.
    function _verifyInsertProof(
        address asset,
        uint256 amount,
        uint256 leftCommitment,
        ProofCommitment memory proof
    ) private view returns (bool) {
        // construct a merkle trie with one input note
        (uint256 inputCommitment, uint256 inputNullifier) = _commitment(
            uint256(uint160(asset)),
            amount,
            0x1 // salt. Can't have burn salt (0) here, but it doesn't matter what it is
        );

        // rightCommitment is just a hardcoded 0 salt, 0 amount commitment
        (uint256 rightCommitment,) = _commitment(
            uint256(uint160(asset)),
            0, // amount
            0 // salt (0 is the burn salt)
        );

        // construct a fake merkle tree proof leaves=[inputCommitment, rightCommitment]
        uint256 fakeMerkleRoot = _hash(inputCommitment, rightCommitment);
        for (uint256 i = 0; i < 30 - 1; i++) { // XXX: magic number 30. TODO have a constant
            fakeMerkleRoot = _hash(fakeMerkleRoot, 0);
        }

        return verifier.verifyProof(
            proof.a,
            proof.b,
            proof.c,
            [
                fakeMerkleRoot, // fake merkle root
                leftCommitment,
                rightCommitment, // empty commitment
                inputNullifier, 0, 0, 0, 0, 0, 0, 0 // nullifiers[8]
            ]
        );
    }


    function split(
        uint256 leftCommitment,
        uint256 rightCommitment,
        uint256[8] memory nullifiers,
        ProofCommitment memory proof
    ) internal returns (uint256 leftIndex, uint256 rightIndex) {
        require(
            _checkProof(
                leftCommitment,
                rightCommitment,
                nullifiers,
                proof
            ),
            "Invalid proof (split)"
        );

        leftIndex = _insert(leftCommitment);
        rightIndex = _insert(rightCommitment);

        emit Transaction(leftCommitment, leftIndex);
        emit Transaction(rightCommitment, rightIndex);
    }


    function bridge(
        uint256 localCommitment, // right commitment
        uint256 remoteCommitment, // left commitment
        uint256[8] memory nullifiers,
        ProofCommitment memory proof
    ) internal returns (uint256 localIndex) {
        require(
            _checkProof(
                remoteCommitment,
                localCommitment,
                nullifiers,
                proof
            ),
            "Invalid proof (bridge)"
        );

        localIndex = _insert(localCommitment);

        emit Transaction(localCommitment, localIndex);
    }


    // burns using the left commitment (0 salt)
    // remaining funds from input notes (in nullifiers) goes to right commitment
    function drop(
        address asset,
        uint256 amount,
        uint256 rightCommitment,
        uint256[8] memory nullifiers, // TODO: we shouldn't hardcode this array size
        ProofCommitment memory proof
    ) internal returns (uint256 rightIndex) {
        (uint256 leftCommitment,) = _commitment(
            uint256(uint160(asset)),
            uint256(amount),
            0 // salt (0 is the burn salt)
        );

        require(
            _checkProof(
                leftCommitment,
                rightCommitment,
                nullifiers,
                proof
            ),
            "Invalid proof (drop)"
        );

        rightIndex = _insert(rightCommitment);

        emit PublicTransaction (
            rightCommitment,
            rightIndex,
            asset,
            amount
        );
    }


    // mints by checking that the left commitment has the right amount and
    // asset, without revealing the salt, then inserting
    function insert(
        address asset,
        uint256 amount,
        uint256 leftCommitment,
        ProofCommitment memory proof
    ) internal returns (uint256 index) {
        require(
            // deals with the fake insertion
            _verifyInsertProof(
                asset,
                amount,
                leftCommitment,
                proof
            ),
            "Invalid proof (insert)"
        );

        index = _insert(leftCommitment);

        emit PublicTransaction (
            leftCommitment,
            index,
            asset,
            amount
        );
    }


    function insert(
        uint256 commitment
    ) internal returns (uint256 index) {
        index = _insert(commitment);
        emit Transaction(commitment, index);
    }


    function _hash(
        uint256 left,
        uint256 right
    ) public override view returns (uint256 r) {
        r = left;
        uint256 c;
        (r, c) = mimcSponge.MiMCSponge(r, 0, 0);
        r += right;
        (r,) = mimcSponge.MiMCSponge(r, c, 0);
    }


    function _nullifier(
        uint256 asset,
        uint256 amount,
        uint256 salt
    ) public view returns (uint256) {
        return poseidonFour.poseidon([asset, 0, amount, salt]);
    }


    function _commitment(
        uint256 asset,
        uint256 amount,
        uint256 salt
    ) public view returns (uint256 commitment, uint256 nullifier) {
        nullifier = _nullifier(asset, amount, salt);
        commitment = poseidonTwo.poseidon([
            nullifier,
            salt
        ]);
    }
}
