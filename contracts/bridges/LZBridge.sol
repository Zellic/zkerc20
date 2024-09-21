pragma solidity ^0.8.27;

import { Bridge } from "./Bridge.sol";
import { OApp, Origin, MessagingFee } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/OApp.sol";
//import { OptionsBuilder } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/libs/OptionsBuilder.sol";

contract LZBridge is Bridge, OApp {
    mapping(uint256 => uint32) public chainIdToEid;

    constructor(address _deployer, address _manager, address _endpoint)
        Bridge(_manager) OApp(_endpoint, _deployer) {}


    function _sendMessage(address sender, uint256 destChainId, bytes memory data) internal override {
        require(chainIdToEid[destChainId] != 0, "LZBridge: destination chain not configured");
        _lzSend(
            chainIdToEid[destChainId], // TODO: map to LZ chain ID
            data,
            bytes(""),
            //OptionsBuilder.newOptions(),
            MessagingFee(msg.value, 0), // (nativeFee, lzTokenFee)
            payable(sender) // refund addr
        );
    }


    function estimateFee(
        uint256 _destChainId,
        bytes memory _payload
    ) public view returns (uint256 nativeFee, uint256 lzTokenFee) {
        require(chainIdToEid[_destChainId] != 0, "LZBridge: destination chain not configured");

        bytes memory _options;
        MessagingFee memory fee = _quote(chainIdToEid[_destChainId], _payload, _options, false);
        return (fee.nativeFee, fee.lzTokenFee);
    }


    /// @notice Entry point for receiving messages.
    /// @param _origin The origin information containing the source endpoint and sender address.
    ///  - srcEid: The source chain endpoint ID.
    ///  - sender: The sender address on the src chain.
    ///  - nonce: The nonce of the message.
    /// @param _guid The unique identifier for the received LayerZero message.
    /// @param payload The payload of the received message.
    /// @param _executor The address of the executor for the received message.
    /// @param _extraData Additional arbitrary data provided by the corresponding executor.
    function _lzReceive(
        Origin calldata _origin,
        bytes32 _guid,
        bytes calldata payload,
        address _executor,
        bytes calldata _extraData
    ) internal override {
        receiveMessage(_origin.srcEid, payload);
    }


    function configureChainId(uint256 chainId, uint32 eid) public onlyOwner {
        require(eid != 0, "LZBridge: invalid eid");
        chainIdToEid[chainId] = eid;
    }
}
