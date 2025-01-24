class CustomError extends Error {
    static prefixes = {
        SelfGriefingError: "Self-griefing detected",
        AmountMismatchError: "Amount mismatch error",
        MerkleTreeFullError: "Merkle tree error",
        InvalidCommitmentError: "Invalid commitment error",
    };

    constructor(message, data) {
        super(message);
        this.name = this.constructor.name;
        if (data) {
            this.data = data;
        }
    }

    toString() {
        const prefix = CustomError.prefixes[this.name] || this.name;
        return `${prefix}: ${this.message}`;
    }
}


class SelfGriefingError extends CustomError {}
class AmountMismatchError extends CustomError {}
class MerkleTreeFullError extends CustomError {}
class InvalidCommitmentError extends CustomError {}


module.exports = {
    SelfGriefingError,
    AmountMismatchError,
    MerkleTreeFullError,
    InvalidCommitmentError
};
