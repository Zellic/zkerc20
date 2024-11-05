// reference: tornadocash/tornado-core

pragma circom 2.1.9;

include "../node_modules/circomlib/circuits/bitify.circom";
include "../node_modules/circomlib/circuits/mimcsponge.circom";
include "../node_modules/circomlib/circuits/poseidon.circom";

template HashTwo() {
    signal input left;
    signal input right;
    signal output hash;

    component hasher = MiMCSponge(2, 220, 1);
    hasher.ins[0] <== left;
    hasher.ins[1] <== right;
    hasher.k <== 0;
    hash <== hasher.outs[0];
}

template HashCheck() {
    signal input left;
    signal input right;
    signal input hash;

    component hasher = MiMCSponge(2, 220, 1);
    hasher.ins[0] <== left;
    hasher.ins[1] <== right;
    hasher.k <== 0;

    component again = MiMCSponge(2, 220, 1);
    again.ins[0] <== hasher.outs[0];
    again.ins[1] <== hasher.outs[0];
    again.k <== 0;

    again.outs[0] === hash;
}

template MerkleRoot(height) {
    signal input value;

    signal input path[height];
    signal input sides[height];

    signal output root;

    signal hash[height + 1];
    component hasher[height];

    hash[0] <== value;

    for (var i = 0; i < height; i++) {
        // the side must be zero or one
        sides[i] * (1 - sides[i]) === 0;

        // if side is 0, then hash(subtree, path)
        // otherwise, hash(path, subtree)
        hasher[i] = HashTwo();
        hasher[i].left <== (path[i] - hash[i]) * sides[i] + hash[i];
        hasher[i].right <== (hash[i] - path[i]) * sides[i] + path[i];

        hash[i + 1] <== hasher[i].hash;
    }

    root <== hash[height];
}

template Commitment() {
    signal input asset;
    signal input amount;
    signal input salt;

    signal output nullifier;
    signal output commitment;

    component nullifierHasher = Poseidon(4);
    nullifierHasher.inputs[0] <== asset;
    nullifierHasher.inputs[1] <== amount;
    nullifierHasher.inputs[2] <== salt;
    nullifier <== nullifierHasher.out;

    component commitmentHasher = Poseidon(2);
    commitmentHasher.inputs[0] <== nullifier;
    commitmentHasher.inputs[1] <== salt;
    commitment <== commitmentHasher.out;
}

// a. takes an arbitrary number of input commitments+nullifiers
// b. checks that the commitment is in the tree
// c. 
template Split(height, notes) {
    // notes in
    signal input root;
    signal private input asset;
    signal private input amounts[notes];
    signal private input salts[notes];

    // note left
    signal private input leftAmount;
    signal private input leftSalt;
    signal input leftCommitment;

    // note right
    signal private input rightAmount;
    signal private input rightSalt;
    signal input rightCommitment;

    // should be hash(asset, amount, salt)
    signal input nullifiers[notes];

    // leaf of the tree is hash(nullifier, salt)
    signal private input path[notes][height];
    signal private input sides[notes][height];

    component commitments[notes];
    component verifiers[notes];

    signal merkleValid[notes];

    var totalInputAmount = 0;
    for (var i = 0; i < notes; i++) {
        // check that the nullifier is correct
        commitments[i] = Commitment();
        commitments[i].asset <== asset;
        commitments[i].amount <== amounts[i];
        commitments[i].salt <== salts[i];
        commitments[i].nullifier === nullifiers[i];

        // check that the commitment is not from the burn salt
        commitments[i].salt !== 0;

        // check that the commitment is in the tree
        verifiers[i] = MerkleRoot(height);
        verifiers[i].value <== commitments[i].commitment;
        for (var j = 0; j < height; j++) {
            verifiers[i].path[j] <== path[i][j];
            verifiers[i].sides[j] <== sides[i][j];
        }

        // either the commitment is in the tree
        // or it represents zero tokens
        merkleValid[i] <== verifiers[i].root - root;
        merkleValid[i] * amounts[i] === 0;

        // overflow check (TODO: is this the best way?)
        totalInputAmount + amounts[i] >== totalInputAmount
        totalInputAmount + amounts[i] >== amounts[i]
        totalInputAmount += amounts[i];
    }

    // check that the amounts are not too large
    let maxAmount = 2 ** 100;
    leftAmount < maxAmount;
    rightAmount < maxAmount;

    // check that the total amount is preserved
    totalInputAmount === leftAmount + rightAmount;

    // verify that the commitments are correct
    component left = Commitment();
    left.asset <== asset;
    left.amount <== leftAmount;
    left.salt <== leftSalt;
    left.commitment === leftCommitment;

    component right = Commitment();
    right.asset <== asset;
    right.amount <== rightAmount;
    right.salt <== rightSalt;
    right.commitment === rightCommitment;

    // check that the nullifier will be unique
    // XXX: this isn't strictly necessary, just a sanity check
    // TODO: remove once things are working
    // XXX: this will actually break burning a full note
    left.nullifier !== right.nullifier;
    for (var i = 0; i < notes; i++) {
        left.nullifier !== nullifiers[i];
        right.nullifier !== nullifiers[i];
    }
}

component main {
    public [
        root, // contract checks this is the current commitment
        leftCommitment, // contract inserts this into the commitment
        rightCommitment, // contract inserts this into the commitment
        nullifiers // contract marks these as spent
    ]
} = Split(30, 8);
