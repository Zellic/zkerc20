const {
    Note
} = require('./note.js');

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

    note(index = null) {
        if (this.index) {
            if (index && this.index !== index) {
                // this.index is written to when the calculating where it'll be in the merkle tree
                // index is passed in when we need it to be a note
                // maybe this can be hit in some kind of race condition?
                // just figured a sanity check would be good here to make debugging easier
                throw new Error(`Note index mismatch. This means there is a bug. Expected this.index=${this.index}, got index=${index}`);
            } else {
                index = this.index;
            }
        } else {
            if (!index) {
                throw new Error('Note index is required for .note(index) call; there was no stored this.index.');
            }
        }

        return new Note(this, index);
    }
}


module.exports = {
    Commitment,
    Note
};
