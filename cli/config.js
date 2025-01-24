const fs = require('fs');
const path = require('path');


// Default configuration paths
const defaultConfigPath = path.join(process.env.HOME || process.env.USERPROFILE, '.config/zkerc20/config.json');
//const defaultAccountPath = path.join(process.env.HOME || process.env.USERPROFILE, '.config/zkerc20/wallets/default.json');


let _readConfigOnly = (configFilepath) => {
    let data = JSON.parse(fs.readFileSync(configFilepath));

    // add functions to refresh or write the config file
    data.refresh = () => {
        // clear old data, except for the functions
        for (let key in data) {
            if (typeof data[key] !== 'function') {
                delete data[key];
            }
        }

        // repopulate the data object
        let newData = JSON.parse(fs.readFileSync(configFilepath));
        Object.assign(data, newData);
    }

    data.write = () => {
        let _data = {};
        for (let key in data) {
            if (typeof data[key] !== 'function') {
                _data[key] = data[key];
            }
        }

        fs.writeFileSync(configFile, JSON.stringify(_data, null, 4));
    }

    return data;
}


let _readConfigOrCreateDefault = (configFilepath, defaultJSON) => {
    // 1. try to read the file
    try {
        return _readConfigOnly(configFilepath);
    } catch (e) {
        // 2. if the file is corrupted, throw an error to exit the program
        if (e.code === 'ENOENT') {
            // 3. if the file does not exist, create it
            const configDir = path.dirname(configFilepath);
            fs.mkdirSync(configDir, { recursive: true });
            fs.writeFileSync(configFilepath, JSON.stringify(defaultJSON, null, 4));
            return _readConfigOnly(configFilepath);
        } else if (e instanceof SyntaxError) {
            // wrap e and throw it
            throw new Error(`Error reading config file "${configFilepath}": ${e.message}`);

        } else {
            throw e;
        }
    }
}


function readConfig(overrideConfig) {
    let configFilepath = defaultConfigPath;
    if (overrideConfig) {
        configFilepath = overrideConfig;
    }

    // open and read the config file
    const fullConfig = _readConfigOrCreateDefault(configFilepath, {
        chains: {},
        defaultChain: null
    });
    return fullConfig;
}


module.exports = {
    defaultConfigPath,
    readConfig
}
