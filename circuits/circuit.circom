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
    signal input sender;
    signal input asset;
    signal input amount;
    signal input salt;

    signal output nullifier;
    signal output commitment;

    component nullifierHasher = Poseidon(4);
    nullifierHasher.inputs[0] <== sender;
    nullifierHasher.inputs[1] <== asset;
    nullifierHasher.inputs[2] <== amount;
    nullifierHasher.inputs[3] <== salt;
    nullifier <== nullifierHasher.out;

    component commitmentHasher = Poseidon(2);
    commitmentHasher.inputs[0] <== nullifier;
    commitmentHasher.inputs[1] <== salt;
    commitment <== commitmentHasher.out;
}

template Split(height, notes) {
    // notes in
    signal input root;
    signal input sender;
    signal input asset;
    signal input amounts[notes];
    signal input salts[notes];

    // note left
    signal input leftRecipient;
    signal input leftAmount;
    signal input leftSalt;
    signal input leftCommitment;

    // note right
    signal input rightRecipient;
    signal input rightAmount;
    signal input rightSalt;
    signal input rightCommitment;

    // should be hash(sender, amount, salt)
    signal input nullifiers[notes];

    // leaf of the tree is hash(nullifier, salt)
    signal input path[notes][height];
    signal input sides[notes][height];

    component commitments[notes];
    component verifiers[notes];

    signal merkleValid[notes];

    var totalAmount = 0;
    for (var i = 0; i < notes; i++) {
        commitments[i] = Commitment();
        commitments[i].sender <== sender;
        commitments[i].asset <== asset;
        commitments[i].amount <== amounts[i];
        commitments[i].salt <== salts[i];

        commitments[i].nullifier === nullifiers[i];

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
        totalAmount + amounts[i] >== totalAmount
        totalAmount + amounts[i] >== amounts[i]

        totalAmount += amounts[i];
    }

    // check that the amounts are not too large
    let maxAmount = 2 ** 100;
    leftAmount < maxAmount;
    rightAmount < maxAmount;

    // check that the total amount is preserved
    totalAmount === leftAmount + rightAmount;

    // verify that the commitments are correct
    component left = Commitment();
    left.sender <== leftRecipient;
    left.asset <== asset;
    left.amount <== leftAmount;
    left.salt <== leftSalt;
    left.commitment === leftCommitment;

    component right = Commitment();
    right.sender <== rightRecipient;
    right.asset <== asset;
    right.amount <== rightAmount;
    right.salt <== rightSalt;
    right.commitment === rightCommitment;
}

component main {
    public [
        root, // contract checks this is the current commitment
        sender, // contract checks this is the sender
        leftCommitment, // contract inserts this into the commitment
        rightCommitment, // contract inserts this into the commitment
        nullifiers // contract marks these as spent
    ]
} = Split(30, 8);
