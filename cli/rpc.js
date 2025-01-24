class RPC {
    constructor(ethers) {
        this.ethers = ethers;
        this.cacheFile = '/tmp/zkerc20RPC';
    }

    async queryEventsSince(query, timestamp) {}
}


class CachedRPC extends RPC {
    // TODO

    async queryEvents(query) {}
}


module.exports = {
    RPC,
    CachedRPC
}
