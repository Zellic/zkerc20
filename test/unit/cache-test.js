const { expect } = require("chai");
const { ProofCache } = require('../../lib/proofCache.js');
const fs = require('fs');
const path = require('path');

describe("Proof Cache Tests", function () {
    let proofCache;
    const testCacheDir = 'test-cache';

    beforeEach(() => {
        // Create a fresh cache instance for each test
        proofCache = new ProofCache(testCacheDir);
    });

    afterEach(() => {
        // Clean up test cache directory after each test
        if (fs.existsSync(testCacheDir)) {
            fs.rmSync(testCacheDir, { recursive: true });
        }
    });

    it("should generate consistent cache keys", () => {
        const inputs1 = { a: 1, b: 2, c: 3 };
        const inputs2 = { c: 3, b: 2, a: 1 };
        const key1 = proofCache.generateCacheKey(inputs1);
        const key2 = proofCache.generateCacheKey(inputs2);
        
        // Same inputs in different order should generate same key
        expect(key1).to.equal(key2);
    });

    it("should save and retrieve proofs", () => {
        const inputs = { amount: 100, salt: "0x123" };
        const proof = { 
            result: "success",
            hash: "0xabc",
            timestamp: Date.now()
        };

        // Save the proof
        const saved = proofCache.saveProof(inputs, proof);
        expect(saved).to.be.true;

        // Retrieve the proof
        const retrieved = proofCache.getProof(inputs);
        expect(retrieved).to.deep.equal(proof);
    });

    it("should return null for non-existent proofs", () => {
        const inputs = { amount: 100, salt: "0x123" };
        const retrieved = proofCache.getProof(inputs);
        expect(retrieved).to.be.null;
    });

    it("should clear cache successfully", () => {
        // Save some proofs
        const inputs1 = { amount: 100, salt: "0x123" };
        const inputs2 = { amount: 200, salt: "0x456" };
        const proof = { result: "success" };

        proofCache.saveProof(inputs1, proof);
        proofCache.saveProof(inputs2, proof);

        // Clear cache
        const cleared = proofCache.clearCache();
        expect(cleared).to.be.true;

        // Verify proofs are cleared
        expect(proofCache.getProof(inputs1)).to.be.null;
        expect(proofCache.getProof(inputs2)).to.be.null;
    });
});
