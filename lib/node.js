const { 
    poseidon_gencontract, 
    mimcsponge_gencontract, 
    poseidon, 
    mimcsponge 
} = require('../node_modules/circomlibjs');

const { Scalar, ZqField } = require("ffjavascript");
const { TransactionKeeper } = require('./transactionKeeper.js');
const { SelfGriefingError, AmountMismatchError } = require('./utils.js');

// Initialize ZqField for MiMC Sponge
const F = new ZqField(
    Scalar.fromString("21888242871839275222246405745257275088548364400416034343698204186575808495617")
);
mimcsponge.F = F;

// Async functions for poseidon and mimcSponge builders
const buildPoseidon = async (nRounds) => poseidon;
const buildMimcSponge = async (nRounds, seed) => mimcsponge;

// Keep the same function names as future versions of circomlibjs so that we 
// can easily switch in the future once its bugs are fixed
const poseidonContract = poseidon_gencontract;
const mimcSpongecontract = mimcsponge_gencontract;


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


    _nullifierHash(commitment) {
        return commitment.nullifierHash(this.transactionKeeper.proofGenerationCached);
    }
    _commitmentHash(commitment) {
        return commitment.commitmentHash(this.transactionKeeper.proofGenerationCached);
    }

    
    // create an insert commitment with fake root containing just the commitment
    async lock(asset, amount, salt) {
        // sanity check
        if (amount > 0 && salt == 0) {
            throw new SelfGriefingError('disallowing self-griefing by using 0 salt with a non-zero amount', { asset, amount, salt });
        }

        const { commitment, proof } = await this.transactionKeeper.insert(asset, amount, salt);
        return new NodeResult({
            asset,
            amount,
            commitment: ethers.BigNumber.from(this._commitmentHash(commitment)),
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
            remainderCommitment: ethers.BigNumber.from(this._commitmentHash(remainderCommitment)),
            nullifier: nullifiedCommitments.map(n => this._nullifierHash(n)),
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
            throw new SelfGriefingError('disallowing self-griefing by using 0 salt for local commitment with a non-zero amount', { localAmount, localSalt });
        } else if (remoteAmount > 0 && remoteSalt == 0) {
            throw new SelfGriefingError('disallowing self-griefing by using 0 salt for remote commitment with a non-zero amount', { remoteAmount, remoteSalt });
        }

        const { localCommitment, remoteCommitment, proof } = await this.transactionKeeper.bridge(localAmount, localSalt, remoteAmount, remoteSalt, inputCommitments);
        return new NodeResult({
            localCommitment: ethers.BigNumber.from(this._commitmentHash(localCommitment)),
            remoteCommitment: ethers.BigNumber.from(this._commitmentHash(remoteCommitment)),
            nullifiers: inputCommitments.map(n => this._nullifierHash(n)),
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
            throw new AmountMismatchError('input commitments amount is less than payout amount', { payoutAmount, sumInputAmount, inputCommitments });
        }
        const remainderAmount = sumInputAmount - payoutAmount;

        // sanity check
        if (payoutAmount > 0 && payoutSalt == 0) {
            throw new SelfGriefingError('disallowing self-griefing by using 0 salt for payout commitment with a non-zero amount', { payoutAmount, payoutSalt });
        } else if (remainderAmount > 0 && remainderSalt == 0) {
            throw new SelfGriefingError('disallowing self-griefing by using 0 salt for remainder commitment with a non-zero amount', { remainderAmount, remainderSalt });
        }

        const { payoutCommitment, remainderCommitment, proof } = await this.transactionKeeper.split(payoutAmount, payoutSalt, payoutOwner, remainderAmount, remainderSalt, inputCommitments);

        return new NodeResult({
            payoutCommitment: this._commitmentHash(payoutCommitment),
            remainderCommitment: this._commitmentHash(remainderCommitment),
            nullifiers: inputCommitments.map(n => this._nullifierHash(n)),
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
    NodeResult,
    Node,
    ConnectedNode,

    // needed in CLI
    buildPoseidon
}
