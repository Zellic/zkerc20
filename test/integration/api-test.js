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

    beforeEach(async function() {
        //console.log("here next");
        const [ _owner ] = await ethers.getSigners();
        owner = _owner
        //console.log("here", owner);

        let setup = new Setup(owner);
        await setup.initialize();
        node = setup.node;
        zkerc20 = setup.zkerc20;

        api = new ConnectedNode(ethers, node);
        await api.initialize();

        token = await ethers.deployContract('MockERC20');
    });


    it("hash contracts - comparison tests", async function() {
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
    }).timeout(1000000);


    it("hash contracts - offchain constant tests", async function() {
        let check = async function(target, amount, nonce, expectedNullifierHash, expectedCommitmentHash) {
            let commitment = new Commitment(target, amount, nonce);
            let nullifierHash = await ethers.toBigInt(commitment.nullifierHash(api.transactionKeeper.proofGenerationCached));
            let commitmentHash = await ethers.toBigInt(commitment.commitmentHash(api.transactionKeeper.proofGenerationCached));

            expect(nullifierHash).to.equal(ethers.toBigInt(expectedNullifierHash));
            expect(commitmentHash).to.equal(ethers.toBigInt(expectedCommitmentHash));
        };
        
        // if these fail, the poseidon hash function is broken somehow
        await check('0xdeadbeef', 0, 0, '19224068435258351729157069503843718869252568236362754246412158339818749573452', '19035903073545343248811008532844467234831299900385283947624316800171833185292');
    }).timeout(1000000);


    //////////


    /*it("integration - lock", async function() {
        let amount = 100000;
        let nonce = 1234;

        await token.mint(owner.address, amount);
        await token.approve(node.target, amount);
        expect(await token.balanceOf(owner.address)).to.equal(amount);

        const result = await api.lock(token.target, amount, nonce);
        expect(await token.balanceOf(owner.address)).to.equal(0);
    }).timeout(1000000);*/


    it("integration - lock, unlock", async function() {
        let amount = 100000;
        let nonce = 1234;

        await token.mint(owner.address, amount);
        await token.approve(node.target, amount);
        expect(await token.balanceOf(owner.address)).to.equal(amount);

        const lockResult = await api.lock(token.target, amount, nonce);
        expect(await token.balanceOf(owner.address)).to.equal(0);

        console.log(lockResult)
        const unlockResult = await api.unlock(
            token.target,
            amount,
            0, // remainder nonce
            lockResult.storage.inserted
        );
    }).timeout(1000000);
});
