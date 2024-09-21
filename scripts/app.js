const crypto = require('crypto')
const snarkjs = require('snarkjs')

const buildMimcSponge = require('circomlibjs').buildMimcSponge
const buildPoseidon = require('circomlibjs').buildPoseidon

const HEIGHT = 30

// returns initial state
const createChainState = (
    chainAddress, // BigInt
    userAddress,  // BigInt
) => {
    return {
        chainAddress,
        userAddress,
        knownCommitments: [],
        knownData: [],
    }
}

// when anyone adds a receipt this has to be called
// returns new state
const addKnownCommitment = (
    state,      // ChainState
    commitment, // BigInt
    index,      // number
) => {
    const commitmentCopy = structuredClone(state.knownCommitments)
    commitmentCopy[index] = commitment

    return {
        ...state,
        knownCommitments: commitmentCopy,
    }
}

// longest contiguous prefix of commitments
// returns list of commitments
const getKnownCommitments = (
    state,      // ChainState
) => {
    const commitments = []
    for (let i = 0; i < state.knownCommitments.length; i++) {
        if (state.knownCommitments[i] === undefined) {
            break
        }
        commitments.push(state.knownCommitments[i])
    }
    return commitments
}

// returns new state
const learnMyData = (
    state,       // ChainState
    asset,       // BigInt
    address,     // BigInt
    amount,      // BigInt
    secret,      // BigInt
    index,       // number
) => {
    if (state.userAddress !== address) {
        return state
    }

    const data = {
        asset,
        amount,
        secret,
        index,
    }

    return {
        ...state,
        knownData: [...state.knownData, data],
    }
}

const utils = async () => {
    const mimcSponge = await buildMimcSponge()
    const mimcHash = (left, right) => mimcSponge.multiHash([left, right], 0, 1)
    const mimcZero = mimcSponge.F.fromObject(0)
    const poseidon = await buildPoseidon()

    const toMerkleRows = (entries) => {
        const layers = [entries]

        while (layers.length < HEIGHT + 1) {
            const last = layers[layers.length - 1]
            if (last.length % 2 === 1) {
                last.push(mimcZero)
            }

            const next = []
            for (let i = 0; i < last.length / 2; i++) {
                const left = last[i * 2]
                const right = last[i * 2 + 1]
                next.push(mimcHash(left, right))
            }

            layers.push(next)
        }

        return layers
    }

    const toMerkleProof = (rows, index) => {
        const path = []
        const side = []

        for (let i = 0; i < HEIGHT; i++) {
            const layer = rows[i]
            const siblingIndex = index % 2 === 0 ? index + 1 : index - 1
            const sibling = layer[siblingIndex]
            path.push(sibling)

            if (index < siblingIndex) {
                side.push(0)
            } else {
                side.push(1)
            }

            index = Math.floor(index / 2)
        }

        return { path, side }
    }

    const commit = (sender, asset, amount, salt) => {
        const nullifier = poseidon([
            sender,
            asset,
            amount,
            salt,
        ])

        const commitment = poseidon([nullifier, salt])
        return [nullifier, commitment]
    }

    return {
        mimcHash,
        mimcSponge,
        poseidon,
        toMerkleRows,
        toMerkleProof,
        commit,
    }
}

const buildTransfer = async (
    allCommitments,
    asset,
    sender,
    usedReceipts,    // [amount, salt, commitment index]

    leftReceiver,
    leftAmount,
    leftSalt,

    rightReceiver,
    rightSalt,
) => {
    const {
        mimcSponge,
        toMerkleRows,
        toMerkleProof,
        commit,
    } = await utils()

    const merkleRows = toMerkleRows(allCommitments)

    let total = 0n
    const amounts = []
    const salts = []
    const nullifiers = []
    const paths = []
    const sides = []
    for (let [amount, salt, index] of usedReceipts) {
        total += amount

        amounts.push(amount)
        salts.push(salt)

        const [nullifier] = commit(
            sender,
            asset,
            amount,
            salt,
        )
        nullifiers.push(mimcSponge.F.toObject(nullifier))

        const { path, side } = toMerkleProof(merkleRows, index)
        paths.push(path.map((p) => mimcSponge.F.toObject(p)))
        sides.push(side.map((s) => s))
    }

    return {
        root: mimcSponge.F.toObject(merkleRows[HEIGHT][0]),
        sender,
        asset,
        amounts,
        salts,

        leftRecipient: leftReceiver,
        leftAmount: leftAmount,
        leftSalt: leftSalt,
        leftCommitment: mimcSponge.F.toObject(
            commit(leftReceiver, asset, leftAmount, leftSalt)[1]
        ),

        rightRecipient: rightReceiver,
        rightAmount: total - leftAmount,
        rightSalt: rightSalt,
        rightCommitment: mimcSponge.F.toObject(
            commit(rightReceiver, asset, total - leftAmount, rightSalt)[1]
        ),

        nullifiers,
        path: paths,
        sides,
    }
}


