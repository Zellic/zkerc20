CIRCUITS := circuits
CONTRACTS := contracts

.DEFAULT_GOAL := test


test: node_modules
	$(MAKE) -C $(CIRCUITS) test


deploy-local: node_modules
	npx hardhat run lib/scripts/deploy.js

clean:
	$(MAKE) -C $(CIRCUITS) clean
	npx hardhat clean


node_modules:
	@npm -v > /dev/null 2>&1 || (echo "npm command not found. Please install npm." && exit 1)
	npm install


.PHONY: clean test deploy-local
