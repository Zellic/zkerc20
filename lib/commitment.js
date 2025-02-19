// { asset: address, amount: uint256, salt: uint256, owner: address, tokenId: uint256, tokenType: uint8 }
class Commitment {
    _zeroPadConvertUint8Array(x) { return ethers.getBytes(ethers.zeroPadValue(ethers.getBytes(ethers.toBeArray(x)), 32)); }

    // TokenType: 0 = ERC20, 1 = ERC721, 2 = ERC1155
    constructor(asset, amount, salt, owner = null, index = null, tokenId = 0, tokenType = 0) {
        if (!owner) owner = 0;

        this.asset = asset;
        this.amount = amount;
        this.salt = salt;
        this.owner = owner;
        this.index = index;
        this.tokenId = tokenId;
        this.tokenType = tokenType;

        // Validate token type specific rules
        this._validateTokenRules();
    }

    _validateTokenRules() {
        switch (this.tokenType) {
            case 1: // ERC721
                if (this.amount !== 0 && this.amount !== 1) {
                    throw new Error('ERC721 tokens can only have amount of 0 or 1');
                }
                if (this.tokenId === 0) {
                    throw new Error('ERC721 tokens must have a valid tokenId');
                }
                break;
            case 2: // ERC1155
                if (this.tokenId === 0) {
                    throw new Error('ERC1155 tokens must have a valid tokenId');
                }
                break;
            case 0: // ERC20
                if (this.tokenId !== 0) {
                    throw new Error('ERC20 tokens should not have a tokenId');
                }
                break;
            default:
                throw new Error('Invalid token type');
        }
    }

    nullifierHash(proofGeneration) {
        let result = proofGeneration.poseidon([
            this.asset,
            this.amount,
            this.salt,
            this.owner,
            this.tokenId,
            this.tokenType
        ]);
        return result;
    }

    commitmentHash(proofGeneration) {
        return proofGeneration.poseidon([
            this.nullifierHash(proofGeneration),
            this.salt
        ]);
    }

    // Helper method to create ERC721 commitment
    static createERC721(asset, tokenId, salt, owner = null, index = null) {
        return new Commitment(asset, 1, salt, owner, index, tokenId, 1);
    }

    // Helper method to create ERC1155 commitment
    static createERC1155(asset, tokenId, amount, salt, owner = null, index = null) {
        return new Commitment(asset, amount, salt, owner, index, tokenId, 2);
    }

    // Helper method to create ERC20 commitment (for backward compatibility)
    static createERC20(asset, amount, salt, owner = null, index = null) {
        return new Commitment(asset, amount, salt, owner, index, 0, 0);
    }
}

module.exports = { Commitment }
