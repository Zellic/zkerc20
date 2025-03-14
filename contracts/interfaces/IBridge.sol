// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.27;

interface IBridge {
    function sendMessage(address sender, uint256 destChainId, bytes memory data) external payable;
}
