# Explanation of Design Choices

Note that in this document, we use *salt*, *nonce*, and *secret* interchangably to refer to the same data.


## What is the fake merkle tree that deposits (insertions) use?

Throughout this protocol, we reuse one main circuit: note splitting. One or UTXOs are spent by splitting into two new UTXOs (left and right).

When depositing, we want to ensure the asset and amount actually transferred in matches the commitment the user submits. Creating the commitment on-demand on-chain is not possible because the commitment includes the salt, which must be kept secret.

To reuse the splitting circuit, we must have input funds/notes to split. There are two main approaches to this, but we chose to create a "fake" merkle trie with a fake input commitment, and split to the real user's commitment. This verifies that the amount and asset match, while not revealing the salt.

An alternative design choice is to have a "master" commitment that gets split/nullified every time a user deposits. However, this approach is about equally as complex, and requires writing to storage which is expensive in EVM.


## Why do commitments and nullifiers both have salt?

Of course, we must have to separate pieces of data per UTXO: the commitment (defines one UTXO) and a nullifier (which is associated with exactly one commitment, for the purpose of burning the commitment). We chose for them to have the following definitions:

```
commitment = hash(nullifier | salt)
nullifier = hash(asset | amount | salt)
```

That is, *commitment* is `hash(hash(asset | amount | salt) | salt)`. While this may seem odd to have the salt twice, it is actually necessary for privacy preserving purposes.

If the commitment and nullifier were identical, or anyone could easily calculate one given the other, then it would be possible to associate transferring/burning (i.e., spending a commitment by submitting the nullifier on-chain) with the original deposit transaction, thereby revealing the depositor. So, we must include the salt in the calculation of the commitment.

Similarly, if the nullifier were easily calculatable, then anyone could burn anyone's commitments. So we must include the salt in the nullifier as well.

