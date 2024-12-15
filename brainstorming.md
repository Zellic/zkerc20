zkerc20-cli 0.1
Private ERC-20 wrapping and bridging

USAGE:
    zkerc20 [FLAGS] [OPTIONS] <SUBCOMMAND>

FLAGS:
    -h, --help                           Prints help information
        --no-address-labels              Do not use address labels in the output
    -V, --version                        Prints version information
    -v, --verbose                        Show additional information

OPTIONS:
    -C, --config <FILEPATH>              Configuration file to use [default: $HOME/.config/zkerc20/config.yml]
    -a, --account <FILEPATH>              Account to use [default: $HOME/.config/zkerc20/wallets/default.json]
        --output <FORMAT>                Return information in specified output format [possible values: json]

SUBCOMMANDS:
    help                                 Prints this message or the help of the given subcommand(s)
    
    account                              Show notes owned by account
    address                              Get your public key
    balance                              Show balance of account
    
    lock                                 Lock ERC-20 tokens into the contract
    unlock                               Unlock ERC-20 tokens from the contract
    transfer                             Transfer ZKERC20 notes
    bridge                               Bridge ZKERC20 notes
