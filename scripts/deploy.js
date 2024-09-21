// deploy the Deploy.s.sol contract on the two networks

import { ethers } from "hardhat";
require('dotenv').config()


async function deployAndSetup() {
    // array of providers, where provider has the network name and chain id
    let providers = [
        {
            name: 'eth-sepolia',
            endpoint: 'http://127.0.0.1:8545/',
            chainId: 10,
            lzEndpoint: '0x6EDCE65403992e310A62460808c4b910D972f10f',
            lzChainId: 40161,
            ccipRouter: '0x1234567890123456789012345678901234567890', // TODO
            ccipChainId: 1, // TODO
            provider: null,
            wallet: null
        },
        {
            name: 'linea-sepolia',
            endpoint: 'http://127.0.0.1:8546/',
            chainId: 20,
            lzEndpoint: '0x6EDCE65403992e310A62460808c4b910D972f10f',
            lzChainId: 40287,
            ccipRouter: '0x1234567890123456789012345678901234567890', // TODO
            ccipChainId: 1, // TODO
            provider: null,
            wallet: null
        }
    ];


    //let privateKey = '0x0123456789012345678901234567890123456789012345678901234567890123'; // TODO
    let privateKey = process.env.PRIVATE_KEY;


    //////////


    // 1. Deploy all contracts
    let numDeployed = 0;
    await Promise.all(providers.map(async (p) => {
        // Initialize provider and wallet
        p.provider = ethers.getDefaultProvider(p.name);
        p.wallet = new ethers.Wallet(privateKey, p.provider);

        console.log("Deploying contract on", p.name, "with the account:", p.wallet.address);

        // Deploy the contract
        const Deploy = await ethers.getContractFactory("Deploy", p.wallet);
        p.deploy = await Deploy.deploy(p.lzEndpoint, p.ccipRouter);
        console.log("... deploying to address:", p.deploy.address);
        console.log("... transaction hash:", p.deploy.deployTransaction.hash);

        // Wait for the deployment to be mined
        await p.deploy.deployTransaction.wait();
        await p.deploy.deployed();
        numDeployed++;
        console.log(`... deployment on ${p.name} was mined (${providers.length - numDeployed} remaining)`);
    }));

    // 2. Connect all deployments to each other
    console.log(`Connecting deployments to each other (${providers.length}x${providers.length} matrix)...`);
    for (let i = 0; i < providers.length; i++) {
        let p = providers[i];

        // 3.a. Get the LZBridge and CCIPBridge addresses
        console.log("... getting LZBridge and CCIPBridge addresses for", p.name);
        p.lzAddr = await p.deploy.lzBridge();
        p.ccipAddr = await p.deploy.ccipBridge();
        console.log("\tLZBridge:", p.lzAddr);
        console.log("\tCCIPBridge:", p.ccipAddr);

        // 3.b. Connect deployments
        for (let j = 0; j < providers.length; j++) {
            if (i == j) continue; // skip self-connection
            let q = providers[j];
            
            // connectLz(uint256 destChainId, uint32 eid, address counterparty)
            console.log(`... connecting ${p.name} to ${q.name} on LayerZero...`);
            await p.deploy.connectLz(q.chainId, q.lzChainId, p.lzAddr);

            // connectCCIP(uint256 destChainId, uint64 selector, address counterparty)
            console.log(`... connecting ${p.name} to ${q.name} on CCIP...`);
            await p.deploy.connectCCIP(q.chainId, q.ccipChainId, p.ccipAddr);
        }
    }


    // 3. On one chain, create a memecoin
    {
        let p = providers[0];
        console.log("Creating a memecoin on", p.name, "...");

        // returns memecoin address
        p.memecoin = await p.deploy.demo();
        console.log("... memecoin address:", p.memecoin);
    }


    // 4. Renounce ownership
    console.log("Renouncing ownership of all deployments...");
    for (let i = 0; i < providers.length; i++) {
        let p = providers[i];
        await p.deploy.renounceOwnership();
    }


    // 5. Create a JSON file with the deployments
    let fs = require('fs');
    let deployments = {};
    for (let i = 0; i < providers.length; i++) {
        let p = providers[i];
        deployments[p.name] = {
            address: p.deploy.address,
            deployer: p.wallet.address,
            memecoin: p.memecoin || null,

            chainId: p.chainId,
            lzChainId: p.lzChainId,
            ccipChainId: p.ccipChainId,
            lzAddr: p.lzAddr,
            ccipAddr: p.ccipAddr,
        };
    }
    fs.writeFileSync('deployments.json', JSON.stringify(deployments, null, 4));
    console.log("Deployments saved to deployments.json");
}


deployAndSetup().then(() => process.exit(0)).catch(error => {
    console.error(error);
    process.exit(1);
});
