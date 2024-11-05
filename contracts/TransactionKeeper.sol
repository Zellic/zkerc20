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
        uint256 amount,
        uint256 salt
    );


    Groth16Verifier public verifier = new Groth16Verifier();
    mapping(uint256 => bool) public spent;

    IPoseidonTwo public poseidonTwo;
    IPoseidonFour public poseidonFour;
    IMimcSponge public mimcSponge;


    constructor(address _hashContracts) {
        HashContracts deployer = HashContracts(_hashContracts);
        poseidonTwo = deployer.poseidonTwo();
        poseidonFour = deployer.poseidonFour();
        mimcSponge = deployer.mimcSponge();
    }


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

        for (uint256 i = 0; i < nullifiers.length; i++) {
            if (spent[nullifiers[i]]) { return false; }
            spent[nullifiers[i]] = true;
        }

        return true;
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
            "Invalid proof"
        );

        leftIndex = _insert(leftCommitment);
        rightIndex = _insert(rightCommitment);

        emit Transaction(leftCommitment, leftIndex);
        emit Transaction(rightCommitment, rightIndex);
    }


    function bridge(
        uint256 leftCommitment,
        uint256 rightCommitment,
        uint256[8] memory nullifiers,
        ProofCommitment memory proof
    ) internal returns (uint256 remainingCommitment, uint256 rightIndex) {
        require(
            _checkProof(
                leftCommitment,
                rightCommitment,
                nullifiers,
                proof
            ),
            "Invalid proof"
        );

        remainingCommitment = leftCommitment;
        rightIndex = _insert(rightCommitment);

        emit Transaction(rightCommitment, rightIndex);
    }


    function drop(
        address asset,
        uint256 amount,
        uint256 rightCommitment,
        uint256[8] memory nullifiers, // TODO: we shouldn't hardcode this array size
        ProofCommitment memory proof
    ) internal returns (uint256 rightIndex) {
        uint256 leftCommitment = _commitment(
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
            "Invalid proof"
        );

        rightIndex = _insert(rightCommitment);

        emit Transaction(rightCommitment, rightIndex);
    }


    // TODO: this function won't be necessary soon
    function insert(
        address asset,
        uint256 amount,
        uint256 salt
    ) internal returns (uint256 index) {
        uint256 commitment = _commitment(
            uint256(uint160(asset)),
            amount,
            salt // TODO: this will be offchain
        );

        index = _insert(commitment);

        emit PublicTransaction (
            commitment,
            index,
            asset,
            amount,
            salt
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
        return poseidonFour.poseidon([asset, amount, salt]);
    }


    function _commitment(
        uint256 asset,
        uint256 amount,
        uint256 salt
    ) public view returns (uint256) {
        return poseidonTwo.poseidon([
            _nullifier(asset, amount, salt),
            salt
        ]);
    }
}
