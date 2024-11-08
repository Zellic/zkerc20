const { expect } = require("chai");
const { ethers } = require("hardhat");

const { Node } = require("../../circuits/test"); // TODO: rename

describe.only("JS API tests", function () {
    let node;

    let assetA = ethers.utils.hexZeroPad("0xdeadbeef", 20);

    before(async function () {
        console.log(Node);
        node = new Node();
        await node.initialize();
        console.log('Created node:', node);
    });

    it("main test", async function () {
        const result = await node.lock(assetA, 0, 1000, 123);
        console.log('Result:', result);
        //expect(await someContract.someFunc()).to.equal(something);
    });
});
