'use strict';
const logs = require("./logs");
const dev =require("./BTaccessory");
const config = require("./config.json");
const { Scanner } = require("./scanner");
const BluetoothAgent =  require("./BTScanner");

var log = new logs.Log("P2",false,true);
var cbFunc = function(){
	console.log("we have arrived");
}
//var device = new dev(log);
var device = new BluetoothAgent.BluetoothAgent(cbFunc);
device.discoverDevices();
