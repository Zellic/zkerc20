const { expect } = require("chai");
const { ethers } = require("hardhat");

const { Node, ConnectedNode } = require("../../circuits/api");

describe.only("JS API tests", function () {
    let node;

    //let assetA = ethers.utils.hexZeroPad("0xdeadbeef", 20);
    let assetA = 0xdeadbeef;

    before(async function () {
        node = new ConnectedNode();
        await node.initialize();
    });

    it("lock", async function () {
        const result = await node.lock(assetA, 0, 1000, 123);
        console.log('Result:', result);
        //expect(await someContract.someFunc()).to.equal(something);
    });
});
