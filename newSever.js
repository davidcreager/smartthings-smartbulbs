#!/usr/bin/env node
'use strict';
const util = require('util');
const UUID = require('uuid/v1');
const SSDP = require('node-ssdp').Server;
const SSDPScan = require("./ssdpScan").ssdpScan;
const properties = require("./newProps.json")
const devices = require("./newDevice");
const Log = require("./logs");
const log = new Log.Log("smartserver");
let gTest = false;
let gCommand = null;
require('events').EventEmitter.defaultMaxListeners = 50;
(function () {
	process.argv.forEach((val, index) => {
		if (index > 1) {
			if (val=="TEST") {
				gTEST = true
			} else {
				gCommand = val;
			}
		}
	});
})();

const G_serverPort = properties.ServerPort
let devicePortCounter = properties.DevicePortStart
log.info("Starts"," gTest=" + gTest + " gCommand=" + gCommand);
log.info("Config"," G_serverPort=" + G_serverPort + " devicePortCounter=" + devicePortCounter);
let adverts = new devices.Advertiser({"log":log, portCounter: devicePortCounter, serverPort: G_serverPort}  );
devices.Advertiser.configure({portCounter: 43000});

let deviceHandler = new devices.BTDeviceHandler();
deviceHandler.createHTTPServer();
let xiaomiThermostatBindKeys = ["937ac1412e511bf43c0be0ccad342fbc","6409e0c4e83e4486e45223d0cfa0985b"];
let xiaomiThermostatAddresses = ["A4:C1:38:03:D4:0D","A4:C1:38:F7:92:27"];
let createdDevices = {};
let updateTimers = {};
let cnter = 0;
let testDevs = {};
let testStats = {};
deviceHandler.getAdapter().then( (adapt)=>{
	adapt.startDiscovery().then(()=>{
		simplerTest(adapt);
	});
});
function simplerTest(adapt)
{
	let cnt=0;
	//adapt.startDiscovery().then(()=>{
		//console.log("discovery started")
		adapt.devices().then((devs) => {
			console.log("found " + devs.length + " Devices");
			devs.forEach( (dev)=> {
				adapt.getDevice(dev).then( (devy)=>{
					//ServiceData
					testDevs[devy.device] = devy;
					console.log("device - " + dev + " got devy=" + devy.device);
					if (xiaomiThermostatAddresses.includes(dev)) {
						if (!testStats[dev]) {
							testStats[dev] = new devices.XiaomiThermostat(adapt,dev,xiaomiThermostatBindKeys[xiaomiThermostatAddresses.indexOf(dev)],testDevs[devy.device]);
							console.log("\t\t Creating stat " + " for dev=" + dev);
							testStats[dev].prepare();
							//setInterval(testStats[dev].pollForUpdates.bind(testStats[dev]),2000);
						}
					}			
				})
			});
			/*
			adapt.stopDiscovery().then( ()=> {
				for (let prp in testDevs) {cnt++;};
				console.log("done prop count is " + cnt);
				return 
			});
			*/
			let gotAllDevs = true;
			xiaomiThermostatAddresses.forEach( (add) => {
				if ( !testStats[add] ) { gotAllDevs = false }
			});
			if (gotAllDevs) {
				console.log("All Stats Created, increased scan frequency");
				//setTimeout(simplerTest,20000,adapt);
			} else {
				setTimeout(simplerTest,5000,adapt);
			}

		});
	//});

}
async function simpTest(adapt){
	let devs = await deviceHandler.rawDiscoverDevices();
	let adapte = await deviceHandler.getAdapter();
	if (devs) {
		devs.forEach(async (dev) => {
			if (!createdDevices[dev])  {
				createdDevices[dev] = "created";
				console.log(dev);
				if (xiaomiThermostatAddresses.includes(dev)) {
					let device = await adapte.waitDevice(dev);
					let stat = new devices.XiaomiThermostat(adapte,dev,xiaomiThermostatBindKeys[xiaomiThermostatAddresses.indexOf(dev)],device);
					console.log("\t\t Creating stat");
					cnter++;
					stat.pollForUpdates();
					setInterval(stat.pollForUpdates.bind(stat),2000);
				}
			}			
		});
	}
		
	console.log("simpTest\t devs has " + devs.length + " devices devs[0]=" + devs[0] + " of Type " + typeof(devs[0]));
}
//createBTDevices(deviceHandler);
async function createBTDevices(deviceHandler) {
		let eventHandler = function(event) { console.log("createBTDevices\t eventHandler - received event=" + event) }
		let adapt = await deviceHandler.getAdapter(eventHandler);
		let devs = await deviceHandler.discoverDevices();
		if (devs) {
			devs.forEach(async (dev) => {
				if (!createdDevices[dev.id]) {
					console.log("createBTDevices\t new Device id=" + dev.id + " alias=" + dev.alias)// + "\tkeys=" + Object.keys(createdDevices));
					createdDevices[dev.id] = {};
					if (xiaomiThermostatAddresses.includes(dev.id)) {
						console.log("createBTDevices\t - creating a XiaomiThermostat address=" + dev.id + 
							" bindkey=" + xiaomiThermostatBindKeys[xiaomiThermostatAddresses.indexOf(dev.id)]);
						let device = await adapt.waitDevice(dev.id);
						createdDevices[dev.id] = new devices.XiaomiThermostat(adapt,dev.id,xiaomiThermostatBindKeys[xiaomiThermostatAddresses.indexOf(dev.id)],device);
						createdDevices[dev.id].pollForUpdates();
						updateTimers[dev.id] = setInterval(createdDevices[dev.id].pollForUpdates.bind(createdDevices[dev.id]),1000);
					}
				} else {
					//console.log("createBTDevices\t Existing device id=" + dev.id + " alias=" + dev.alias);
				}
			});
		} else {
			console.log("Weird - No Devices returned");
		}
		//console.log("foreach finished");
		//console.log("length returned=" + devs.length + " 0 ele=" + JSON.stringify(devs[0]));
		setTimeout(createBTDevices,10000,deviceHandler);
}

/*
let newDevice1 = new devices.BTDeviceHandler();
newDevice1.configure();
newDevice1.discoverDevices();
*/

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