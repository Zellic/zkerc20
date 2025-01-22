const fs = require('fs');
const { groth16 } = require('snarkjs');

//const { buildPoseidon, buildMimcSponge } = require('circomlibjs');
const {
    poseidon_gencontract,
    mimcsponge_gencontract,
    poseidon,
    mimcsponge
} = require('../node_modules/circomlibjs');
let poseidonContract = poseidon_gencontract;
let mimcSpongecontract = mimcsponge_gencontract;
// async function that just returns an object with a .poseidon() function
let buildPoseidon = async (nRounds) => {
    return poseidon;
}
let buildMimcSponge = async (nRounds, seed) => {
    return mimcsponge;
}
const Scalar = require("ffjavascript").Scalar
const ZqField = require("ffjavascript").ZqField;
const F = new ZqField(Scalar.fromString("21888242871839275222246405745257275088548364400416034343698204186575808495617"));
mimcsponge.F = F;




const PROOF_CACHE_FILE = '/tmp/proof_cache.json';

const CIRCUIT_WASM = '../circuits/circuit_js/circuit.wasm';
const CIRCUIT_ZKEY = '../circuits/circuit_final.zkey';

const MAX_HEIGHT = 30;
const NUM_NOTES = 8;


module.exports
