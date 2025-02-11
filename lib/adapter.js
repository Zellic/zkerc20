const { 
    poseidon_gencontract, 
    mimcsponge_gencontract, 
    poseidon, 
    mimcsponge 
} = require('../node_modules/circomlibjs');

const { Scalar, ZqField } = require("ffjavascript");

// Initialize ZqField for MiMC Sponge
const F = new ZqField(
    Scalar.fromString("21888242871839275222246405745257275088548364400416034343698204186575808495617")
);
mimcsponge.F = F;

// Async functions for poseidon and mimcSponge builders
const buildPoseidon = async (nRounds) => poseidon;
const buildMimcSponge = async (nRounds, seed) => mimcsponge;

// Keep the same function names as future versions of circomlibjs so that we 
// can easily switch in the future once its bugs are fixed
const poseidonContract = poseidon_gencontract;
const mimcSpongeContract = mimcsponge_gencontract;



module.exports = {
    buildPoseidon,
    buildMimcSponge,

    // for seutp.js
    poseidonContract,
    mimcSpongeContract
}
