#!/usr/bin/env node
'use strict';
//var yeeLight = require('./YeeWifiLamp.js');
var COLORS=require("color-convert")
var noble = require('noble');
var http = require('http');
var URL = require('url');
var ip=require("ip")
var UUID = require('uuid/v1')
var async=require("async")
var SSDP = require('node-ssdp').Server
//var NCONF=require('nconf');
const querystring = require('querystring');
var properties = require("./properties.json");
const https = require('https');
/*
NCONF.argv()
	.env()
	.file({ file: './config.json' });
console.log("smartbulbserver: is working for " + JSON.stringify(NCONF.get("bridge").workFor))
var tmp="";
process.argv.forEach((val, index) => {
	tmp == "" ? tmp = index + ":" + val : tmp = tmp + "," + index + ":" + val
 
});
console.log("smartbulbserver: input arguments are " + tmp)
*/
 (function () {
	var tmp="";
	var enabledTypes = []
	process.argv.forEach((val, index) => {
		tmp == "" ? tmp = index + ":" + val : tmp = tmp + "," + index + ":" + val
		if (index > 1) {
			enabledTypes[index-2] = val;
		}
	});

	//console.log("smartbulbserver: input arguments are " + tmp + " enabledtypes (overriding properties.json)=" + enabledTypes);
})();

var devicePortCounter = 8201
var smartSubscribers = {};
var subscriptionStack = [];
var smartSSDs = {};
var smartPorts = {};
var smartConfigs = {};
var smartDevices = {};
var handleAgentEvents = {};
var servers = {};
var responseStack = {};
var responseObjectStack = {};
var responseUniqueNameStack = {};
var yeelightAgent;
var playbulbAgent;
var smartSids = {};
var sid = UUID();
var eventCounter=1;
var commandSeq = 1 + (Math.random() * 1e3) & 0xff;


const G_oauthToken = {
	  //"apiUrl": "https://graph-eu01-euwest1.api.smartthings.com:443",
	  "apiUrl": "https://graph-eu01-euwest1.api.smartthings.com",
	  "access_token": "f3aa010f-86ad-4a57-80dd-138ed9ec3f16", 
	  "api": "https://graph.api.smartthings.com/api/smartapps/endpoints/e18fa88a-bd6b-455f-a0c4-4f2c0a94e302/", 
	  "api_location": "graph.api.smartthings.com", 
	  "path": "/api/smartapps/endpoints/e18fa88a-bd6b-455f-a0c4-4f2c0a94e302/",
	  "client_id": "e18fa88a-bd6b-455f-a0c4-4f2c0a94e302", 
	  "client_secret": "521c5979-2d93-45ed-98dc-37c74f1dc93b", 
	  "expires_in": 1576799998, 
	  "scope": "app", 
	  "token_type": "bearer"
	}
	
	
const G_serverPort = properties.ServerPort
var devicePortCounter = properties.DevicePortStart

//var	smartBridgeSSDP = new SSDP({allowWildcards:true,sourcePort:1900,udn:"SmartBridge", suppressRootDeviceAdvertisements:true,
var	smartBridgeSSDP = new SSDP({allowWildcards:true,sourcePort:1900,udn:"SmartBridge", 
					location:"http://"+ ip.address() + ":" + G_serverPort + '/bridge'})
	smartBridgeSSDP.addUSN('urn:schemas-upnp-org:device:SmartBridge:1')
	smartBridgeSSDP.start();
	console.log("smartbulbserver: Starting SSDP Annoucements for Bridge " + 
			" location=" +  "http://"+ ip.address() + ":" + G_serverPort + '/bridge'
			+ " usn=" + 'urn:schemas-upnp-org:device:SmartBridge:1');
