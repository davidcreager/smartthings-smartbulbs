#!/usr/bin/env node
'use strict';
var COLORS=require("color-convert")
var http = require('http');
var URL = require('url');
var ip=require("ip")
var UUID = require('uuid/v1')
var async=require("async")
var SSDP = require('node-ssdp').Server
const querystring = require('querystring');
var properties = require("./properties.json");
const https = require('https');
var gTEST = false;
(function () {
	var tmp="";
	var enabledTypes = []
	process.argv.forEach((val, index) => {
		tmp == "" ? tmp = index + ":" + val : tmp = tmp + "," + index + ":" + val
		if (index > 1) {
			if (val=="TEST") {
				gTEST = true;
			} else {
				enabledTypes[index-2] = val;
			}
		}
	});

	//console.log("smartbulbserver: input arguments are " + tmp + " enabledtypes (overriding properties.json)=" + enabledTypes);
})();
var smartSubscribers = {};
var subscriptionStack = [];
var smartSSDs = {};
var smartPorts = {};
var smartConfigs = {};
var smartDevices = {};
var handleAgentEvents = {};
var servers = {};
var responseStack = {};
var BTResponsesByDevices = {}
var responseObjectStack = {};
var responseUniqueNameStack = {};
var responsePromises = [];
var smartSids = {};
var sid = UUID();
var commandSeq = 1 + (Math.random() * 1e3) & 0xff;
const G_serverPort = properties.ServerPort
var devicePortCounter = properties.DevicePortStart


