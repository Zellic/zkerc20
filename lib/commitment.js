// { asset: address, amount: uint256, salt: uint256, owner: address }
class Commitment {
    _zeroPadConvertUint8Array(x) { return ethers.getBytes(ethers.zeroPadValue(ethers.getBytes(ethers.toBeArray(x)), 32)); } // XXX

    constructor(asset, amount, salt, owner = null, index = null) {
        if (!owner) owner = 0;

        this.asset = asset;
        this.amount = amount;
        this.salt = salt;
        this.owner = owner;
        this.index = index;
    }

    nullifierHash(proofGeneration) {

        //console.log("EXAMPLE FROM JS", ethers.toBigInt(proofGeneration.poseidon([0, 0])));

        /*let asset = this._zeroPadConvertUint8Array(this.asset);
        let amount = this._zeroPadConvertUint8Array(this.amount);
        let salt = this._zeroPadConvertUint8Array(this.salt);*/

        let result = proofGeneration.poseidon([
            this.asset,
            this.amount,
            this.salt,
            this.owner
        ]);
        //console.log('nullifier hash result', result, [this.asset, this.amount, this.salt])
        return result;
    }

    commitmentHash(proofGeneration) {
        return proofGeneration.poseidon([
            this.nullifierHash(proofGeneration),
            this.salt
        ]);
    }
}


module.exports = { Commitment }
