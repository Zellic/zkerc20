Deposit any ERC-20, and receive a corresponding zkERC20 token. These can be transferred to any user and bridged to any chain---without revealing the token type, amount, or receiver.

# About

The protocol consists of a contract on each supported ecosystem, which utilizes zero knowledge proofs to regulate user balances in a vector commitment. These contracts interact through messages on LayerZero and Chainlink, allowing users to send assets completely privately and anonymously. In fact, outside observers cannot even determine exactly how a token's supply is spread across the chains.

The ZK circuits powering this functionality are designed to be friendly towards potential privacy-focused DeFi protocols, including anonymous perps/leverage protocols, dark pools, and ZK orderbooks/DEXes. Of course, users can at any time withdraw their zkERC-20. On the original chain, this leaves them with the corresponding ERC-20; on others, they receive a wrapped variant economically pegged 1:1.

For more information about the privacy guarantees of the protocol, see [`docs/MOTIVATIONS.md`](docs/MOTIVATIONS.md).

# How it works

Our protocol uses completely custom zero knowledge circuits, which allows the privacy-preserving guarantees without dependent on specialized ecosystem features. This allows the application to trivially be expanded across EVM-compatible chains, and even others like Aptos.

Users interact with the protocol by providing proofs of certain invariants. These are produced off-chain. We provide a number of options: they can be computed directly in the browser using WebAssembly, or even by a self-hosted server implementation.

The bridging mechanism allows assets to be transferred with very concise messages. We choose to implement a higher level abstraction that allows the protocol to be composed with any bridge. This expands the number of chains and possible trust configurations,
