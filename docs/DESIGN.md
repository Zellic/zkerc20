# Explanation of Design Choices

Note that in this document, we use *salt*, *nonce*, and *secret* interchangably to refer to the same data.


## Why do commitments and nullifiers both have salt?

Of course, we have to separate pieces of data per UTXO: the commitment (defines one UTXO) and a nullifier (which is associated with exactly one commitment, for the purpose of burning the commitment). We chose for them to have the following definitions:

```
commitment = hash(nullifier | salt)
nullifier = hash(asset | amount | salt)
```

That is, *commitment* is `hash(hash(asset | amount | salt) | salt)`. While this may seem odd to have the salt twice, it is actually necessary for privacy preserving purposes.

If the commitment and nullifier were identical, or anyone could easily calculate one given the other, then it would be possible to associate transferring/burning (i.e., spending a commitment by submitting the nullifier on-chain) with the original deposit transaction, thereby revealing the depositor. So, we must include the salt in the calculation of the commitment.

Similarly, if the nullifier were easily calculatable, then anyone could burn anyone's commitments. So we must include the salt in the nullifier as well.


## What is the fake merkle tree that deposits (insertions) use?

Throughout this protocol, we reuse one main circuit: note splitting. One or UTXOs are spent by splitting into two new UTXOs (left and right).

When depositing, we want to ensure the asset and amount actually transferred in matches the commitment the user submits. Creating the commitment on-demand on-chain is not possible because the commitment includes the salt, which must be kept secret.

To reuse the splitting circuit, we must have input funds/notes to split. There are two main approaches to this, but we chose to create a "fake" merkle trie with a fake input commitment, and split to the real user's commitment. This verifies that the amount and asset match, while not revealing the salt.

An alternative design choice is to have a "master" commitment that gets split/nullified every time a user deposits. However, this approach is about equally as complex, and requires writing to storage which is expensive in EVM.


## Why do we pick random salt even for input commitments with no value?

When transferring or bridging, the commitments with a zero amount always use securely random numbers. The reasoning is that if the salt and amount are known, then the asset can be deduced. To prevent privacy leaks, we must use random salts for all commitments.


## Why are there two modes of transfer?

When transferring (i.e., splitting) a note to a different user, the sender must provide at least one output commitment. Of course, calculating this commitment hash requires the salt, which is secret. If the receiver simply provided the sender with a salt to use, then the sender could "take back" (spend) the note until the receiver splits the note again to change the salt.

This could be done atomically, where the receiver provides the sender with the details/proof for a second split to bundle that changes the salt immediately after the first split, in one transaction.

While this is acceptable, we want to provide the ability for users to atomically revoke their ability to spend a note, without requiring a communication from the receiver. So, we provide two modes of authentication on notes: by salt or ownership:

- **Salt**: The user knows the salt, and can spend the note by revealing the nullifier.
- **Salt+Ownership**: If the note has an owner defined (i.e. is non-zero in the commitment), then the `msg.sender` must also match the owner, in addition to the salt.

The second mode allows a sender to revoke their ability to spend a note after transferring it without requiring communication from the receiver.

Note that the salt would still be known to the sender after splitting, so the receiver must split the note and change the salt to preserve privacy on the next transaction; otherwise, since the nullifier is known to the original sender, privacy on the second transaction would be leaked when the nullifier is burned. We recommend that the receiver splits the note immediately after receiving it to change the salt.

