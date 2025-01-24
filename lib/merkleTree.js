const {
    MerkleTreeFullError
} = require('./utils.js');

const MAX_HEIGHT = 30;


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
            throw new MerkleTreeFullError("Tree is full");
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


module.exports = { MerkleTree }