var G_deviceProperties = ( function() {
	var fs = require("fs");
	var fName = "deviceProperties.json";
	var data = JSON.stringify({});
	try {
		data = fs.readFileSync(fName, "utf8");
	} catch(err) {
		if (err.code === 'ENOENT') {
			console.log("smartbulbserver:G_DeviceProperties: File " + fName + " Not Found - Initialising");
			try {
				fs.writeFileSync(fName, data)
			} catch (exc) {
				console.log("smartbulbserver:G_DeviceProperties: File " + fName + " exception initialising error=" + exc);
				return null;
			}
			console.log("smartbulbserver:G_DeviceProperties: File " + fName + " File has been created");
		} else {
			console.log("smartbulbserver:G_DeviceProperties: exception reading " + fName + " error=" + err);
			return null;
		}		
	}
	try {
		return  JSON.parse(data);
	} catch (exc) {
		console.log("smartbulbserver:G_DeviceProperties: exception parsing json " + fName + " data=" + data + " exception=" + exc);
		return null;
	}
})();
console.log("smartbulbserver:G_DeviceProperties=" + JSON.stringify(G_deviceProperties));
if (gTEST){
	console.log("Trying to get ssdps")
	var SSDPClient = require('node-ssdp').Client;
	var client = new SSDPClient({ allowWildcards:false});
	var searchString = 'urn:schemas-upnp-org:device*';
    client.on('response', function (response) {
		if (response.ST == searchString)
		console.log("response st=" + response.ST + " location=" + response.LOCATION +"\t usn=" + response.USN )
		});
	client.on('notify', function () {
	  console.log('Got a notification.')
	})
    // search for a service type
    //client.search('urn:schemas-upnp-org:device:SmartBridge*');
	//"urn:schemas-upnp-org:device:SmartBridge:1"
	//client.search("schemas-upnp-org:device:SmartBridge:1");
	//client.search('schemas-upnp-org:device:Smart*');
	//client.search('urn:schemas-upnp-org:device:RFXDevice:1')
	//urn:schemas-upnp-org:device
	client.search(searchString);
	//client.search('urn:');
} else {
	var	smartBridgeSSDP = new SSDP({allowWildcards:true,sourcePort:1900,udn: properties.ssdpUDN, 
						location:"http://"+ ip.address() + ":" + G_serverPort + '/bridge'})
		smartBridgeSSDP.addUSN(properties.ssdpUSN)
		smartBridgeSSDP.start();
		console.log("smartbulbserver: Starting SSDP Annoucements for Bridge " + 
				" location=" +  "http://"+ ip.address() + ":" + G_serverPort + '/bridge'
				+ " usn=" + properties.ssdpUSN + " udn=" + properties.ssdpUDN);
	servers[G_serverPort] = http.createServer(httpRequestHandler);
	servers[G_serverPort].listen(G_serverPort)
	var G_enabledTypes = ( function () {
		var type;
		var enabledTypes = []
		var stringOfPossibleTypes="";
		for (let i0 in properties.bridgeEnabledTypes) {
			stringOfPossibleTypes = (stringOfPossibleTypes=="" ? i0 : stringOfPossibleTypes + " or " + i0)
		}
		process.argv.forEach((val, index) => {
			if (index > 1) {
				if (val=="TEST") {
					gTEST = true;
					console.log("smartbulbserver: setting TEST MODE")
				} else {
					enabledTypes.push(val);
					if (  (!properties.bridgeEnabledTypes[val]) ) {
						console.log("\nINPUT ERROR - type does not exist should be " + stringOfPossibleTypes)
						throw "invalid input argument";
					}
				}
			}
		});
		if (enabledTypes.length==0) {
			for (type in properties.bridgeEnabledTypes) {
				if (properties.bridgeEnabledTypes[type].enabled) {
					enabledTypes.push(type);
				}
			}
		} 
		return enabledTypes;
	})();	

	var G_agents = (function () {
		var type;
		var tmpTypeDetails;
		var agents = {};
		for (type in properties.bridgeEnabledTypes) {
			tmpTypeDetails = properties.bridgeEnabledTypes[type];
			if ( G_enabledTypes.includes(type) )  {
				if (agents[tmpTypeDetails.agent]) {
					console.log("smartbulbserver: " + "Working for " + type  + " agent is " + tmpTypeDetails.agent + " already running")
				} else {
					if (tmpTypeDetails.agent == "YeeAgent") {
						agents[tmpTypeDetails.agent] = new require("./YeeWifiAgent").YeeAgent(handleAgentEvents);
						console.log("smartbulbserver: " + "Working for " + type  + " agent started " + tmpTypeDetails.agent );
						agents[tmpTypeDetails.agent].discoverDevices();
					} else if  (tmpTypeDetails.agent == "MiAgent")  {
						agents[tmpTypeDetails.agent] = new require("./MiAgent").MiAgent(handleAgentEvents);
						console.log("smartbulbserver: " + "Working for " + type  + " agent started " + tmpTypeDetails.agent );
						agents[tmpTypeDetails.agent].discoverDevices();
					} else if  (tmpTypeDetails.agent == "BluetoothAgent")  {
						agents[tmpTypeDetails.agent] = new require("./BluetoothAgent").BluetoothAgent(handleAgentEvents);
						console.log("smartbulbserver: " + "Working for " + type  + " agent started " + tmpTypeDetails.agent );
						agents[tmpTypeDetails.agent].discoverDevices();
					} else if  (tmpTypeDetails.agent == "FindIphone")  {
						agents[tmpTypeDetails.agent] = new require("./FindIphone").FindIphone(handleAgentEvents);
						console.log("smartbulbserver: " + "Working for " + type  + " agent started " + tmpTypeDetails.agent );
						agents[tmpTypeDetails.agent].discoverDevices();
					} else if  (tmpTypeDetails.agent == "RFXAgent")  {
						agents[tmpTypeDetails.agent] = new require("./RFXAgent").RFXAgent(handleAgentEvents);
						console.log("smartbulbserver: " + "Working for " + type  + " agent started " + tmpTypeDetails.agent );
						agents[tmpTypeDetails.agent].discoverDevices();
					} else {
						console.log("smartbulbserver: " + " Unsupported agent NOT working for " + type  + " agent is " + tmpTypeDetails.agent)
					}
				}
			} else {
				console.log("smartbulbserver: " + "NOT working for " + type  + " agent is " + tmpTypeDetails.agent)
			}
		}
		return agents;
	})();
}
handleAgentEvents.BTDisconnect = function(peripheral, device) {
		console.log("smartbulbserver: Disconnect received for " + device.friendlyName + " peripheral name=" + peripheral.advertisement.localName);
		/*
		NOTIFY / HTTP/1.1
		HOST: 192.168.1.1:3000
		CONTENT-TYPE: text/xml; charset="utf-8"
		CONTENT-LENGTH: 212
		NT: upnp:event
		NTS: upnp:propchange
		SID: uuid:7206f5ac-1dd2-11b2-80f3-e76de858414e
		SEQ: 0
		<e:propertyset xmlns:e="urn:schemas-upnp-org:event-1-0">
		  <e:property>
			<BinaryState>0</BinaryState>
		  </e:property>
		</e:propertyset>
		*/
}.bind(this);

