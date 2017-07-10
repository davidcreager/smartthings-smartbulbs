#!/usr/bin/env node
'use strict';
var yeeLight = require('./yee.js');
var COLORS=require("color-convert")
var noble = require('noble');
var http = require('http');
var URL = require('url');
var ip=require("ip")
var UUID = require('uuid/v1')
var async=require("async")
var SSDP = require('node-ssdp').Server
var NCONF=require('nconf');
const querystring = require('querystring');
var properties = require("./properties.json")
NCONF.argv()
	.env()
	.file({ file: './config.json' });
console.log("smartserver: is working for " + JSON.stringify(NCONF.get("bridge").workFor))
var tmp="";
process.argv.forEach((val, index) => {
	tmp == "" ? tmp = index + ":" + val : tmp = tmp + "," + index + ":" + val
 
});
console.log("smartserver: input arguments are " + tmp)


var devicePortCounter = 8201
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




const gServerPort=NCONF.get("smartserver").port;

var	smartBridgeSSDP = new SSDP({allowWildcards:true,sourcePort:1900,udn:"SmartBridge", suppressRootDeviceAdvertisements:true,
					location:"http://"+ ip.address() + ":" + gServerPort + '/bridge'})
	smartBridgeSSDP.addUSN('urn:schemas-upnp-org:device:SmartBridge:1')
	smartBridgeSSDP.start()
	
var server = http.createServer(httpRequestHandler)
server.listen(gServerPort)
servers[gServerPort]=server


//console.log(JSON.stringify(properties))

if (NCONF.get("bridge").workFor.Yeelight) {
	console.log("smartserver: Working for Yeelights workFor=" + JSON.stringify(NCONF.get("bridge").workFor) + " Yeelight=" + JSON.stringify(NCONF.get("bridge").workFor.Yeelight) )
	yeelightAgent = new yeeLight.YeeAgent(handleAgentEvents)
	yeelightAgent.startDisc()
} else {
	console.log("smartserver: NOT Working for Yeelights workFor=" + JSON.stringify(NCONF.get("bridge").workFor) + " Yeelight=" + JSON.stringify(NCONF.get("bridge").workFor.Yeelight) )
}
if (NCONF.get("bridge").workFor.Playbulb) {
	console.log("smartserver: Working for Playbulbs workFor=" + JSON.stringify(NCONF.get("bridge").workFor) + " Playbulb=" + JSON.stringify(NCONF.get("bridge").workFor.Playbulb) )
	//playbulbAgent = new Playbulb.BluetoothManager(handleAgentEvents);
	playbulbAgent = new require("./bluetoothManager").BluetoothManager(handleAgentEvents);
	playbulbAgent.discoverDevices.call(playbulbAgent)
} else {
	console.log("smartserver: NOT Working for Playbulbs workFor=" + JSON.stringify(NCONF.get("bridge").workFor) + " Yeelight=" + JSON.stringify(NCONF.get("bridge").workFor.Yeelight) )
}

console.log("smartserver: SmartBridge Bridge - Starting SSDP Annoucements for Bridge Device (SmartBridge) IP:PORT=" 
		+ ip.address() + ":" + gServerPort )

