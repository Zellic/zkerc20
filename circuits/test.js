const fs = require('fs');
const { buildPoseidon, buildMimcSponge } = require('circomlibjs');
const { fullProve } = require('snarkjs');
const { sha256 } = require('js-sha256');

import { ethers } from 'ethers';

const PROOF_CACHE_FILE = '/tmp/proof_cache.json';


class ProofGeneration {
    constructor() {
        this.poseidon = await buildPoseidon();
    }

    poseidon(inputs) {
        return this.poseidon(inputs);
    }

    fullProve(data) {
        const { proof, publicSignals } = await snarkjs.groth16.fullProve(data, "circuit_js/circuit.wasm", "circuit_final.zkey");
        return { proof, publicSignals };
    }
}


// wrap ProofGeneration but cache the proof results in a cache file to speed 
// up rerunning the tests
class ProofGenerationCached {
    constructor() {
        this.proofGeneration = new ProofGeneration();
        this.proofCache = {};

        // parse json if file exists
        if (fs.existsSync(PROOF_CACHE_FILE)) {
            this.proofCache = JSON.parse(fs.readFileSync(PROOF_CACHE_FILE));
        }
    }

    fullProve(data) {
        // TODO: use a better hash function lol
        hashCode = s => s.split('').reduce((a,b)=>{a=((a<<5)-a)+b.charCodeAt(0);return a&a},0)

        const cacheKey = sha256(JSON.stringify(data));
        if (cacheKey in this.proofCache) {
            console.debug(`Cache hit for ${cacheKey}`);
            return this.proofCache[cacheKey];
        }

        const proofData = this.proofGeneration.fullProve(data);
        this.proofCache[cacheKey] = proofData;
        fs.writeFileSync(PROOF_CACHE_FILE, JSON.stringify(this.proofCache));
        return proofData;
    }
}


// { asset: address, tokenId: uint256, amount: uint256, salt: uint256 }
class Commitment {
    constructor(asset, tokenId, amount, salt) {
        this.asset = asset;
        this.tokenId = tokenId;
        this.amount = amount;
        this.salt = salt;
    }

    nullifierHash(proofGeneration) {
        return proofGeneration.poseidon([
            this.asset,
            this.tokenId,
            this.amount,
            this.salt
        ]);
    }

    commitmentHash(proofGeneration) {
        return proofGeneration.poseidon([
            this.nullifierHash(),
            this.salt
        ]);
    }
}


class MerkleTree {
    constructor(transactionKeeper) {
        this._merkleHash = transactionKeeper._merkleHash; // XXX: bad design
        this.root = 0;
        this.index = 0;
        this.filledSubtrees = Array(targetHeight).fill(0); // array to store intermediate hashes at each tree level
    }

    // inserts a value into the tree and updates the root
    // TODO: test
    insert(value) {
        if (this.index >= 2 ** MAX_HEIGHT) {
            throw new Error("merkle tree is full");
        }

        let current = value;
        let index = this.index;

        for (let i = 0; i < MAX_HEIGHT; i++) {
            if (index % 2 === 0) {
                this.filledSubtrees[i] = current;
                current = this._merkleHash(current, 0);
            } else {
                current = this._merkleHash(this.filledSubtrees[i], current);
            }
            index = Math.floor(index / 2);
        }

        this.root = current; // update root to the latest
        return this.index++; // return the position of the inserted transaction, then increment index
    }

    // verifies a proof for a given value at a specific index
    verifyProof(treeRoot, value, index, proof) {
        let current = value;

        for (let i = 0; i < proof.length; i++) {
            if (index % 2 === 0) {
                current = this._merkleHash(current, proof[i]);
            } else {
                current = this._merkleHash(proof[i], current);
            }
            index = Math.floor(index / 2);
        }

        return current === treeRoot;
    }
}


const MAX_HEIGHT = 30;
const NUM_NOTES = 8;
class TransactionKeeper {
    constructor() {
        this.proofGenerationCached = new ProofGenerationCached();
        this.mimcSponge = await buildMimcSponge();
    }

    _merkleHash(left, right) {
        return mimcSponge.multiHash([left, right], 0, 1);
    }

