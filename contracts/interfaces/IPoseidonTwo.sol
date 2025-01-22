// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.27;

interface IPoseidonTwo {
    function poseidon(
        uint256[2] calldata input
    ) external pure returns (uint256);
}