handleAgentEvents.BTNotify = function(device,command,value) {
	console.log("Notify received for " + device.friendlyName + " command=" + command + " value=" + value);
	
}.bind(this);
handleAgentEvents.onDevFound = function(device, type, name, uniqueName) {
	//console.log("smartserver:handleAgentEvents:onDevFound: device.did = " + device.did + " type=" + type + " name=" + name + " uniqueName=" + uniqueName)
	
	if (device) {
		if (!smartSSDs[uniqueName]) {
			if (!servers[devicePortCounter]) {
				servers[devicePortCounter]=http.createServer(httpRequestHandler);
				console.log("smartserver:handleAgentEvents:onDevFound: Created server for " + devicePortCounter + " uniqueName=" + device.uniqueName + " type=" + type + " name=" + name)
			} else {
				console.log("smartserver:handleAgentEvents:onDevFound: Weird server already exists")
			}
			servers[devicePortCounter].listen(devicePortCounter)
			smartSSDs[device.uniqueName] = new SSDP({allowWildcards:true,sourcePort:1900,udn:device.uniqueName,
								location:"http://"+ ip.address() + ":" + devicePortCounter +
								'/light?' + "uniqueName="+ device.uniqueName +
								'&type=' + type
								});
			//console.log("smartserver:handleAgentEvents: adding device ssdp for play light " + device.uniqueName);
			smartSSDs[device.uniqueName].addUSN('urn:schemas-upnp-org:device:' + type +  ':1');
			smartSSDs[device.uniqueName].start();
			smartConfigs[device.uniqueName]= Object.assign({}, properties[type].Configs);
			smartPorts[device.uniqueName] = devicePortCounter;
			smartSids[device.uniqueName] = UUID();
			smartDevices[device.uniqueName] = device;
			devicePortCounter++;
		} else {
			//console.log("smartserver:handleAgentEvents:onDevFound: Device already exists "+device.uniqueName)
		}
	} else {
		console.log("smartserver:handleAgentEvents:onDevFound: Weird!   Device found is null")
	}
};
handleAgentEvents.onDevConnected = function(device){
		console.log("smartserver:handleAgentEvents:onDevConnected: host:port=" + device.host + ":" + device.port + " " + device.did + 
					" model=" + device.model + " bright:hue:sat=" + device.bright + ":" + device.hue + ":" + device.sat)	
}
handleAgentEvents.onDevDisconnected = function(device){
		console.log("smartserver:handleAgentEvents:onDevDisconnected: host:port=" + device.host + ":" + device.port + " " + device.did + 
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
		//console.log("smartserver:onDevPropChange:(1)  " + device.did + " prop: " + prop+ " ind=" + ind + " val: " + val)
		if (prop=="all") {
			if (ind in responseStack) {
				var result, stuff
				try {
					result=JSON.parse(val)["result"]
					stuff=JSON.parse(val)
					//console.log("smartserver:onDevPropChange: (1)" + device.did + " response received id=" + ind + 
					//			" result is "+ result + " val=" + val + " stuff=" + stuff +
					//			" obj=" + JSON.stringify(responseObjectStack[ind]))
				} catch(e) {
					result="Invalid result"
				}
				//console.log("smartserver:onDevPropChange:" + device.did + " response received id=" + ind + 
				//				" prop: " + prop + " result is "+ result + " response.finished=" + 
				//				" obj=" + JSON.stringify(responseObjectStack[ind]) + " " + responseStack[ind].finished)					
				var res={}
				if (result=="ok") {
					responseStack[ind].write(JSON.stringify(responseObjectStack[ind]));
					responseStack[ind].end();
					//console.log("smartserver:onDevPropChange: Result OK")
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
					console.log("smartserver:onDevPropChange: Result NOT OK result="+result+" stuff="+retProps(stuff))
				}
				//console.log("smartserver:onDevPropChange: (3)" + device.did + " response received id=" + 
									//ind + " prop: " + prop + " result is "+ result + " response.finished=" + responseStack[ind].finished)				
				responseStack[ind]=null
				responseObjectStack[ind]=null
			} else if (ind!=1) {
				console.log("smartserver:onDevPropChange: Weird response but no request received") 
			}
		} else {
			//console.log("smartserver:onDevPropChange: (3)" + device.did + " response received id=" + ind + " prop: " + prop + " result is "+ result)
		}
	
	
};

function httpRequestHandler(req,resp) {
	req.on("error",function(err){
		console.error("smartserver:httpRequestHandler: request onerror:"+err);
		resp.statusCode = 400;
		resp.end();
	})

	resp.on('finish', function(err) {
		//console.error("smartserver:httpRequestHandler: Debug Finish event "+ retProps(err,true) );
	});
	resp.on('error', function(err) {
		console.error("smartserver:httpRequestHandler: response onerror:" + err);
	});
	var url=URL.parse(req.url, true);
	var query = querystring.parse(url.query);
	var smartDevice;
	//console.log("smartserver:httpRequestHandler: Received Request pathname=" + url.pathname + " value=" + url.query.value)
	//console.log("smartserver:httpRequestHandler: req.url=" + req.url + " pathname=" + url.pathname + 
	//			" query=" + JSON.stringify(url.query) +
	//			" request from=" + req.connection.remoteAddress)
	if (url.pathname == "/bridge") {
		resp.writeHead(200, {"Content-Type": "text/xml"});
		//resp, ssdpDeviceType, friendlyName, uniqueName, IP, port, modelInfo
		writeDeviceDescriptionResponse(resp, "SmartBridge", "SmartBridge", ip.address() , gServerPort,  {} );
		resp.end();
		//console.log("smartserver:httpRequestHandler: Responded to /bridge devName=" + "PlayBridge-Pi" + " # devices=" + playbulbAgent.btDevices.length)
	} else {
		if ( (url.query) && (url.query.uniqueName) ) {
			smartDevice = smartDevices[url.query.uniqueName]
			if (smartDevice) {
				//
				if (url.pathname == "/subscription") {
			//TODO sort this out
					var callbck = req.headers.callback
					console.log("smartserver: subscription host=" + req.headers.host + " callback=" + req.headers.callback + " sid=" + sid + " substr=" + callbck.substring(1,callbck.length-1))
					//var inpUrl = new URL(callbck)
					resp.setHeader("DATE",new Date().toUTCString())
					resp.setHeader("SERVER","OS/version UPnP/1.1 product/version");
					resp.setHeader("SID",sid);
					resp.setHeader('CONTENT-LENGTH',0);
					resp.setHeader("TIMEOUT",3600);
					//resp.writeHead(200, {"Content-Type": "text/plain"});	
					//resp.write("\n")
					resp.end();
				} else if (url.pathname == "/light") {
					resp.writeHead(200, {"Content-Type": "text/xml"});
					//resp, ssdpDeviceType, friendlyName, uniqueName, IP, port, modelInfo
					writeDeviceDescriptionResponse(resp,  (url.query.type == "Playbulb") ? "Playbulb" : "Yeelight" , 
															smartDevice.friendlyName, url.query.uniqueName, ip.address(), 
															smartPorts[url.query.uniqueName],
															{"modelType":smartDevice.type}
															);					
					resp.end();
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
						console.log("smartserver:httpRequestHandler: change color pathname=" + url.pathname + " friendlyName=" + smartDevice.friendlyName + " uniqueName=" + smartDevice.uniqueName + 
																								" mode=" + url.query.mode + " value=" + url.query.value);
					} else if (url.pathname.includes("/set_bright")) {
						retObj = {"uniqueName": smartDevice.uniqueName, "method":"set_bright", "params": {"value": [url.query.value]}}
						smartDevice.setBright(url.query.value, effect, duration, commandSeq);
						console.log("smartserver:httpRequestHandler: set bright url - req.url=" + req.url + 
										" pathname=" + url.pathname + " queryObj=" + JSON.stringify(url.query) );
					} else if ( (url.pathname.includes("/off")) || (url.pathname.includes("/on")) ){
						retObj = {"uniqueName": smartDevice.uniqueName, "method": "set_power", "params": {"value": (url.pathname.includes("/on")) ? ["on"] : ["off"]}}
						//url.pathname.includes("/on") ? smartDevice.on() : smartDevice.off();
						smartDevice.setPower((url.pathname.includes("/on")) ? 1 : 0, effect, duration, commandSeq)
						console.log("smartserver:httpRequestHandler: on/off url  pathname=" + url.pathname + " friendlyName=" + smartDevice.friendlyName + " uniqueName=" + smartDevice.uniqueName + " mode=" + url.query.mode + " value=" + url.query.value)
					} else if (url.pathname.includes("/ctx")) {
						retObj = {"uniqueName": smartDevice.uniqueName, "method": "set_ctx", "params": {"value": [url.query.value]}}
						smartDevice.set_ctx(url.query.value, effect, duration, commandSeq);
						console.log("smartserver:httpRequestHandler: set Color Temp url - req.url=" + req.url + 
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
										//console.log("smartserver:httpRequestHandler:getProps in progress prop=" + prop + ":" + retObj.params[prop])
										cb(null);
									});
							}, function(error){
								console.log("smartserver:httpRequestHandler: finished getProps for " + smartDevice.friendlyName + " " + JSON.stringify(retObj))
								resp.writeHead(200, {"Content-Type": "application/json"});
								resp.write(JSON.stringify(retObj));
								resp.end();
							});
						} else if (smartDevice.smartType == "Yeelight") {
							console.log("smartserver:httpRequestHandler:Refresh unknown type " + smartDevice.smartType )
							var tmpInd;
							var tmpProp;
							for (tmpInd in properties[smartDevice.smartType]["Properties"]) {
								tmpProp = properties[smartDevice.smartType]["Properties"][tmpInd];
								retObj.params[tmpProp] = smartDevice[tmpProp];
							}
							console.log("smartserver:httpRequestHandler: finished getProps for " + smartDevice.friendlyName + " " + JSON.stringify(retObj))
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
							if (smartDevice.smartType != "Yeelight") {
								resp.write(JSON.stringify(retObj));
								resp.end();
							} else {
								responseStack[commandSeq] = resp;
								responseObjectStack[commandSeq] = retObj;
								responseUniqueNameStack[commandSeq] = smartDevice.uniqueName;
							}
						}
					} else {
						console.log("smartserver:httpRequestHandler: unknown command/path - req.url=" + req.url + " pathname=" + url.pathname + " query=" + retProps(url.query));
						resp.writeHead(509, {"Content-Type": "text/xml"});
						resp.end();
					}
				} else {
					console.log("smartserver:httpRequestHandler: unexpected url - req.url=" + req.url + " pathname=" + url.pathname + " query=" + retProps(url.query));
					resp.writeHead(509, {"Content-Type": "text/xml"});
					resp.end()
				}
			} else {
				console.log("smartserver:httpRequestHandler: Device Not Found - req.url=" + req.url + " pathname=" + url.pathname + " query=" + retProps(url.query));
				resp.writeHead(508, {"Content-Type": "text/xml"});
				resp.end();
			}
		} else {
			console.log("smartserver:httpRequestHandler: Device not specified in url " + req.url)
			resp.writeHead(103, {"Content-Type": "text/xml"});
			resp.end();
		}