handleAgentEvents.manageSubscriptions = function() {
	if (subscriptionStack.length > 0) {
		if (!subscriptionStack[subscriptionStack.length-1].done) {
			//console.log("smartbulbserver:manageSubscriptions: subscriptionStack has " + subscriptionStack.length + " entries");
			var subscriptionBeingProcessed = subscriptionStack.pop();
			var cmd = JSON.stringify({"value": subscriptionBeingProcessed.value,
								"device": subscriptionBeingProcessed.device
							});
			var req = http.request(subscriptionBeingProcessed.options, function(resp) {
				var body = "";
				if (resp.statusCode != 200) {
					console.log("smartbulbserver:manageSubscriptions: request sent ERROR response status=" + resp.statusCode);
				}
				resp.setEncoding("utf8");
				resp.on("data", function(chunk) {
							body  = body + chunk;
						});
				resp.on("end", function(chunk) {
							subscriptionBeingProcessed.done=true;
						});
				resp.on("error", function(chunk) {
							console.log("smartbulbserver:manageSubscriptions: DEBUG - error received ");
						});
			});
			req.write("<e:propertyset xmlns:e=\"urn:schemas-upnp-org:event-1-0\">");
			req.write("<e:property>");
			req.write("<command>" + cmd + "</command>" )						
			req.write("</e:property>");
			req.write("</e:propertyset>");
			req.end();
		}
	}
	setTimeout(handleAgentEvents.manageSubscriptions,1500);
};

//execute first time
handleAgentEvents.manageSubscriptions();

