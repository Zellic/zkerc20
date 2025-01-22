/*const {
    buildPoseidon,
    buildMimcSponge,
    poseidonContract,
    mimcSpongecontract
} = require('circomlibjs');*/
const {
    poseidon_gencontract,
    mimcsponge_gencontract,
    poseidon,
    mimcsponge
} = require('../../zkerc20-deptest/node_modules/circomlibjs');
let poseidonContract = poseidon_gencontract;
let mimcSpongecontract = mimcsponge_gencontract;

// async function that just returns an object with a .poseidon() function
let buildPoseidon = async (nRounds) => {
    return poseidon;
}
let buildMimcSponge = async (nRounds, seed) => {
    return mimcsponge;
}


class Setup {
    constructor(owner) { // signer
        this.owner = owner;
        this.poseidon2 = null;
        this.poseidon4 = null;
        this.mimcSponge = null;
    }

    async initialize() {
        // deploy hash contracts

        let poseidon2Factory = new ethers.ContractFactory(
            poseidonContract.generateABI(2),
            poseidonContract.createCode(2),
            this.owner
        );
        this.poseidon2 = await poseidon2Factory.deploy();

        let poseidon4Factory = new ethers.ContractFactory(
            poseidonContract.generateABI(4),
            poseidonContract.createCode(4),
            this.owner
        );
        this.poseidon4 = await poseidon4Factory.deploy();

        let mimcSpongeFactory = new ethers.ContractFactory(
            mimcSpongecontract.abi,
            mimcSpongecontract.createCode(ethers.utils.toUtf8Bytes("mimcsponge"), 220, { keccak256: ethers.utils.keccak256 }), // XXX/TODO: temporarily bypass bug in circomlibjs
            this.owner
        );
        this.mimcSponge = await mimcSpongeFactory.deploy();

        await this.poseidon2.deployed();
        await this.poseidon4.deployed();
        await this.mimcSponge.deployed();


        // test them
        
        let onchainP2Result = ethers.BigNumber.from(await this.poseidon2['poseidon(uint256[2])']([4, 9]));
        let offchainP2Result = ethers.BigNumber.from((await buildPoseidon(2))([4, 9]));
        if (!onchainP2Result.eq(offchainP2Result)) {
            throw new Error('Poseidon2 test failed: ' + onchainP2Result + ' !== ' + offchainP2Result);
        }

        let onchainP3Result = ethers.BigNumber.from(await this.poseidon4['poseidon(uint256[4])']([1, 2, 3, 4]));
        let offchainP3Result = ethers.BigNumber.from((await buildPoseidon(4))([1, 2, 3, 4]));
        if (!onchainP3Result.eq(offchainP3Result)) {
            throw new Error('Poseidon3 test failed: ' + onchainP3Result + ' !== ' + offchainP3Result);
        }

        // TODO: test mimcsponge

        // deploy zkerc20 contracts

        let nodeFactory = await ethers.getContractFactory('Node');
        this.node = await nodeFactory.deploy(this.owner, this.poseidon2, this.poseidon4, this.mimcSponge);

        let zkerc20Factory = await ethers.getContractFactory('ZKERC20');
        this.zkerc20 = zkerc20Factory.attach(await this.node.zkerc20());

        return {
            node: this.node,
            zkerc20: this.zkerc20
        }
    }
}


module.exports = { Setup };
