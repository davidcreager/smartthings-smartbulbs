const chalk = require("chalk");
const util = require("util");

module.exports.Log = function(prefix,debugEnabled,timestampEnabled) {
	this.LogLevel = {
			INFO : "info",
			WARN : "warn",
			ERROR : "error",
			DEBUG : "debug",
		}
	this.debugEnabled = debugEnabled || true;
	this.timestampEnabled = timestampEnabled || true;
	this.prefix = prefix || "Bluetooth Test";	
	this.info = function(message, ...parameters) {
		this.log(this.LogLevel.INFO, message, ...parameters);
	}
	this.warn = function(message, ...parameters) {
		this.log(this.LogLevel.WARN, message, ...parameters);
	}
	this.error = function(message, ...parameters) {
		this.log(this.LogLevel.ERROR, message, ...parameters);
	}
	this.debug = function(message, ...parameters) {
		this.log(this.LogLevel.DEBUG, message, ...parameters);
	}
	this.log = function(level, message, ...parameters) {
    var message = util.format(message, ...parameters);

    let loggingFunction = console.log;
    switch (level) {
      case this.LogLevel.WARN:
        message = chalk.yellow(message);
        loggingFunction = console.error;
        break;
      case this.LogLevel.ERROR:
        message = chalk.red(message);
        loggingFunction = console.error;
        break;
      case this.LogLevel.DEBUG:
        message = chalk.gray(message);
        break;
    }

    if (this.prefix) {
      message = chalk.cyan(`[${this.prefix}] `) + message;
    }

    if (this.timestampEnabled) {
      const date = new Date();
      message = chalk.white(`[${date.toLocaleString()}] `) + message;
    }

    loggingFunction(message);
  }
}