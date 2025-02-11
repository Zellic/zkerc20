#!/usr/bin/env node

const { ethers } = require('ethers');

const { Command } = require('commander');

const { Setup } = require('../setup.js');

DEFAULT_NETWORK = 'http://127.0.0.1:8545/';
DEFAULT_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';


async function deploy(network, privatekey, deployMockToken) { // use ethersjs
    let owner = new ethers.Wallet(privatekey, new ethers.providers.JsonRpcProvider(network));
    let setup = new Setup(owner);
    const { node, zkerc20 } = await setup.initialize();

    let mocktokenAddress = null;
    if (deployMockToken) {
        let mocktoken = await setup.deployMockERC20();
        mocktokenAddress = mocktoken.address;

    }

    if (!node) {
        throw new Error('Node deployment failed');
    }
    if (!zkerc20) {
        throw new Error('ZKERC20 deployment failed');
    }

    return {
        node: node.address,
        zkerc20: zkerc20.address,
        mocktoken: mocktokenAddress
    };
}

const program = new Command();

program
    .option('-n, --network <network>', 'network', DEFAULT_NETWORK)
    .option('-p, --privatekey <privatekey>', 'private key (or use PRIVATE_KEY env var)', DEFAULT_PRIVATE_KEY)
    .option('-t, --notoken', 'dont deploy a mock token contract', false)
    .action(async (options) => {
        let privatekey = options.privatekey || process.env.PRIVATE_KEY;
        if (!privatekey) {
            throw new Error('Missing private key, use -p or set PRIVATE_KEY environmental variable');
        }

        let { node, zkerc20, mocktoken } = await deploy(options.network, privatekey, !options.token);

        console.log('------------------------------------');
        console.log('Node:', node);
        console.log('ZKERC20:', zkerc20);
        if (mocktoken) {
            console.log('MockToken:', mocktoken);
        }

        // TODO: auto write addresses to config
    })

program.parse(process.argv);

