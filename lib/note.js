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
} = require('./adapter.js');

const {
    Commitment
} = require('./commitment.js');

class Note {
    // A note can be created from either (commitment,index) or (commitmentHash,index)
    constructor(commitment, index = null, nullified = null) {
        if (commitment instanceof Commitment) {
            this.commitment = commitment;
            this._commitmentHash = null;

            
            if (commitment.index) {
                if (index && commitment.index !== index) {
                    // this.index is written to when the calculating where it'll be in the merkle tree
                    // index is passed in when we need it to be a note
                    // maybe this can be hit in some kind of race condition?
                    // just figured a sanity check would be good here to make debugging easier
                    throw new Error(`Note index mismatch. This means there is a bug. Expected commitment.index=${this.index}, got index=${index}`);
                } else {
                    index = commitment.index;
                }
            }
        } else {
            this.commitment = null;
            this._commitmentHash = commitment;
        }
        this.index = index;
        this.nullified = nullified;

        if (!index) {
            throw new Error('Note index is required for .note(index) call; there was no stored this.index.');
        }
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

