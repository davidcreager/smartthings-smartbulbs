#!/usr/bin/env node
'use strict';
const props = require("./newProps")
const advlib = require('advlib-ble');
const LIBRARIES = [ require('advlib-ble-services'),
                    require('advlib-ble-manufacturers') ];
const PROCESSORS = [
    { processor: require('advlib-ble'),
      libraries: [ require('advlib-ble-services'),
                   require('advlib-ble-manufacturers') ],
      options: { ignoreProtocolOverhead: true } }
];
'use strict';
//Sort out server port and device port starting value
let ssdpUSNPrefix = "urn:schemas-upnp-org:device:";
let ssdpUDN = "TestBridge";
let nCalls = 0;
let httpServer = {};
let sspdServers = {};
let ports = {};
let aName = "abc";
let devices = {};
let classCounter=0;
let deviceList = {};
let gAdapter

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
let log = {};
let portCounter;
let serverPort;
class Advertiser extends EventEmitter {
	constructor(staticStuff){
		super();
		classCounter++;
		if (staticStuff) {
			log = staticStuff.log || console;
			portCounter = staticStuff.portCounter || 6000;
			serverPort = staticStuff.serverPort || 6500;
		}
		
		this.httpRequestHandler = this.httpRequestHandler.bind(this);
		//console.log(" staticStuff = " + JSON.stringify(staticStuff));
		if (!log.info) log.info = console.log;
		if (!log.warn) log.warn = console.log;
		if (!log.debug) log.debug = console.log;
		if (!log.error) log.error = console.log;
		//console.log(" log = " + JSON.stringify(log));
		simpLog("Advertiser",this, new.target.name);
	}
								
	static configure(config) {
		({ssdpUSNPrefix = ssdpUSNPrefix, ssdpUDN = ssdpUDN} = config);
		deviceList = {"WifiDeviceHandler":  WifiDeviceHandler, "BTDeviceHandler":  BTDeviceHandler, "ConnectableBTDeviceHandler":  ConnectableBTDeviceHandler};
	}
	processRequest(url,query){
		nCalls++;
		console.log("Advertiser.processRequest Did not expect to be here" + " thing=" + this.constructor.name + " # calls=" + nCalls);
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
		this.ssdpUSN = ssdpUSNPrefix + ssdpUDN + ":1";
		simpLog("BridgeDeviceHandler",this, new.target.name);		
	}

