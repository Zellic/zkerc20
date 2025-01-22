CIRCUITS := circuits
CONTRACTS := contracts

.DEFAULT_GOAL := test

test: node_modules
	$(MAKE) -C $(CIRCUITS) test

clean:
	$(MAKE) -C $(CIRCUITS) clean
	forge clean
	npx hardhat clean

node_modules:
	@npm -v > /dev/null 2>&1 || (echo "npm command not found. Please install npm." && exit 1)
	npm install

.PHONY: clean test
