const fs = require('fs');
const { groth16 } = require('snarkjs');

//const { buildPoseidon, buildMimcSponge } = require('circomlibjs');
const {
    poseidon_gencontract,
    mimcsponge_gencontract,
    poseidon,
    mimcsponge
} = require('../../zkerc20-deptest/node_modules/circomlibjs');
let poseidonContract = poseidon_gencontract;
let mimcSpongecontract = mimcsponge_gencontract;
// async function that just returns an object with a .poseidon() function
let buildPoseidon = async (nRounds) => {
    return poseidon;
}
let buildMimcSponge = async (nRounds, seed) => {
    return mimcsponge;
}
const Scalar = require("ffjavascript").Scalar
const ZqField = require("ffjavascript").ZqField;
const F = new ZqField(Scalar.fromString("21888242871839275222246405745257275088548364400416034343698204186575808495617"));
mimcsponge.F = F;




const PROOF_CACHE_FILE = '/tmp/proof_cache.json';

const CIRCUIT_WASM = '../circuits/circuit_js/circuit.wasm';
const CIRCUIT_ZKEY = '../circuits/circuit_final.zkey';

const MAX_HEIGHT = 30;
const NUM_NOTES = 8;


class Setup {
    constructor(owner) { // address
        this.owner = owner;
    }

    async initialize() {
        this.node = await ethers.deployContract('Node', [owner, hashContracts.target]);
        this.zkerc20 = await node.zkerc20();
    }
}


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
class ProofGenerationCached { // TODO: just override ProofGeneration
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

        const cacheKey = hashCode(''+data);
        if (cacheKey in this.proofCache) {
            console.debug(`Proof cache hit for ${cacheKey}`);
            return this.proofCache[cacheKey];
        }

        console.debug(`Proof cache miss for ${cacheKey}, generating new proof...`);
        const proofData = await this.proofGeneration.prove(data);
        this.proofCache[cacheKey] = proofData;
        fs.writeFileSync(PROOF_CACHE_FILE, JSON.stringify(this.proofCache));
        return proofData;
    }
}


// { asset: address, amount: uint256, salt: uint256 }
class Commitment {
    _zeroPadConvertUint8Array(x) { return ethers.getBytes(ethers.zeroPadValue(ethers.getBytes(ethers.toBeArray(x)), 32)); } // XXX

    constructor(asset, amount, salt, index = null) {
        this.asset = asset;
        this.amount = amount;
        this.salt = salt;
        this.index = index;
    }

    nullifierHash(proofGeneration) {

        //console.log("EXAMPLE FROM JS", ethers.toBigInt(proofGeneration.poseidon([0, 0])));

        /*let asset = this._zeroPadConvertUint8Array(this.asset);
        let amount = this._zeroPadConvertUint8Array(this.amount);
        let salt = this._zeroPadConvertUint8Array(this.salt);*/

        let result = proofGeneration.poseidon([
            this.asset,
            this.amount,
            this.salt
        ]);
        //console.log('nullifier hash result', result, [this.asset, this.amount, this.salt])
        return result;
    }

    commitmentHash(proofGeneration) {
        return proofGeneration.poseidon([
            this.nullifierHash(proofGeneration),
            this.salt
        ]);
    }
}


// XXX: unfortunately this is going to have to be regenerated each transaction.
// Otherwise, it won't be updating as people submit (if the user stays on the 
// page)
class MerkleTree {
    constructor(mimcSponge, getLatestLeaves) {
        this._getLatestLeaves = getLatestLeaves;
        this._mimcSponge = mimcSponge;
        //this._mimcZero = mimcSponge.F.fromObject(0);
        //this._mimcZero = mimcSponge.F.zero;
        this._mimcZero = 0; // TODO is this bad?

        // start with empty tree. Will be filled by _fetchLatestLeaves at the 
        // end of this constructor.
        this.root = 0;
        this.index = 0;
        this.filledSubtrees = Array(MAX_HEIGHT).fill(0); // array to store intermediate hashes at each tree level
        this.leaves = []

        // need to initialize
        if (getLatestLeaves) {
            this._fetchLatestLeaves();
        }
    }
    
    // updates the merkle tree state
    _fetchLatestLeaves() {
        //this.leaves = this._getLatestLeaves();
        //this.index = this.leaves.length;
        // filledSubtrees wil update on next insert
        
        // XXX: not the most efficient thing, but this is just for MVP
        const leaves = this._getLatestLeaves();
        for (var i = 0; i < leaves.length; i++) {
            this.insert(leaves[i]);
        }
    }

