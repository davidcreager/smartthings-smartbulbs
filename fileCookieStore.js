var util = require('util'),
    fs = require('fs'),
    crypto = require('crypto'),
    tough = require('tough-cookie'),
    Store = tough.MemoryCookieStore;

function FileCookieStore(filePath, option) {
    Store.call(this);
    this.idx = {}; // idx is memory cache
    this.filePath = filePath;
    this.option = option || {};
    this.option.encrypt = !(option.encrypt === false);
    if (this.option.encrypt) {
        this.option.algorithm = this.option.algorithm || 'aes-256-ctr';
        this.option.password = this.option.password || 'cookie-store';
    }
    var self = this;
    loadFromFile(this.filePath, this.option, function (dataJson) {
        if (dataJson)
            self.idx = dataJson;
    })
}

util.inherits(FileCookieStore, Store);

module.exports = FileCookieStore;


FileCookieStore.prototype.flush = function () {
    saveToFile(this.filePath, this.idx, this.option);
};

function encrypt(text, option){
    var cipher = crypto.createCipher(option.algorithm, option.password);
    var crypted = cipher.update(text, 'utf8', 'hex');
    crypted += cipher.final('hex');

    return crypted;
}

function saveToFile(filePath, data, option, cb) {
    var dataJson = JSON.stringify(data);
    if (option.encrypt) {
        dataJson = encrypt(dataJson, option);
    }

    fs.writeFileSync(filePath, dataJson);
}

function decrypt(text, option){
    var decipher = crypto.createDecipher(option.algorithm, option.password)
    var dec = decipher.update(text, 'hex', 'utf8')
    dec += decipher.final('utf8');

    return dec;
}

function loadFromFile(filePath, option, cb) {
    var fileData = fs.readFileSync(filePath, {encoding: 'utf8', flag: 'a+'});
    
    if (option.encrypt && fileData) {
        var decrypted = decrypt(fileData, option)
    }
    var dataJson = decrypted ? JSON.parse(decrypted) : null;
    for (var domainName in dataJson) {
        for (var pathName in dataJson[domainName]) {
            for (var cookieName in dataJson[domainName][pathName]) {
                dataJson[domainName][pathName][cookieName] = tough.fromJSON(JSON.stringify(dataJson[domainName][pathName][cookieName]));
            }
        }
    }
    cb(dataJson);
}