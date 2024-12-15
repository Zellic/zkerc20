// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.27;

// TODO: separate interface files

interface IPoseidonTwo {
    function poseidon(
        uint256[2] calldata input
    ) external pure returns (uint256);
}

interface IPoseidonFour {
    function poseidon(
        uint256[4] calldata input
    ) external pure returns (uint256);
}

interface IMimcSponge {
    function MiMCSponge(
        uint256 xL_in,
        uint256 xR_in,
        uint256 k
    ) external pure returns (uint256 xL, uint256 xR);
}
