SNARKJS := node ../node_modules/snarkjs/cli.js


verifier.sol: circuit_final.zkey
	$(SNARKJS) zkey export solidityverifier circuit_final.zkey verifier.sol


circuit_final.zkey: circuit.r1cs
	$(SNARKJS) groth16 setup circuit.r1cs final.ptau circuit_final.zkey
	$(SNARKJS) zkey export verificationkey circuit_final.zkey verification_key.json


circuit.r1cs: circuit.circom
	circom circuit.circom --r1cs --wasm --sym


clean:
	rm -r circuit_js
	rm -f circuit.r1cs circuit.sym circuit_final.zkey verification_key.json verifier.sol


.PHONY: clean
