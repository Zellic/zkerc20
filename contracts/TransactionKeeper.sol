// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.27;

import { console } from "hardhat/console.sol";

import { MerkleTree } from "./MerkleTree.sol";
import { Groth16Verifier } from "../circuits/verifier.sol";
import { IPoseidonTwo } from "./interfaces/IPoseidonTwo.sol";
import { IPoseidonFour } from "./interfaces/IPoseidonFour.sol";
import { IMimcSponge } from "./interfaces/IMimcSponge.sol";

struct ProofCommitment {
    uint256[2] a;
    uint256[2][2] b;
    uint256[2] c;
}

contract TransactionKeeper is MerkleTree(30) {
    event Nullified (
        uint256 nullifier
    );


    Groth16Verifier public verifier = new Groth16Verifier();
    mapping(uint256 => bool) public spent;

    IPoseidonTwo public poseidonTwo;
    IPoseidonFour public poseidonThree;
    IMimcSponge public mimcSponge;


    constructor(address _poseidon2, address _poseidon4, address _mimcSponge) {
        poseidonTwo = IPoseidonTwo(_poseidon2);
        poseidonThree = IPoseidonFour(_poseidon4);
        mimcSponge = IMimcSponge(_mimcSponge);
    }


    // Checks the proof, nullifies the nullifiers, and returns true if the proof
    // is valid.
    function _checkProof(
        address sender,
        uint256 leftCommitment,
        uint256 rightCommitment,
        uint256[8] memory nullifiers,
        ProofCommitment memory proof
    ) private returns (bool) {
        console.log("==== onchain split ====");
        console.log("proof.a[0]: %d", proof.a[0]);
        console.log("proof.a[1]: %d", proof.a[1]);
        console.log("proof.b[0][0]: %d", proof.b[0][0]);
        console.log("proof.b[0][1]: %d", proof.b[0][1]);
        console.log("proof.b[1][0]: %d", proof.b[1][0]);
        console.log("proof.b[1][1]: %d", proof.b[1][1]);
        console.log("proof.c[0]: %d", proof.c[0]);
        console.log("proof.c[1]: %d", proof.c[1]);
        console.log("sender: %d", sender);
        console.log("MerkleTree.root: %d", MerkleTree.root);
        console.log("leftCommitment: %d", leftCommitment);
        console.log("rightCommitment: %d", rightCommitment);
        console.log("nullifiers[0]: %d", nullifiers[0]);
        console.log("nullifiers[1]: %d", nullifiers[1]);
        console.log("nullifiers[2]: %d", nullifiers[2]);
        console.log("nullifiers[3]: %d", nullifiers[3]);
        console.log("nullifiers[4]: %d", nullifiers[4]);
        console.log("nullifiers[5]: %d", nullifiers[5]);
        console.log("nullifiers[6]: %d", nullifiers[6]);
        console.log("nullifiers[7]: %d", nullifiers[7]);
        console.log("============================");

        bool valid = verifier.verifyProof(
            proof.a,
            proof.b,
            proof.c,
            [
                uint256(uint160(sender)),
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

        require(valid, "_checkProof: invalid proof");
        if (!valid) { return false; }

        // ensures nullifiers are unique (no duplicates in the array) after proof 
        // verification
        for (uint256 i = 0; i < nullifiers.length; i++) {
            if (spent[nullifiers[i]]) { return false; }

            emit Nullified(nullifiers[i]);
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
            0x1, // salt. Can't have burn salt (0) here, but it doesn't matter what it is
            0x0 // owner
        );
        
        // empty commitments, only used to fill the array
        (/*uint256 inputZeroCommitment*/, uint256 inputZeroNullifier) = _commitment(
            uint256(uint160(asset)),
            0, // amount
            0x1, // salt. Can't have burn salt (0) here, but it doesn't matter what it is
            0x0 // owner
        );

        // rightCommitment is just a hardcoded 0 salt, 0 amount commitment
        (uint256 rightCommitment,) = _commitment(
            uint256(uint160(asset)),
            0, // amount
            0x0, // salt (0 is the burn salt)
            0x0 // owner
        );

        // construct a fake merkle tree proof leaves=[inputCommitment, rightCommitment]
        uint256 fakeMerkleRoot = _hash(inputCommitment, leftCommitment);
        for (uint256 i = 0; i < 30 - 1; i++) { // XXX: magic number 30. TODO have a constant
            fakeMerkleRoot = _hash(fakeMerkleRoot, 0);
        }

        /*console.log("==== _verifyInsertProof split ====");
        console.log("proof.a[0]: %d", proof.a[0]);
        console.log("proof.a[1]: %d", proof.a[1]);
        console.log("proof.b[0][0]: %d", proof.b[0][0]);
        console.log("proof.b[0][1]: %d", proof.b[0][1]);
        console.log("proof.b[1][0]: %d", proof.b[1][0]);
        console.log("proof.b[1][1]: %d", proof.b[1][1]);
        console.log("proof.c[0]: %d", proof.c[0]);
        console.log("proof.c[1]: %d", proof.c[1]);
        console.log("fakeMerkleRoot: %d", fakeMerkleRoot);
        console.log("leftCommitment: %d", leftCommitment);
        console.log("rightCommitment: %d", rightCommitment);
        console.log("nullifiers[0]: %d", inputNullifier);
        console.log("nullifiers[1..7]: %d", inputZeroNullifier);
        console.log("============================");*/

        return verifier.verifyProof(
            proof.a,
            proof.b,
            proof.c,
            [
                0, // sender
                fakeMerkleRoot, // fake merkle root
                leftCommitment,
                rightCommitment, // empty commitment

                // nullifiers[8]
                inputNullifier,
                inputZeroNullifier,
                inputZeroNullifier,
                inputZeroNullifier,
                inputZeroNullifier,
                inputZeroNullifier,
                inputZeroNullifier,
                inputZeroNullifier
            ]
        );
    }


    function split(
        address sender,
        uint256 leftCommitment,
        uint256 rightCommitment,
        uint256[8] memory nullifiers,
        ProofCommitment memory proof
    ) internal returns (uint64 leftIndex, uint64 rightIndex) {
        require(
            _checkProof(
                sender,
                leftCommitment,
                rightCommitment,
                nullifiers,
                proof
            ),
            "Invalid proof (split)"
        );

        leftIndex = _insert(leftCommitment);
        rightIndex = _insert(rightCommitment);
    }


    function bridge(
        address sender,
        uint256 localCommitment, // right commitment
        uint256 remoteCommitment, // left commitment
        uint256[8] memory nullifiers,
        ProofCommitment memory proof
    ) internal returns (uint64 localIndex) {
        require(
            _checkProof(
                sender,
                remoteCommitment,
                localCommitment,
                nullifiers,
                proof
            ),
            "Invalid proof (bridge)"
        );

        localIndex = _insert(localCommitment);
    }


    // burns using the left commitment (0 salt)
    // remaining funds from input notes (in nullifiers) goes to right commitment
    function drop(
        address sender,
        address asset,
        uint256 amount,
        uint256 rightCommitment,
        uint256[8] memory nullifiers,
        ProofCommitment memory proof
    ) internal returns (uint64 rightIndex) {
        (uint256 leftCommitment,) = _commitment(
            uint256(uint160(asset)),
            uint256(amount),
            0, // salt (0 is the burn salt)
            0 // doesn't matter since we're burning
        );

        require(
            _checkProof(
                sender,
                leftCommitment,
                rightCommitment,
                nullifiers,
                proof
            ),
            "Invalid proof (drop)"
        );

        rightIndex = _insert(rightCommitment);
    }


    // mints by checking that the left commitment has the right amount and
    // asset, without revealing the salt, then inserting
    function insert(
        address asset,
        uint256 amount,
        uint256 leftCommitment,
        ProofCommitment memory proof
    ) internal returns (uint64 index) {
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
    }


    function insert(
        uint256 commitment
    ) internal returns (uint64 index) {
        index = _insert(commitment);
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
        uint256 salt,
        uint256 owner
    ) public view returns (uint256) {
        /*console.log("EXAMPLE FROM SOL: %d", poseidonTwo.poseidon([uint256(0), uint256(0)]));
        console.log("- sol poseidon4 asset: %d", asset);
        console.log("-               amount: %d", amount);
        console.log("-               salt: %d", salt);*/
        return poseidonThree.poseidon([asset, amount, salt, owner]);
    }


    function _commitment(
        uint256 asset,
        uint256 amount,
        uint256 salt,
        uint256 owner
    ) public view returns (uint256 commitment, uint256 nullifier) {
        nullifier = _nullifier(asset, amount, salt, owner);
        commitment = poseidonTwo.poseidon([
            nullifier,
            salt
        ]);
    }
}
