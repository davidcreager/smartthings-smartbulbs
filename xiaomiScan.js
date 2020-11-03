'use strict';
const logs = require("./logs");
const dev =require("./BTaccessory");
const config = require("./config.json");
const { Scanner } = require("./scanner");

var log = new logs.Log("P1",false,true);
var device = new dev(log);