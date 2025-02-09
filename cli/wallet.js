const { ethers } = require('ethers');

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


const {
    Note
} = require('../lib/commitment.js');


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
        const nodeContractAddress = config.nodeContract;
        const zkerc20ContractAddress = config.zkerc20Contract;

        // create ethers provider given account
        if (!config.privateKey) {
            throw new InvalidConfigError(`No private key provided for wallet for chain "${chainSelection}"`);
        }
        const provider = new ethers.providers.JsonRpcProvider(config.rpcURL);
        let account = new ethers.Wallet(config.privateKey, provider);

        const nodeContract = new ethers.Contract(nodeContractAddress, require('../artifacts/contracts/Node.sol/Node.json').abi, provider);
        const zkerc20Contract = new ethers.Contract(zkerc20ContractAddress, require('../artifacts/contracts/ZKERC20.sol/ZKERC20.json').abi, provider);
        super(ethers, account, nodeContract, zkerc20Contract);

        this.config = config;
        this.fullConfig = fullConfig;
        this.account = account;
    }


    //////
    
    // find all notes we can that are owned by the user
    // @param {Array<Number>} extraSalts - (optional) additional salts to use in the search
    // @returns {Promise<Number>} an array of Note objects
    async getUserNotes(extraSalts = []) {
        // 1. try salts stored in config
        // 2. try extraSalts
        // 3. try derivng salts until a note doesn't exist
        
        // create a set we can add to
        let notes = new Set();

        let allNotes = await this._getAllNotes();
/*
        allNotes.forEach(note => {
            if 
        });

        // first, find all salts stored in config
        let userSalts = await wallet.getUserSalts();
  */      
    }


    //////

    async _getAllNotes(since) {
        let allNullifiers = await this._getAllUsedNullifiers(since);

        if (since === undefined) {
            since = 0;
        }

        // query for the Inserted(uint256, uint64) event on the zkerc20 contract
        const results = await this.zkerc20Contract.queryFilter(this.zkerc20Contract.filters.Inserted(null, null), since, 'latest');
        
        // construct Node objects
        console.log(results)
        return results
    }

    async _getAllUsedNullifiers(since) {
        if (since === undefined) {
            since = 0;
        }

        // query for the Nullified(address) event on the zkerc20 contract
        const results = await this.zkerc20Contract.queryFilter(this.zkerc20Contract.filters.Nullified(null), since, 'latest');
        console.log('here')
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
