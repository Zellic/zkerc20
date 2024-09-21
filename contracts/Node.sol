pragma solidity 0.8.27;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { BridgeManager } from "./BridgeManager.sol";
import { ProofCommitment } from "./TransactionKeeper.sol";
import { ZKERC20 } from "./ZKERC20.sol";
import { IZKERC20 } from "./interfaces/IZKERC20.sol";

contract Node is BridgeManager {
    using SafeERC20 for IERC20;

    mapping(address => address) public nativeToUnwrapped; // the original token's address => the unwrapped token address
    mapping(address => address) public unwrappedToNative; // the unwrapped token address => the original token address
    mapping(address => bool) public isNative; // XXX: obviously, this won't be sync'd across chains and could be race con'd

    address public immutable zkerc20;

    constructor() {
        zkerc20 = address(new ZKERC20{salt: bytes32(uint256(0xdeadbeef))}());
    }


    //////////////////////////
    // LOCKING


    function lock(address token, uint256 amount, uint256 salt) external returns (uint256 receipt) {
        // take the user's original ERC20 tokens
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        address originalToken = unwrappedToNative[token];
        if (originalToken != address(0)) {
            // we're re-wrapping a token
            receipt = IZKERC20(zkerc20)._mint(originalToken, msg.sender, amount, salt);
        } else {
            // we're wrapping a native token
            isNative[token] = true;
            receipt = IZKERC20(zkerc20)._mint(token, msg.sender, amount, salt);
        }
    }


    receive() external payable {
        revert("Node: native coin not supported");
    }


    //////////////////////////
    // UNLOCKING


    // TODO: support burning partial note too?
    function unlock(
        address token,
        uint256 amount,
        uint256 salt,
        uint256 remainderCommitment,
        uint256[8] memory nullifier,
        ProofCommitment memory proof
    ) external {
        IZKERC20(zkerc20)._burn(
            token,
            msg.sender,
            amount,
            salt,
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
            address unwrappedToken = _unwrapToken(token);
            IERC20(unwrappedToken).transfer(msg.sender, amount);
        }
    }


    //////////////////////////
    // BRIDGING


    function _receiveMessage(uint256 srcChainId, uint256 commitment) internal override {
        IZKERC20(zkerc20)._mint(commitment);
    }


    function bridge(
        uint8 bridgeId,
        uint256 destChainId, // TODO: use bridgeId for upper bits (gas opt)
        uint256 leftCommitment,
        uint256 rightCommitment,
        uint256[8] memory nullifiers,
        ProofCommitment memory proof
    ) external {
        (uint256 remainingCommitment, uint256 index) = IZKERC20(zkerc20)._bridge(
            leftCommitment,
            rightCommitment,
            nullifiers,
            proof
        );
        BridgeManager._sendMessage(
            bridgeId, 
            msg.sender, // only used for refunds
            destChainId,
            remainingCommitment
        );
    }


    //////////////////////////
    // UTILITY FUNCTIONS


    function _unwrapToken(address token) internal returns (address unwrappedToken) {
        unwrappedToken = nativeToUnwrapped[token];
        if (unwrappedToken == address(0)) {
            // need to deploy a new unwrapped ZK token
            string memory origName = ERC20(token).name();
            string memory newName = string(abi.encodePacked("uwZK", origName));
            unwrappedToken = address(new ERC20
                {salt: keccak256(abi.encodePacked(newName))}
                (newName, ERC20(token).symbol()
            ));

            nativeToUnwrapped[token] = unwrappedToken;
            unwrappedToNative[unwrappedToken] = token;
            isNative[unwrappedToken] = true;
        }
    }
}


