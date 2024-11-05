pragma solidity ^0.8.27;

import { TransactionKeeper, ProofCommitment } from "./TransactionKeeper.sol";
import { IZKERC20 } from "./interfaces/IZKERC20.sol";

contract ZKERC20 is IZKERC20, TransactionKeeper {
    address public immutable node;
    uint256 public constant DEFAULT_SECRET = 0;

    event Mint(address indexed asset, address indexed to, uint256 amount);
    event Mint();
    event Burn(address indexed asset uint256 amount);
    event Transfer();

    modifier onlyNode() {
        require(msg.sender == node, "ZKERC20: caller is not the node");
        _;
    }

    constructor(address _contracts) TransactionKeeper(_contracts) {
        node = msg.sender;
    }


    //////////////////////////
    // NODE-ONLY FUNCTIONS


    // TODO: will need to delete this
    function _mint(
        address asset,
        address to,
        uint256 amount,
        uint256 salt
    ) external onlyNode returns (uint256) {
        emit Mint(asset, to, amount);
        return TransactionKeeper.insert(
            to,
            asset,
            amount,
            salt
        );
    }


    function _mint(uint256 commitment) external onlyNode returns (uint256) {
        emit Mint();
        return TransactionKeeper.insert(commitment);
    }


    function _burn(
        address asset,
        uint256 amount,
        uint256 remainderCommitment,
        uint256[8] memory nullifier,
        ProofCommitment memory proof
    ) external onlyNode returns (uint256) {
        emit Burn(asset, amount);
        return TransactionKeeper.drop(
            asset,
            amount,
            remainderCommitment,
            nullifier,
            proof
        );
    }


    function _bridge(
        uint256 leftCommitment,
        uint256 rightCommitment,
        uint256[8] memory nullifier,
        ProofCommitment memory proof
    ) external override onlyNode returns (uint256, uint256) {
        emit Transfer();
        return TransactionKeeper.bridge(
            leftCommitment,
            rightCommitment,
            nullifier,
            proof
        );
    }


    //////////////////////////
    // PUBLIC FUNCTIONS


    function transferFrom(
        uint256 payoutCommitment,
        uint256 remainderCommitment,
        uint256[8] memory nullifier,
        ProofCommitment memory proof
    ) external returns (uint256 payoutIndex, uint256 remainderIndex) {
        emit Transfer();
        return TransactionKeeper.split(
            payoutCommitment,
            remainderCommitment,
            nullifier,
            proof
        );
    }


    //////////////////////////
    // ERC20-TYPE FUNCTIONS


    function name() public pure returns (string memory) {
        return "zkERC20";
    }
    function symbol() public pure returns (string memory) {
        return "ZKERC20";
    }
    function decimals() public pure returns (uint8) {
        revert("ZKERC20: decimals not supported");
    }
    function totalSupply() public pure returns (uint256) {
        revert("ZKERC20: totalSupply not supported");
    }
    function balanceOf(address account) public pure returns (uint256) {
        revert("ZKERC20: balanceOf not supported");
    }
    function allowance(address owner, address spender) public pure returns (uint256) {
        revert("ZKERC20: allowance not supported");
    }
}
