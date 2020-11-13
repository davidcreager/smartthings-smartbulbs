'use strict';
//Sort out server port and device port starting value
let ssdpUSNPrefix = "urn:schemas-upnp-org:device:";
let ssdpUDN = "TestBridge";
let portCounter;
let nCalls = 0;
let httpServer = {};
let sspdServers = {};
let ports = {};
let aName = "abc";
let devices = {};
let classCounter=0;
let deviceList = {};
//const SERVICE_DATA_UUID = "fe95"
//"YeeBTLamp RGBW Light", "Find Iphone","Playbulb RGBW Light", "Playbulb RGBW Light", "RFXCOM Somfy Blinds"
//"YeeBTLamp", "iPhone", "MiLight", "Playbulb", "RFXDevice"

function dumpObject(name,obj){
	let out = ""
	for (let key in obj) {
		//out = (out=="") ? (key + ":" + obj[key]) : (out + "," + key + ":" + obj[key]);
		out = (out=="") ? key : out + ", " + key;
	}
	console.log("object " + name + " = " + out);
}
const http = require('http');
const SSDP = require('node-ssdp').Server;
const ip=require("ip");
const URL = require('url');
const querystring = require('querystring');
const noble = require("@abandonware/noble");
const EventEmitter = require("events");


const simpLog = function(typ,obj,newb) {
	console.log(" cnt=" + classCounter + " Constructing a " + typ + " class=" + obj.constructor.name + 
					" target=" + newb + " ssdpUSNPrefix=" + ssdpUSNPrefix + " ssdpUDN=" + ssdpUDN);
}
class Advertiser {
	constructor(staticStuff){
		classCounter++;
		simpLog("Advertiser",this, new.target.name);
		this.httpRequestHandler = this.httpRequestHandler.bind(this);
		this.log = console;
		this.log.info = console.log;
		this.log.warn = console.log;
		this.log.debug = console.log;
	}
	static configure(config) {
		({ssdpUSNPrefix = ssdpUSNPrefix, ssdpUDN = ssdpUDN, portCounter=6000} = config);
		deviceList = {"WifiDeviceHandler":  WifiDeviceHandler, "BTDeviceHandler":  BTDeviceHandler, "ConnectableBTDeviceHandler":  ConnectableBTDeviceHandler};
	}
	processRequest(url,query){
		nCalls++;
		console.log("Did not expect to be here" + " thing=" + this.constructor.name + " # calls=" + nCalls);
	}
	httpRequestHandler(req,resp){
		req.on("error",function(err){
			console.error("smartserver:httpRequestHandler: request onerror:" + err);
			resp.statusCode = 400;
			resp.end();
		})
		resp.on('finish', function(err) {
			//console.error("smartserver:httpRequestHandler: Debug Finish event "+ retProps(err,true) );
		});
		resp.on('error', function(err) {
			console.error("smartserver:httpRequestHandler: response onerror:" + err);
		});
		let url = URL.parse(req.url, true);
		let query = querystring.parse(url.query);
		console.log("DEBUG url=" + JSON.stringify(req.url));
		
		this.processRequest(url,query);
		resp.writeHead(200, {"Content-Type": "application/json"});
		resp.write("I'm here " + " url=" + JSON.stringify(url) + " query=" + JSON.stringify(query));
		resp.end();
	}

}
class BridgeDeviceHandler extends Advertiser{
	constructor(port){
		super();
		this.serverPort = port || 6500;
		this.ssdpUSN = ssdpUSNPrefix + ssdpUDN + ":1";
		simpLog("BridgeDeviceHandler",this, new.target.name);		
	}