handleAgentEvents.BTNotify = function(device, value, ind) {
	console.log("smartbulbserver: Notify received for " + device.uniqueName +  " value=" + JSON.stringify(value));
	if (device) {
		if (BTResponsesByDevices[device.uniqueName]) {
			var req
			for (req in BTResponsesByDevices[device.uniqueName].requests) {
				//retObj = {"uniqueName": device.uniqueName, "method":"set_bright", "params": {"value": [url.query.value]}}
				var cmd;
				var cmds=[];
				var rgb={};
				for (cmd in value) {
					if (cmd == "red" || cmd == "green" || cmd == "blue") {
						rgb[cmd] = value[cmd];
					} else if ( cmd == "bright") {
						cmds.push({method: "set_bright", params: {value: value.cmd}});
					} else if ( cmd == "ctx") {
						cmds.push({method: "set_ctx", params: {value: value.cmd}});
					} else if ( cmd == "power") {
						cmds.push({method: "set_power", params: {value: value.cmd}});
					}
				}
				if (rgb.red != undefined) {
					var hex = COLORS.rgb.hex([rgb.red,rgb.green,rgb.blue])
					cmds.push({method: "set_rgb", stColor: {hex: hex}, params: {value: hex}});
				}
				BTResponsesByDevices[device.uniqueName].requests[req].writeHead(200, {"Content-Type": "application/json"});
				BTResponsesByDevices[device.uniqueName].requests[req].write(JSON.stringify(
								{"uniqueName": device.uniqueName, "method": "get_props", params: cmds}));
				BTResponsesByDevices[device.uniqueName].requests[req].end();
			}
		}
		if (smartSubscribers[device.uniqueName]) {
			var subscriber;
			for (subscriber in smartSubscribers[device.uniqueName]) {
				if (!smartSubscribers[device.uniqueName][subscriber].seq) {
					smartSubscribers[device.uniqueName][subscriber].seq = 1;
				};
				var subscriberDeets = smartSubscribers[device.uniqueName][subscriber];
				var reqOptions = {hostname:subscriber, port: subscriberDeets.port, path: subscriberDeets.path, method: "NOTIFY",
									headers:{"Content-Type": "text/xml",
												"DATE": new Date().toUTCString(),
												"SERVER": "OS/version UPnP/1.1 product/version",
												//"HOST": ip.address() + ":" + smartPorts[device.uniqueName],
												"HOST": ip.address() + ":" + G_serverPort,
												"NT": "upnp:event",
												"NTS": "upnp:propchange",
												"SID": "uuid:" + subscriberDeets.sid,
												"SEQ": subscriberDeets.seq
										}
									}; 			
				subscriptionStack.push({"options": reqOptions, "done": false, "value": value, "device": device.uniqueName});
				//console.log("smartbulbserver:BTNotify: Processing subscriber " + subscriber + " port=" + subscriberDeets.port + 
				//									" seq=" + subscriberDeets.seq + " sid=" + "uuid:" + subscriberDeets.sid +
				//									" path=" + subscriberDeets.path +
				//									" host=" + ip.address() + ":" + G_serverPort );
				//console.log("smartbulbserver:BTNotify: subscriptionStack has " + subscriptionStack.length + " entries");
				subscriberDeets.seq++;
			}
		} else {
			console.log("smartbulbserver: No subscriptions for " + device.friendlyName + " value=" + value);
		}
	} else {
		console.log("smartbulbserver:BTNotify: Null device received");
	}
	
}.bind(this);
handleAgentEvents.onDevFound = function(device, type, name, uniqueName, agent) {
	//console.log("smartbulbserver:handleAgentEvents:onDevFound: device.did = " + device.did + " type=" + type + " name=" + name + " uniqueName=" + uniqueName)
	if (device) {
		if (!smartSSDs[uniqueName]) {
			if (!servers[devicePortCounter]) {
				servers[devicePortCounter]=http.createServer(httpRequestHandler);
				servers[devicePortCounter].listen(devicePortCounter)
				//console.log("smartbulbserver: Created server for " + device.friendlyName + " IP:PORT=" + ip.address() + ":" + devicePortCounter + 
				//								" unique=" + device.uniqueName + " type=" + type );
			} else {
				console.log("smartbulbserver:handleAgentEvents:onDevFound: Weird server already exists")
			}
			smartSSDs[device.uniqueName] = new SSDP({allowWildcards:true,sourcePort:1900,udn:device.uniqueName,
						location:"http://"+ ip.address() + ":" + devicePortCounter +
						'/light?' + "uniqueName="+ device.uniqueName +
						'&type=' + type
						});
			smartSSDs[device.uniqueName].addUSN('urn:schemas-upnp-org:device:' + type +  ':1');
			console.log("smartbulbserver: Starting SSDP Annoucements for " + device.friendlyName + " location=" + smartSSDs[device.uniqueName]._location);
			smartSSDs[device.uniqueName].start();
			smartConfigs[device.uniqueName]= Object.assign({}, properties[type].Configs);
			smartPorts[device.uniqueName] = devicePortCounter;
			smartSids[device.uniqueName] = UUID();
			smartDevices[device.uniqueName] = device;
			devicePortCounter++;
		} else {
			console.log("smartbulbserver:handleAgentEvents:onDevFound: Device already exists "+device.uniqueName)
		}
	} else {
		console.log("smartbulbserver:handleAgentEvents:onDevFound: Weird!   Device found is null")
	}
};
handleAgentEvents.onDevConnected = function(device){
		console.log("smartbulbserver:handleAgentEvents:onDevConnected: host:port=" + device.host + ":" + device.port + " " + device.did + 
					" model=" + device.model + " bright:hue:sat=" + device.bright + ":" + device.hue + ":" + device.sat)	
}
handleAgentEvents.onDevDisconnected = function(device){
		console.log("smartbulbserver:handleAgentEvents:onDevDisconnected: host:port=" + device.host + ":" + device.port + " " + device.did + 
					" model=" + device.model + " bright:hue:sat=" + device.bright + ":" + device.hue + ":" + device.sat)
};
handleAgentEvents.onDevPropChange = function(device, val){
	if (val.type == "response") {
		console.log("smartbulbserver:onDevPropChange: response " + device.did + " ind=" + val.id + "result type=" + typeof(val.result) + " val: " + JSON.stringify(val));
		if (val.id){
			if (responseStack[val.id]) {
				if (val.error) {
					responseStack[val.id].writeHead(506, {"Content-Type": "application/json"});
					responseStack[val.id].write(JSON.stringify(val.error));
					console.log("smartbulbserver:onDevPropChange: Result NOT OK result=" + val.result + " error=" + JSON.stringify(val.error));
				} else if (val.result) {
					if (val.result.length == 1 && val.result[0] == "ok") {
						responseStack[val.id].write(JSON.stringify(responseObjectStack[val.id]));
						responseStack[val.id].end();
					} else {
						var res = {};
						for (var index in properties[device.smartType]["getProps"]) {
							//console.log("DEBUG: index=" + index + " property=" + properties[device.smartType]["getProps"][index] + " result=" + val.result[index])
							if (val.result[index]) {
								res[properties[index]]=val.result[index]
							} else {
								res[properties[index]]=null
							}
						}
						responseStack[val.id].writeHead(200, {"Content-Type": "application/json"}); //application/json
						responseStack[val.id].write(JSON.stringify({"uniqueName":responseUniqueNameStack[val.id],"method":"get_props",
																"params":res}))							
						responseStack[val.id].end();
					}
				} else {
					responseStack[val.id].end();
					console.log("smartbulbserver:onDevPropChange: Invalid Response result=" + val.result + " error=" + JSON.stringify(val.error));
				}
				responseStack[val.id] = null
				responseObjectStack[val.id] = null
			} else {
				console.log("smartbulbserver:onDevPropChange: " + device.did + " " + device.friendlyName + " request not found for response " + val.id);
				return;
			}
		} else {
			console.log("smartbulbserver:onDevPropChange: " + device.did + " " + device.friendlyName + " request index not set " + val.id);
		}
	} else if (val.type == "notification") {
		console.log("smartbulbserver:onDevPropChange: notification " + device.did + " val: " + JSON.stringify(val));
	} else {
		console.log("smartbulbserver:onDevPropChange: " + device.did + " " + device.friendlyName + " type not notification or response " + val.type);
	}

};

