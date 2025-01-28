#!/usr/bin/env node

// Import required modules
const { Command } = require('commander');

const { defaultConfigPath, readConfig } = require('./config');
const { ZKERC20Wallet } = require('./wallet');

const { CustomError } = require('./errors');

let OPT_VERBOSE = process.env.VERBOSE || false;

const program = new Command();
program
    .name('zkerc20')
    .version('0.1')
    .description('Private ERC-20 wrapping and bridging')
    .option('-v, --verbose', 'Show additional information', false)
    .option('--no-address-labels', 'Do not use address labels in the output', false)
    .option('-C, --config <filepath>', 'Configuration file to use', defaultConfigPath)
    //.option('-a, --account <filepath>', 'Account to use', defaultAccountPath)
    .option('-c, --chain <chain>', 'Chain ID to use', null)
    .option('--output <format>', 'Return information in specified output format', 'text');


////////// SUBCOMMANDS


let handler = (fn) => {
    return async (...args) => {
        let opts = program.opts();

        if (opts.verbose) {
            OPT_VERBOSE = true;
        }

        try {
            let config = readConfig(opts.config);

            await fn(opts, config, ...args);
            process.exit(0);
        } catch (err) {
            // show full error stack if verbose
            // or, if Error and not a custom error.
            // otherwise just show the error message
            if (OPT_VERBOSE || !(err instanceof CustomError)) {
                console.error(err);
            } else {
                console.error('Error:', err.message);
            }

            process.exit(1);
        }
    };
};


let _createWallet = (opts, config) => {
    return new ZKERC20Wallet(config, opts.chain);
}


// account
program
    .command('config')
    .description('Display and modify configuration')
    .action(handler(async (opts, config) => {
        console.log('Account functionality not implemented.');
    }));

// address
program
    .command('address')
    .description('Get your public key')
    .action(handler(async (opts, config) => {
        console.log('Public key functionality not implemented.');
    }));

// balance
program
    .command('balance')
    .description('Show balance of account')
    .action(handler(async (opts, config) => {
        let wallet = _createWallet(opts, config);
        console.log('Balance functionality not implemented.');
    }));

// list
program
    .command('list')
    .description('List available ZKERC20 tokens')
    .action(handler(async (opts, config) => {
        let wallet = _createWallet(opts, config);
        console.log('List functionality not implemented.');
    }));

// lock
program
    .command('lock')
    .alias('deposit')
    .alias('wrap')
    .alias('mint')
    .description('Lock ERC-20 tokens into the contract')
    .action(handler(async (opts, config) => {
        let wallet = _createWallet(opts, config);
        console.log('Lock functionality not implemented.');
    }));

// unlock
program
    .command('unlock')
    .alias('withdraw')
    .alias('unwrap')
    .alias('redeem')
    .description('Unlock ERC-20 tokens from the contract')
    .action(handler(async (opts, config) => {
        let wallet = _createWallet(opts, config);
        console.log('Unlock functionality not implemented.');
    }));

// transfer
program
    .command('transfer')
    .description('Transfer ZKERC20 notes')
    .action(handler(async (opts, config) => {
        let wallet = _createWallet(opts, config);
        console.log('Transfer functionality not implemented.');
    }));

// bridge
program
    .command('bridge')
    .description('Bridge ZKERC20 notes')
    .action(handler(async (opts, config) => {
        let wallet = _createWallet(opts, config);
        console.log('Bridge functionality not implemented.');
    }));


////////// MAIN


program.parse(process.argv);

// Display help if no subcommand is provided
if (!process.argv.slice(2).length) {
    program.outputHelp();
}

