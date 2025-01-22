// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.27;

interface IPoseidonFour {
    function poseidon(
        uint256[4] calldata input
    ) external pure returns (uint256);
}
