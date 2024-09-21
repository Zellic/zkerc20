pragma solidity 0.8.27;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { BridgeManager } from "./BridgeManager.sol";
import { ZKERC20 } from "./ZKERC20.sol";
import { IZKERC20 } from "./interfaces/IZKERC20.sol";

contract Node is BridgeManager {
    using SafeERC20 for IERC20;

    mapping(address => address) public nativeToUnwrapped;
    mapping(address => address) public unwrappedToNative;
    mapping(address => bool) public isNative; // XXX: obviously, this won't be sync'd across chains and could be race con'd

    address public immutable zkerc20;

    constructor() {
        zkerc20 = address(new ZKERC20{salt: bytes32(uint256(0xdeadbeef))}());
    }


    //////////////////////////
    // LOCKING


    function lock(address token, uint256 amount) external {
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        address originalToken = unwrappedToNative[token];
        if (originalToken != address(0)) {
            // we're re-wrapping a token
            IZKERC20(zkerc20).mint(originalToken, msg.sender, amount);
        } else {
            // we're wrapping a native token
            isNative[token] = true;
            IZKERC20(zkerc20).mint(token, msg.sender, amount);
        }
    }


    receive() external payable {
        revert("Node: native coin not supported");
    }


    //////////////////////////
    // UNLOCKING


    // TODO: support burning partial note too?
    function unlock(address token, uint256 amount, uint256 nullifier, uint256[] memory proof) external {
        IZKERC20(zkerc20).burn(token, msg.sender, amount, nullifier, proof);
        _unlock(token, amount);
    }


    function _unlock(address token, uint256 amount) internal {
        // if the token is native to this chain
        if (isNative[token]) {
            IERC20(token).safeTransfer(msg.sender, amount);
        } else {
            address unwrappedToken = _unwrapToken(token);
            IERC20(unwrappedToken).transfer(msg.sender, amount);
        }
    }


    // TODO: remove `token`
    function _receiveMessage(uint256 srcChainId, uint256 commitment) internal override {
        IZKERC20(zkerc20).mint(commitment);
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


