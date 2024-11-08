const fs = require('fs')

const snarkjs = require('snarkjs')

const buildMimcSponge = require('circomlibjs').buildMimcSponge
const buildPoseidon = require('circomlibjs').buildPoseidon

const HEIGHT = 30

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

    console.log(mimcSponge.F.toObject(commit(1, 2, 3, 4)[1]))

    return {
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
    sendData,        // [receiver, amount]

    salt1,
    salt2,
) => {
    const {
        mimcSponge,
        toMerkleRows,
        toMerkleProof,
        commit,
    } = await utils()

    const merkleRows = toMerkleRows(allCommitments)

    let total = 0
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

    const [receiver, amount] = sendData

    return {
        root: mimcSponge.F.toObject(merkleRows[HEIGHT][0]),
        sender,
        asset,
        amounts,
        salts,

        leftRecipient: receiver,
        leftAmount: amount,
        leftSalt: salt1,
        leftCommitment: mimcSponge.F.toObject(
            commit(receiver, asset, amount, salt1)[1]
        ),

        rightRecipient: sender,
        rightAmount: total - amount,
        rightSalt: salt2,
        rightCommitment: mimcSponge.F.toObject(
            commit(sender, asset, total - amount, salt2)[1]
        ),

        nullifiers,
        path: paths,
        sides,
    }
}

void (async () => {
    const { commit, } = await utils()

    // sender, asset, amount, salt
    const data = [
        [1, 0, 10, 0],
        [1, 0, 20, 1],
        [1, 0, 30, 2],
        [1, 0, 40, 3],
        [1, 0, 50, 4],
        [1, 0, 60, 5],
        [1, 0, 70, 6],
        [1, 0, 80, 7],
        [2, 0, 90, 8],
        [2, 0, 100, 9],
    ]

    const commitments = data.map(
        ([sender, asset, amount, salt]) => commit(
            sender,
            asset,
            amount,
            salt,
        )[1]
    )

    const asset = 0
    const sender = 1
    const usedReceipts = [
        [10, 0, 0],
        [20, 1, 1],
        [30, 2, 2],
        [40, 3, 3],
        [50, 4, 4],
        [60, 5, 5],
        [70, 6, 6],
        [80, 7, 7],
    ]

    const sendData = [2, 90]

    const inputs = await buildTransfer(
        commitments,
        asset,
        sender,
        usedReceipts,
        sendData,
        69,
        96,
    )

    console.log('Generating proof for', inputs);

    console.log('generating proof...')
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        inputs,
        'circuit_js/circuit.wasm',
        'circuit_final.zkey',
    )

    console.log(proof)
    console.log(publicSignals)

    console.log('verifying proof...')
    const vkVerifier = JSON.parse(fs.readFileSync('verification_key.json'))
    const res = await snarkjs.groth16.verify(
        vkVerifier,
        publicSignals,
        proof,
    )

    console.log(res)
})()
