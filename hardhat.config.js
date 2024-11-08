require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-foundry");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
    solidity: "0.8.27",
    gas: 2100000,
    gasPrice: 8000000000,
    allowUnlimitedContractSize: true
};
