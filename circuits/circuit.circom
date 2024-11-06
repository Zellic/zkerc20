// reference: tornadocash/tornado-core

pragma circom 2.1.9;

include "../node_modules/circomlib/circuits/bitify.circom";
include "../node_modules/circomlib/circuits/mimcsponge.circom";
include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

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

template MerkleRoot(MAX_HEIGHT) {
    signal input value;

    signal input path[MAX_HEIGHT];
    signal input sides[MAX_HEIGHT];

    signal output root;

    signal hash[MAX_HEIGHT + 1];
    component hasher[MAX_HEIGHT];

    hash[0] <== value;

    for (var i = 0; i < MAX_HEIGHT; i++) {
        // the side must be zero or one
        sides[i] * (1 - sides[i]) === 0;

        // if side is 0, then hash(subtree, path)
        // otherwise, hash(path, subtree)
        hasher[i] = HashTwo();
        hasher[i].left <== (path[i] - hash[i]) * sides[i] + hash[i];
        hasher[i].right <== (hash[i] - path[i]) * sides[i] + path[i];

        hash[i + 1] <== hasher[i].hash;
    }

    root <== hash[MAX_HEIGHT];
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

// TODO: refactor into separate file
template Split(MAX_HEIGHT, NUM_NOTES) {
    // NUM_NOTES in
    signal input root;
    signal input asset; // private
    signal input amounts[NUM_NOTES]; // private
    signal input salts[NUM_NOTES]; // private

    // note left
    signal input leftAmount; // private
    signal input leftSalt; // private
    signal input leftCommitment;

    // note right
    signal input rightAmount; // private
    signal input rightSalt; // private
    signal input rightCommitment;

    // should be hash(asset, amount, salt)
    signal input nullifiers[NUM_NOTES];

    // leaf of the tree is hash(nullifier, salt)
    signal input path[NUM_NOTES][MAX_HEIGHT];
    signal input sides[NUM_NOTES][MAX_HEIGHT];

    component commitments[NUM_NOTES];
    component verifiers[NUM_NOTES];

    signal merkleValid[NUM_NOTES];


    var totalInputAmount = 0;

    // off-chain, nullifiers are checked to be unique
    for (var i = 0; i < NUM_NOTES; i++) {
        // check that the nullifier is correct
        commitments[i] = Commitment();
        commitments[i].asset <== asset;
        commitments[i].amount <== amounts[i];
        commitments[i].salt <== salts[i];
        commitments[i].nullifier === nullifiers[i];

        // check that the commitment is not from the burn salt
        component saltCheck = GreaterThan(256);
        saltCheck.in[0] <== commitments[i].salt;
        saltCheck.in[1] <== 0;
        saltCheck.out === 1; // TODO: is 1 true?

        // check that the commitment is in the tree
        verifiers[i] = MerkleRoot(MAX_HEIGHT);
        verifiers[i].value <== commitments[i].commitment;
        for (var j = 0; j < MAX_HEIGHT; j++) {
            verifiers[i].path[j] <== path[i][j];
            verifiers[i].sides[j] <== sides[i][j];
        }

        // either the commitment is in the tree
        // or it represents zero tokens
        merkleValid[i] <== verifiers[i].root - root;
        merkleValid[i] * amounts[i] === 0;

        // overflow check (TODO: is this the best way?)
        component overflowCheck = LessThan(256);
        overflowCheck.in[0] <== amounts[i];
        overflowCheck.in[1] <== 2 ** 256 - totalInputAmount - 1;
        overflowCheck.out === 1; // TODO: is 1 true?

        totalInputAmount += amounts[i];
    }

    // check that the amounts are not too large
    // TODO: is there a better way to do this
    var maxAmount = 2 ** 256 / 2 - 1;
    component leftTotalAmountCheck = LessThan(256);
    totalAmountCheck.in[0] <== leftAmount;
    totalAmountCheck.in[1] <== maxAmount;
    totalAmountCheck.out === 1; // TODO: is 1 true?

    component rightTotalAmountCheck = LessThan(256);
    totalAmountCheck.in[0] <== rightAmount;
    totalAmountCheck.in[1] <== maxAmount;
    totalAmountCheck.out === 1; // TODO: is 1 true?

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
}

component main {
    public [
        root, // contract checks this is the current commitment
        leftCommitment, // contract inserts this into the commitment
        rightCommitment, // contract inserts this into the commitment
        nullifiers // contract marks these as spent
    ]
} = Split(30, 8);
