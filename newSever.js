#!/usr/bin/env node
'use strict';
const http = require('http');
const URL = require('url');
const ip=require("ip");
const UUID = require('uuid/v1');
const SSDP = require('node-ssdp').Server;
const SSDPScan = require("ssdpScan").ssdpScan;
const querystring = require('querystring');
const properties = require("./properties.json");
let gTest = false;
(function () {
	process.argv.forEach((val, index) => {
	if (index > 1) {
		if (val=="TEST") {
			gTEST = true;
		}
	});
	//console.log("smartserver: input arguments are " + tmp + " enabledtypes (overriding properties.json)=" + enabledTypes);
})();
const G_serverPort = properties.ServerPort
let devicePortCounter = properties.DevicePortStart
console.log("Started");
SSDPScan();
console.log("Finshed");