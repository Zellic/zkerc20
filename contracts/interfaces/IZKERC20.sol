// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.27;

import { ProofCommitment } from "../TransactionKeeper.sol";

interface IZKERC20 {
    function _mint(
        address asset,
        address to,
        uint256 amount,
        uint256 salt
    ) external returns (uint256);
    
    function _mint(uint256 commitment) external returns (uint256);

    function _burn(
        address asset,
        address from,
        uint256 amount,
        uint256 salt,
        uint256 remainderCommitment,
        uint256[8] memory nullifier,
        ProofCommitment memory proof
    ) external returns (uint256);
        
    function _bridge(
        uint256 leftCommitment,
        uint256 rightCommitment,
        uint256[8] memory nullifier,
        ProofCommitment memory proof
    ) external returns (uint256 remainingCommitment, uint256 index);


    function transferFrom(
        address spender,
        uint256 payoutCommitment,
        uint256 remainderCommitment,
        uint256[8] memory nullifier,
        ProofCommitment memory proof
    ) external returns (uint256 payoutIndex, uint256 remainderIndex);
        
    
}
