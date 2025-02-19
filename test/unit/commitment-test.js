const { expect } = require("chai");
const { Commitment } = require('../../lib/commitment.js');

describe("Commitment Tests", function () {
    const mockProofGeneration = {
        poseidon: (inputs) => inputs.reduce((a, b) => a + b, 0) // Simple mock for testing
    };

    describe("ERC721 Commitments", () => {
        it("should create valid ERC721 commitment", () => {
            const commitment = Commitment.createERC721(
                "0x123",  // asset address
                1,        // tokenId
                123456,   // salt
                "0x456"   // owner
            );

            expect(commitment.tokenType).to.equal(1);
            expect(commitment.amount).to.equal(1);
            expect(commitment.tokenId).to.equal(1);
        });

        it("should reject invalid ERC721 amount", () => {
            expect(() => new Commitment(
                "0x123",  // asset
                2,        // amount (invalid for ERC721)
                123456,   // salt
                "0x456",  // owner
                null,     // index
                1,        // tokenId
                1         // tokenType (ERC721)
            )).to.throw('ERC721 tokens can only have amount of 0 or 1');
        });

        it("should reject ERC721 with zero tokenId", () => {
            expect(() => new Commitment(
                "0x123", // asset
                1,       // amount
                123456,  // salt
                "0x456", // owner
                null,    // index
                0,       // tokenId (invalid)
                1        // tokenType (ERC721)
            )).to.throw('ERC721 tokens must have a valid tokenId');
        });
    });

    describe("ERC1155 Commitments", () => {
        it("should create valid ERC1155 commitment", () => {
            const commitment = Commitment.createERC1155(
                "0x123",  // asset address
                1,        // tokenId
                5,        // amount
                123456,   // salt
                "0x456"   // owner
            );

            expect(commitment.tokenType).to.equal(2);
            expect(commitment.amount).to.equal(5);
            expect(commitment.tokenId).to.equal(1);
        });

        it("should reject ERC1155 with zero tokenId", () => {
            expect(() => new Commitment(
                "0x123", // asset
                5,       // amount
                123456,  // salt
                "0x456", // owner
                null,    // index
                0,       // tokenId (invalid)
                2        // tokenType (ERC1155)
            )).to.throw('ERC1155 tokens must have a valid tokenId');
        });
    });

    describe("ERC20 Commitments (Backward Compatibility)", () => {
        it("should create valid ERC20 commitment", () => {
            const commitment = Commitment.createERC20(
                "0x123",  // asset address
                100,      // amount
                123456,   // salt
                "0x456"   // owner
            );

            expect(commitment.tokenType).to.equal(0);
            expect(commitment.amount).to.equal(100);
            expect(commitment.tokenId).to.equal(0);
        });

        it("should reject ERC20 with non-zero tokenId", () => {
            expect(() => new Commitment(
                "0x123", // asset
                100,     // amount
                123456,  // salt
                "0x456", // owner
                null,    // index
                1,       // tokenId (invalid for ERC20)
                0        // tokenType (ERC20)
            )).to.throw('ERC20 tokens should not have a tokenId');
        });
    });

    describe("Commitment Hashing", () => {
        it("should include tokenId and tokenType in nullifier hash", () => {
            const commitment = new Commitment(
                123,      // asset (numeric for testing)
                1,        // amount
                456,      // salt
                789,      // owner
                null,     // index
                1,        // tokenId
                1        // tokenType (ERC721)
            );

            const hash = commitment.nullifierHash(mockProofGeneration);
            // Sum of all inputs: 123 + 1 + 456 + 789 + 1 + 1 = 1371
            expect(hash).to.equal(1371);
        });
    });
});
