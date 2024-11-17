CIRCUITS := circuits
CONTRACTS := contracts

clean:
	$(MAKE) -C $(CIRCUITS)/Makefile clean

test:
	$(MAKE) -C $(CIRCUITS)/Makefile test
