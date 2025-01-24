pragma circom 2.1.9;

include "../node_modules/circomlib/circuits/poseidon.circom";


template Commitment() {
    signal input asset;
    signal input amount;
    signal input salt;
    signal input owner;

    signal output nullifier;
    signal output commitment;

    component nullifierHasher = Poseidon(4);
    nullifierHasher.inputs[0] <== asset;
    nullifierHasher.inputs[1] <== amount;
    nullifierHasher.inputs[2] <== salt;
    nullifierHasher.inputs[3] <== owner;
    nullifier <== nullifierHasher.out;

    component commitmentHasher = Poseidon(2);
    commitmentHasher.inputs[0] <== nullifier;
    commitmentHasher.inputs[1] <== salt;
    commitment <== commitmentHasher.out;
}

