const fs = require('fs');
const { buildPoseidon, buildMimcSponge } = require('circomlibjs');
const { groth16 } = require('snarkjs');
const { ethers } = require('ethers');


const PROOF_CACHE_FILE = '/tmp/proof_cache.json';

const CIRCUIT_WASM = 'circuits/circuit_js/circuit.wasm';
const CIRCUIT_ZKEY = 'circuits/circuit_js/circuit_final.zkey';


class ProofGeneration {
    constructor(_poseidon) {
        this._poseidon = _poseidon;
    }

    poseidon(inputs) {
        return this._poseidon(inputs);
    }

    async prove(data) {
        console.log('Generating proof for', data);
        const { proof, publicSignals } = await groth16.fullProve(data, CIRCUIT_WASM, CIRCUIT_ZKEY);
        return { proof, publicSignals };
    }
}


// wrap ProofGeneration but cache the proof results in a cache file to speed 
// up rerunning the tests
class ProofGenerationCached {
    constructor(_poseidon) {
        this.proofGeneration = new ProofGeneration(_poseidon);
        this.proofCache = {};

        this.poseidon = (inputs) => this.proofGeneration.poseidon(inputs);

        // parse json if file exists
        if (fs.existsSync(PROOF_CACHE_FILE)) {
            this.proofCache = JSON.parse(fs.readFileSync(PROOF_CACHE_FILE));
        }
    }

    async prove(data) {
        // TODO: use a better hash function lol
        const hashCode = s => s.split('').reduce((a,b)=>{a=((a<<5)-a)+b.charCodeAt(0);return a&a},0)

        const cacheKey = hashCode(JSON.stringify(data));
        if (cacheKey in this.proofCache) {
            console.debug(`Cache hit for ${cacheKey}`);
            return this.proofCache[cacheKey];
        }

        const proofData = await this.proofGeneration.prove(data);
        this.proofCache[cacheKey] = proofData;
        fs.writeFileSync(PROOF_CACHE_FILE, JSON.stringify(this.proofCache));
        return proofData;
    }
}


// { asset: address, tokenId: uint256, amount: uint256, salt: uint256 }
class Commitment {
    constructor(asset, tokenId, amount, salt, index = null) {
        this.asset = asset;
        this.tokenId = tokenId;
        this.amount = amount;
        this.salt = salt;
        this.index = index;
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
            this.nullifierHash(proofGeneration),
            this.salt
        ]);
    }
}


class MerkleTree {
    constructor(transactionKeeper) {
        this._merkleHash = (left, right) => transactionKeeper._merkleHash(left, right);
        this.root = 0;
        this.index = 0;
        this.filledSubtrees = Array(MAX_HEIGHT).fill(0); // array to store intermediate hashes at each tree level
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

    // generates a proof (path and sides) for a given index
    // TODO: need to double check this!!!
    generateProof(index) {
        const path = [];
        const sides = [];
        let currentIndex = index;

        for (let i = 0; i < MAX_HEIGHT; i++) {
            const siblingIndex = currentIndex % 2 === 0 ? currentIndex + 1 : currentIndex - 1;
            const sibling = this.filledSubtrees[i] || 0;  // Use 0 if no sibling hash exists

            path.push(sibling);
            sides.push(currentIndex % 2); // 0 if left, 1 if right

            currentIndex = Math.floor(currentIndex / 2);
        }

        return { path, sides };
    }
}


const MAX_HEIGHT = 30;
const NUM_NOTES = 8;
class TransactionKeeper {
    constructor(poseidon, mimcSponge) {
        this.proofGenerationCached = new ProofGenerationCached(poseidon);
        this.mimcSponge = mimcSponge;
    }

    _merkleHash(left, right) {
        return this.mimcSponge.multiHash([left, right], 0, 1);
    }

