pragma solidity ^0.8.27;

import { Bridge } from "./Bridge.sol";
import { LinkTokenInterface } from "@chainlink/contracts/src/v0.8/shared/interfaces/LinkTokenInterface.sol";
import { IRouterClient } from "@chainlink/contracts-ccip/src/v0.8/ccip/interfaces/IRouterClient.sol";
import { CCIPReceiver } from "@chainlink/contracts-ccip/src/v0.8/ccip/applications/CCIPReceiver.sol";
import { Client } from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

contract CCIPBridge is Bridge, CCIPReceiver, Ownable {
    mapping(uint256 => uint64) public chainIdToSelector;
    mapping(uint64 => uint256) public selectorToChainId;
    mapping(uint256 => address) public chainIdToCounterparty;

    address public router;


    constructor(address _deployer, address _manager, address _router)
        Bridge(_manager) CCIPReceiver(_router) {
        router = _router;
    }


    function _sendMessage(address refundAddress, uint256 destChainId, bytes memory data) internal override {
        require(chainIdToSelector[destChainId] != 0, "CCIPBridge: destination chain not configured");

        Client.EVM2AnyMessage memory message = _createPayload(destChainId, data);

        uint256 fee = IRouterClient(router).getFee(
            chainIdToSelector[destChainId],
            message
        );

        IRouterClient(router).ccipSend{value: fee}(
            chainIdToSelector[destChainId],
            message
        );
    }


    function _ccipReceive(
        Client.Any2EVMMessage memory message
    ) internal override {
        uint64 latestSourceChainSelector = message.sourceChainSelector;
        address latestSender = abi.decode(message.sender, (address));
        
        uint256 sourceChainId = selectorToChainId[latestSourceChainSelector];
        require(sourceChainId != 0, "CCIPBridge: source chain not configured");
        require(chainIdToCounterparty[sourceChainId] == latestSender, "CCIPBridge: unauthorized sender");
        receiveMessage(sourceChainId, message.data);
    }


    function estimateFee(
        uint256 destChainId,
        bytes memory payload
    ) public view override returns (uint256) {
        return IRouterClient(router).getFee(
            chainIdToSelector[destChainId],
            _createPayload(destChainId, payload)
        );
    }


    bytes4 public constant EVM_EXTRA_ARGS_V1_TAG = 0x97a657c9;
    struct EVMExtraArgsV1 {
        uint256 gasLimit;
        bool strict;
    }
    function _argsToBytes(EVMExtraArgsV1 memory extraArgs) internal pure returns (bytes memory bts) {
        return abi.encodeWithSelector(EVM_EXTRA_ARGS_V1_TAG, extraArgs);
    }


    function _createPayload(
        uint256 destChainId,
        bytes memory payload
    ) internal view returns (Client.EVM2AnyMessage memory) {

        return Client.EVM2AnyMessage({
            receiver: abi.encode(chainIdToCounterparty[destChainId]),
            data: payload,
            tokenAmounts: new Client.EVMTokenAmount[](0),
            extraArgs: _argsToBytes(EVMExtraArgsV1({
                gasLimit: 2_000_000, // TODO: pick accurate gas numbers
                strict: false
            })),
            feeToken: address(0)
        });
    }


    function configureChainId(uint256 chainId, uint64 selector, address counterparty) public onlyOwner {
        require(chainIdToSelector[chainId] == 0 && selectorToChainId[selector] == 0, "CCIPBridge: chainId already configured");
        require(selector != 0, "CCIPBridge: invalid chain selector");
        require(chainId != 0, "CCIPBridge: invalid chainId");

        chainIdToSelector[chainId] = selector;
        selectorToChainId[selector] = chainId;
        chainIdToCounterparty[chainId] = counterparty;
    }
}
