pragma solidity ^0.8.27;

import { MerkleTree } from "./MerkleTree.sol";
import { Groth16Verifier } from "@circuits/verifier.sol";
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
    Groth16Verifier public verifier = new Groth16Verifier();
    mapping(uint256 => bool) public spent;

    IPoseidonTwo public poseidonTwo;
    IPoseidonFour public poseidonFour;
    IMimcSponge public mimcSponge;

    constructor() {
        HashContracts deployer = new HashContracts();
        poseidonTwo = deployer.deployPoseidonTwo();
        poseidonFour = deployer.deployPoseidonFour();
        mimcSponge = deployer.deployMimcSponge();
    }

    function checkProof(
        address spender,
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
                uint256(uint160(spender)),
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

        for (uint256 i = 0; i < nullifiers.length; i++) {
            if (spent[nullifiers[i]]) { return false; }
            spent[nullifiers[i]] = true;
        }

        return true;
    }

    function split(
        address spender,
        uint256 leftCommitment,
        uint256 rightCommitment,
        uint256[8] memory nullifiers,
        ProofCommitment memory proof
    ) internal returns (uint256 leftIndex, uint256 rightIndex) {
        require(
            checkProof(
                spender,
                leftCommitment,
                rightCommitment,
                nullifiers,
                proof
            ),
            "Invalid proof"
        );

        leftIndex = _insert(leftCommitment);
        rightIndex = _insert(rightCommitment);
    }

    function split(
        address spender,
        uint256 leftCommitment,
        uint256 rightCommitment,
        uint256[8] memory nullifiers,
        ProofCommitment memory proof
    ) internal returns (uint256 leftCommitment, uint256 rightIndex) {
        require(
            checkProof(
                spender,
                leftCommitment,
                rightCommitment,
                nullifiers,
                proof
            ),
            "Invalid proof"
        );

        rightIndex = _insert(rightCommitment);
    }

    function drop(
        address spender,
        address asset,
        uint256 amount,
        uint256 salt,
        uint256 rightCommitment,
        uint256[8] memory nullifiers,
        ProofCommitment memory proof
    ) internal returns (uint256 rightIndex) {
        uint256 leftCommitment = _commitment(
            0,
            uint256(uint160(asset)),
            uint256(amount),
            salt
        );

        require(
            checkProof(
                spender,
                leftCommitment,
                rightCommitment,
                nullifiers,
                proof
            ),
            "Invalid proof"
        );

        rightIndex = _insert(rightCommitment);
    }

    function insert(
        address spender,
        address asset,
        uint256 amount,
        uint256 salt
    ) internal returns (uint256) {
        return _insert(
            _commitment(
                uint256(uint160(spender)),
                uint256(uint160(asset)),
                amount,
                salt
            )
        );
    }

    function insert(
        uint256 commitment
    ) internal returns (uint256) {
        return _insert(commitment);
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
        uint256 sender,
        uint256 asset,
        uint256 amount,
        uint256 salt
    ) public view returns (uint256) {
        return poseidonFour.poseidon([sender, asset, amount, salt]);
    }

    function _commitment(
        uint256 sender,
        uint256 asset,
        uint256 amount,
        uint256 salt
    ) public view returns (uint256) {
        return poseidonTwo.poseidon([
            poseidonFour.poseidon([sender, asset, amount, salt]),
            salt
        ]);
    }
}
