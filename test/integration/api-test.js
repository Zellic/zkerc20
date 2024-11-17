const { expect } = require("chai");
//const { ethers } = require("hardhat");

const { Node, ConnectedNode } = require("../../circuits/api");

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

        const hashContracts = await ethers.deployContract("HashContracts");

        node = await ethers.deployContract('Node', [owner.address, hashContracts.target]);
        zkerc20 = await node.zkerc20();

        token = await ethers.deployContract('MockERC20');
    });

    it("lock", async function() {
        let amount = 100000;
        let nonce = 1234;

        const result = await api.lock(token.target, amount, nonce);
        console.log('Result:', result);
        console.log('proof:', result.args.proof)

        await token.mint(owner.address, amount);
        expect(await token.balanceOf(owner.address)).to.equal(amount);

        await token.approve(node.target, amount);
        await node.lock(token.target, amount, result.args.commitment, result.args.proof);
        expect(await token.balanceOf(owner.address)).to.equal(0);

        //expect(await someContract.someFunc()).to.equal(something);
    });
});
