// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.27;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { BridgeManager } from "./BridgeManager.sol";
import { ProofCommitment, TransactionKeeper } from "./TransactionKeeper.sol";

import { ZKERC20 } from "./ZKERC20.sol";
import { WZKERC20 } from "./WZKERC20.sol";
import { IZKERC20 } from "./interfaces/IZKERC20.sol";
import { IWZKERC20 } from "./interfaces/IWZKERC20.sol";

contract Node is BridgeManager {
    using SafeERC20 for IERC20;

    mapping(address => address) public nativeToWrapped; // the original token's address => the wrapped token address
    mapping(address => address) public wrappedToNative; // the wrapped token address => the original token address
    mapping(address => bool) public isNative; // XXX: obviously, this won't be sync'd across chains and could be race con'd. Worst case scenario is you can't withdraw on that chain.

    IZKERC20 public immutable zkerc20;


    constructor(address _deployer, address _poseidon2, address _poseidon3, address _mimcSponge) BridgeManager(_deployer) {
        zkerc20 = IZKERC20(new ZKERC20{salt: bytes32(uint256(0xdeadbeef))}(_poseidon2, _poseidon3, _mimcSponge));
    }


    //////////////////////////
    // LOCKING


    function lock(
        address token,
        uint256 amount,
        uint256 commitment,
        ProofCommitment memory proof
    ) external returns (uint256 index) {
        // take the user's original ERC20 tokens
        address originalToken = wrappedToNative[token];
        if (originalToken != address(0)) {
            // we're re-wrapping a token
            IWZKERC20(token).burn(msg.sender, amount);

            index = zkerc20._mint(
                originalToken,
                amount,
                commitment,
                proof
            );
        } else {
            // we're wrapping a native token
            IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
            isNative[token] = true;

            index = zkerc20._mint(
                token,
                amount,
                commitment,
                proof
            );
        }
    }


    receive() external payable {
        // TODO: consider wrapping as WETH? can't convert to native coin on 
        //   dest chains though.
        revert("Node: native coin not supported");
    }


    //////////////////////////
    // UNLOCKING


    function unlock(
        address token,
        uint256 amount,
        uint256 remainderCommitment,
        uint256[8] memory nullifier,
        ProofCommitment memory proof
    ) external returns (uint256 rightIndex) {
        rightIndex = zkerc20._burn(
            msg.sender,
            token,
            amount,
            remainderCommitment,
            nullifier,
            proof
        );
        _unlock(token, amount);
    }


    function _unlock(address token, uint256 amount) internal {
        if (isNative[token]) {
            // the token is native to this chain.
            // simply transfer the token to the user
            IERC20(token).safeTransfer(msg.sender, amount);
        } else {
            // the token is not native to this chain.
            // we need to make a "fake" token
            address wrappedToken = _wrapToken(token);
            IWZKERC20(wrappedToken).mint(address(this), amount);
        }
    }


    //////////////////////////
    // BRIDGING


    function _receiveMessage(uint256 /*srcChainId*/, uint256 commitment) internal override {
        zkerc20._mint(commitment);
    }


    function bridge(
        uint8 bridgeId,
        uint256 destChainId, // TODO: use bridgeId for upper bits (gas opt)
        uint256 localCommitment, // commitment to store on local chain
        uint256 remoteCommitment, // commitment to send to dest chain
        uint256[8] memory nullifiers,
        ProofCommitment memory proof
    ) external returns (uint256 remainderCommitment) {
        remainderCommitment = zkerc20._bridge(
            msg.sender,
            localCommitment,
            remoteCommitment,
            nullifiers,
            proof
        );

        BridgeManager._sendMessage(
            bridgeId, 
            msg.sender, // NOTE: only used for refunds
            destChainId,
            remoteCommitment
        );
    }


    //////////////////////////
    // UTILITY FUNCTIONS


    function _wrapToken(address token) internal returns (address wrappedToken) {
        wrappedToken = nativeToWrapped[token];
        if (wrappedToken == address(0)) {
            // need to deploy a new wrapped ZK token
            wrappedToken = _deployNewWrappedToken(token);
            nativeToWrapped[token] = wrappedToken;
            wrappedToNative[wrappedToken] = token;
            isNative[wrappedToken] = true;
        }
    }


    function _deployNewWrappedToken(address token) internal virtual returns (address) {
        return address(new WZKERC20
            {salt: keccak256(abi.encodePacked(uint256(0xdeadbeef), token))}
            ()
        );
    }


    // TODO remove this
    function _nullifier(
        uint256 asset,
        uint256 amount,
        uint256 salt,
        uint256 owner
    ) public view returns (uint256) {
        return TransactionKeeper(address(zkerc20))._nullifier(asset, amount, salt, owner);
    }


    function _commitment(
        uint256 asset,
        uint256 amount,
        uint256 salt,
        uint256 owner
    ) public view returns (uint256, uint256) {
        return TransactionKeeper(address(zkerc20))._commitment(asset, amount, salt, owner);
    }
}

