const { expect } = require("chai");
//const { ethers } = require("hardhat");

const { Node, ConnectedNode, Commitment } = require("../../circuits/api");
const { Setup } = require("../../circuits/setup");

// https://github.com/iden3/circomlibjs/blob/main/test/poseidoncontract.js
// https://cn.bing.com/search?q=contractfactory+deploy+ethers+6.6.2&form=QBLH&sp=-1&lq=0&pq=contractfactory+deploy+ethers+6.6&sc=7-33&qs=n&sk=&cvid=400DDB4C8F184F318932B1C75CA2C4AF&ghsh=0&ghacc=0&ghpl=
// https://docs.ethers.org/v6/single-page/

describe.only("JS API tests", function () {
    let owner;

    let api;
    let node;
    let zkerc20;
    let token;
    
    //let assetA = ethers.utils.hexZeroPad("0xdeadbeef", 20);
    let assetA = 0xdeadbeef;

    before(async function() {
        //console.log("here next");
        const [ _owner ] = await ethers.getSigners();
        owner = _owner
        //console.log("here", owner);

        api = new ConnectedNode(ethers);
        await api.initialize();

        let setup = new Setup(owner);
        await setup.initialize();
        node = setup.node;
        zkerc20 = setup.zkerc20;

        token = await ethers.deployContract('MockERC20');
    });

    it("hashing comparison tests", async function() {
        let check = async function(amount, nonce) {
            let commitment = new Commitment(token.target, amount, nonce);
            let offchainNullifierHash = await ethers.toBigInt(commitment.nullifierHash(api.transactionKeeper.proofGenerationCached));
            let offchainCommitmentHash = await ethers.toBigInt(commitment.commitmentHash(api.transactionKeeper.proofGenerationCached));

            let [ onchainCommitmentHash, onchainNullifierHash ] = await node._commitment(token.target, amount, nonce);

            expect(offchainNullifierHash).to.equal(onchainNullifierHash);
            expect(offchainCommitmentHash).to.equal(onchainCommitmentHash);
        };

        await check(0, 0);
        await check(1000, 0);
        await check(1000, 1);
    });

    it("lock", async function() {
        let amount = 100000;
        let nonce = 1234;

        const result = await api.lock(token.target, amount, nonce);
        console.log('Result:', result);

        await token.mint(owner.address, amount);
        expect(await token.balanceOf(owner.address)).to.equal(amount);

        await token.approve(node.target, amount);
        await node.lock(token.target, amount, result.args.commitment, result.args.proof);
        expect(await token.balanceOf(owner.address)).to.equal(0);

        //expect(await someContract.someFunc()).to.equal(something);
    });
});