    async _split(merkleTree, inputCommitments, leftCommitment, rightCommitment) {
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

        // this case can be triggered if too many input notes come in.
        // making it more general to sanity check myself.
        if (inputCommitments.length != NUM_NOTES) {
            throw new Error('input commitments must be of length NUM_NOTES', { inputCommitments });
        }

        // all inputCommitments must have non-null indeces
        inputCommitments.forEach(c => {
            if (c.index == null && c.amount > 0) {
                throw new Error('input commitment\'s index with non-zero amount cannot be null', { inputCommitment: c });
            }
        });

        // all inputCommitments must have unique indeces (where if amount > 0)
        // this is enfored onchain (not in circuits) using the nullifiers
        const indeces = inputCommitments.filter(c => c.amount > 0).map(c => c.index);
        if (indeces.length != new Set(indeces).size) {
            throw new Error('input commitments with non-zero amount must have unique index (no duplicate indeces allowed)', { inputCommitments });
        }

        // find where the input commitments are in the tree
        const pathAndSides = inputCommitments.map(c => merkleTree.generateProof(c.index));

        // 4. prove it!
        const proof = await this.proofGenerationCached.prove({
            root: merkleTree.root, // must be updated before this _split call
            asset: leftCommitment.asset,
            tokenId: leftCommitment.tokenId,
            amounts: inputCommitments.map(c => c.amount),
            salts: inputCommitments.map(c => c.salt),

            leftAmount: leftCommitment.amount,
            leftSalt: leftCommitment.salt,
            leftCommitment: leftCommitment.commitmentHash(this.proofGenerationCached),

            rightAmount: rightCommitment.amount,
            rightSalt: rightCommitment.salt,
            rightCommitment: rightCommitment.commitmentHash(this.proofGenerationCached),

            nullifiers: inputCommitments.map(c => c.nullifierHash(this.proofGenerationCached)),
            
            // signal input path[NUM_NOTES][MAX_HEIGHT];
            // signal input sides[NUM_NOTES][MAX_HEIGHT];
            path: pathAndSides.map(ps => ps.path),
            sides: pathAndSides.map(ps => ps.sides)
        });

        return proof;
    }


    // main functions

    // lock
    async insert(asset, tokenId, amount, salt) {
        const inputCommitment = new Commitment(asset, tokenId, amount, 0x1);
        const leftCommitment = new Commitment(asset, tokenId, amount, salt);
        const rightCommitment = new Commitment(asset, tokenId, 0, 0x0);

        var merkleTree = new MerkleTree(this);
        inputCommitment.index = merkleTree.insert(inputCommitment.commitmentHash(this.proofGenerationCached));
        const proof = await this._split(merkleTree, [inputCommitment], leftCommitment, rightCommitment);

        return {
            commitment,
            proof
        };
    }

    // unlock
    async drop(merkleTree, asset, tokenId, amount, salt, inputCommitments) {
        // get total amount from input commitments
        const sumInputAmount = inputCommitments.reduce((acc, c) => acc + c.amount, 0);
        if (sumInputAmount < amount) {
            throw new Error('input commitments amount is less than amount to drop', { amount, sumInputAmount, inputCommitments });
        }

        // left is burned (salt 0), right is the remainder
        const leftCommitment = new Commitment(asset, tokenId, amount, 0x0);
        const rightCommitment = new Commitment(asset, tokenId, sumInputAmount - amount, salt);

        rightCommitment.index = merkleTree.insert(rightCommitment.commitmentHash(this.proofGenerationCached));
        const proof = await this._split(merkleTree, inputCommitments, leftCommitment, rightCommitment);

        return {
            remainderCommitment: rightCommitment,
            nullifiedCommitments: inputCommitments,
            proof
        };
    }

    // bridge
    async bridge(merkleTree, asset, tokenId, localAmount, localSalt, remoteAmount, remoteSalt, inputCommitments) {
        const localCommitment = new Commitment(asset, tokenId, localAmount, localSalt);
        const remoteCommitment = new Commitment(asset, tokenId, remoteAmount, remoteSalt);

        localCommitment.index = merkleTree.insert(localCommitment.commitmentHash(this.proofGenerationCached));
        const proof = await this._split(merkleTree, inputCommitments, localCommitment, remoteCommitment);

        return {
            localCommitment,
            remoteCommitment,
            proof
        };
    }