    _split(root, inputCommitments, leftCommitment, rightCommitment) {
        // 1. make sure inputCommitments is NUM_NOTES sized
        for (let i = inputCommitments.length; i < NUM_NOTES; i++) {
            // we can't have 0 as salt, but it doesn't matter since amount=0
            inputCommitments.push(new Commitment(leftCommitment.asset, leftCommitment.tokenId, 0, 0x1));
        }

        // 2. all elements are the same asset type. None of the inputs can have 0 as salt
        inputCommitments.forEach(c => {
            if (c.salt == 0) {
                throw new Error('input commitment salt cannot be 0', { inputCommitment: c });
            }

            if (c.asset != leftCommitment.asset) {
                throw new Error('input commitment asset mismatch', { inputCommitment: c, expectedAsset: leftCommitment.asset });
            }

            if (c.tokenId != leftCommitment.tokenId) {
                throw new Error('input commitment tokenId mismatch', { inputCommitment: c, expectedTokenId: leftCommitment.tokenId });
            }
        });

        if (leftCommitment.asset != rightCommitment.asset) {
            throw new Error('right commitment asset is incorrect', { rightCommitment, expectedAsset: leftCommitment.asset });
        }

        if (leftCommitment.tokenId != rightCommitment.tokenId) {
            throw new Error('right commitment tokenId is incorrect', { rightCommitment, expectedTokenId: leftCommitment.tokenId });
        }

        // 3. ensure leftCommitment.amount + rightCommitment.amount == sum(inputCommitments.amount)
        const sumInputAmount = inputCommitments.reduce((acc, c) => acc + c.amount, 0);
        if (leftCommitment.amount + rightCommitment.amount != sumInputAmount) {
            throw new Error('input commitment amounts do not equal output commitment amounts', { leftCommitment, rightCommitment, sumInputAmount, inputCommitments });
        }

        // 4. prove it!
        const proof = this.proofGenerationCached.fullProve({
            root, // must be updated before this _split call
            asset,
            tokenId,
            get
        });

        return proof;
    }


    // main functions

    // lock
    insert(asset, tokenId, amount, salt) {
        const inputCommitment = new Commitment(asset, tokenId, amount, 0x1);
        const leftCommitment = new Commitment(asset, tokenId, amount, salt);
        const rightCommitment = new Commitment(asset, tokenId, 0, 0x0);

        var merkleTree = new MerkleTree(this);
        merkleTree.insert(inputCommitment.commitmentHash());
        const proof = this._split(merkleTree.root, [inputCommitment], leftCommitment, rightCommitment);

        return {
            commitment,
            proof
        };
    }

    // unlock
    drop(merkleTree, asset, tokenId, amount, salt, inputCommitments) {
        // get total amount from input commitments
        const sumInputAmount = inputCommitments.reduce((acc, c) => acc + c.amount, 0);
        if (sumInputAmount < amount) {
            throw new Error('input commitments amount is less than amount to drop', { amount, sumInputAmount, inputCommitments });
        }

        // left is burned (salt 0), right is the remainder
        const leftCommitment = new Commitment(asset, tokenId, amount, 0x0);
        const rightCommitment = new Commitment(asset, tokenId, sumInputAmount - amount, salt);

        merkleTree.insert(rightCommitment.commitmentHash());
        const proof = this._split(merkleTree.root, inputCommitments, leftCommitment, rightCommitment);

        return {
            remainderCommitment: rightCommitment,
            nullifiedCommitments: inputCommitments,
            proof
        };
    }

    // bridge
    bridge(merkleTree, asset, tokenId, localAmount, localSalt, remoteAmount, remoteSalt, inputCommitments) {
        const localCommitment = new Commitment(asset, tokenId, localAmount, localSalt);
        const remoteCommitment = new Commitment(asset, tokenId, remoteAmount, remoteSalt);

        merkleTree.insert(localCommitment.commitmentHash());
        const proof = this._split(merkleTree.root, inputCommitments, localCommitment, remoteCommitment);

        return {
            localCommitment,
            remoteCommitment,
            proof
        };
    }

    // transferFrom
    split(merkleTree, payoutAmount, payoutSalt, remainderAmount, remainderSalt, inputCommitments) {
        const payoutCommitment = new Commitment(asset, tokenId, payoutAmount, payoutSalt);
        const remainderCommitment = new Commitment(asset, tokenId, remainderAmount, remainderSalt);

        merkleTree.insert(remainderCommitment.commitmentHash());
        const proof = this._split(merkleTree.root, inputCommitments, payoutCommitment, remainderCommitment);

        return {
            payoutCommitment,
            remainderCommitment,
            proof
        };
    }
}


// { args: dict, storage?: dict }
class NodeResult {
    constructor(args, storage = {}) {
        this.args = args;
        this.storage = storage;
    }
}


