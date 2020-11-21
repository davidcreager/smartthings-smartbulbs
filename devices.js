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
const util = require("util");
const http = require('http');
const SSDP = require('node-ssdp').Server;
const ip=require("ip");
const URL = require('url');
const querystring = require('querystring');
const EventEmitter = require("events");

const {createBluetooth} = require('node-ble')
const {bluetooth, destroy} = createBluetooth()


const peripheralAddresses = {"PB_Sphere_4": "2a:cf:4b:16:ac:e6", 
								"yeelight_ms": "f8:24:41:c0:51:71",
								"LYWSD03MMC": "a4:c1:38:f7:92:27",
								"XMCTD_": "f8:24:41:e9:0d:18"};
								
const allAddresses = ["2a:cf:4b:16:ac:e6","f8:24:41:c0:51:71","f8:24:41:e9:0d:18" ];

const simpLog = function(typ,obj,newb) {
	//console.log(" cnt=" + classCounter + " Constructing a " + typ + " class=" + obj.constructor.name + 
	//				" target=" + newb + " ssdpUSNPrefix=" + ssdpUSNPrefix + " ssdpUDN=" + ssdpUDN);
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
		consoleconsole.log("Advertiser.processRequest Did not expect to be here" + " thing=" + this.constructor.name + " # calls=" + nCalls);
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
		console.log("smartserver:httpRequestHandler: url=" + JSON.stringify(req.url));
		
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
		this.type = "genericDevice" || type;
		this.ssdpUSN = ssdpUSNPrefix + type;
		this.smartThingsDeviceHandler = smartthingsDeviceHandler || ""
		portCounter++;
		simpLog("DeviceHandler",this, new.target.name);
	}
	processRequest (url,query){
		console.log("DeviceHandler.processRequest I did want to be here");
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
		this.adapter = {};
		this.devices = {);
		this.macs = [
		
		
		this.discoverDevices = this.discoverDevices.bind(this);
		this.writeBTCommand = this.writeBTCommand.bind(this);
		simpLog("BTDeviceHandler",this, new.target.name);
		this.forceDiscovering = null;
		this.restartDelay = 2500;
		this.discoveredPeripherals = {};
		this.addresses = [];
		//this.addresses = ["2a:cf:4b:16:ac:e6"]; // playbulb sphere PB_Sphere_4
		this.addresses = ["f8:24:41:c0:51:71"]; // yeelight candela  yeelight_ms
		//this.addresses = ["e5:53:e9:f9:11:37"]; // NO71W
		//this.addresses = ["f8:24:41:e9:0d:18"]; // yeelight bedside XMCTD_
		this.chars = [];
		

		//this.periph = {};
		
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
		//console.log("discoverDevices: scanNow =" + scanNow + " powerState =" + this.powerState + " scanState =" + this.scanState + " devsConnecting =" + devsConnecting);		
		process.stdout.write(".");
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
				console.log("discoverDevices: Not scanning as devices are still connecting waiting 10sec " + devsConnecting)
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
	stop(cb) {
		this.scanning = false;
		clearTimeout(this.startScanningTimer)
		noble.stopScanning(cb);
	}
	writeBTCommand(arr) {
		const buff =  Buffer.from(arr.fill(0x00,arr.length,36));
		if (this.chars["COMMAND_CHARACT_UUID"]) {
			console.log("writeBT: char=" + this.chars["COMMAND_CHARACT_UUID"]);
			console.log("writeBT: arr= " + arr + " buff=" + buff.toString("hex"));
			this.chars["COMMAND_CHARACT_UUID"].write(buff,false, (error) => {
					if (error) {
						console.log("writeBT: write error " + error);
					} else {
						console.log("writeBT: write success " + this.chars["COMMAND_CHARACT_UUID"]);
					}
				});
		} else {
			console.log("writeBT: Error write characteristic not set " );
		}
		
	}
	onConnect(peripheral) {
		console.log("onConnect: " + peripheral.address + " self=" + this.type + " state=" + peripheral.state)
		//8e2f0cbd1a664b53ace6b494e25f87bd yeelight
		//peripheral.discoverAllServicesAndCharacteristics(function(error,services) {
		//peripheral.discoverServices([], function(error,services) {
		let self = this;
		peripheral.discoverServices([], function(error,services) {
			if (error) {
				console.log("onConnect: discoverServices error getting services -" + error);
			}
			let srvs = ""
			let infoService = null;
			if (services.length>0) {
				services.forEach( (serv) => {
						srvs = ((srvs=="") ? serv.uuid : srvs + ", " + serv.uuid);
						if (serv.uuid=="fe87") {
							console.log("onConnect:discoverServices - found information service " + serv);
							infoService = serv;
						}
				});
			}
			console.log("onConnect: got #" + services.length + " services " + srvs);
			if (infoService) {
				let tempchars = ['aa7d3f342d4f41e0807f52fbf8cf7443', '8f65073d9f574aaaafea397d19d5bbeb']
				infoService.discoverCharacteristics(tempchars, function(err,chars){
					if (err) {
						console.log("onConnect: discoverCharacteristics error getting characteristic -" + err);
						return;
					}
					console.log("onConnect: discoverCharacteristics " + chars.length + "# chars found [0]=" + chars[0]+ " [1]=" + chars[1]);
					self.chars["COMMAND_CHARACT_UUID"] = chars[0];
					self.chars["NOTIFY_CHARACT_UUID"] = chars[1];
					self.chars["NOTIFY_CHARACT_UUID"].on("data", self.onNotify.bind(self));
					self.chars["NOTIFY_CHARACT_UUID"].once("read",self.onNotify.bind(self));
					self.chars["COMMAND_CHARACT_UUID"].once("write",self.onWrite.bind(self));
					self.chars["NOTIFY_CHARACT_UUID"].subscribe( (error, data) => {
								if (error) {
									console.log("onConnect:discoverServices Error in subscribe " + error);
								} else {
									console.log("onConnect:discoverServices Debug in subscribe function " + error + " data=" + data);
								}
								self.chars["COMMAND_CHARACT_UUID"].once("write", () => {
										self.onWrite.bind(self,chars[1])
									});
								self.writeBTCommand([0x43,0x67,0xde,0xad,0xbe,0xbf,0x00]);
							});					
				});
			} else {
				console.log("onConnect: discoverCharacteristics infoservice not set");
			}
		}); // */
		
		/* peripheral.discoverServices(['8e2f0cbd1a664b53ace6b494e25f87bd'], function(error,services) {
			console.log("onConnect: in on discovering infoService");
			if (error) {
				console.log("onConnect:discoverServices error " + error);
				return null;
			} else {
				console.log("onConnect:discoverServices " + services.length + " found [0] is " + services[0] );
			}
			let infoService = services[0];
			let tempchars = ['aa7d3f342d4f41e0807f52fbf8cf7443', '8f65073d9f574aaaafea397d19d5bbeb']
			infoService.discoverCharacteristics(tempchars, function(err,chars){
				if (err) {
					console.log("onConnect: discoverCharacteristics error getting characteristic -" + err);
					return;
				}
				console.log("onConnect: discoverCharacteristics " + chars.length + "# chars found [0]=" + chars[0]+ " [1]=" + chars[1]);
				self.chars["COMMAND_CHARACT_UUID"] = chars[0];
				self.chars["NOTIFY_CHARACT_UUID"] = chars[1];
				self.chars["NOTIFY_CHARACT_UUID"].on("data", (data, isNotify) => {
							self.onNotify.bind(self, data, isNotify,chars[1])
							});
				self.chars["NOTIFY_CHARACT_UUID"].once("read", (data, isNotify) => {
							self.onNotify.bind(self, data, isNotify,chars[1])
							});
				self.chars["COMMAND_CHARACT_UUID"].once("write", () => {
							self.onWrite.bind(self,chars[1])
							});
				//self.writeBTCommand([0x43,0x67,0xde,0xad,0xbe,0xbf,0x00]);
				chars[1].subscribe( (error, data) => {
							if (error) {
								console.log("onConnect:discoverServices Error in subscribe " + error);
							} else {
								console.log("onConnect:discoverServices Debug in subscribe function " + error + " data=" + data);
							}
						});
					});
			if (error) {
				console.log("onConnect: Discover error in infoservice discovery");
				return null;
			}
			//Discoverservices #=7 , 1801, 1800, 00001016d10211e19b2300025b00a5a5, ff0f, 180f, fef1, 180a - playbulb
			//Discoverservices #=4 , 1800, 180a, 000102030405060708090a0b0c0d1910, fe87 - candela
			let srvs="";
			services.forEach( (srv) => srvs = (srvs="" ? srv.uuid : srvs + ", " + srv.uuid) );
			console.log("onConnect: Discoverservices infoservice #=" + services.length + " " + srvs);
			return services;
		}); // */
	}
	onDisconnect(peripheral) {
		console.log("onDisconnect - " + peripheral.address + " self=" + this.type)
	}
	onDiscover(peripheral) {
		//this.periph = peripheral;
		//console.log("onDiscover - " + peripheral.address + " self=" + this.type + " state=" + peripheral.state)
		const { advertisement: { serviceData } = {}, id, address } =
				peripheral || {};
		if (peripheral.state=="connected") {
			console.log("onDiscover: disconnecting " + peripheral.address);
			peripheral.disconnect();
		}
		if (!this.discoveredPeripherals[peripheral.address]) {
			console.log("onDiscover - " + peripheral.address + " self=" + this.type + 
						" name=" + peripheral.advertisement.localName + " state=" + peripheral.state)
			if (this.addresses.includes(peripheral.address)) {
				console.log("onDiscover: Address found");
				dumpPeripheral(peripheral);
				peripheral.once('disconnect',this.onDisconnect.bind(this, peripheral));
				peripheral.once('connect',this.onConnect.bind(this, peripheral));
				console.log("onDiscover: about to try connecting");
				//this.noble.reset();
				this.stop(() => {
					peripheral.connect( function( error ) {
						if (error) {
							console.log("onDiscover: Connect error");s
							return null;
						}
						console.log("onDiscover: Connected - address=" + peripheral.address + " state= " + peripheral.state);
					}); // */
				});
			} else if (this.addresses.length==0) {
				dumpPeripheral(peripheral);
			}
			this.discoveredPeripherals[peripheral.address] = peripheral;
		}
	}
	onScanStart() {
		this.log.debug("onScanStart - Started scanning.");
		this.scanState = "on";
	}
	onScanStop() {
		this.log.info("onScanStop - Stopped scanning.");
		this.scanState = "off";
		if (this.scanning && this.forceDiscovering) {
			setTimeout(() => {
				this.log.debug("Restarting scan.");
				this.start();
			}, this.restartDelay);
		}
	}
	onWarning(message) {
		this.log.info("onWarning - Warning message =" + message);
	}
	onNotify(data, isNotify) {
		let packetType = data.toString('hex').substring(2,4);
		console.log('onNotify: DEBUG : (packet type)' + packetType);
		this.log.info("onNotify: isNotify=" + isNotify + " data=" + data.toString("hex"));
		if (packetType == '63') {
			this.writeBTCommand([0x43,0x67,0xde,0xad,0xbe,0xbf,0x00]);
			this.writeBTCommand([0x43,0x40,0x02]);
		}
	}
	onWrite(data) {
		this.log.info("onWrite data=" + data);
	}
	onStateChange(state) {
		if (state === "poweredOn") {
			this.start();
		} else {
			this.log.info(`onStateChange - Stop scanning. (${state})`);
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
			console.log("DeviceFactory: Device Factory doing its thing for " + type);
			return  deviceList[type];
		}
		else {
			console.log("DeviceFactory: ERROR ERROR " + type)
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
	let mData = ((peripheral.advertisement.manufacturerData) ? peripheral.advertisement.manufacturerData.toString('hex') : "none")
	console.log('peripheral=' + peripheral.id +
			  ' address <' + peripheral.address +  ', ' + peripheral.addressType + '>,' +
			  ' connect? ' + peripheral.connectable + ',' +
			  ' RSSI=' + peripheral.rssi + 
			  ' LocalName=' + peripheral.advertisement.localName +
			  ' Manudata=' + mData
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
	
	this.yeeServices = [];
	this.btBaseUUID = "xxxxxxxx-0000-1000-8000-00805F9B34FB"
	this.yeeCharacteristics = [	{id:"aa7d3f342d4f41e0807f52fbf8cf7443", type:"ReadWrite"},
								{id:"8f65073d9f574aaaafea397d19d5bbeb", type:"Notify"} ];
	this.yeeCommands = [	{name:"on", code:[0x43,0x40,0x01]},
							{name:"off", code:[0x43,0x40,0x02]},
							{name:"setBright", code:[0x43,0x40,0x00]},
							{name:"setColor", code:[0x43,0x41,0x02,0x00,0x00,0xFF,0x65]},
							{name:"setCT", code:[0x43,0x43,0x00,0x00,0x00]},
							{name:"auth", code:[0x43,0x67,0xDE,0xAD,0xBE,0xBF]},
							{name:"status", code:[0x43,0x44,0x00,0x00,0x00]},
							{name:"temperature", code:[0x43,0x43,0x00,0x00,0x00]},
							{name:"rgb", code:[0x43,0x41,0x00,0x00,0x00]},
							{name:"pair", code:[0x43,0x67,0x02,0x00,0x00]},
							{name:"name", code:[0x43,0x52,0x00,0x00,0x00]},
							{name:"disconnect", code:[0x43,0x68,0x00,0x00,0x00]},
							{name:"stats", code:[0x43,0x8C,0x00,0x00,0x00]} ]
	this.playbulbCharacteristics = [ {serviceUUID: "ff02", charUUID: "fffc", type:"Current Color"},
									{serviceUUID: "ff02", charUUID: "ffff", type:"Candle Name"},
									{serviceUUID: "ff02", charUUID: "fffb", type:"Candle Name"},
									{serviceUUID: "180f", charUUID: "2a19", type:"batteryLevel"} ];
	this.playbulbUUIDs = 			[ 	{name:"DEVICE_INFORMATION_UUID",uuid:"180a"},
										{name:"SYSTEM_ID_UUID",uuid:"2a23"},
										{name:"MODEL_NUMBER_UUID",uuid:""},
										{name:"SERIAL_NUMBER_UUID",uuid:""},
										{name:"FIRMWARE_REVISION_UUID",uuid:""},
										{name:"HARDWARE_REVISION_UUID",uuid:""},
										{name:"SOFTWARE_REVISION_UUID",uuid:"2a28"},
										{name:"MANUFACTURER_NAME_UUID",uuid:"2a29"} ];
									['aa7d3f342d4f41e0807f52fbf8cf7443', '8f65073d9f574aaaafea397d19d5bbeb']
	this.yeebtUUIDs = 			[ 	{name:"COMMAND_CHARACT_UUID",uuid:"180a"},
									{name:"COMMAND_CHARACT_UUID",uuid:"0xaa7d3f342d4f41e0807f52fbf8cf7443"},
									{name:"SERVICE_UUID",uuid:"0x8e2f0cbd1a664b53ace6b494e25f87bd"},
									{name:"NOTIFY_CHARACT_UUID",uuid:"0x8f65073d9f574aaaafea397d19d5bbeb"} ];
	this.candela = 			[ 	{name:"COMMAND_CHARACT_UUID",uuid:"180a"},
									{name:"COMMAND_CHARACT_UUID",uuid:"0xaa7d3f342d4f41e0807f52fbf8cf7443"},
									{name:"SERVICE_UUID",uuid:"fe87"},
									{name:"NOTIFY_CHARACT_UUID",uuid:"0x8f65073d9f574aaaafea397d19d5bbeb"} ];
	
		*/
}

module.exports = {Advertiser,DeviceHandler,WifiDeviceHandler,BTDeviceHandler,ConnectableBTDeviceHandler,DeviceFactory,BridgeDeviceHandler}