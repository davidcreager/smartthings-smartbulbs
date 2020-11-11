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
const simpLog = function(typ,obj,newb) {
	console.log(" cnt=" + classCounter + " Constructing a " + typ + " class=" + obj.constructor.name + 
					" target=" + newb + " ssdpUSNPrefix=" + ssdpUSNPrefix + " ssdpUDN=" + ssdpUDN);
}
class Advertiser {
	constructor(staticStuff){
		classCounter++;
		simpLog("Advertiser",this, new.target.name);
		this.httpRequestHandler = this.httpRequestHandler.bind(this);
	}
	static configure(config) {
		({ssdpUSNPrefix = ssdpUSNPrefix, ssdpUDN = ssdpUDN, portCounter=6000} = config);
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
class BridgeDevice extends Advertiser{
	constructor(port){
		super();
		this.serverPort = port || 6500;
		this.ssdpUSN = ssdpUSNPrefix + ssdpUDN + ":1";
		simpLog("BridgeDevice",this, new.target.name);		
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
class Device extends Advertiser {
	constructor(type){
		super();
		this.port = portCounter;
		this.type = "genericDice" || type;
		this.ssdpUSN = ssdpUSNPrefix + type;
		portCounter++;
		simpLog("Device",this, new.target.name);
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
class WifiDevice extends Device {
	constructor(){
		super();
		simpLog("WifiDevice",this, new.target.name);
	}
}
class BTDevice extends Device {
	constructor(){
		super();
		simpLog("BTDevice",this, new.target.name);		
	}
}
class ConnectableBTDevice extends BTDevice {
	constructor(){
		super();
		simpLog("ConnectableBTDevice",this, new.target.name);
	}
}

let deviceList = {"WifiDevice":  WifiDevice, "BTDevice":  BTDevice, "ConnectableBTDevice":  ConnectableBTDevice};
// class DeviceFactory = {
const DeviceFactory = function(type) {
	//constructor(type) {
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

module.exports = {Advertiser,Device,WifiDevice,BTDevice,ConnectableBTDevice,DeviceFactory,BridgeDevice}