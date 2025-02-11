/*
 * To convert a Comitment to a Note, simply call new Note(commitment)
 */

// { asset: address, amount: uint256, salt: uint256, owner: address }
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
        return proofGeneration.poseidon([
            this.asset,
            this.amount,
            this.salt,
            this.owner
        ]);
    }

    commitmentHash(proofGeneration) {
        return proofGeneration.poseidon([
            this.nullifierHash(proofGeneration),
            this.salt
        ]);
    }
}


module.exports = {
    Commitment
};
