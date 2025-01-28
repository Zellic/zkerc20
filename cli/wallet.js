const ethers = require('ethers');

const {
    RPC,
    CachedRPC
} = require('./rpc.js');


const {
    NoChainSelectedError,
    InvalidConfigError
} = require('./errors.js');

const {
    ConnectedNode
} = require('../lib/api.js');


class ZKERC20Wallet extends ConnectedNode {
    constructor(fullConfig, chainSelectionOverride) {
        // get chain config from the config file
        let chainSelection = chainSelectionOverride;
        if (!chainSelection) {
            if (fullConfig.defaultChain) {
                // if there is a configured default chain, use that
                chainSelection = fullConfig.defaultChain;
            } else if (Object.keys(fullConfig.chains).length === 1) {
                // if there is only one chain, select that
                chainSelection = Object.keys(fullConfig.chains)[0];
            } else {
                throw new NoChainSelectedError();
            }
        }
        const config = fullConfig.chains[chainSelection];
        if (config === undefined) {
            throw new InvalidConfigError(`Selected chain "${chainSelection}" not found in config file.`);
        }

        // import contract addresses from config
        const nodeContract = config.nodeContract;
        const zkerc20Contract = config.zkerc20Contract;

        // create ethers provider given account
        if (!config.privateKey) {
            throw new InvalidConfigError(`No private key provided for wallet for chain "${chainSelection}"`);
        }
        let account = new ethers.Wallet(config.privateKey);
        const ethers = new ethers.providers.JsonRpcProvider(config.rpcURL);
        const signer = ethers.getSigner(account);

        super(ethers, signer, nodeContract, zkerc20Contract);

        this.config = config;
        this.fullConfig = fullConfig;
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


module.exports = {
    ZKERC20Wallet
};