function httpRequestHandler(req,resp) {
	req.on("error",function(err){
		console.error("smartbulbserver:httpRequestHandler: request onerror:"+err);
		resp.statusCode = 400;
		resp.end();
	})
	resp.on('finish', function(err) {
		//console.error("smartbulbserver:httpRequestHandler: Debug Finish event "+ retProps(err,true) );
	});
	resp.on('error', function(err) {
		console.error("smartbulbserver:httpRequestHandler: response onerror:" + err);
	});
	function writeDiscoveryResp(resp, TypeOrBridgeName, uniqueName, friendlyName, ipAddress, port, othTags, sDevices, managedDevices  ) {
				resp.writeHead(200, {"Content-Type": "text/xml"});
				resp.write("<?xml version=\"1.0\"?> ");
				resp.write("<root xmlns=\"urn:schemas-upnp-org:device:" + TypeOrBridgeName + ":1\">");
				resp.write("<device>");
				resp.write("<deviceType>urn:schemas-upnp-org:device:" + TypeOrBridgeName + ":1</deviceType>");
				resp.write("<friendlyName>" + friendlyName + "</friendlyName>");
				resp.write("<uniqueName>" + uniqueName + "</uniqueName>");
				resp.write("<UDN>" + uniqueName + "</UDN>");
				resp.write("<IP>" + ipAddress + "</IP>");
				resp.write("<port>" + port + "</port>");										
				for (const prop in othTags) {
						resp.write("<" + prop + ">" + othTags[prop] + "</" + prop + ">")
				}
				if (sDevices) {
					resp.write("<supportedDevices>");
					resp.write(JSON.stringify(sDevices))
					resp.write("</supportedDevices>")
				}//sSmartDevices
				if (managedDevices) {
					resp.write("<managedDevices>");
					resp.write(JSON.stringify(managedDevices))
					resp.write("</managedDevices>")
				}
				resp.write("</device>");
				resp.write("</root>");
				resp.end();
	}
	var url = URL.parse(req.url, true);
	var query = querystring.parse(url.query);
	var smartDevice;
	console.log("smartbulbserver:httpRequestHandler: Received Request pathname=" + url.pathname  + " from:" + req.connection.remoteAddress + 
						" query=" + JSON.stringify(url.query))

	if (url.pathname == "/bridge") {
		var sDevices = [];
		G_enabledTypes.forEach( (val,index) => {
			sDevices.push( {"usn":'urn:schemas-upnp-org:device:' + val +  ':1'
							, "type": val
							, "discoverString": "lan discovery urn:schemas-upnp-org:device:" + val + ":1"})
		});
		var managedDevices = [];
		var dni;
		var key;
		for (key in smartDevices) {
			dni = ip.toLong(ip.address()).toString(16) + smartPorts[smartDevices[key].uniqueName].toString(16);
			//console.log("DEBUG DNIs " + smartDevices[key].uniqueName + " ip:port=" + ip.address() + ":" + smartPorts[smartDevices[key].uniqueName] + " dni=" + dni + " iphex="+ip.toLong(ip.address()).toString(16) + " portHex=" + smartPorts[smartDevices[key].uniqueName].toString(16) );
			managedDevices.push({"dni": dni.toUpperCase(), uniqueName: smartDevices[key].uniqueName})
		}
		writeDiscoveryResp(resp, properties.ssdpUDN, properties.ssdpUDN, properties.ssdpUDN, ip.address(), G_serverPort, null, sDevices,managedDevices )
		//console.log("smartbulbserver:httpRequestHandler: Responded to /bridge devName=" + "PlayBridge-Pi" + " # devices=" + playbulbAgent.btDevices.length)
	} else {
		if ( (url.query) && (url.query.uniqueName) ) {
			smartDevice = smartDevices[url.query.uniqueName]
			var retObj = {"uniqueName": smartDevice.uniqueName}
			if (smartDevice) {
				if (url.pathname == "/subscription") {
			//TODO sort this out
					//var callbck = req.headers.callback
					var callbck=URL.parse(req.headers.callback.substring(1,req.headers.callback.length-1), true,true);
					//console.log("DEBUG: host=" + callbck.hostname + " port=" + callbck.port + " pathname=" + callbck.pathname + 
					//					" callback=" + req.headers.callback.substring(1,req.headers.callback.length-1) );
					smartSubscribers[smartDevice.uniqueName] = {};
					smartSubscribers[smartDevice.uniqueName][callbck.hostname] = {"sid": sid,
																"seq": 5,
																"hostname":callbck.hostname,
																"port":callbck.port,
																"path": callbck.pathname
																};
					console.log("smartbulbserver: subscription host=" + callbck.hostname + " path=" + callbck.pathname + " port=" + callbck.port +
								" sid=" + sid + " substr=" + req.headers.callback.substring(1,req.headers.callback.length-1))
					resp.setHeader("DATE",new Date().toUTCString())
					resp.setHeader("SERVER","OS/version UPnP/1.1 product/version");
					resp.setHeader("SID","uuid:" + sid);
					resp.setHeader('CONTENT-LENGTH',0);
					resp.setHeader("TIMEOUT",3600);
					resp.end();
				} else if (url.pathname == "/light") {
					var oTags = {modelType: smartDevice.type, smartType: smartDevice.smartType, deviceHandler: smartDevice.deviceHandler};		
					writeDiscoveryResp(resp, smartDevice.smartType, smartDevice.uniqueName, smartDevice.friendlyName, ip.address(), smartPorts[smartDevice.uniqueName], oTags, null )
					console.log("smartbulbserver:httpRequestHandler: desc query for " + url.query.uniqueName + " (type)modeltype=" + smartDevice.type + " smartType=" + smartDevice.smartType + " dh=" + smartDevice.deviceHandler)
				} else if (url.pathname.includes("HubAction")) {
					var effect=url.query.transition
					var duration=url.query.transitionspeed
					if ( (effect != "Smooth") && ((effect != "Sudden")) ) {(effect = "Sudden")};
					if ( (!duration) || (duration < 30) || (duration > 2000) ) {duration = 500};
					commandSeq = commandSeq + 1;
					var valid = true;
					var done = false;
					var prop;
					if (url.pathname.includes("/ping")) {
						done=true;
						resp.writeHead(200, {"Content-Type": "application/json"});
						resp.write(JSON.stringify({"uniqueName": smartDevice.uniqueName, "method": "pingresponse"}));
						resp.end();
					} else if (url.pathname.includes("/pair")) {
						retObj = {"uniqueName": smartDevice.uniqueName, "method":"pair", "params": {"value": null}}
						console.log("smartbulbserver:httpRequestHandler: pair url - req.url=" + req.url + 
										" pathname=" + url.pathname + " queryObj=" + JSON.stringify(url.query) );
					} else if (url.pathname.includes("/rgb")) {
						var rgb, hex, hsl
						if (url.query.mode=="hex") {
							hex = url.query.value
							rgb = COLORS.hex.rgb(hex)
							hsl = COLORS.hex.hsl.raw(hex)
						} else if (url.query.mode=="hsl") {
							hsl = [url.query.hue,url.query.saturation,100]
							rgb = COLORS.hsl.rgb(hsl)
							hex = COLORS.hsl.hex(hsl)
						} else if (url.query.mode=="decimal") {
							rgb = DecToRGB(url.query.value)
							hsl = COLORS.rgb.hsl.raw(rgb)
							hex = COLORS.rgb.hex(rgb)
						} else {
							rgb = COLORS.hex.rgb("FFFAF0")
							hsl = COLORS.hex.hsl.raw("FFFAF0")
							hex = "FFFAF0"
						}						
						retObj.method = "set_rgb";
						retObj.colors = {red: rgb[0], green: rgb[1], blue: rgb[2],
											hue: hsl[0], saturation: hsl[1],
											hex:hex };
						retObj.params = {value: retObj.colors.hex, effect: effect, duration: duration};
					} else if (url.pathname.includes("/trigger")) {
						retObj.method = "trigger";
					} else if (url.pathname.includes("/set_bright")) {
						retObj.method = "set_bright";
						retObj.params = {"value": url.query.value, effect: effect, duration: duration};
					} else if ( (url.pathname.includes("/off")) || (url.pathname.includes("/on")) ){
						retObj.method = "set_power";
						retObj.params = {"value": (url.pathname.includes("/on")) ? "on" : "off", effect: effect, duration: duration};
					} else if (url.pathname.includes("/ctx")) {
						retObj.method = "set_ctx";
						retObj.params = {"value": url.query.value, effect: effect, duration: duration};
					} else if (url.pathname.includes("/refresh")) {
						retObj={"uniqueName": smartDevice.uniqueName, "method": "refresh", "params": {}};
						retObj.method = "refresh";
						retObj.params = {};
						if (smartDevice.smartType == "Playbulb") {
							done=true;
							async.eachSeries(properties[smartDevice.smartType]["Properties"], function(prop,cb){
									smartDevice.getAttribute(prop,"", function(error,data) {
										if (error) {
											retObj.params[prop] = "Error " + error;
										} else {
											retObj.params[prop] = data;
										}
										//console.log("smartbulbserver:httpRequestHandler:getProps in progress prop=" + prop + ":" + retObj.params[prop])
										cb(null);
									});
							}, function(error){
								console.log("smartbulbserver:httpRequestHandler: finished getProps for " + smartDevice.friendlyName + " " + JSON.stringify(retObj))
								resp.writeHead(200, {"Content-Type": "application/json"});
								resp.write(JSON.stringify(retObj));
								resp.end();
							});
						} else if (smartDevice.smartType == "YeeWifiLamp") {
							console.log("smartbulbserver:httpRequestHandler:Refresh unknown type " + smartDevice.smartType )
							var tmpInd;
							var tmpProp;
							for (tmpInd in properties[smartDevice.smartType]["Properties"]) {
								tmpProp = properties[smartDevice.smartType]["Properties"][tmpInd];
								retObj.params[tmpProp] = smartDevice[tmpProp];
							}
							smartDevice.get_props(commandSeq);
							console.log("smartbulbserver:httpRequestHandler: finished getProps for " + smartDevice.friendlyName + " " + JSON.stringify(retObj))
							//resp.writeHead(200, {"Content-Type": "application/json"});
							//resp.write(JSON.stringify(retObj));
							//resp.end();
						}
					} else if (url.pathname.includes("/configGet")) {
						done=true;
						retObj={"uniqueName": smartDevice.uniqueName, "method": "refresh", "params": {}};
						if (url.query.value == "all") {
							//for (prop in smartConfigs[smartDevice.uniqueName]) {
							for (prop in properties.Playbulb.Configs) {
								if (!smartConfigs[smartDevice.uniqueName][prop]) {
									smartConfigs[smartDevice.uniqueName][prop] = properties.Playbulb.Configs[prop];
								}
								retObj.params[prop] = smartConfigs[smartDevice.uniqueName][prop]
							}
						} else {
							if (!smartConfigs[smartDevice.uniqueName][url.query.name]) {
								smartConfigs[smartDevice.uniqueName][url.query.name] = properties.Playbulb.Configs[url.query.name]
							}
							retObj.params[url.query.name] = smartConfigs[smartDevice.uniqueName][url.query.name]
						}
						resp.writeHead(200, {"Content-Type": "application/json"});
						resp.write(JSON.stringify(retObj));
						resp.end();
					} else if (url.pathname.includes("/configSet")) {
						done=true;
						retObj = {"uniqueName": smartDevice.uniqueName,  "method": "refresh", "params" : {}}
						retObj.params[url.query.name] = url.query.value;
						smartConfigs[smartDevice.uniqueName][url.query.name] = url.query.value
						resp.writeHead(200, {"Content-Type": "application/json"});
						resp.write(JSON.stringify(retObj));
						resp.end();
					} else {
						valid = false;
					}
					if (valid){
						if (!done) {
							resp.writeHead(200, {"Content-Type": "application/json"});
							execCommand(smartDevice, retObj, commandSeq );
							if (smartDevice.responds == "none") {
								resp.write(JSON.stringify(retObj));
								resp.end();
							} else if (smartDevice.responds == "indexed") {
								responseStack[commandSeq] = resp;
								responseObjectStack[commandSeq] = retObj;
								responseUniqueNameStack[commandSeq] = smartDevice.uniqueName;							
							} else if (smartDevice.responds == "changes") {
								if (!BTResponsesByDevices[smartDevice.uniqueName]) {
									BTResponsesByDevices[smartDevice.uniqueName] = {requests: []};
								}
								BTResponsesByDevices[smartDevice.uniqueName].requests.push(resp);
							} else {
								console.log("smartbulbserver:httpRequestHandler: invalid smartDevice.responds=" + smartDevice.responds);
								resp.write(JSON.stringify(retObj));
								resp.end();
							}
						}
					} else {
						console.log("smartbulbserver:httpRequestHandler: unknown command/path - req.url=" + req.url + " pathname=" + url.pathname + " query=" + retProps(url.query));
						resp.writeHead(509, {"Content-Type": "text/xml"});
						resp.end();
					}
				} else {
					console.log("smartbulbserver:httpRequestHandler: unexpected url - req.url=" + req.url + " pathname=" + url.pathname + " query=" + retProps(url.query));
					resp.writeHead(509, {"Content-Type": "text/xml"});
					resp.end()
				}
			} else {
				console.log("smartbulbserver:httpRequestHandler: Device Not Found - req.url=" + req.url + " pathname=" + url.pathname + " query=" + retProps(url.query));
				resp.writeHead(508, {"Content-Type": "text/xml"});
				resp.end();
			}
		} else {
			console.log("smartbulbserver:httpRequestHandler: Device not specified in url " + req.url)
			resp.writeHead(103, {"Content-Type": "text/xml"});
			resp.end();
		}
	}
}

