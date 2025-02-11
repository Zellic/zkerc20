async function generateSalt() {
    // NOTE: Here are some ideas. Will talk to crypto guy first
    //
    // We could derive the salt based on the current timestamp + private key.
    // This way it's recoverable. Someone would just need to iterate over every
    // timestamp and check if the salt is right
    //
    // ^ nvm wouldn't work since we don't know the other payment details
    // (token,amount,etc)
    //

    // TODO
    return 1234;
}


module.exports = {
    generateSalt
}
