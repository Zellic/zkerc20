const { expect } = require("chai");
const { network } = require("hardhat");

const { Node, ConnectedNode, Commitment } = require("../../lib/api");
const { Setup } = require("../../lib/setup");

const { reset } = require("../../lib/transactionKeeper.js"); // TODO

// XXX
function bigNumberToInt(bn) {
    return parseInt(bn.toString());
}

// XXX: move somewhere better
async function expectBalance(token, address, amount) {
    expect(bigNumberToInt(await token.balanceOf(address))).to.equal(amount);
}

describe.only("JS API tests", function () {
    let owner;
    let user1;
    let user2;

    let api;
    let node;
    let zkerc20;
    let token;
    
    //let assetA = ethers.utils.hexZeroPad("0xdeadbeef", 20);
    let assetA = 0xdeadbeef;

    beforeEach(async function() {
        await reset();

        //console.log("here next");
        const [ _owner, _user1, _user2 ] = await ethers.getSigners();
        owner = _owner
        user1 = _user1
        user2 = _user2

        let setup = new Setup(owner);
        await setup.initialize();
        node = setup.node;
        zkerc20 = setup.zkerc20;

        api = new ConnectedNode(
            ethers,
            owner,
            node,
            zkerc20
        );
        await api.initialize();

        token = await ethers.deployContract('MockERC20');
    });


    it("hash contracts - comparison tests", async function() {
        let check = async function(amount, nonce) {
            let commitment = new Commitment(token.address, amount, nonce, 0);
            let offchainNullifierHash = await ethers.BigNumber.from(commitment.nullifierHash(api.transactionKeeper.proofGenerationCached));
            let offchainCommitmentHash = await ethers.BigNumber.from(commitment.commitmentHash(api.transactionKeeper.proofGenerationCached));

            let [ onchainCommitmentHash, onchainNullifierHash ] = await node._commitment(token.address, amount, nonce, 0);

            let nullifiersEqual = offchainNullifierHash.eq(onchainNullifierHash);
            let commitmentsEqual = offchainCommitmentHash.eq(onchainCommitmentHash);

            expect(nullifiersEqual).to.equal(true);
            expect(commitmentsEqual).to.equal(true);
        };

        await check(0, 0);
        await check(1000, 0);
        await check(1000, 1);
    }).timeout(1000000);


    it("hash contracts - offchain constant tests", async function() {
        let check = async function(target, amount, nonce, expectedNullifierHash, expectedCommitmentHash) {
            let commitment = new Commitment(target, amount, nonce);
            let nullifierHash = await ethers.BigNumber.from(commitment.nullifierHash(api.transactionKeeper.proofGenerationCached));
            let commitmentHash = await ethers.BigNumber.from(commitment.commitmentHash(api.transactionKeeper.proofGenerationCached));
            
            let nullifiersEqual = nullifierHash.eq(ethers.BigNumber.from(expectedNullifierHash));
            let commitmentsEqual = commitmentHash.eq(ethers.BigNumber.from(expectedCommitmentHash));

            expect(nullifiersEqual).to.equal(true);
            expect(commitmentsEqual).to.equal(true);
        };
        
        // if these fail, the poseidon hash function is broken somehow
        await check('0xdeadbeef', 0, 0, '14006213014570130731724841774503597700912601142228955426330209845505752830351', '14469031835332477258829287130447066149964072663602806908366093491394045725668');
    }).timeout(1000000);


    //////////


    /*it("integration - lock", async function() {
        let amount = 100000;
        let nonce = 1234;

        await token.mint(owner.address, amount);
        await token.approve(node.address, amount);
        expect(await token.balanceOf(owner.address)).to.equal(amount);

        const result = await api.lock(token.address, amount, nonce);
        expect(await token.balanceOf(owner.address)).to.equal(0);
    }).timeout(1000000);*/


    /*it("integration - lock, unlock", async function() {
        let amount = 100000;
        let nonce = 1234;

        await token.mint(owner.address, amount);
        await token.approve(node.address, amount);
        expect(await token.balanceOf(owner.address)).to.equal(amount);

        const lockResult = await api.lock(token.address, amount, nonce);
        expect(await token.balanceOf(owner.address)).to.equal(0);

        const unlockResult = await api.unlock(
            amount,
            0, // remainder nonce
            lockResult.storage.inserted
        );
        expect(await token.balanceOf(owner.address)).to.equal(amount);
    }).timeout(1000000);*/

    
    it("integration - lock, transfer, unlock", async function() {
        let amount = 100000;
        let nonce = 1234;

        let transferAmount = 5000;
        let payoutNonce = 1337;
        let remainderNonce = 1338;

        await token.mint(owner.address, amount);
        await token.approve(node.address, amount);
        await expectBalance(token, owner.address, amount);

        const lockResult = await api.lock(token.address, amount, nonce);
        await expectBalance(token, owner.address, 0);

        const transferResult = await api.transferUnowned(transferAmount, payoutNonce, remainderNonce, lockResult.storage.inserted);

        const unlockResult1 = await api.unlock(
            transferAmount,
            0, // remainder nonce
            [transferResult.storage.inserted[0]]
        );
        await expectBalance(token, owner.address, transferAmount);

        // unlock remaining amount
        const unlockResult2 = await api.unlock(
            amount - transferAmount,
            0, // remainder nonce
            [transferResult.storage.inserted[1]]
        );
        await expectBalance(token, owner.address, amount);
    }).timeout(1000000);
    

    
    /*it("integration - lock, transfer (owned), unlock", async function() {
        let amount = 100000;
        let nonce = 1234;

        let transferAmount = 5000;
        let payoutNonce = 1337;
        let remainderNonce = 1338;

        await token.mint(owner.address, amount);
        await token.approve(node.address, amount);
        expect(await token.balanceOf(owner.address)).to.equal(amount);

        const lockResult = await api.lock(token.address, amount, nonce);
        expect(await token.balanceOf(owner.address)).to.equal(0);

        const transferResult = await api.transfer(transferAmount, payoutNonce, owner.address, remainderNonce, lockResult.storage.inserted);
        const unlockResult1 = await api.unlock(
            transferAmount,
            0, // remainder nonce
            [transferResult.storage.inserted[0]]
        );
        expect(await token.balanceOf(owner.address)).to.equal(transferAmount);

        // unlock remaining amount
        const unlockResult2 = await api.unlock(
            amount - transferAmount,
            0, // remainder nonce
            [transferResult.storage.inserted[1]]
        );
        expect(await token.balanceOf(owner.address)).to.equal(amount);
    }).timeout(1000000);*/
});
