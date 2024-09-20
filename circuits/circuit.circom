// reference: tornadocash/tornado-core

pragma circom 2.1.9;

include "../node_modules/circomlib/circuits/bitify.circom";
include "../node_modules/circomlib/circuits/mimcsponge.circom";
include "../node_modules/circomlib/circuits/pedersen.circom";

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

template VerifyMerkleProof(height) {
    signal input value;
    signal input root;

    signal input path[height];
    signal input sides[height];

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

    hash[height] === root;
}

template Commitment(address) {
    signal input sender;
    signal input asset;
    signal input amount;
    signal input salt;

    signal output nullifier;
    signal output commitment;

    component senderBits = Num2Bits(address);
    component assetBits = Num2Bits(address);
    component amountBits = Num2Bits(248);
    component saltBits = Num2Bits(248);

    senderBits.in <== sender;
    assetBits.in <== asset;
    amountBits.in <== amount;
    saltBits.in <== salt;

    // sender || asset || amount || salt
    component nullifierHash = Pedersen(address + address + 248 + 248);

    for (var i = 0; i < 160; i++) {
        nullifierHash.in[i] <== senderBits.out[i];
        nullifierHash.in[i + 160] <== assetBits.out[i];
    }

    for (var i = 0; i < 248; i++) {
        nullifierHash.in[i + 320] <== amountBits.out[i];
        nullifierHash.in[i + 568] <== saltBits.out[i];
    }

    nullifier <== nullifierHash.out[0];

    component nullifierBits = Num2Bits(248);
    nullifierBits.in <== nullifier;

    // nullifier || salt
    component commitmentHash = Pedersen(248 + 248);

    for (var i = 0; i < 248; i++) {
        commitmentHash.in[i] <== nullifierBits.out[i];
        commitmentHash.in[i + 248] <== saltBits.out[i];
    }

    commitment <== commitmentHash.out[0];
}

template Split(height, notes, address) {
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

    var totalAmount = 0;
    for (var i = 0; i < notes; i++) {
        commitments[i] = Commitment(address);
        commitments[i].sender <== sender;
        commitments[i].asset <== asset;
        commitments[i].amount <== amounts[i];
        commitments[i].salt <== salts[i];

        commitments[i].nullifier === nullifiers[i];

        verifiers[i] = VerifyMerkleProof(height);
        verifiers[i].value <== commitments[i].commitment;
        verifiers[i].root <== root;

        for (var j = 0; j < height; j++) {
            verifiers[i].path[j] <== path[i][j];
            verifiers[i].sides[j] <== sides[i][j];
        }

        totalAmount += amounts[i];
    }

    // check that the total amount is preserved
    totalAmount === leftAmount + rightAmount;

    // verify that the commitments are correct
    component left = Commitment(address);
    left.sender <== leftRecipient;
    left.asset <== asset;
    left.amount <== leftAmount;
    left.salt <== leftSalt;
    left.commitment === leftCommitment;

    component right = Commitment(address);
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
} = Split(30, 8, 160);
