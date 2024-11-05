pragma solidity 0.8.27;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { BridgeManager } from "./BridgeManager.sol";
import { ProofCommitment } from "./TransactionKeeper.sol";
import { ZKERC20 } from "./ZKERC20.sol";
import { IZKERC20 } from "./interfaces/IZKERC20.sol";


interface IWZKERC20 is IERC20 {
    function mint(address to, uint256 amount) external;
    function burn(address from, uint256 amount) external;
}


contract WZKERC20 is ERC20 {
    address public node;

    constructor() ERC20("WZKERC20", "WZKERC20") {
        node = msg.sender;
    }

    function mint(address to, uint256 amount) external {
        require(msg.sender == node, "WZKERC20: only node can mint");
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external {
        require(msg.sender == node, "WZKERC20: only node can burn");
        _burn(from, amount);
    }
}


contract Node is BridgeManager {
    using SafeERC20 for IERC20;

    mapping(address => address) public nativeToWrapped; // the original token's address => the wrapped token address
    mapping(address => address) public wrappedToNative; // the wrapped token address => the original token address
    mapping(address => bool) public isNative; // XXX: obviously, this won't be sync'd across chains and could be race con'd. Worst case scenario is you can't withdraw on that chain.

    address public immutable zkerc20;


    constructor(address _deployer, address _hashContracts) BridgeManager(_deployer) {
        zkerc20 = address(new ZKERC20{salt: bytes32(uint256(0xdeadbeef))}(_hashContracts));
    }


    //////////////////////////
    // LOCKING


    function lock(address token, uint256 amount, uint256 salt) external returns (uint256 receipt) {
        // take the user's original ERC20 tokens
        address originalToken = wrappedToNative[token];
        if (originalToken != address(0)) {
            // we're re-wrapping a token
            IWZKERC20(token).burn(msg.sender, amount);
            receipt = IZKERC20(zkerc20)._mint(originalToken, msg.sender, amount, salt); // TODO: will need to update this
        } else {
            // we're wrapping a native token
            IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

            isNative[token] = true;
            receipt = IZKERC20(zkerc20)._mint(token, msg.sender, amount, salt); // TODO: will need to update this
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
    ) external {
        IZKERC20(zkerc20)._burn(
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


    function _receiveMessage(uint256 srcChainId, uint256 commitment) internal override {
        IZKERC20(zkerc20)._mint(commitment);
    }


    function bridge(
        uint8 bridgeId,
        uint256 destChainId, // TODO: use bridgeId for upper bits (gas opt)
        uint256 leftCommitment, // commitment to store on local chain
        uint256 rightCommitment, // commitment to send to dest chain
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
            msg.sender, // NOTE: only used for refunds
            destChainId,
            remainingCommitment
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
}


