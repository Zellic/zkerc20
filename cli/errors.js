class CustomError extends Error {
    constructor(message, data) {
        super(message);
        this.name = this.constructor.name;
        if (data) {
            this.data = data;
        }
    }
}


class InvalidConfigError extends CustomError {}

class NoChainSelectedError extends CustomError {
    constructor() {
        super('No chain selected');
    }
}


module.exports = {
    CustomError,

    InvalidConfigError,
    NoChainSelectedError
};