const createProof = async (
    state,
    asset,          // BigInt
    tickets,        // number[] of indices
    leftReceiver,   // BigInt
    leftAmount,     // BigInt
    rightReceiver,  // BigInt
) => {
    const u = await utils()

    const leftSecret = BigInt(
        `0x${crypto.randomBytes(32).toString('hex')}`
    )
    const rightSecret = BigInt(
        `0x${crypto.randomBytes(32).toString('hex')}`
    )

    const usedReceipts = []
    for (const index of tickets) {
        const asset = state.knownData.find((d) => d.index === index)
        if (asset === undefined) return null
        usedReceipts.push([asset.amount, asset.secret, index])
    }

    console.log(
        u.mimcSponge.F.toObject(
            u.mimcHash(
                20051188440476674805728603439276332542747966705457781819161321158021805995991n,
                0n,
            // u.mimcHash(
            //     1n,
            //     2n,
            // )
            )
        )
    )

    const proofInputs = await buildTransfer(
        getKnownCommitments(state),
        asset,
        state.userAddress,
        usedReceipts,
        leftReceiver,
        leftAmount,
        leftSecret,
        rightReceiver,
        rightSecret,
    )

    while (proofInputs.nullifiers.length < 8) {
        const salt = BigInt(`0x${crypto.randomBytes(32).toString('hex')}`)
        const [nullifier] = u.commit(
            state.userAddress,
            asset,
            0n,
            salt,
        )

        proofInputs.nullifiers.push(u.mimcSponge.F.toObject(nullifier))
        proofInputs.path.push(Array(HEIGHT).fill(0n))
        proofInputs.sides.push(Array(HEIGHT).fill(0))
        proofInputs.amounts.push(0n)
        proofInputs.salts.push(salt)
    }

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        proofInputs,
        'circuits/circuit_js/circuit.wasm',
        'circuits/circuit_final.zkey',
    )

    console.log(await snarkjs.groth16.exportSolidityCallData(proof, publicSignals))

    const vkVerifier = JSON.parse(
        require('fs').readFileSync('circuits/verification_key.json')
    )
    const res = snarkjs.groth16.verify(vkVerifier, publicSignals, proof)

    console.log(res)

    if (!res) return null

    for (const index of tickets) {
        state.knownData = state.knownData.filter((d) => d.index !== index)
    }

    return {
        a: proof.pi_a,
        b: proof.pi_b,
        c: proof.pi_c,
        root: publicSignals[0],
        sender: publicSignals[1],
        leftCommitment: publicSignals[2],
        rightCommitment: publicSignals[3],
        nullifiers: publicSignals.slice(4, 12),
        leftRecipient: proofInputs.leftRecipient,
        leftAmount: proofInputs.leftAmount,
        leftSecret: leftSecret,
        rightRecipient: proofInputs.rightRecipient,
        rightAmount: proofInputs.rightAmount,
        rightSecret: rightSecret,
    }
}

// (async () => {
//     const u = await utils()
//
//     const sender = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266n
//     const asset = 0x6Eb443D531c9d7F818a4D0d34f196c0d4Ac7e402n
//     let state = createChainState(0x1, sender)
// 
//     const notes = []
// 
//     // amount: 0x989680
//     // salt: 0
//     // index: 0
//     const firstMint = u.commit(
//         sender,
//         chain,
//         0x989680n,
//         0n,
//     )[1]
//     state = addKnownCommitment(state, firstMint, 0)
//     state = learnMyData(state, asset, sender, 0x989680n, 0n, 0)
//     notes.push(0)
//
//     const proof = await createProof(state, asset, notes, 0n, 100n, sender)
//     console.log(proof)
// })()

const express = require('express')

const app = express()

app.use(express.json())

app.post('/prove', async (req, res) => {
    const {
        chainAddress,      // basically everything is hex
        userAddress,
        knownCommitments,
        knownData,         // list of { asset: hex, amount: hex, secret: hex, index: number }

        assetAddress,
        tickets,           // list of number indices matching knownData
        receiveAddress,
        amount,
        remainAddress,

    } = req.body
    if (
        chainAddress === undefined ||
        userAddress === undefined ||
        knownCommitments === undefined ||
        knownData === undefined
    ) {
        return res.status(400).send('Missing fields')
    }

    const state = {
        chainAddress: BigInt(chainAddress),
        userAddress: BigInt(userAddress),
        knownCommitments: knownCommitments.map((c) => BigInt(c)),
        knownData: knownData.map((d) => ({
            asset: BigInt(d.asset),
            amount: BigInt(d.amount),
            secret: BigInt(d.secret),
            index: d.index,
        })),
    }

    const proof = await createProof(
        state,
        BigInt(assetAddress),
        tickets,
        BigInt(receiveAddress),
        BigInt(amount),
        BigInt(remainAddress),
    )

    const data = {
        a: [proof.a[0].toString(16), proof.a[1].toString(16)],
        b: proof.b.map((b) => [b[1].toString(16), b[0].toString(16)]),
        c: proof.c.map((c) => c.toString(16)),
        root: proof.root.toString(16),
        sender: proof.sender.toString(16),
        leftCommitment: proof.leftCommitment.toString(16),
        rightCommitment: proof.rightCommitment.toString(16),
        nullifiers: proof.nullifiers.map((n) => n.toString(16)),
        leftRecipient: proof.leftRecipient.toString(16),
        leftAmount: proof.leftAmount.toString(16),
        leftSecret: proof.leftSecret.toString(16),
        rightRecipient: proof.rightRecipient.toString(16),
        rightAmount: proof.rightAmount.toString(16),
        rightSecret: proof.rightSecret.toString(16),
    }

    return res.json(data)
})

app.listen(3000)
