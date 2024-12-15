const fs = require('fs');
const { groth16 } = require('snarkjs');


const PROOF_CACHE_FILE = '/tmp/proof_cache.json';

const CIRCUIT_WASM = '../circuits/circuit_js/circuit.wasm';
const CIRCUIT_ZKEY = '../circuits/circuit_final.zkey';


//////


class ProofGeneration {
    constructor(_poseidon) {
        this._poseidon = _poseidon;
    }

    poseidon(inputs) {
        return this._poseidon(inputs);
    }

    async prove(data) {
        //console.log('Generating proof for', data);
        const { proof, publicSignals } = await groth16.fullProve(data, CIRCUIT_WASM, CIRCUIT_ZKEY);
        //console.log(await groth16.exportSolidityCallData(proof, publicSignals))
        return { proof, publicSignals };
    }
}


// wrap ProofGeneration but cache the proof results in a cache file to speed 
// up rerunning the tests
class ProofGenerationCached { // TODO: just override ProofGeneration
    constructor(_poseidon) {
        this.proofGeneration = new ProofGeneration(_poseidon);
        this.proofCache = {};

        // XXX/TODO: for some reason, proofs that have entered verifyProof can't be reused. Absolutely no idea why not. TODO
        this.i = 0;

        this.poseidon = (inputs) => this.proofGeneration.poseidon(inputs);

        // parse json if file exists
        if (fs.existsSync(PROOF_CACHE_FILE)) {
            this.proofCache = JSON.parse(fs.readFileSync(PROOF_CACHE_FILE));
        }
    }

    async prove(data) {
        // TODO: use a better hash function lol
        const hashCode = s => s.split('').reduce((a,b)=>{a=((a<<5)-a)+b.charCodeAt(0);return a&a},0)

        const cacheKey = hashCode(this.i+'|'+data);
        this.i++;
        if (cacheKey in this.proofCache) {
            console.debug(`Proof cache hit for ${cacheKey}`);
            //return this.proofCache[cacheKey]; // XXX: somehow verifyProof knows if it's been verified before
        }

        console.debug(`Proof cache miss for ${cacheKey}, generating new proof...`);
        const proofData = await this.proofGeneration.prove(data);
        this.proofCache[cacheKey] = proofData;
        fs.writeFileSync(PROOF_CACHE_FILE, JSON.stringify(this.proofCache));
        return proofData;
    }
}


module.exports = {
    ProofGeneration,
    ProofGenerationCached
}