    _merkleHash(left, right) {
        return this._mimcSponge.multiHash([left, right], 0, 1);
    }

    getValue(index) {
        if (index < this.leaves.length) {
            return this.leaves[index];
        }
        return 0;
    }

    // inserts a value into the tree and updates the root
    // TODO: test
    insert(value) {
        if (this.index >= 2 ** MAX_HEIGHT) {
            throw new Error("Tree is full");
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
            index >>= 1; // Right shift by 1 (equivalent to index = Math.floor(index / 2))
        }

        this.root = current; // update root to the latest
        this.leaves.push(value); // store the value at the current index
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

    // recalcs each time (we're assuming we're gonna insert after generating 
    // proof)
    _getRows() {
        const layers = [this.leaves]

        while (layers.length < MAX_HEIGHT + 1) {
            const last = layers[layers.length - 1]
            if (last.length % 2 === 1) {
                last.push(this._mimcZero)
            }

            const next = []
            for (let i = 0; i < last.length / 2; i++) {
                const left = last[i * 2]
                const right = last[i * 2 + 1]
                next.push(this._merkleHash(left, right))
            }

            layers.push(next)
        }

        return layers
    }

    // generates a proof (path and sides) for a given index
    generateProof(index) { // index is the LEAF INDEX
        const rows = this._getRows();
        const path = [];
        const sides = [];

        for (let i = 0; i < MAX_HEIGHT; i++) {
            const layer = rows[i]
            const siblingIndex = index % 2 === 0 ? index + 1 : index - 1
            const sibling = layer[siblingIndex]
            path.push(sibling)

            // TODO: double check this logic. Seems sus
            if (index < siblingIndex) {
                sides.push(0)
            } else {
                sides.push(1)
            }

            index = Math.floor(index / 2)
        }

        // sanity check
        // TODO: remove;
        this.verifyProof(this.root, this.getValue(index), index, path);

        return {
            path,
            sides
        }
    }
}


class TransactionKeeper {
    /*
     * NOTE: If a commitment is inserted, it's kept in the state / a usable 
     * commitment, unless it's immediately (atomically) nullified on-chain.
     *
     * Fake input commitment: nullified atomically on-chain
     * Fake output commitment: never actually inserted into the tree
     */


    constructor(poseidon, mimcSponge, getLatestLeaves) {
        this.proofGenerationCached = new ProofGenerationCached(poseidon);
        this.mimcSponge = mimcSponge;
        this.merkleTree = new MerkleTree(mimcSponge, getLatestLeaves);
    }

