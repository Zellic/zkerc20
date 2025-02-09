// We define "Note" as a Commitment that is inserted into a merkle trie
//
// Its details may or may not be known. All that is public knowledge is:
// - The commitment hash
// - Its index in the merkle trie
// - Whether or not it has been nullified yet
//
// Often, this is also public knowledge:
// - Its nullifier hash
//
// All other details are only known by the creator of the note.

const {
    buildPoseidon
} = require('./node.js');

const {
    Commitment
} = require('./commitment.js');

class Note {
    // A note can be created from either (commitment,index) or (commitmentHash,index)
    constructor(commitment, index, nullified = null) {
        if (commitment instanceof Commitment) {
            this.commitment = commitment;
            this._commitmentHash = null;
        } else {
            this.commitment = null;
            this._commitmentHash = new Commitment(commitment);
        }
        this.index = index;
        this.nullified = nullified;
    }

    /**
     * Returns the commitment hash of the note
     * @param {ProofGeneration} proofGeneration - if provided, the note will use this proofGeneration to hash the commitment
     * @returns {Promise<Commitment>} - the commitment hash of the note
     */
    async commitmentHash(proofGeneration = null) {
        // check if stored
        if (this._commitmentHash) {
            return this._commitmentHash;
        }

        // it doesn't exist, so we'll need to hash it ourselves
        if (!proofGeneration) {
            const poseidon = await buildPoseidon();
            proofGeneration = new ProofGeneration(poseidon);
        }

        this._commitmentHash = await this.commitment.commitmentHash(proofGeneration);
        return this._commitmentHash;
    }
}


module.exports = {
    Note
};

