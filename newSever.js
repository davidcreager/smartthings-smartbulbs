#!/usr/bin/env node
'use strict';


const UUID = require('uuid/v1');
const SSDP = require('node-ssdp').Server;
const SSDPScan = require("./ssdpScan").ssdpScan;

const properties = require("./properties.json")
const devices = require("./devices");
let gTest = false;
(function () {
	process.argv.forEach((val, index) => {
		if (index > 1) {
			if (val=="TEST") gTEST = true
		}
	});
	//console.log("smartserver: input arguments are " + tmp + " enabledtypes (overriding properties.json)=" + enabledTypes);
})();
const G_serverPort = properties.ServerPort
let devicePortCounter = properties.DevicePortStart
console.log("Started");
//let adverts = new devices.Advertiser();
devices.Advertiser.configure({portCounter: 43000});
let newDevice = new devices.BridgeDeviceHandler();
newDevice.createHTTPServer();

let newDevice1 = new devices.BTDeviceHandler();
newDevice1.configure();
newDevice1.discoverDevices();

//adverts.configure({usn: "newUSN", urn: "newURN",bollocks: "bollocks"});
/*
devices.Advertiser.configure({usn: "newUSN", urn: "newURN",bollocks: "bollocks"});
let newDevice1 = new devices.BTDevice();
let newDevice2 = new devices.WifiDevice();
console.log("about to call device factory");
let newDevice3 = new (devices.DeviceFactory("BTDevice"));
console.log(" newDevice3 =" + newDevice3 + " json=" + JSON.stringify(newDevice3))
*/
//SSDPScan("upnp:rootdevice");
//SSDPScan("urn:schemas-upnp-org:*");
console.log("Finshed");