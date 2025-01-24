pragma circom 2.1.9;

include "hashtwo.circom";


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