    // transferFrom
    async split(merkleTree, payoutAmount, payoutSalt, remainderAmount, remainderSalt, inputCommitments) {
        const payoutCommitment = new Commitment(asset, tokenId, payoutAmount, payoutSalt);
        const remainderCommitment = new Commitment(asset, tokenId, remainderAmount, remainderSalt);

        remainderCommitment.index = merkleTree.insert(remainderCommitment.commitmentHash(this.proofGenerationCached));
        const proof = await this._split(merkleTree, inputCommitments, payoutCommitment, remainderCommitment);

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
    constructor() {}
    // XXX: I'm bad at JS. Not sure how to do async in constructors
    async initialize() {
        const poseidon = await buildPoseidon();
        const mimcSponge = await buildMimcSponge();
        this.transactionKeeper = new TransactionKeeper(poseidon, mimcSponge);
    }
    
    // create an insert commitment with fake root containing just the commitment
    /* function lock(
        address token,
        uint256 amount,
        uint256 commitment,
        ProofCommitment memory proof
    ) external returns (uint256 receipt); */
    async lock(asset, tokenId, amount, salt) {
        // sanity check
        if (amount > 0 && salt == 0) {
            throw new Error('disallowing self-griefing by using 0 salt with a non-zero amount', { asset, tokenId, amount, salt });
        }

        const { commitment, proof } = await this.transactionKeeper.insert(asset, tokenId, amount, salt);
        return NodeResult({
            token,
            amount,
            commitment: commitment.commitmentHash(this.transactionKeeper.proofGenerationCached),
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
    async unlock(merkleTree, asset, tokenId, amount, remainderSalt, inputCommitments) {
        const { remainderCommitment, nullifiedCommitments, proof } = await this.transactionKeeper.drop(merkleTree, asset, tokenId, amount, salt, inputCommitments);
        return NodeResult({
            token,
            amount,
            remainderCommitment: remainderCommitment.commitmentHash(this.transactionKeeper.proofGenerationCached),
            nullifier: nullifiedCommitments.map(n => n.nullifierHash(this.transactionKeeper.proofGenerationCached)),
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
    async bridge(merkleTree, asset, tokenId, localAmount, localSalt, remoteAmount, remoteSalt, inputCommitments) {
        // sanity check
        if (localAmount > 0 && localSalt == 0) {
            throw new Error('disallowing self-griefing by using 0 salt for local commitment with a non-zero amount', { asset, tokenId, localAmount, localSalt });
        } else if (remoteAmount > 0 && remoteSalt == 0) {
            throw new Error('disallowing self-griefing by using 0 salt for remote commitment with a non-zero amount', { asset, tokenId, remoteAmount, remoteSalt });
        }

        const { localCommitment, remoteCommitment, proof } = await this.transactionKeeper.bridge(merkleTree, asset, tokenId, localAmount, localSalt, remoteAmount, remoteSalt, inputCommitments);
        return NodeResult({
            localCommitment: localCommitment.commitmentHash(this.transactionKeeper.proofGenerationCached),
            remoteCommitment: remoteCommitment.commitmentHash(this.transactionKeeper.proofGenerationCached),
            nullifiers: inputCommitments.map(n => n.nullifierHash(this.transactionKeeper.proofGenerationCached)),
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
    async transferFrom(merkleTree, asset, tokenId, payoutAmount, payoutSalt, remainderAmount, remainderSalt, inputCommitments) {
        // sanity check
        if (payoutAmount > 0 && payoutSalt == 0) {
            throw new Error('disallowing self-griefing by using 0 salt for payout commitment with a non-zero amount', { asset, tokenId, payoutAmount, payoutSalt });
        } else if (remainderAmount > 0 && remainderSalt == 0) {
            throw new Error('disallowing self-griefing by using 0 salt for remainder commitment with a non-zero amount', { asset, tokenId, remainderAmount, remainderSalt });
        }

        const { payoutCommitment, remainderCommitment, proof } = await this.transactionKeeper.split(merkleTree, payoutAmount, payoutSalt, remainderAmount, remainderSalt, inputCommitments);
        return NodeResult({
            payoutCommitment: payoutCommitment.commitmentHash(this.transactionKeeper.proofGenerationCached),
            remainderCommitment: remainderCommitment.commitmentHash(this.transactionKeeper.proofGenerationCached),
            nullifiers: inputCommitments.map(n => n.nullifierHash(this.transactionKeeper.proofGenerationCached)),
            proof
        }, {
            inserted: [payoutCommitment, remainderCommitment],
            nullified: inputCommitments
        });
    }
}

module.exports = {
    Node
};
