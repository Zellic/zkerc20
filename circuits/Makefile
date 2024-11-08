SNARKJS := node ../node_modules/snarkjs/cli.js
PTAU := powersOfTau28_hez_final_21.ptau

.DEFAULT_GOAL := verifier.sol


%.sol: circuit_final.zkey
	$(SNARKJS) zkey export solidityverifier $< $@


%.json: circuit_final.zkey
	$(SNARKJS) zkey export verificationkey $< $@


%.zkey: circuit.r1cs $(PTAU)
	$(SNARKJS) groth16 setup $< $(PTAU) $@


%.r1cs: circuit.circom
	circom $< --r1cs --wasm --sym


%.ptau:
	wget https://storage.googleapis.com/zkevm/ptau/$@


clean:
	rm -rf circuit_js
	rm -f circuit.r1cs circuit.sym circuit_final.zkey verification_key.json verifier.sol


test: verifier.sol circuit_final.zkey
	npx hardhat test


.PHONY: clean test