	createSSDP(){
		this.SSDPServer = new SSDP({allowWildcards:true,sourcePort:1900,udn: ssdpUDN,
										location:"http://"+ ip.address() + ":" + serverPort + '/bridge'
									});
		this.SSDPServer.addUSN(this.ssdpUSN)
		this.SSDPServer.start();
	}
	createHTTPServer(){
		log.info("httpServer" , " running on " + ip.address() + " listening on " + serverPort);
		this.httpServer = http.createServer(this.httpRequestHandler)
		this.httpServer.listen(serverPort);
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
		log.info("httpServer" , " running on " + ip.address() + " listening on " + this.port);
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
		this.devices = [];
		simpLog("BTDeviceHandler",this, new.target.name);
		this.discoveredPeripherals = {};
		this.addresses = [];
		//this.addresses = ["2a:cf:4b:16:ac:e6"]; // playbulb sphere PB_Sphere_4
		//this.addresses = ["f8:24:41:c0:51:71"]; // yeelight candela  yeelight_ms
		//this.addresses = ["e5:53:e9:f9:11:37"]; // NO71W
		//this.addresses = ["f8:24:41:e9:0d:18"]; // yeelight bedside XMCTD_

	}
	async getAdapter() {
		if ( (gAdapter=={}) || (!gAdapter) ) {
			log.info("BTDeviceHandler.getAdapter\t Creating Adapter");
			try {
				 const adapt = await bluetooth.defaultAdapter();
				 gAdapter = adapt;
				 return adapt;
				} catch (err) {
					log.error("getAdapater error=" + err);
					throw err;
				}
		} else {
			log.info("BTDeviceHandler.getAdapter\t Adapter Already Exists ");
		}
	}
	dumpDevices(){
		console.log("dumpdevices\t" + this.devices.length + " devices found");
		this.devices.forEach( (dev) => {
			console.log("dumpdevices\t" + JSON.stringify(dev)); /*
			console.log("dumpdevices\t " + dev.alias + " " + dev.name + " adtype=" + dev.adtype)
			console.log("\t\t sdata=" + JSON.stringify(parseAdvData(dev.sdata)));
			console.log("\t\t mdata=" + JSON.stringify(parseAdvData(dev.mdata))); */
			});
	}
	async processDevice(device) {
		let dev = await gAdapter.getDevice(device);
		return Promise.all([
				device,
				dev.getAlias(),
				dev.getAddressType(),
				dev.getName().catch(()=> {return "No Name"}),
				dev.getServiceData().catch( () => {return "no Service Data"}),
				dev.getManufacturerData().catch( () => {return "no Manufacturer Data"})
				])
	}
	async discoverDevices(){
		try {
			if (!gAdapter) {
				log.error("discoverDevices\t adapter not there");
				return null;
			}
			if (! await gAdapter.isDiscovering()) await gAdapter.startDiscovery();
			let devs = await gAdapter.devices();
			let devPromises = devs.map(  (device,ind) => {
				console.log("\t mapping ind=" + ind + " device=" + device);
				const retval = this.processDevice(device); 
				return retval
				});
			console.log("DEBUG devPromises[0]=" + devPromises[0] + "\tJS=" + JSON.stringify(devPromises[0]))
			let resolvedDevPromises = await Promise.all(devPromises).then(); // Resolves the getDevice
			console.log("DEBUG resolvedDevPromises[0]=" + resolvedDevPromises[0] + "\tJS=" + JSON.stringify(resolvedDevPromises[0]))
			this.devices = resolvedDevPromises;
			this.dumpDevices();
			await gAdapter.stopDiscovery();
			return this.devices;
		} catch (err) {
			log.error("discoverDevices error=" + err);
			return null;
		}
	}
}
class XiaomiBTDevice extends BTDeviceHandler {
	constructor(type, smartthingsDeviceHandler, device){
		super(type,smartthingsDeviceHandler);
		simpLog("XiaomiBTDevice",this, new.target.name);
	}
}
class ConnectableBTDeviceHandler extends BTDeviceHandler {
	constructor(type,smartthingsDeviceHandler){
		super(type,smartthingsDeviceHandler);
		simpLog("ConnectableBTDeviceHandler",this, new.target.name);
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
	onNotify(data, isNotify) {
		let packetType = data.toString('hex').substring(2,4);
		log.info("onNotify: isNotify=" + isNotify + " data=" + data.toString("hex"));
		if (packetType == '63') {
			this.writeBTCommand([0x43,0x67,0xde,0xad,0xbe,0xbf,0x00]);
			this.writeBTCommand([0x43,0x40,0x02]);
		}
	}
	onWrite(data) {
		log.info("onWrite data=" + data);
	}
	onConnect(peripheral) {
		console.log("onConnect: " + peripheral.address + " self=" + this.type + " state=" + peripheral.state)
	}
	onDisconnect(peripheral) {
		console.log("onDisconnect - " + peripheral.address + " self=" + this.type)
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

}

module.exports = {Advertiser,DeviceHandler,WifiDeviceHandler,BTDeviceHandler,ConnectableBTDeviceHandler,DeviceFactory,BridgeDeviceHandler}

class BTDevice {
	constructor(type,device){
		this.primaryUUID  = props.type["SERVICE_UUID"];
		this.controlCharacteristicUUID = props.type["COMMAND_CHARACT_UUID"];
		this.notifyCharacteristicUUID = props.type["NOTIFY_CHARACT_UUID"];
		this.device = device;
		this.primaryService = {};
		this.services = {};
		this.characteristics = {};
		this.controlCharacteristic = {};
		this.notifyCharacteristic = {};
		this.isReady =  false;
	}
	async setup() {
		try {
			await this.device.connect();
			const gattServer = await device.gatt();
			this.services = await gattServer.services();
			this.primaryService = await gattServer.getPrimaryService(this.primaryUUID);
			this.characteristics = await this.primaryService.characteristics();
			this.controlCharacteristic = await service.getCharacteristic(this.controlCharacteristicUUID);
			this.notifyCharacteristic = await service.getCharacteristic(this.notifyCharacteristicUUID);
			this.isReady = true;
			return true;
		} catch (error) {
			log.error("BTDevice error in setup " + error);
			return null;
		}

	}
}
function parseAdvData(data) {
	let adv = null;
	if (typeof(data) != "string") {
		for (const uid in data) {
			let arr = Buffer.from(data[uid].value);
			if (adv) {console.log("HELP - adv is not null uid=" + uid + " adv=" + JSON.stringify(adv))};
			adv = advlib.process(arr, PROCESSORS)
		}
	} else {
		adv = data;
	}
	return adv
}	