	createSSDP(){
		this.SSDPServer = new SSDP({allowWildcards:true,sourcePort:1900,udn: ssdpUDN,
										location:"http://"+ ip.address() + ":" + this.serverPort + '/bridge'
									});
		this.SSDPServer.addUSN(this.ssdpUSN)
		this.SSDPServer.start();
	}
	createHTTPServer(){
		console.log("httpServer running on " + ip.address() + " listening on " + this.serverPort);
		this.httpServer = http.createServer(this.httpRequestHandler)
		this.httpServer.listen(this.serverPort);
	}
}
class DeviceHandler extends Advertiser {
	constructor(type,smartthingsDeviceHandler){
		super();
		this.port = portCounter;
		this.type = "genericDice" || type;
		this.ssdpUSN = ssdpUSNPrefix + type;
		this.smartThingsDeviceHandler = smartthingsDeviceHandler || ""
		portCounter++;
		simpLog("DeviceHandler",this, new.target.name);
	}
	processRequest (url,query){
		console.log("I did want to be here");
	}
	createSSDP(){
		this.SSDPServer = new SSDP({allowWildcards:true,sourcePort:1900,udn: this.uniqueName,
										location:"http://"+ ip.address() + ":" + this.port + 
										'/device?uniqueName=' + this.uniqueName + '&type=' + this.type
									});
		this.SSDPServer.addUSN(ssdpUSN) .addUSN('urn:schemas-upnp-org:device:' + this.type +  ':1');
		this.SSDPServer.start();
	}
	createHTTPServer(){
		console.log("httpServer running on " + ip.address() + " listening on " + this.port);
		this.httpServer = http.createServer(this.httpRequestHandler);
		this.httpServer.listen(this.port);
	}
}
class WifiDeviceHandler extends DeviceHandler {
	constructor(type,smartthingsDeviceHandler){
		super(type,smartthingsDeviceHandler);
		simpLog("WifiDeviceHandler",this, new.target.name);
	}
}
class BTDeviceHandler extends DeviceHandler {
	constructor(type,smartthingsDeviceHandler){
		super(type,smartthingsDeviceHandler);
		this.discoverDevices = this.discoverDevices.bind(this);
		simpLog("BTDeviceHandler",this, new.target.name);
		this.forceDiscovering = null;
		this.restartDelay = 2500;
		this.discoveredPeripherals = {};
		this.powerState = "startUp";
		this.scanState = "off";
		this.startScanningTimer = null;
		this.stopScanningTimer = null;
	}
	configure() {
		noble.on("discover", this.onDiscover.bind(this));
		noble.on("scanStart", this.onScanStart.bind(this));
		noble.on("scanStop", this.onScanStop.bind(this));
		noble.on("warning", this.onWarning.bind(this));
		noble.on("stateChange", this.onStateChange.bind(this));
	}
	discoverDevices(){
		let scanNow = true;
		let devsConnecting = false;
		const deviceValues = Object.values(devices);
		
		deviceValues.forEach( function(item) {
							if (item.status=="BTConnecting") {
								devsConnecting = true;
								scanNow = false;
							}
						});
		console.log("scanNow =" + scanNow + " powerState =" + this.powerState + " scanState =" + this.scanState + " devsConnecting =" + devsConnecting);		
		if (scanNow) {
			if (this.startScanningTimer) {
				this.startScanningTimer = null;
				clearTimeout(this.startScanningTimer)
			}
			if ( (this.powerState=="poweredOn") && (this.scanState=="off") ) {
				this.noble.startScanning([],false);
				clearTimeout(this.stopScanningTimer)
				this.stopScanningTimer = setTimeout(this.scanStop,5000);
			} else {
				this.startScanningTimer = (this.powerState != "poweredOn" ? 2000 : 10000)
				this.startScanningTimer = setTimeout(this.discoverDevices, this.startScanningTimer );
			}
		} else {
				console.log("BluetoothAgent:discoverDevices: Not scanning as devices are still connecting waiting 10sec " + devsConnecting)
				this.startScanningTimer = setTimeout(this.discoverDevices, 10000);
		}
	}
	start() {
		this.log.info("Start scanning.");
		try {
			noble.startScanning([], true);
			this.scanning = true;
		} catch (e) {
			this.scanning = false;
			this.log.error(e);
		}
	}
	stop() {
		this.scanning = false;
		noble.stopScanning();
	}
	onDiscover(peripheral) {
		const { advertisement: { serviceData } = {}, id, address } =
				peripheral || {};

		if (!this.discoveredPeripherals[peripheral.address]) {
			dumpPeripheral(peripheral);
			this.discoveredPeripherals[peripheral.address] = peripheral;
		}
	}
	onScanStart() {
		this.log.debug("Started scanning.");
		this.scanState = "on";
	}
	onScanStop() {
		this.log.info("Stopped scanning.");
		this.scanState = "on";
		if (this.scanning && this.forceDiscovering) {
			setTimeout(() => {
				this.log.debug("Restarting scan.");
				this.start();
			}, this.restartDelay);
		}
	}
	onWarning(message) {
		this.log.info("Warning message =" + message);
	}
	onStateChange(state) {
		if (state === "poweredOn") {
			this.start();
		} else {
			this.log.info(`Stop scanning. (${state})`);
			this.stop();
		}
	}
}
class ConnectableBTDeviceHandler extends BTDeviceHandler {
	constructor(type,smartthingsDeviceHandler){
		super(type,smartthingsDeviceHandler);
		simpLog("ConnectableBTDeviceHandler",this, new.target.name);
	}
}
const DeviceFactory = function(type) {
		if ( (type) && (deviceList[type]) ) {
			console.log("Device Factory doing its thing for " + type);
			return  deviceList[type];
		}
		else {
			console.log("ERROR ERROR " + type)
			return new Device;
		}
	//}
}
function dumpPeripheral(peripheral) {
	// fd6f = apple, feaf nest, fe9f google
	/*
	  advertisement: {
		localName: "<name>",
		txPowerLevel: <int>,
		serviceUuids: ["<service UUID>", ...],
		serviceSolicitationUuid: ["<service solicitation UUID>", ...],
		manufacturerData: <Buffer>,
		serviceData: [
			{
				uuid: "<service UUID>"
				data: <Buffer>
			},
			...
			]
		}
	*/
	let srvs = "";
	peripheral.advertisement.serviceData.forEach( function(item){
		//srvs = (srvs=="") ? JSON.stringify(item) : srvs + ", " + JSON.stringify(item);
		srvs = (srvs=="") ? item.uuid : srvs + ", " + item.uuid;
	});
	
	console.log('peripheral=' + peripheral.id +
			  ' address <' + peripheral.address +  ', ' + peripheral.addressType + '>,' +
			  ' connect? ' + peripheral.connectable + ',' +
			  ' RSSI=' + peripheral.rssi + 
			  ' LocalName=' + peripheral.advertisement.localName
			  );

	/*					
	//peripheral.advertisement.serviceData.find(data => data.uuid.toLowerCase() === SERVICE_DATA_UUID)
	console.log('Advertised services:' + "\t" + JSON.stringify(peripheral.advertisement.serviceUuids) + 'Service Data:' + "\t" + srvs);
	//console.log('Servuce Data:' + "\t" + srvs);
	
	if (peripheral.advertisement.serviceData && peripheral.advertisement.serviceData.length) {
		for (var i in peripheral.advertisement.serviceData) {
			console.log('Service Data:\t' + JSON.stringify(peripheral.advertisement.serviceData[i].uuid) + ': ' + JSON.stringify(peripheral.advertisement.serviceData[i].data.toString('hex')));
		}
	}
	if (peripheral.advertisement.manufacturerData) {
		console.log('Manu:\t' + JSON.stringify(peripheral.advertisement.manufacturerData.toString('hex')));
	}
	if (peripheral.advertisement.txPowerLevel !== undefined) {
		console.log('TX Power:\t' + peripheral.advertisement.txPowerLevel);
	}	
		*/
}

module.exports = {Advertiser,DeviceHandler,WifiDeviceHandler,BTDeviceHandler,ConnectableBTDeviceHandler,DeviceFactory,BridgeDeviceHandler}