function retProps(obj,onlyNames = false){
	var props=""
	if (obj) {
		for (var property in obj) {
			if (Object.hasOwnProperty.call(obj, property)) {
				var prp=obj[property]
				if (typeof(prp)=="object"){
					prp="OBJECT";
				} else if (typeof(prop)=="function") {
					prp="FUNCTION";
				}
				if (props=="") {
					props=property + (onlyNames) ? "" : ":" + prp
				} else {
					props=props+","+property + (onlyNames) ? "" : ":" + prp
				}
			}
		}
	}
	return props
}
function DecToRGB(rgb){return {r:((rgb>>16)&0x0ff),g:((rgb>>8)&0x0ff),b:((rgb)&0x0ff)}}
function RGBToDec(r,g,b){return (r*65536)+(g*256)+b}
function encodeXml(s) {
    return (s
        .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
        .replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/\t/g, '&#x9;').replace(/\n/g, '&#xA;').replace(/\r/g, '&#xD;')
    );
}
function execCommand(smartDevice, retObj, commandSeq) {
	console.log("DEBUG:execCommand: called with method=" + retObj.method + " " + smartDevice.friendlyName + " seq=" + commandSeq);
	switch (retObj.method) {
		case "pair":
			smartDevice.pair();
		break;
		case "trigger":
			smartDevice.trigger();
		break;
		case "set_rgb":
			smartDevice.setRGB(retObj.colors.red, retObj.colors.green, retObj.colors.blue, retObj.params.effect, retObj.params.duration, commandSeq);
		break;
		case "set_bright":
			smartDevice.setBright(retObj.params.value, retObj.params.effect, retObj.params.duration, commandSeq);
		break;
		case "set_power":
			smartDevice.setPower((retObj.params.value == "on") ? 1 : 0, retObj.params.effect, retObj.params.duration, commandSeq);
		break;
		case "set_ctx":
			smartDevice.setCTX(retObj.params.value, retObj.params.effect, retObj.params.duration, commandSeq);
		break;
		case "refresh":
		break;
		default:
			console.log("execCommand: Unknown Method=" + retObj.method + " " + smartDevice.friendlyName);
	}
};

