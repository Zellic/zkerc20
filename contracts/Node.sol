pragma solidity 0.8.27;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Node is BridgeManager {
    using SafeERC20 for IERC20;

    mapping(address => address) public nativeToWrapped;
    mapping(address => bool) public isNative;

    constructor Node() {
        // allow native coins to be wrapped
        wrapToken(address(0));
    }


    //////////////////////////
    // LOCKING


    function lock(address token, uint256 amount) external {
        require(isNative[token], "Node: token is not native to this chain");
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        // TODO
    }


    // support locking native coin
    receive() external payable {
        _lock(address(0), msg.value);
    }


    function _lock(address token, uint256 amount) internal {
        address wrappedToken = wrapToken(token);
        //IZKERC20(wrappedToken).mint(msg.sender, amount);
    }


    //////////////////////////
    // UNLOCKING


    function unlock(address token, uint256 amount, uint256[] memory proof) external {
        require(isNative[token], "Node: token is not native to this chain");

        IZKERC20(wrappedToken).burn(msg.sender, amount, proof);

        if (token == address(0)) {
            payable(msg.sender).transfer(amount);
        } else {
            IERC20(token).safeTransfer(msg.sender, amount);
        }
    }


    function _receiveMessage(uint256 srcChainId, address token, uint256[] memory proof) internal override {
        address wrappedToken = wrapToken(token);
        IZKERC20(wrappedToken).transferFrom(proof);
    }


    //////////////////////////
    // UTILITY FUNCTIONS


    function wrapToken(address token) internal returns (address wrappedToken) {
        wrappedToken = nativeToWrapped[token];
        if (wrappedToken == address(0)) {
            wrappedToken = new ZKERC20(token);
            nativeToWrapped[token] = wrappedToken;
            isNative[wrappedToken] = true;
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
