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
        //console.log('Generating proof for', data);
        const { proof, publicSignals } = await groth16.fullProve(data, CIRCUIT_WASM, CIRCUIT_ZKEY);
        //console.log(await groth16.exportSolidityCallData(proof, publicSignals))
        return { proof, publicSignals };
    }
}


// wrap ProofGeneration but cache the proof results in a cache file to speed 
// up rerunning the tests
class ProofGenerationCached { // TODO: just override ProofGeneration
    constructor(_poseidon) {
        this.proofGeneration = new ProofGeneration(_poseidon);
        this.proofCache = {};

        // XXX/TODO: for some reason, proofs that have entered verifyProof can't be reused. Absolutely no idea why not. TODO
        this.i = 0;

        this.poseidon = (inputs) => this.proofGeneration.poseidon(inputs);

        // parse json if file exists
        if (fs.existsSync(PROOF_CACHE_FILE)) {
            this.proofCache = JSON.parse(fs.readFileSync(PROOF_CACHE_FILE));
        }
    }

    async prove(data) {
        // TODO: use a better hash function lol
        const hashCode = s => s.split('').reduce((a,b)=>{a=((a<<5)-a)+b.charCodeAt(0);return a&a},0)

        const cacheKey = hashCode(this.i+'|'+data);
        this.i++;
        if (cacheKey in this.proofCache) {
            console.debug(`Proof cache hit for ${cacheKey}`);
            //return this.proofCache[cacheKey]; // XXX: somehow verifyProof knows if it's been verified before
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

    constructor(asset, amount, salt, owner = null, index = null) {
        if (!owner) owner = 0;

        this.asset = asset;
        this.amount = amount;
        this.salt = salt;
        this.owner = owner;
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
            this.salt,
            this.owner
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
    insert(value) {
        //console.log('INSERTING',value,'AT INDEX',this.index,this.leaves)
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
        const layers = [this.leaves.slice(0, this.leaves.length)] // XXX: idk how to copy array in js

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


    constructor(poseidon, mimcSponge, getLatestLeaves, getSender) {
        this.proofGenerationCached = new ProofGenerationCached(poseidon);
        this.mimcSponge = mimcSponge;
        this.merkleTree = new MerkleTree(mimcSponge, getLatestLeaves);
        this.getSender = getSender;
    }

    // get secure random uint256
    _getRandom() {
        return Math.floor(Math.random() * 2**256); // TODO/XXX
    }


    async _split(sender, _merkleTree, inputCommitments, leftCommitment, rightCommitment, randFunc) {
        // XXX: a bit of a hack, but we need to allow using 0 as salt for 
        // inserts which have a fake merkle root. Onchain needs to calc the 
        // commitments too, so we can't have random salts for those. Privacy 
        // leak doesn't matter here because the asset is obviously already 
        // known because the ERC20 must be sent in.
        if (randFunc === undefined) {
            randFunc = this._getRandom;
        }

        // 1. make sure inputCommitments is NUM_NOTES sized
        for (let i = inputCommitments.length; i < NUM_NOTES; i++) {
            // we can't have 0 as salt, but it doesn't matter since amount=0
            inputCommitments.push(new Commitment(leftCommitment.asset, 0, randFunc()));
        }

        // 2. all elements are the same asset type. None of the inputs can have 0 as salt
        inputCommitments.forEach(c => {
            if (c.salt == 0) {
                throw new Error('input commitment salt cannot be 0', { inputCommitment: c });
            }

            if (c.asset != leftCommitment.asset) {
                throw new Error('input commitment asset mismatch', { inputCommitment: c, expectedAsset: leftCommitment.asset });
            }

            // all inputCommitments must have non-null indeces
            if (c.index == null && c.amount > 0) {
                throw new Error('input commitment\'s index with non-zero amount cannot be null', { inputCommitment: c });
            }

            // must be in the merkle trie
            if (c.index != null && _merkleTree.getValue(c.index) != c.commitmentHash(this.proofGenerationCached)) {
                //console.log({inputCommitment: c, inputCommitmentHashed: c.commitmentHash(this.proofGenerationCached), actualCommitmentAtIndex: _merkleTree.leaves})
                throw new Error('input commitment index exists in merkle trie, but the value does not match', {inputCommitment: c, inputCommitmentHashed: c.commitmentHash(this.proofGenerationCached), actualCommitmentAtIndex: _merkleTree.getValue(c.index)});
            }

            // if there is an owner, it must be this address
            if (c.owner != 0 && c.owner != sender) {
                throw new Error('input commitment owner must be the sender', { inputCommitment: c, sender });
            }

            // cannot be duplicate of another input commitment. This is 
            // enforced onchain in _split using the nullifing loop
            /*inputCommitments.forEach(d => {
                if (c.nullifierHash(this.proofGenerationCached) == d.nullifierHash(this.proofGenerationCached)) {
                    throw new Error('input commitment cannot be duplicate of another input commitment', {inputCommitment: c, duplicateOf: d});
                }
            })*/ // TODO
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
            const { path, sides: s } = _merkleTree.generateProof(inputCommitments[i].index);
            paths.push(path.map((p) => this.mimcSponge.F.toObject(p)))
            sides.push(s);
        }


        console.debug('---- API split ----');
        console.debug('root:', ethers.toBigInt(_merkleTree.root));
        console.debug('leftCommitment:', ethers.toBigInt(leftCommitment.commitmentHash(this.proofGenerationCached)));
        console.debug('rightCommitment:', ethers.toBigInt(rightCommitment.commitmentHash(this.proofGenerationCached)));
        for (var i = 0; i < inputCommitments.length; i++)
            console.debug('nullifiers['+i+']:', ethers.toBigInt(inputCommitments[i].nullifierHash(this.proofGenerationCached)));
        console.debug('-------------------');


        // 4. prove it!
        const proof = await this.proofGenerationCached.prove({
            sender,
            root: this.mimcSponge.F.toObject(_merkleTree.root),

            asset: leftCommitment.asset,
            amounts: inputCommitments.map(c => c.amount),
            salts: inputCommitments.map(c => c.salt),
            owners: inputCommitments.map(c => c.owner),

            leftAmount: leftCommitment.amount,
            leftSalt: leftCommitment.salt,
            leftOwner: leftCommitment.owner,
            leftCommitment: this.mimcSponge.F.toObject(leftCommitment.commitmentHash(this.proofGenerationCached)),

            rightAmount: rightCommitment.amount,
            rightSalt: rightCommitment.salt,
            rightOwner: rightCommitment.owner,
            rightCommitment: this.mimcSponge.F.toObject(rightCommitment.commitmentHash(this.proofGenerationCached)),

            nullifiers: inputCommitments.map(c => this.mimcSponge.F.toObject(c.nullifierHash(this.proofGenerationCached))),
            
            // signal input path[NUM_NOTES][MAX_HEIGHT];
            // signal input sides[NUM_NOTES][MAX_HEIGHT];
            path: paths,
            sides
        });

        const proofData = {
            a: proof.proof.pi_a.slice(0, 2).map(ethers.toBigInt),
            b: proof.proof.pi_b.slice(0, 2).map((x) => x.map(ethers.toBigInt).reverse()),
            c: proof.proof.pi_c.slice(0, 2).map(ethers.toBigInt)
        }
        return proofData;
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
        const proof = await this._split(
            0x0, // fake sender
            fakeMerkleTree,
            [inputCommitment],
            leftCommitment,
            rightCommitment,
            () => 1 // rand func, always return 1
        );

        // we also need to update local state, so just insert it 
        leftCommitment.index = this.merkleTree.insert(leftCommitment.commitmentHash(this.proofGenerationCached));

        return {
            commitment: leftCommitment,
            proof
        };
    }

    // unlock
    async drop(amount, remainderSalt, inputCommitments) {
        if (inputCommitments.length == 0) {
            throw new Error('input commitments for drop must be non-empty', { inputCommitments });
        }
        const asset = inputCommitments[0].asset;

        // get total amount from input commitments
        const sumInputAmount = inputCommitments.reduce((acc, c) => {
            // RangeError: The number NaN cannot be converted to a BigInt because it is not an integer
            if (c.amount === undefined) {
                throw new Error('input commitment amount is undefined', { inputCommitments, c });
            }
            return acc + c.amount
        }, 0);
        if (sumInputAmount < amount) {
            throw new Error('input commitments amount is less than amount to drop', { amount, sumInputAmount, inputCommitments });
        }

        // left is burned (salt 0), right is the remainder
        const leftCommitment = new Commitment(
            asset,
            amount,
            0x0 // burn salt
        );
        const rightCommitment = new Commitment(
            asset,
            sumInputAmount - amount,
            remainderSalt
        );

        const proof = await this._split(
            await this.getSender(),
            this.merkleTree,
            inputCommitments,
            leftCommitment,
            rightCommitment
        );

        rightCommitment.index = this.merkleTree.insert(rightCommitment.commitmentHash(this.proofGenerationCached));

        return {
            asset,
            remainderCommitment: rightCommitment,
            nullifiedCommitments: inputCommitments,
            proof
        };
    }

    // bridge
    async bridge(localAmount, localSalt, remoteAmount, remoteSalt, inputCommitments) {
        if (inputCommitments.length == 0) {
            throw new Error('input commitments for bridge must be non-empty', { inputCommitments });
        }
        const asset = inputCommitments[0].asset;

        const localCommitment = new Commitment(asset, localAmount, localSalt);
        const remoteCommitment = new Commitment(asset, remoteAmount, remoteSalt);

        const proof = await this._split(
            await this.getSender(),
            this.merkleTree,
            inputCommitments,
            localCommitment,
            remoteCommitment
        );
        
        localCommitment.index = this.merkleTree.insert(localCommitment.commitmentHash(this.proofGenerationCached));

        return {
            asset,
            localCommitment,
            remoteCommitment,
            proof
        };
    }

    async split(payoutAmount, payoutSalt, payoutOwner, remainderAmount, remainderSalt, inputCommitments) {
        if (inputCommitments.length == 0) {
            throw new Error('input commitments for split must be non-empty', { inputCommitments });
        }
        const asset = inputCommitments[0].asset;

        const payoutCommitment = new Commitment(asset, payoutAmount, payoutSalt, payoutOwner);
        const remainderCommitment = new Commitment(asset, remainderAmount, remainderSalt);

        const proof = await this._split(
            await this.getSender(),
            this.merkleTree,
            inputCommitments,
            payoutCommitment,
            remainderCommitment
        );

        payoutCommitment.index = this.merkleTree.insert(payoutCommitment.commitmentHash(this.proofGenerationCached));
        remainderCommitment.index = this.merkleTree.insert(remainderCommitment.commitmentHash(this.proofGenerationCached));

        return {
            asset,
            payoutCommitment,
            remainderCommitment,
            proof
        };
    }
}


// { args: dict, storage?: dict }
class NodeResult {
    constructor(args, storage) {
        this.args = args;
        this.storage = storage;
        if (!this.storage) {
            this.storage = {};
        }
    }
}


class Node {
    constructor() {
        this.getSender = async function() { return 0x0; };
    }

    // XXX: I'm bad at JS. Not sure how to do async in constructors
    async initialize(getLatestLeaves, getSender) {
        const poseidon = await buildPoseidon();
        const mimcSponge = await buildMimcSponge();
        this.transactionKeeper = new TransactionKeeper(
            poseidon,
            mimcSponge,
            getLatestLeaves,
            this.getSender
        );
    }
    
    // create an insert commitment with fake root containing just the commitment
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
    async unlock(amount, remainderSalt, inputCommitments) {
        const { asset, remainderCommitment, nullifiedCommitments, proof } = await this.transactionKeeper.drop(amount, remainderSalt, inputCommitments);
        return new NodeResult({
            asset,
            amount,
            remainderCommitment: ethers.toBigInt(remainderCommitment.commitmentHash(this.transactionKeeper.proofGenerationCached)),
            nullifier: nullifiedCommitments.map(n => n.nullifierHash(this.transactionKeeper.proofGenerationCached)),
            proof
        }, {
            inserted: [remainderCommitment],
            nullified: nullifiedCommitments
        });
    }

    // bridge a commitment
    async bridge(localAmount, localSalt, remoteAmount, remoteSalt, inputCommitments) {
        // sanity check
        if (localAmount > 0 && localSalt == 0) {
            throw new Error('disallowing self-griefing by using 0 salt for local commitment with a non-zero amount', { localAmount, localSalt });
        } else if (remoteAmount > 0 && remoteSalt == 0) {
            throw new Error('disallowing self-griefing by using 0 salt for remote commitment with a non-zero amount', { remoteAmount, remoteSalt });
        }

        const { localCommitment, remoteCommitment, proof } = await this.transactionKeeper.bridge(localAmount, localSalt, remoteAmount, remoteSalt, inputCommitments);
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


    // XXX: pick a better name
    // transfer (split) a commitment, choose salt auth only
    async transfer(payoutAmount, payoutSalt, payoutOwner, remainderSalt, inputCommitments) {
        // figure out the remainderCommitment's amount given the payout amount
        const sumInputAmount = inputCommitments.reduce((acc, c) => acc + c.amount, 0);
        if (sumInputAmount < payoutAmount) {
            throw new Error('input commitments amount is less than payout amount', { payoutAmount, sumInputAmount, inputCommitments });
        }
        const remainderAmount = sumInputAmount - payoutAmount;

        // sanity check
        if (payoutAmount > 0 && payoutSalt == 0) {
            throw new Error('disallowing self-griefing by using 0 salt for payout commitment with a non-zero amount', { payoutAmount, payoutSalt });
        } else if (remainderAmount > 0 && remainderSalt == 0) {
            throw new Error('disallowing self-griefing by using 0 salt for remainder commitment with a non-zero amount', { remainderAmount, remainderSalt });
        }

        const { payoutCommitment, remainderCommitment, proof } = await this.transactionKeeper.split(payoutAmount, payoutSalt, payoutOwner, remainderAmount, remainderSalt, inputCommitments);

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


    // transfer (split) a commitment, choose an owner+salt
    async transferUnowned(payoutAmount, payoutSalt, remainderSalt, inputCommitments) {
        return await this.transfer(payoutAmount, payoutSalt, 0x0, remainderSalt, inputCommitments);
    }
}


// this class will be the one that actually connects onchain
class ConnectedNode extends Node {
    constructor(ethers, signer, nodeContract, zkerc20Contract) {
        super();

        this.ethers = ethers;
        this.signer = signer;
        this.nodeContract = nodeContract;
        this.zkerc20Contract = zkerc20Contract;

        this.getSender = async function() {
            return signer.getAddress();
        }
    }

    async lock(asset, amount, salt) {
        const result = await super.lock(asset, amount, salt);
        result.args.receipt = await this.nodeContract.lock(result.args.asset, result.args.amount, result.args.commitment, result.args.proof);
        return result;
    }

    async unlock(amount, remainderSalt, inputCommitments) {
        const result = await super.unlock(amount, remainderSalt, inputCommitments);
        await this.nodeContract.unlock(result.args.asset, result.args.amount, result.args.remainderCommitment, result.args.nullifier, result.args.proof);
        return result;
    }

    async transfer(payoutAmount, payoutSalt, payoutOwner, remainderSalt, inputCommitments) {
        const result = await super.transfer(payoutAmount, payoutSalt, payoutOwner, remainderSalt, inputCommitments);
        await this.zkerc20Contract.transferFrom(result.args.payoutCommitment, result.args.remainderCommitment, result.args.nullifiers, result.args.proof);
        return result;
    }

    async transferUnowned(payoutAmount, payoutSalt, remainderSalt, inputCommitments) {
        return await this.transfer(payoutAmount, payoutSalt, 0x0, remainderSalt, inputCommitments);
    }
}


module.exports = {
    Node,
    ConnectedNode,

    Commitment
};
