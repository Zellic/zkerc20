pragma solidity ^0.8.27;

import { Bridge } from "./Bridge.sol";
import { OApp, Origin, MessagingFee } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/OApp.sol";
import { OptionsBuilder } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/libs/OptionsBuilder.sol";

contract LZBridge is Bridge, OApp {
    using OptionsBuilder for bytes;

    mapping(uint256 => uint32) public chainIdToEid;
    mapping(uint32 => uint256) public eidToChainId;

    constructor(address _deployer, address _manager, address _endpoint)
        Bridge(_manager) OApp(_endpoint, _deployer) {}


    function _sendMessage(address refundAddress, uint256 destChainId, bytes memory data) internal override {
        require(chainIdToEid[destChainId] != 0, "LZBridge: destination chain not configured");
        _lzSend(
            chainIdToEid[destChainId],
            data,
            _buildOptions(),
            MessagingFee(msg.value, 0), // (nativeFee, lzTokenFee)
            payable(refundAddress)
        );
    }


    function estimateFee(
        uint256 destChainId,
        bytes memory payload
    ) public view override returns (uint256) {
        require(chainIdToEid[destChainId] != 0, "LZBridge: destination chain not configured");

        bytes memory _options = _buildOptions();
        MessagingFee memory fee = _quote(chainIdToEid[destChainId], payload, _options, false);
        return fee.nativeFee;
    }


    function _lzReceive(
        Origin calldata _origin,
        bytes32 _guid,
        bytes calldata payload,
        address _executor,
        bytes calldata _extraData
    ) internal override {
        receiveMessage(eidToChainId[_origin.srcEid], payload);
    }


    function _buildOptions() private pure returns (bytes memory) {
        return OptionsBuilder.newOptions()
            // (gas limit, msg.value)
            .addExecutorLzReceiveOption(2000000, 0); // TODO
    }


    function configureChainId(uint256 chainId, uint32 eid) public onlyOwner {
        require(chainIdToEid[chainId] == 0 && eidToChainId[eid] == 0, "LZBridge: chainId already configured");
        require(chainId != 0, "LZBridge: invalid chainId");
        require(eid != 0, "LZBridge: invalid eid");

        chainIdToEid[chainId] = eid;
        eidToChainId[eid] = chainId;
    }
}
