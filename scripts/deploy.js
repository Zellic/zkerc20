// deploy the Deploy.s.sol contract on the two networks

import hardhat from "hardhat";
import dotenv from "dotenv";
import fs from "fs";

ethers = hre.ethers

dotenv.config();


let privateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'; // TODO


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
        await tx.wait()
        p.memecoin = await p.deploy.memecoin();
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
            endpoint: p.provider.connection.url,
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


function readConfig() {
    let data = fs.readFileSync('deployments.json');
    let deployments = JSON.parse(data);
    return deployments;
}


function debugEvents(c, events) {
    for (let i = 0; i < events.length; i++) {
        let e = events[i];
        if (e.topics[0] == c.interface.getEventTopic("PublicTransaction")) 
            console.log("PublicTransaction:", c.interface.decodeEventLog("PublicTransaction", e.data, e.topics));
        if (e.topics[0] == c.interface.getEventTopic("Transaction")) 
            console.log("Transaction:", c.interface.decodeEventLog("Transaction", e.data, e.topics));
    }
}


async function test() {
    let config = readConfig();
    console.log(config);

    let p = config['eth-sepolia'];
    p.provider = new ethers.providers.JsonRpcProvider(p.endpoint);
    p.wallet = new ethers.Wallet(privateKey, p.provider);

    // approval
    let GM = await ethers.getContractFactory("GM", p.wallet);
    let gm = GM.attach(p.memecoin);
    await (await gm.approve(p.nodeAddr, 10000000)).wait();

    // call lock(address token, uint256 amount, uint256 salt) function on p.nodeAddr
    let Node = await ethers.getContractFactory("Node", p.wallet);
    let node = Node.attach(p.nodeAddr);
    let tx = await node.lock(p.memecoin, 10000000, 0);
    let result = await tx.wait();

    // get transaction keeper contract
    let keeper = await ethers.getContractFactory("TransactionKeeper", p.wallet);
    debugEvents(keeper, result.events);
}


async function test2() {
    let config = readConfig();
    console.log(config);

    let p = config['eth-sepolia'];
    p.provider = new ethers.providers.JsonRpcProvider(p.endpoint);
    p.wallet = new ethers.Wallet(privateKey, p.provider);
    
    let GM = await ethers.getContractFactory("GM", p.wallet);
    let gm = GM.attach(p.memecoin);

    gm.on("Approval", (owner, spender, value) => {
        console.log("Approval event:", owner, spender, value);
    });

    let Node = await ethers.getContractFactory("Node", p.wallet);
    let node = Node.attach(p.nodeAddr);
    /*node.on("Transaction", (...args) => {
        console.log("Transaction event:", args);
    });
    node.on("PublicTransaction", (...args) => {
        console.log("PublicTransaction event:", args);
    });*/


    console.log("Balance before:", await gm.balanceOf(p.wallet.address));


    // try to unlock using
    /*
    function unlock(
        address token,
        uint256 amount,
        uint256 salt,
        uint256 remainderCommitment,
        uint256[8] memory nullifier,
        ProofCommitment memory proof
    ) external {*/
    const tx = await node.unlock(
        p.memecoin,
        100n,
        87904951019716707710055962234874657102500361950386291974384215110142559059116n,
        9717771579393646773370552781154687600926795043171303965955312131799982584864n,
        [
    8730273586057753900425985854499303569622860172918595424256786110013120576882n,
    14009679963510954066873422331061838824611276260609796615690198548128109427465n,
    18471658952596635804021505052222437656639782769463870935400157233296122869684n,
    18571319392570483801384696607161238962883488729419469707457123637446385729314n,
    5826241462717187210633002062484534933423779725214192201396314109180443494585n,
    20326201724452196063388590674587323710246070376260470529533641893872715087654n,
    13257665672648012525043258097888957095854080444700997150348491896804789688244n,
    5051593776894220445867611636167702085461145136162537925189215983429773265719n
  ],
        {
            a: [10939541030895068387710189451330818568234508204192864853346489189590966841927n, 1963241271828660923280553613656687076604591057171644321530633005620573589730n],
            b: [
                [11517995661681886545119589197452649892501781755317791468401760774521248689436n,
                20969657449058393591356154214009749238543538594442221896715805111490558307733n], 
                [16667988724250614403403139768619430115937693485549871782983117535253354924282n,
                5484115486663501597086160978795177290381050902864224994016861816359354841811n]],
            c: [21515056832717351673045105755157089204267696387109425297901655963712892125497n, 12303858988037607353438197408250211785092696427871100477093492631244242015946n]
        }
    );
    await tx.wait();

    console.log("Balance after:", await gm.balanceOf(p.wallet.address));
}


/*deployAndSetup().then(() => {
    test().then(() => process.exit(0)).catch(error => {
        console.error(error);
        process.exit(1);
    })
    //process.exit(0)
}).catch(error => {
    console.error(error);
    process.exit(1);
});*/

test2().then(() => process.exit(0)).catch(error => {
    console.error(error);
    process.exit(1);
});

