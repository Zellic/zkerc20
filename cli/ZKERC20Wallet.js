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


class ZKERC20Wallet extends ConnectedNode {
    constructor(configFilepath, accountFilepath) {
        // open and read the config file
        const config = JSON.parse(fs.readFileSync(configFilepath));
        const account = JSON.parse(fs.readFileSync(accountFilepath));
        this.config = config;
        this.account = account;

        // import contract addresses from config
        const nodeContract = config.nodeContract;
        const zkerc20Contract = config.zkerc20Contract;

        // create ethers provider given account
        const ethers = new ethers.providers.JsonRpcProvider(config.rpcURL);
        const signer = ethers.getSigner(account);

        super(ethers, signer, nodeContract, zkerc20Contract);
    }

    //////

    async _getAllNotes() {
        return account.notes;
    }

    async _getAllUsedNullifiers(since) {
        if (since === undefined) {
            since = 0;
        }

        // query for the Nullified(address) event on the zkerc20 contract
        const results = await this.zkerc20Contract.queryFilter(this.zkerc20Contract.filters.Nullified(null), since, 'latest');
        return results.map(r => r.args.nullifier);
    }

    async _getMerkleTreeLeaves() {

    }

    //////

    async _submitTransaction(tx) {}
}