var server = http.createServer(httpRequestHandler)
server.listen(G_serverPort);
servers[G_serverPort]=server;

	
var G_enabledTypes = ( function () {
	var type;
	var tmp="";
	var enabledTypes = []
	var stringOfPossibleTypes="";
	for (let i0 in properties.bridgeEnabledTypes) {
		stringOfPossibleTypes = (stringOfPossibleTypes=="" ? i0 : stringOfPossibleTypes + " or " + i0)
	}
	process.argv.forEach((val, index) => {
		tmp == "" ? tmp = index + ":" + val : tmp = tmp + "," + index + ":" + val
		if (index > 1) {
			//console.log("DEBUG val=" + val);
			//enabledTypes[index-2] = val;
			enabledTypes.push(val);
			if (  (!properties.bridgeEnabledTypes[val]) ) {
				console.log("\nINPUT ERROR - type does not exist should be " + stringOfPossibleTypes)
				throw "invalid input argument";
			}
		}
	});
	if (enabledTypes.length==0) {
		for (type in properties.bridgeEnabledTypes) {
			//console.log("DEBUG enabledTypes type=" + type + " bridgeEnabledTypes[type]=" + JSON.stringify(properties.bridgeEnabledTypes[type]));
			if (properties.bridgeEnabledTypes[type].enabled) {
				enabledTypes.push(type);
			}
		}
	} else {
		//console.log("DEBUG enabledTypes not null");
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
				} else if  (tmpTypeDetails.agent == "BluetoothAgent")  {
					agents[tmpTypeDetails.agent] = new require("./BluetoothAgent").BluetoothAgent(handleAgentEvents);
					console.log("smartbulbserver: " + "Working for " + type  + " agent started " + tmpTypeDetails.agent );
					agents[tmpTypeDetails.agent].discoverDevices();
					//playbulbAgent.discoverDevices.call(playbulbAgent)
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
	
	var cnt;
	if (subscriptionStack.length > 0) {
		if (!subscriptionStack[subscriptionStack.length-1].done) {
			//console.log("smartbulbserver:manageSubscriptions: subscriptionStack has " + subscriptionStack.length + " entries");
			var subscriptionBeingProcessed = subscriptionStack.pop();
			var cmd = JSON.stringify({"command": subscriptionBeingProcessed.command, "value": subscriptionBeingProcessed.value });
			var req = http.request(subscriptionBeingProcessed.options, function(resp) {
				var body = "";
				if (resp.statusCode == 200) {
					//console.log("smartbulbserver:manageSubscriptions: request sent response status=" + resp.statusCode);
				} else {
					console.log("smartbulbserver:manageSubscriptions: request sent ERROR response status=" + resp.statusCode);
				}
				resp.setEncoding("utf8");
				resp.on("data", function(chunk) {
							//console.log("smartbulbserver:manageSubscriptions: DEBUG - data received ");
							body  = body + chunk;
						});
				resp.on("end", function(chunk) {
							//console.log("smartbulbserver:manageSubscriptions: DEBUG - end received ");
							subscriptionBeingProcessed.done=true;
							//delete subscriptionStack[arrayInd];
						});
				resp.on("error", function(chunk) {
							console.log("smartbulbserver:manageSubscriptions: DEBUG - error received ");
						});
				});
				req.write("<e:propertyset xmlns:e=\"urn:schemas-upnp-org:event-1-0\">");
				req.write("<e:property>");
				req.write("<update>" + cmd + "</update>" )									
				req.write("</e:property>");
				req.write("</e:propertyset>");
				req.end();
			} else {
				if (cnt>10) {
					console.log("smartbulbserver:manageSubscriptions: subscriptionStack still waiting for response");
					cnt=0;
				}
			}
	} else {
		//console.log("smartbulbserver:manageSubscriptions: subscriptionStack is empty");
	}
	setTimeout(handleAgentEvents.manageSubscriptions,1500);
};

//execute first time
handleAgentEvents.manageSubscriptions();

handleAgentEvents.BTNotify = function(device,command,value) {
	console.log("smartbulbserver: Notify received for " + device.friendlyName + " command=" + command + " value=" + value);
	if (device) {
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
				//console.log("DEBUG reqOptions = " + JSON.stringify(reqOptions));
				subscriptionStack.push({"options": reqOptions, "done": false, "command": command, "value": value});
				//console.log("smartbulbserver:BTNotify: Processing subscriber " + subscriber + " port=" + subscriberDeets.port + 
				//									" seq=" + subscriberDeets.seq + " sid=" + "uuid:" + subscriberDeets.sid +
				//									" path=" + subscriberDeets.path +
				//									" host=" + ip.address() + ":" + G_serverPort );
				//console.log("smartbulbserver:BTNotify: subscriptionStack has " + subscriptionStack.length + " entries");
				subscriberDeets.seq++;
			}
		} else {
			console.log("smartbulbserver: No subscriptions for " + device.friendlyName + " command=" + command + " value=" + value);
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
				console.log("smartbulbserver: Created server for " + device.friendlyName + " IP:PORT=" + ip.address() + ":" + devicePortCounter + 
												" unique=" + device.uniqueName + " type=" + type );
			} else {
				console.log("smartbulbserver:handleAgentEvents:onDevFound: Weird server already exists")
			}

			servers[devicePortCounter].listen(devicePortCounter)
			smartSSDs[device.uniqueName] = new SSDP({allowWildcards:true,sourcePort:1900,udn:device.uniqueName,
						location:"http://"+ ip.address() + ":" + devicePortCounter +
						'/light?' + "uniqueName="+ device.uniqueName +
						'&type=' + type
						});
			smartSSDs[device.uniqueName].addUSN('urn:schemas-upnp-org:device:' + type +  ':1');
			console.log("smartbulbserver: Starting SSDP Annoucements for " + device.friendlyName +
					" location=" +  "http://"+ ip.address() + ":" + devicePortCounter + '/light?' + "uniqueName="+ device.uniqueName + '&type=' + type
					+ " usn=" + 'urn:schemas-upnp-org:device:' + type +  ':1');
			smartSSDs[device.uniqueName].start();
			smartConfigs[device.uniqueName]= Object.assign({}, properties[type].Configs);
			smartPorts[device.uniqueName] = devicePortCounter;
			smartSids[device.uniqueName] = UUID();
			smartDevices[device.uniqueName] = device;
			devicePortCounter++;
			//debugHandles(device);
		} else {
			//console.log("smartbulbserver:handleAgentEvents:onDevFound: Device already exists "+device.uniqueName)
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
		/*if (device.did in smartIDs) {
			delete smartSDDPs[device.did]
			delete smartLocations[device.did]
			delete smartIDs[device.did]
		} else {
			console.log("onDevDisconnected: ERROR DEVICE NOT FOUND" + device.did + " " + device.name)
		}
		*/
};

handleAgentEvents.onDevPropChange = function(device, prop, val, ind){
		//console.log("smartbulbserver:onDevPropChange:(1)  " + device.did + " prop: " + prop+ " ind=" + ind + " val: " + val)
		if (prop=="all") {
			if (ind in responseStack) {
				var result, stuff
				try {
					result=JSON.parse(val)["result"]
					stuff=JSON.parse(val)
					//console.log("smartbulbserver:onDevPropChange: (1)" + device.did + " response received id=" + ind + 
					//			" result is "+ result + " val=" + val + " stuff=" + stuff +
					//			" obj=" + JSON.stringify(responseObjectStack[ind]))
				} catch(e) {
					result="Invalid result"
				}
				//console.log("smartbulbserver:onDevPropChange:" + device.did + " response received id=" + ind + 
				//				" prop: " + prop + " result is "+ result + " response.finished=" + 
				//				" obj=" + JSON.stringify(responseObjectStack[ind]) + " " + responseStack[ind].finished)					
				var res={}
				if (result=="ok") {
					responseStack[ind].write(JSON.stringify(responseObjectStack[ind]));
					responseStack[ind].end();
					//console.log("smartbulbserver:onDevPropChange: Result OK")
				} else if (typeof(result)=="object") {
					for (var index in properties) {
						//console.log("DEBUG: index=" + index + " property=" + properties[index] + "result=" + result[index])
						if (result[index]) {
							res[properties[index]]=result[index]
						} else {
							res[properties[index]]=null
						}
					}
					responseStack[ind].writeHead(200, {"Content-Type": "application/json"}); //application/json
					responseStack[ind].write(JSON.stringify({"uniqueName":responseUniqueNameStack[ind],"method":"get_props",
															"params":res}))							
					responseStack[ind].end();
					//console.log("Received object as result ="+JSON.stringify({"props":res}))
 				} else {
					responseStack[ind].end();
					console.log("smartbulbserver:onDevPropChange: Result NOT OK result="+result+" stuff="+retProps(stuff))
				}
				//console.log("smartbulbserver:onDevPropChange: (3)" + device.did + " response received id=" + 
									//ind + " prop: " + prop + " result is "+ result + " response.finished=" + responseStack[ind].finished)				
				responseStack[ind]=null
				responseObjectStack[ind]=null
			} else if (ind!=1) {
				console.log("smartbulbserver:onDevPropChange: Weird response but no request received") 
			}
		} else {
			//console.log("smartbulbserver:onDevPropChange: (3)" + device.did + " response received id=" + ind + " prop: " + prop + " result is "+ result)
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
	var url=URL.parse(req.url, true);
	var query = querystring.parse(url.query);
	var smartDevice;
	//if (url.pathname!="/bridge") {
		console.log("smartbulbserver:httpRequestHandler: Received Request pathname=" + url.pathname  + " from:" + req.connection.remoteAddress + 
								" query=" + JSON.stringify(url.query))
	//}
	if (url.pathname == "/bridge") {
		resp.writeHead(200, {"Content-Type": "text/xml"});
		//resp, ssdpDeviceType, friendlyName, uniqueName, IP, port, modelInfo
		//writeDeviceDescriptionResponse(resp, "SmartBridge", "SmartBridge", ip.address() , G_serverPort,  {} );
		resp.write("<?xml version=\"1.0\"?> ");
		resp.write("<root xmlns=\"urn:schemas-upnp-org:device:" + "SmartBridge" + ":1\">");
		resp.write("<device>");
		resp.write("<deviceType>urn:schemas-upnp-org:device:" + "SmartBridge" + ":1</deviceType>");
		resp.write("<friendlyName>" + "SmartBridge" + "</friendlyName>");
		resp.write("<uniqueName>" + "SmartBridge" + "</uniqueName>");
		resp.write("<UDN>" + "SmartBridge" + "</UDN>");
		resp.write("<IP>" + ip.address() + "</IP>");
		resp.write("<port>" + G_serverPort + "</port>");
		var sDevices = [];
		resp.write("<supportedDevices>");
		G_enabledTypes.forEach( (val,index) => {
			sDevices.push( {"usn":'urn:schemas-upnp-org:device:' + val +  ':1'
							, "type": val
							, "discoverString": "lan discovery urn:schemas-upnp-org:device:" + val + ":1"})
		});
		//console.log("DEBUG " + JSON.stringify(sDevices) );
		resp.write(JSON.stringify(sDevices))
		resp.write("</supportedDevices>")
		resp.write("</device>");
		resp.write("</root>");
		resp.end();	
		//console.log("smartbulbserver:httpRequestHandler: Responded to /bridge devName=" + "PlayBridge-Pi" + " # devices=" + playbulbAgent.btDevices.length)
	} else {
		if ( (url.query) && (url.query.uniqueName) ) {
			smartDevice = smartDevices[url.query.uniqueName]
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
					resp.writeHead(200, {"Content-Type": "text/xml"});
					//resp, ssdpDeviceType, friendlyName, uniqueName, IP, port, modelInfo
					resp.write("<?xml version=\"1.0\"?> ");
					resp.write("<root xmlns=\"urn:schemas-upnp-org:device:" + smartDevice.smartType + ":1\">");
					resp.write("<device>");
					resp.write("<deviceType>urn:schemas-upnp-org:device:" + smartDevice.smartType + ":1</deviceType>");
					resp.write("<friendlyName>" + smartDevice.friendlyName + "</friendlyName>");
					resp.write("<uniqueName>" + url.query.uniqueName + "</uniqueName>");
					resp.write("<UDN>" + url.query.uniqueName + "</UDN>");
					resp.write("<IP>" + ip.address() + "</IP>");
					resp.write("<port>" + smartPorts[url.query.uniqueName] + "</port>");														
					resp.write("<modelType>" + smartDevice.type + "</modelType>");
					resp.write("<smartType>" + smartDevice.smartType + "</smartType>");
					resp.write("<deviceHandler>" + smartDevice.deviceHandler + "</deviceHandler>");
					resp.write("</device>");
					resp.write("</root>");
					resp.end();
					console.log("smartbulbserver:httpRequestHandler: desc query for " + url.query.uniqueName + " (type)modeltype=" + smartDevice.type + " smartType=" + smartDevice.smartType + " dh=" + smartDevice.deviceHandler)
				} else if (url.pathname.includes("HubAction")) {
					var hPos = url.pathname.indexOf("HubAction/") + 10
					var effect=url.query.transition
					var duration=url.query.transitionspeed
					if ( (effect != "Smooth") && ((effect != "Sudden")) ) {(effect = "Sudden")};
					if ( (!duration) || (duration < 30) || (duration > 2000) ) {duration = 500};
					var retObj;
					commandSeq = commandSeq + 1;
					var valid = true;
					var done = false;
					var prop;
					if (url.pathname.includes("/rgb")) {
						var stColorValue, rgb, hex, hsl
						var qQuery=url.query
						if (qQuery.mode=="hex") {
							rgb = COLORS.hex.rgb(qQuery.value)
							hsl = COLORS.hex.hsl.raw(qQuery.value)
							hex = qQuery.value
						} else if (url.query.mode=="hsl") {
							rgb = COLORS.hsl.rgb([qQuery.hue,qQuery.saturation,100])
							hex = COLORS.hsl.hex([qQuery.hue,qQuery.saturation,100])
							hsl = [qQuery.hue,qQuery.saturation,100]
						} else if (url.query.mode=="decimal") {
							rgb = DecToRGB(url.query.value)
							hsl = COLORS.rgb.hsl.raw(rgb)
							hex = COLORS.rgb.hex(rgb)
						} else {
							//FFFAF0
							rgb = COLORS.hex.rgb("FFFAF0")
							hsl = COLORS.hex.hsl.raw("FFFAF0")
							hex = "FFFAF0"
						}
						/*stColorValue = {	red:rgb[0], green:rgb[1], blue:rgb[2],
											hue:((hsl[0]/360)*100),saturation:hsl[1],
											hex:hex }*/
						stColorValue = {	red:rgb[0], green:rgb[1], blue:rgb[2],
											hue:qQuery.hue,saturation:qQuery.saturation,
											hex:hex }
						smartDevice.setRGB(rgb[0], rgb[1], rgb[2], effect, duration, commandSeq);
						
						retObj = {"uniqueName": smartDevice.uniqueName, "method": "set_rgb", "stColor": stColorValue, "params": {"value": [rgb]}}
						console.log("smartbulbserver:httpRequestHandler: change color pathname=" + url.pathname + " friendlyName=" + smartDevice.friendlyName + " uniqueName=" + smartDevice.uniqueName + 
																								" mode=" + url.query.mode + " value=" + url.query.value);
					} else if (url.pathname.includes("/set_bright")) {
						retObj = {"uniqueName": smartDevice.uniqueName, "method":"set_bright", "params": {"value": [url.query.value]}}
						smartDevice.setBright(url.query.value, effect, duration, commandSeq);
						console.log("smartbulbserver:httpRequestHandler: set bright url - req.url=" + req.url + 
										" pathname=" + url.pathname + " queryObj=" + JSON.stringify(url.query) );
					} else if ( (url.pathname.includes("/off")) || (url.pathname.includes("/on")) ){
						retObj = {"uniqueName": smartDevice.uniqueName, "method": "set_power", "params": {"value": (url.pathname.includes("/on")) ? ["on"] : ["off"]}}
						//url.pathname.includes("/on") ? smartDevice.on() : smartDevice.off();
						smartDevice.setPower((url.pathname.includes("/on")) ? 1 : 0, effect, duration, commandSeq)
						console.log("smartbulbserver:httpRequestHandler: on/off url  pathname=" + url.pathname + " friendlyName=" + smartDevice.friendlyName + " uniqueName=" + smartDevice.uniqueName + " mode=" + url.query.mode + " value=" + url.query.value)
					} else if (url.pathname.includes("/ctx")) {
						retObj = {"uniqueName": smartDevice.uniqueName, "method": "set_ctx", "params": {"value": [url.query.value]}}
						smartDevice.setCTX(url.query.value, effect, duration, commandSeq);
						console.log("smartbulbserver:httpRequestHandler: set Color Temp url - req.url=" + req.url + 
										" pathname=" + url.pathname + " queryObj=" + JSON.stringify(url.query) );
					} else if (url.pathname.includes("/refresh")) {
						retObj={"uniqueName": smartDevice.uniqueName, "method": "refresh", "params": {}};
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
						} else if (smartDevice.smartType == "Yeelight") {
							console.log("smartbulbserver:httpRequestHandler:Refresh unknown type " + smartDevice.smartType )
							var tmpInd;
							var tmpProp;
							for (tmpInd in properties[smartDevice.smartType]["Properties"]) {
								tmpProp = properties[smartDevice.smartType]["Properties"][tmpInd];
								retObj.params[tmpProp] = smartDevice[tmpProp];
							}
							console.log("smartbulbserver:httpRequestHandler: finished getProps for " + smartDevice.friendlyName + " " + JSON.stringify(retObj))
							resp.writeHead(200, {"Content-Type": "application/json"});
							resp.write(JSON.stringify(retObj));
							resp.end();
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
							if (smartDevice.smartType != "YeeWifiLamp") {
								resp.write(JSON.stringify(retObj));
								resp.end();
							} else {
								responseStack[commandSeq] = resp;
								responseObjectStack[commandSeq] = retObj;
								responseUniqueNameStack[commandSeq] = smartDevice.uniqueName;
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
//console.log("smartbulbserver:httpRequestHandler: Responded to /light devName="  + smartDevice.uniqueName + " modelType=" + uniqueName.type)
//console.log("smartbulbserver:httpRequestHandler: Device not Available " + url.query.uniqueName + " length=" + playbulbAgent.btDevices.length + " names=" + nms)
//console.log("smartbulbserver:httpRequestHandler: deviceMac not in smartMacs array deviceMac=" + deviceMac);
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
function debugHandles(device) {
	console.log("DEBUG 0 " + device.friendlyName + " periph=" + device.periph._noble.state +
			" " + device.periph._noble.address +
			" binding state=" + device.periph._noble._bindings._state +
			" handles=" + JSON.stringify(device.periph._noble._bindings._handles[device.periph.uuid])
			);
	var binds = device.periph._noble._bindings;
	var handle = binds._handles[device.periph.uuid]
	var gattServices = "";
	var gattCharProps = "";
	var gattCharacteristics = binds._gatts[64]._characteristics //this is an array of arrays by serviceUUID
	for (let tmp in device.periph.services) {
		gattServices = (gattServices=="" ? "[" + tmp + "]=" + device.periph.services[tmp].uuid : gattServices + ", " + 
			"[" + tmp + "]=" + device.periph.services[tmp].uuid )
	}
	var charas = binds._gatts[64]["_characteristics"];
	for (let tmp in charas ) {
		for (let i0 in charas[tmp]) {
			console.log("Gatt Characteristic dump for :" + "[" + tmp + "]" + "[" + i0 + "]" + 
					" valueHandle=" + charas[tmp][i0].valueHandle + " 0x" + 
					charas[tmp][i0].valueHandle.toString(16));
					for (let i1 in charas[tmp][i0]) {
						if (gattCharProps.indexOf(i1)==-1) {
								gattCharProps = ( gattCharProps=="" ? i1 : gattCharProps + ", " + i1);
						}
					}
		}
	}
	console.log("DEBUG 1 " + device.friendlyName + " Services=" + gattServices);
	console.log("DEBUG 2 " + device.friendlyName + " gatts charas avaiable props=" + gattCharProps);
}