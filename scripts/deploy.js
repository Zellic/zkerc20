// deploy the Deploy.s.sol contract on the two networks

import hardhat from "hardhat";
import dotenv from "dotenv";
import fs from "fs";

ethers = hre.ethers

dotenv.config();


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
        /*{
            name: 'linea-sepolia',
            endpoint: 'http://127.0.0.1:8546/',
            chainId: 20,
            lzEndpoint: '0x6EDCE65403992e310A62460808c4b910D972f10f',
            lzChainId: 40287,
            ccipRouter: '0x1234567890123456789012345678901234567890', // TODO
            ccipChainId: 1, // TODO
            provider: null,
            wallet: null
        }*/
    ];


    let privateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'; // TODO


    //////////


    // 1. Deploy all contracts
    await Promise.all(providers.map(async (p) => {
        // create a new provider given url
        p.provider = new ethers.providers.JsonRpcProvider(p.endpoint);
        p.wallet = new ethers.Wallet(privateKey, p.provider);

        console.log("Deploying contract on", p.name, "with the account:", p.wallet.address);

        // Deploy the HashContracts contract
        const HashContracts = await ethers.getContractFactory("HashContracts", p.wallet);
        p.hashContracts = await HashContracts.deploy();
        console.log("... deploying HashContracts to address:", p.hashContracts.address);
        await p.hashContracts.deployed();
        let tx = await p.hashContracts.initialize();
        await tx.wait();

        // Deploy the contract
        const Deploy = await ethers.getContractFactory("Deploy", p.wallet);
        p.deploy = await Deploy.deploy();
        console.log("... deploying Deploy to address:", p.deploy.address);
        await p.deploy.deployed();


        // Deploy the Node contract
        const Node = await ethers.getContractFactory("Node", p.wallet);
        p.node = await Node.deploy(p.deploy.address, p.hashContracts.address);
        p.nodeAddr = p.node.address;
        console.log("... deploying Node contract to address:", p.node.address);
        await p.node.deployed();

        // Deploy LZBridge
        const LZBridge = await ethers.getContractFactory("LZBridge", p.wallet);
        p.lzBridge = await LZBridge.deploy(p.wallet.address, p.node.address, p.lzEndpoint);
        p.lzAddr = p.lzBridge.address;
        console.log("... deploying LZBridge to address:", p.lzBridge.address);
        await p.lzBridge.deployed();

        // Deploy CCIPBridge
        const CCIPBridge = await ethers.getContractFactory("CCIPBridge", p.wallet);
        p.ccipBridge = await CCIPBridge.deploy(p.wallet.address, p.node.address, p.ccipRouter);
        p.ccipAddr = p.ccipBridge.address;
        console.log("... deploying CCIPBridge to address:", p.ccipBridge.address);
        await p.ccipBridge.deployed();

        let tx2 = await p.deploy.initialize(p.hashContracts.address, p.node.address, p.lzBridge.address, p.ccipBridge.address);
        await tx2.wait();

        // Wait for the deployment to be mined
        //await p.deploy.deployTransaction.wait();
        //await p.deploy.waitForDeployment();
        //await p.deploy.deployed();
    }));

    // 2. Connect all deployments to each other
    console.log(`Connecting deployments to each other (${providers.length}x${providers.length} matrix)...`);
    for (let i = 0; i < providers.length; i++) {
        let p = providers[i];

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
        let tx = await p.deploy.demo();
        p.memecoin = await tx.wait();
        console.log("... memecoin:", p.memecoin);
    }


    // 4. Renounce ownership
    console.log("Renouncing ownership of all deployments...");
    for (let i = 0; i < providers.length; i++) {
        let p = providers[i];
        await p.deploy.renounceOwnership();
    }


    // 5. Create a JSON file with the deployments
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
            nodeAddr: p.nodeAddr,
            hashContracts: p.hashContracts.address
        };
    }
    fs.writeFileSync('deployments.json', JSON.stringify(deployments, null, 4));
    console.log("Deployments saved to deployments.json");
}


deployAndSetup().then(() => process.exit(0)).catch(error => {
    console.error(error);
    process.exit(1);
});
