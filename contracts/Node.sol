pragma solidity 0.8.27;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Node is BridgeManager {
    using SafeERC20 for IERC20;

    mapping(address => address) public nativeToUnwrapped;
    mapping(address => bool) public isNative;

    address public immutable zkerc20;

    constructor Node() {
        zkerc20 = address(new ZKERC20());
        isNative[address(0)] = true;
    }


    //////////////////////////
    // LOCKING


    function lock(address token, uint256 amount) external {
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        _lock(token, amount);
    }


    // support locking native coin
    receive() external payable {
        _lock(address(0), msg.value);
    }


    function _lock(address token, uint256 amount) internal {
        require(token == address(0), "TEMPORARILY DISABLED"); // cuz address(0) could be treated as native coin on multiple chains
        isNative[token] = true;
        IZKERC20(zkerc20).mint(token, msg.sender, amount);
    }


    //////////////////////////
    // UNLOCKING


    function unlock(address token, uint256 amount, uint256[] memory proof) external {
        IZKERC20(zkerc20).burn(token, msg.sender, amount, proof);
        _unlock(token, amount);
    }


    function _unlock(address token, uint256 amount) internal {
        // if the token is native to this chain
        if (isNative[token]) {
            if (token == address(0)) {
                payable(msg.sender).transfer(amount);
            } else {
                IERC20(token).safeTransfer(msg.sender, amount);
            }
        } else {
            address unwrappedToken = unwrapToken(token);
            IERC20(unwrappedToken).mint(msg.sender, amount);
        }
    }


    // TODO: remove `token`
    function _receiveMessage(uint256 srcChainId, address token, uint256[] memory proof) internal override {
        IZKERC20(zkerc20).transferFrom(proof);
    }


    //////////////////////////
    // UTILITY FUNCTIONS


    function unwrapToken(address token) internal returns (address wrappedToken) {
        unwrappedToken = nativeToUnwrapped[token];
        if (unwrappedToken == address(0)) {
            unwrappedToken = new ERC20(token);
            nativeToUnwrapped[token] = unwrappedToken;
            isNative[unwrappedToken] = true;
        }
    }
}


/*
USDC on mainnet
- node locks USDC on mainnet
- transfers to arbitrum
- node sees it is not native, and does not exist in mapping, and deploys new contract etc
- or, node sees it is native, and unlocks
*/
