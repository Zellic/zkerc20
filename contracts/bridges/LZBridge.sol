pragma solidity ^0.8.27;

import { Bridge } from "./Bridge.sol";
import { OApp, Origin, MessagingFee } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/OApp.sol";

contract LZBridge is Bridge, OApp {
    constructor(address _deployer, address _manager, address _endpoint)
        Bridge(_manager) OApp(_endpoint, _deployer) {}


    function _sendMessage(address sender, uint256 destChainId, bytes memory data) internal override {
        bytes memory options; // TODO
        _lzSend(
            uint32(destChainId), // TODO: map to LZ chain ID
            data,
            options,
            MessagingFee(msg.value, 0), // (nativeFee, lzTokenFee)
            payable(sender) // refund addr
        );
    }


    /// @notice Estimates the gas associated with sending a message.
    /// @param _dstEid The endpoint ID of the destination chain.
    /// @param _message The message to be sent.
    /// @param _options The message execution options (e.g. gas to use on destination).
    /// @return nativeFee Estimated gas fee in native gas.
    /// @return lzTokenFee Estimated gas fee in ZRO token.
    function estimateFee(
        uint32 _dstEid,
        string memory _message,
        bytes calldata _options
    ) public view returns (uint256 nativeFee, uint256 lzTokenFee) {
        bytes memory _payload = abi.encode(_message);
        MessagingFee memory fee = _quote(_dstEid, _payload, _options, false);
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
}
