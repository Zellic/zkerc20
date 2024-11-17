CIRCUITS := circuits
CONTRACTS := contracts

.DEFAULT_GOAL := test

test:
	$(MAKE) -C $(CIRCUITS) test

clean:
	$(MAKE) -C $(CIRCUITS) clean
	forge clean
	npx hardhat clean

.PHONY: clean test
