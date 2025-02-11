const { ethers } = require('ethers');

const {
    ProofGeneration,
    ProofGenerationCached
} = require('./proofGeneration.js')

const {
    MerkleTree
} = require('./merkleTree.js')

const {
    Commitment
} = require('./commitment.js')


const NUM_NOTES = 8;


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


    _nullifierHash(commitment) {
        return commitment.nullifierHash(this.proofGenerationCached);
    }

    _commitmentHash(commitment) {
        return commitment.commitmentHash(this.proofGenerationCached);
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
                throw new InvalidCommitmentError('input commitment salt cannot be 0', { inputCommitment: c });
            }

            if (c.asset != leftCommitment.asset) {
                throw new InvalidCommitmentError('input commitment asset mismatch', { inputCommitment: c, expectedAsset: leftCommitment.asset });
            }

            // all inputCommitments must have non-null indeces
            if (c.index == null && c.amount > 0) {
                throw new InvalidCommitmentError('input commitment\'s index with non-zero amount cannot be null', { inputCommitment: c });
            }

            // must be in the merkle trie
            if (c.index != null && _merkleTree.getValue(c.index) != this._commitmentHash(c)) {
                //console.log({inputCommitment: c, inputCommitmentHashed: c.commitmentHash(this.proofGenerationCached), actualCommitmentAtIndex: _merkleTree.leaves})
                throw new InvalidCommitmentError('input commitment index exists in merkle trie, but the value does not match', {inputCommitment: c, inputCommitmentHashed: this._commitmentHash(c), actualCommitmentAtIndex: _merkleTree.getValue(c.index)});
            }

            // if there is an owner, it must be this address
            if (c.owner != 0 && c.owner != sender) {
                throw new InvalidCommitmentError('input commitment owner must be the sender', { inputCommitment: c, sender });
            }
        });

        if (leftCommitment.asset != rightCommitment.asset) {
            throw new InvalidCommitmentError('right commitment asset is incorrect', { rightCommitment, expectedAsset: leftCommitment.asset });
        }

        // 3. ensure leftCommitment.amount + rightCommitment.amount == sum(inputCommitments.amount)
        const sumInputAmount = inputCommitments.reduce((acc, c) => acc + c.amount, 0);
        if (leftCommitment.amount + rightCommitment.amount != sumInputAmount) {
            throw new InvalidCommitmentError('input commitment amounts do not equal output commitment amounts', { leftCommitment, rightCommitment, sumInputAmount, inputCommitments });
        }

        // this case can be triggered if too many input notes come in.
        // making it more general to sanity check myself.
        if (inputCommitments.length != NUM_NOTES) {
            throw new InvalidCommitmentError('input commitments must be of length NUM_NOTES', { inputCommitments });
        }

        // all inputCommitments must have unique indeces (where if amount > 0)
        // this is enfored onchain (not in circuits) using the nullifiers
        const indeces = inputCommitments.filter(c => c.amount > 0).map(c => c.index);
        if (indeces.length != new Set(indeces).size) {
            throw new InvalidCommitmentError('input commitments with non-zero amount must have unique index (no duplicate indeces allowed)', { inputCommitments });
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
        console.debug('root:', ethers.BigNumber.from(_merkleTree.root));
        console.debug('leftCommitment:', ethers.BigNumber.from(this._commitmentHash(leftCommitment)));
        console.debug('rightCommitment:', ethers.BigNumber.from(this._commitmentHash(rightCommitment)));
        for (var i = 0; i < inputCommitments.length; i++)
            console.debug('nullifiers['+i+']:', ethers.BigNumber.from(this._nullifierHash(inputCommitments[i])));
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
            leftCommitment: this.mimcSponge.F.toObject(this._commitmentHash(leftCommitment)),

            rightAmount: rightCommitment.amount,
            rightSalt: rightCommitment.salt,
            rightOwner: rightCommitment.owner,
            rightCommitment: this.mimcSponge.F.toObject(this._commitmentHash(rightCommitment)),

            nullifiers: inputCommitments.map(c => this.mimcSponge.F.toObject(this._nullifierHash(c))),
            
            // signal input path[NUM_NOTES][MAX_HEIGHT];
            // signal input sides[NUM_NOTES][MAX_HEIGHT];
            path: paths,
            sides
        });

        const proofData = {
            a: proof.proof.pi_a.slice(0, 2).map(ethers.BigNumber.from),
            b: proof.proof.pi_b.slice(0, 2).map((x) => x.map(ethers.BigNumber.from).reverse()),
            c: proof.proof.pi_c.slice(0, 2).map(ethers.BigNumber.from)
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

        inputCommitment.index = fakeMerkleTree.insert(this._commitmentHash(inputCommitment));
        leftCommitment.index = fakeMerkleTree.insert(this._commitmentHash(leftCommitment));
        const proof = await this._split(
            0x0, // fake sender
            fakeMerkleTree,
            [inputCommitment],
            leftCommitment,
            rightCommitment,
            () => 1 // rand func, always return 1
        );

        // we also need to update local state, so just insert it 
        leftCommitment.index = this.merkleTree.insert(this._commitmentHash(leftCommitment));

        return {
            commitment: leftCommitment,
            proof
        };
    }

    // unlock
    async drop(amount, remainderSalt, inputCommitments) {
        if (inputCommitments.length == 0) {
            throw new InvalidCommitmentError('input commitments for drop must be non-empty', { inputCommitments });
        }
        const asset = inputCommitments[0].asset;

        // get total amount from input commitments
        const sumInputAmount = inputCommitments.reduce((acc, c) => {
            // RangeError: The number NaN cannot be converted to a BigInt because it is not an integer
            if (c.amount === undefined) {
                throw new InvalidCommitmentError('input commitment amount is undefined', { inputCommitments, c });
            }
            return acc + c.amount
        }, 0);
        if (sumInputAmount < amount) {
            throw new InvalidCommitmentError('input commitments amount is less than amount to drop', { amount, sumInputAmount, inputCommitments });
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

        rightCommitment.index = this.merkleTree.insert(this._commitmentHash(rightCommitment));

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
            throw new InvalidCommitmentError('input commitments for bridge must be non-empty', { inputCommitments });
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
        
        localCommitment.index = this.merkleTree.insert(this._commitmentHash(localCommitment));

        return {
            asset,
            localCommitment,
            remoteCommitment,
            proof
        };
    }

    async split(payoutAmount, payoutSalt, payoutOwner, remainderAmount, remainderSalt, inputCommitments) {
        if (inputCommitments.length == 0) {
            throw new InvalidCommitmentError('input commitments for split must be non-empty', { inputCommitments });
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

        payoutCommitment.index = this.merkleTree.insert(this._commitmentHash(payoutCommitment));
        remainderCommitment.index = this.merkleTree.insert(this._commitmentHash(remainderCommitment));

        return {
            asset,
            payoutCommitment,
            remainderCommitment,
            proof
        };
    }
}


// TODO/XXX: this doesn't belong here
async function reset() {
    return await network.provider.send("hardhat_reset", [{}]);
}


module.exports = { TransactionKeeper, reset }
