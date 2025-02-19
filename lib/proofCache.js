const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class ProofCache {
    constructor(cacheDir = 'cache') {
        this.cacheDir = cacheDir;
        // Create cache directory if it doesn't exist
        if (!fs.existsSync(cacheDir)) {
            fs.mkdirSync(cacheDir, { recursive: true });
        }
    }

    // Generate a unique cache key based on proof inputs
    generateCacheKey(inputs) {
        const inputString = JSON.stringify(inputs, Object.keys(inputs).sort());
        return crypto.createHash('sha256').update(inputString).digest('hex');
    }

    // Try to get cached proof
    getProof(inputs) {
        const cacheKey = this.generateCacheKey(inputs);
        const cachePath = path.join(this.cacheDir, `${cacheKey}.json`);

        if (fs.existsSync(cachePath)) {
            try {
                const cachedData = fs.readFileSync(cachePath, 'utf8');
                return JSON.parse(cachedData);
            } catch (error) {
                console.warn(`Failed to read cache file: ${error.message}`);
                return null;
            }
        }
        return null;
    }

    // Save proof to cache
    saveProof(inputs, proof) {
        const cacheKey = this.generateCacheKey(inputs);
        const cachePath = path.join(this.cacheDir, `${cacheKey}.json`);

        try {
            fs.writeFileSync(cachePath, JSON.stringify(proof, null, 2));
            return true;
        } catch (error) {
            console.warn(`Failed to write cache file: ${error.message}`);
            return false;
        }
    }

    // Clear all cached proofs
    clearCache() {
        try {
            const files = fs.readdirSync(this.cacheDir);
            for (const file of files) {
                if (file.endsWith('.json')) {
                    fs.unlinkSync(path.join(this.cacheDir, file));
                }
            }
            return true;
        } catch (error) {
            console.warn(`Failed to clear cache: ${error.message}`);
            return false;
        }
    }
}

module.exports = { ProofCache };