//console.log("smartserver:httpRequestHandler: Responded to /light devName="  + smartDevice.uniqueName + " modelType=" + uniqueName.type)
//console.log("smartserver:httpRequestHandler: Device not Available " + url.query.uniqueName + " length=" + playbulbAgent.btDevices.length + " names=" + nms)
//console.log("smartserver:httpRequestHandler: deviceMac not in smartMacs array deviceMac=" + deviceMac);
	}
}
function writeDeviceDescriptionResponse(resp, ssdpDeviceType, friendlyName, uniqueName, IP, port, modelInfo) {
	resp.write("<?xml version=\"1.0\"?> ");
	resp.write("<root xmlns=\"urn:schemas-upnp-org:device:" + ssdpDeviceType + ":1\">");
	resp.write("<device>");
	resp.write("<deviceType>urn:schemas-upnp-org:device:" + ssdpDeviceType + ":1</deviceType>");
	resp.write("<friendlyName>" + friendlyName + "</friendlyName>");
	resp.write("<uniqueName>" + uniqueName + "</uniqueName>");
	resp.write("<UDN>" + uniqueName + "</UDN>");
	resp.write("<IP>" + IP + "</IP>");
	resp.write("<port>" + port + "</port>");
	if (modelInfo) {
		resp.write("<modelInfo>");
		for (var key in modelInfo) {
			resp.write("<" + "key" + ">" + modelInfo[key] + "<" + "/key" + ">")
		}
		resp.write("</modelInfo>");
	}
	resp.write("</device>");
	resp.write("</root>");	
}
function retProps(obj,onlyNames = false){
	var props=""
	if (obj) {
		for (var property in obj) {
			if (Object.hasOwnProperty.call(obj, property)) {
				var prp=obj[property]
				if (typeof(prp)=="object"){
					prp="OBJECT"
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