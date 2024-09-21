circom circuit.circom --r1cs --wasm --sym
node ../node_modules/snarkjs/cli.js groth16 setup circuit.r1cs final.ptau circuit_final.zkey
node ../node_modules/snarkjs/cli.js zkey export verificationkey circuit_final.zkey verification_key.json
node ../node_modules/snarkjs/cli.js zkey export solidityverifier circuit_final.zkey verifier.sol
