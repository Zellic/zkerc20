// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.27;

import { ProofCommitment } from "../TransactionKeeper.sol";

interface IZKERC20 {
    function _mint(
        address asset,
        uint256 amount,
        uint256 commitment,
        ProofCommitment memory proof
    ) external returns (uint256);
    
    function _mint(
        uint256 commitment
    ) external returns (uint256);

    function _burn(
        address sender,
        address asset,
        uint256 amount,
        uint256 remainderCommitment,
        uint256[8] memory nullifier,
        ProofCommitment memory proof
    ) external returns (uint256);
        
    function _bridge(
        address sender,
        uint256 leftCommitment,
        uint256 rightCommitment,
        uint256[8] memory nullifier,
        ProofCommitment memory proof
    ) external returns (uint256 index);

    function transferFrom(
        uint256 payoutCommitment,
        uint256 remainderCommitment,
        uint256[8] memory nullifier,
        ProofCommitment memory proof
    ) external returns (uint256 payoutIndex, uint256 remainderIndex);
}
