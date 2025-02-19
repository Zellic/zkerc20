Deposit any ERC-20, and receive corresponding zkERC20 tokens. These can be transferred to any user and bridged to any chain — without revealing the token type, amount, or receiver.

# Usage

Dependencies:
- [`circom`](https://docs.circom.io/getting-started/installation/)
- [`npm`](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm)

To install and run tests, in the cloned directory, simply run:

```bash
make test
```

**IMPORTANT DISCLAIMER**: This project is intended to be a proof of concept and is not production ready. Not all features are necessarily fully implemented or tested, and the code has not been audited.

# Make any ERC-20 like Zcash

The protocol consists of a contract on each supported ecosystem, which utilizes zero knowledge proofs (ZKPs) to regulate user balances in a vector commitment. These contracts interact through messages on LayerZero, allowing users to send and bridge assets completely privately and anonymously. In fact, outside observers cannot even determine exactly how a token's supply is spread across the chains.

The zero knowledge (ZK) circuits powering this functionality are designed to be friendly towards potential privacy-focused DeFi protocols, including escrow contracts, anonymous perps/leverage protocols, and dark pools (private orderbooks/DEX). Of course, users can at any time withdraw their zkERC20. On the original chain, this leaves them with the corresponding ERC-20; on others, they receive a wrapped variant economically pegged 1:1.

For more information about the privacy guarantees of the protocol, see [`docs/MOTIVATIONS.md`](docs/MOTIVATIONS.md).

# How it works

Our protocol uses completely custom ZK circuits in [Circom](https://docs.circom.io/), which allows for the privacy-preserving guarantees without being dependent on specialized ecosystem features. This allows the application to be trivially expanded across EVM-compatible chains, and even to be supported on others like Aptos.

Users interact with the protocol by providing proofs of certain invariants that are produced off-chain. There are a number of options: these can be computed directly in the browser using WebAssembly, or even using a self-hosted server implementation.

The bridging mechanism allows assets to be transferred with very concise messages. We choose to implement a higher level abstraction that allows the protocol to be composed with any bridge. This expands the number of chains and possible trust configurations.