    async _split(merkleTree, inputCommitments, leftCommitment, rightCommitment) {
        // 1. make sure inputCommitments is NUM_NOTES sized
        for (let i = inputCommitments.length; i < NUM_NOTES; i++) {
            // we can't have 0 as salt, but it doesn't matter since amount=0
            inputCommitments.push(new Commitment(leftCommitment.asset, 0, 0x1));
        }

        // 2. all elements are the same asset type. None of the inputs can have 0 as salt
        inputCommitments.forEach(c => {
            if (c.salt == 0) {
                throw new Error('input commitment salt cannot be 0', { inputCommitment: c });
            }

            if (c.asset != leftCommitment.asset) {
                throw new Error('input commitment asset mismatch', { inputCommitment: c, expectedAsset: leftCommitment.asset });
            }
        });

        if (leftCommitment.asset != rightCommitment.asset) {
            throw new Error('right commitment asset is incorrect', { rightCommitment, expectedAsset: leftCommitment.asset });
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
        //const pathAndSides = inputCommitments.map(c => merkleTree.generateProof(c.index));
        // paths, and sides, should both be arrays of size inputCommitments.length. Each element is an array of ints
        var paths = [];
        var sides = [];
        for (let i = 0; i < inputCommitments.length; i++) {
            const { path, sides: s } = merkleTree.generateProof(inputCommitments[i].index);
            paths.push(path.map((p) => this.mimcSponge.F.toObject(p)))
            sides.push(s);
        }


        console.debug('---- API split ----');
        console.debug('sanity:', ethers.toBigInt(merkleTree._merkleHash(1337, 1234)));
        console.debug('root:', ethers.toBigInt(merkleTree.root));
        console.debug('leftCommitment:', ethers.toBigInt(leftCommitment.commitmentHash(this.proofGenerationCached)));
        console.debug('rightCommitment:', ethers.toBigInt(rightCommitment.commitmentHash(this.proofGenerationCached)));
        for (var i = 0; i < inputCommitments.length; i++)
            console.debug('nullifiers['+i+']:', ethers.toBigInt(inputCommitments[i].nullifierHash(this.proofGenerationCached)));
        console.debug('-------------------');


        // 4. prove it!
        const proof = await this.proofGenerationCached.prove({
            root: this.mimcSponge.F.toObject(merkleTree.root), // must be updated before this _split call
            asset: leftCommitment.asset,
            amounts: inputCommitments.map(c => c.amount),
            salts: inputCommitments.map(c => c.salt),

            leftAmount: leftCommitment.amount,
            leftSalt: leftCommitment.salt,
            leftCommitment: this.mimcSponge.F.toObject(leftCommitment.commitmentHash(this.proofGenerationCached)),

            rightAmount: rightCommitment.amount,
            rightSalt: rightCommitment.salt,
            rightCommitment: this.mimcSponge.F.toObject(rightCommitment.commitmentHash(this.proofGenerationCached)),

            nullifiers: inputCommitments.map(c => this.mimcSponge.F.toObject(c.nullifierHash(this.proofGenerationCached))),
            
            // signal input path[NUM_NOTES][MAX_HEIGHT];
            // signal input sides[NUM_NOTES][MAX_HEIGHT];
            path: paths,
            sides
        });

        return {
            a: proof.proof.pi_a.slice(0, 2).map(ethers.toBigInt),
            b: proof.proof.pi_b.slice(0, 2).map((x) => x.map(ethers.toBigInt)),
            c: proof.proof.pi_c.slice(0, 2).map(ethers.toBigInt)
        }
    }


    // main functions

    // lock
    async insert(asset, amount, salt) {
        // We basically mint by faking that there's an inputCommitment to fund leftCommitment.
        // The purpose of this is to avoid revealing the salt, while being 
        // able to verify on-chain that the asset and amount match.

        const inputCommitment = new Commitment(asset, amount, 0x1); // fake commitment used to satisfy the circuits
        const leftCommitment = new Commitment(asset, amount, salt); // the user's actual commitment
        const rightCommitment = new Commitment(asset, 0, 0x0); // dummy commitment

        const fakeMerkleTree = new MerkleTree(this.mimcSponge, () => []);

        // we have to insert the fake inputCommitment to satisfy circuits
        // NOTE: on-chain, this is implemented in TransactionKeeper._verifyInsertProof

        inputCommitment.index = fakeMerkleTree.insert(inputCommitment.commitmentHash(this.proofGenerationCached));
        leftCommitment.index = fakeMerkleTree.insert(leftCommitment.commitmentHash(this.proofGenerationCached));
        const proof = await this._split(fakeMerkleTree, [inputCommitment], leftCommitment, rightCommitment);

        // we also need to update local state, so just insert it 
        // TODO/XXX: why do we need to keep local state if we're gona have to 
        // refetch every time anyway? I guess for tests
        leftCommitment.index = this.merkleTree.insert(leftCommitment.commitmentHash(this.proofGenerationCached));

        return {
            commitment: leftCommitment,
            proof
        };
    }

    // unlock
    async drop(asset, amount, salt, inputCommitments) {
        // get total amount from input commitments
        const sumInputAmount = inputCommitments.reduce((acc, c) => acc + c.amount, 0);
        if (sumInputAmount < amount) {
            throw new Error('input commitments amount is less than amount to drop', { amount, sumInputAmount, inputCommitments });
        }

        // left is burned (salt 0), right is the remainder
        const leftCommitment = new Commitment(asset, amount, 0x0);
        const rightCommitment = new Commitment(asset, sumInputAmount - amount, salt);

        rightCommitment.index = this.merkleTree.insert(rightCommitment.commitmentHash(this.proofGenerationCached));
        const proof = await this._split(this.merkleTree, inputCommitments, leftCommitment, rightCommitment);

        return {
            remainderCommitment: rightCommitment,
            nullifiedCommitments: inputCommitments,
            proof
        };
    }

    // bridge
    async bridge(asset, localAmount, localSalt, remoteAmount, remoteSalt, inputCommitments) {
        const localCommitment = new Commitment(asset, localAmount, localSalt);
        const remoteCommitment = new Commitment(asset, remoteAmount, remoteSalt);

        localCommitment.index = this.merkleTree.insert(localCommitment.commitmentHash(this.proofGenerationCached));
        const proof = await this._split(this.merkleTree, inputCommitments, localCommitment, remoteCommitment);

        return {
            localCommitment,
            remoteCommitment,
            proof
        };
    }

    // transferFrom
    async split(payoutAmount, payoutSalt, remainderAmount, remainderSalt, inputCommitments) {
        const payoutCommitment = new Commitment(asset, payoutAmount, payoutSalt);
        const remainderCommitment = new Commitment(asset, remainderAmount, remainderSalt);

        remainderCommitment.index = this.merkleTree.insert(remainderCommitment.commitmentHash(this.proofGenerationCached));
        const proof = await this._split(this.merkleTree, inputCommitments, payoutCommitment, remainderCommitment);

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
    async initialize(getLatestLeaves) {
        const poseidon = await buildPoseidon();
        const mimcSponge = await buildMimcSponge();
        this.transactionKeeper = new TransactionKeeper(poseidon, mimcSponge, getLatestLeaves);
    }
    
    // create an insert commitment with fake root containing just the commitment
    /* function lock(
        address token,
        uint256 amount,
        uint256 commitment,
        ProofCommitment memory proof
    ) external returns (uint256 receipt); */
    async lock(asset, amount, salt) {
        // sanity check
        if (amount > 0 && salt == 0) {
            throw new Error('disallowing self-griefing by using 0 salt with a non-zero amount', { asset, amount, salt });
        }

        const { commitment, proof } = await this.transactionKeeper.insert(asset, amount, salt);
        return new NodeResult({
            asset,
            amount,
            commitment: ethers.toBigInt(commitment.commitmentHash(this.transactionKeeper.proofGenerationCached)),
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
    async unlock(asset, amount, remainderSalt, inputCommitments) {
        const { remainderCommitment, nullifiedCommitments, proof } = await this.transactionKeeper.drop(asset, amount, salt, inputCommitments);
        return new NodeResult({
            asset,
            amount,
            remainderCommitment: ethers.toBigInt(remainderCommitment.commitmentHash(this.transactionKeeper.proofGenerationCached)),
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
    async bridge(asset, localAmount, localSalt, remoteAmount, remoteSalt, inputCommitments) {
        // sanity check
        if (localAmount > 0 && localSalt == 0) {
            throw new Error('disallowing self-griefing by using 0 salt for local commitment with a non-zero amount', { asset, localAmount, localSalt });
        } else if (remoteAmount > 0 && remoteSalt == 0) {
            throw new Error('disallowing self-griefing by using 0 salt for remote commitment with a non-zero amount', { asset, remoteAmount, remoteSalt });
        }

        const { localCommitment, remoteCommitment, proof } = await this.transactionKeeper.bridge(asset, localAmount, localSalt, remoteAmount, remoteSalt, inputCommitments);
        return new NodeResult({
            localCommitment: ethers.toBigInt(localCommitment.commitmentHash(this.transactionKeeper.proofGenerationCached)),
            remoteCommitment: ethers.toBigInt(remoteCommitment.commitmentHash(this.transactionKeeper.proofGenerationCached)),
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
    async transferFrom(asset, payoutAmount, payoutSalt, remainderAmount, remainderSalt, inputCommitments) {
        // sanity check
        if (payoutAmount > 0 && payoutSalt == 0) {
            throw new Error('disallowing self-griefing by using 0 salt for payout commitment with a non-zero amount', { asset, payoutAmount, payoutSalt });
        } else if (remainderAmount > 0 && remainderSalt == 0) {
            throw new Error('disallowing self-griefing by using 0 salt for remainder commitment with a non-zero amount', { asset, remainderAmount, remainderSalt });
        }

        const { payoutCommitment, remainderCommitment, proof } = await this.transactionKeeper.split(payoutAmount, payoutSalt, remainderAmount, remainderSalt, inputCommitments);
        return new NodeResult({
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


// this class will be the one that actually connects onchain
class ConnectedNode extends Node {
    constructor(ethers) {
        super();

        this.ethers = ethers;
    }
}


module.exports = {
    Node,
    ConnectedNode,

    Commitment
};
