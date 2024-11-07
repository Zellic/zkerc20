SNARKJS := node ../node_modules/snarkjs/cli.js
PTAU := powersOfTau28_hez_final_21.ptau


verifier.sol: circuit_final.zkey
	$(SNARKJS) zkey export solidityverifier circuit_final.zkey verifier.sol


circuit_final.zkey: $(PTAU) circuit.r1cs
	$(SNARKJS) groth16 setup circuit.r1cs $(PTAU) circuit_final.zkey
	$(SNARKJS) zkey export verificationkey circuit_final.zkey verification_key.json


circuit.r1cs: circuit.circom
	circom circuit.circom --r1cs --wasm --sym


clean:
	rm -rf circuit_js
	rm -f circuit.r1cs circuit.sym circuit_final.zkey verification_key.json verifier.sol


%.ptau:
	wget https://storage.googleapis.com/zkevm/ptau/$@


.PHONY: clean