class Node {
    constructor() {
        this.transactionKeeper = new TransactionKeeper();
    }
    
    // create an insert commitment with fake root containing just the commitment
    /* function lock(
        address token,
        uint256 amount,
        uint256 commitment,
        ProofCommitment memory proof
    ) external returns (uint256 receipt); */
    lock(asset, tokenId, amount, salt) {
        // sanity check
        if (amount > 0 && salt == 0) {
            throw new Error('disallowing self-griefing by using 0 salt with a non-zero amount', { asset, tokenId, amount, salt });
        }

        const { commitment, proof } = this.transactionKeeper.insert(asset, tokenId, amount, salt);
        return NodeResult({
            token,
            amount,
            commitment: commitment.commitmentHash(),
            proof
        }, {
            inserted: [commitment]
        });
    }

    // unlock a commitment
    /* function unlock(
        address token,
        uint256 amount,
        uint256 remainderCommitment,
        uint256[8] memory nullifier,
        ProofCommitment memory proof
    ) external { */
    unlock(merkleTree, asset, tokenId, amount, remainderSalt, inputCommitments) {
        const { remainderCommitment, nullifiedCommitments, proof } = this.transactionKeeper.drop(merkleTree, asset, tokenId, amount, salt, inputCommitments);
        return NodeResult({
            token,
            amount,
            remainderCommitment: remainderCommitment.commitmentHash(),
            nullifier: nullifiedCommitments.map(n => n.nullifierHash()),
            proof
        }, {
            inserted: [commitment],
            nullified: nullifiedCommitments
        });
    }

    // bridge a commitment
    /* function bridge(
        uint256 localCommitment, // right commitment
        uint256 remoteCommitment, // left commitment
        uint256[8] memory nullifiers,
        ProofCommitment memory proof
    ) internal returns (uint256 localIndex) { */
    bridge(merkleTree, asset, tokenId, localAmount, localSalt, remoteAmount, remoteSalt, inputCommitments) {
        // sanity check
        if (localAmount > 0 && localSalt == 0) {
            throw new Error('disallowing self-griefing by using 0 salt for local commitment with a non-zero amount', { asset, tokenId, localAmount, localSalt });
        } else if (remoteAmount > 0 && remoteSalt == 0) {
            throw new Error('disallowing self-griefing by using 0 salt for remote commitment with a non-zero amount', { asset, tokenId, remoteAmount, remoteSalt });
        }

        const { localCommitment, remoteCommitment, proof } = this.transactionKeeper.bridge(merkleTree, asset, tokenId, localAmount, localSalt, remoteAmount, remoteSalt, inputCommitments);
        return NodeResult({
            localCommitment: localCommitment.commitmentHash(),
            remoteCommitment: remoteCommitment.commitmentHash(),
            nullifiers: inputCommitments.map(n => n.nullifierHash()),
            proof
        }, {
            inserted: [localCommitment, remoteCommitment], // TODO: distinguish between chains in an object?
            nullified: inputCommitments
        });
    }


    // transfer (split) a commitment
    /* function transferFrom(
        uint256 payoutCommitment,
        uint256 remainderCommitment,
        uint256[8] memory nullifier,
        ProofCommitment memory proof
    ) external returns (uint256 payoutIndex, uint256 remainderIndex) { */
    transferFrom(merkleTree, asset, tokenId, payoutAmount, payoutSalt, remainderAmount, remainderSalt, inputCommitments) {
        // sanity check
        if (payoutAmount > 0 && payoutSalt == 0) {
            throw new Error('disallowing self-griefing by using 0 salt for payout commitment with a non-zero amount', { asset, tokenId, payoutAmount, payoutSalt });
        } else if (remainderAmount > 0 && remainderSalt == 0) {
            throw new Error('disallowing self-griefing by using 0 salt for remainder commitment with a non-zero amount', { asset, tokenId, remainderAmount, remainderSalt });
        }

        const { payoutCommitment, remainderCommitment, proof } = this.transactionKeeper.split(merkleTree, payoutAmount, payoutSalt, remainderAmount, remainderSalt, inputCommitments);
        return NodeResult({
            payoutCommitment: payoutCommitment.commitmentHash(),
            remainderCommitment: remainderCommitment.commitmentHash(),
            nullifiers: inputCommitments.map(n => n.nullifierHash()),
            proof
        }, {
            inserted: [payoutCommitment, remainderCommitment],
            nullified: inputCommitments
        });
    }
}
