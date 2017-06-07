#!/usr/bin/env node
/*
Yeelight node.js bridge
This is a node.js server supporting Yeelight Devices.  This node server will:
a.  receive raw yeelight device commands from SmartThings.
b.  send the command to the yeelight device.
c.  return the response raw data to the SmartThings from the yeelight Device.
d.  provides an interface to the bridge.groovy file which monitors this process and provides the ability to restart the PC.  Installation of the YeelightBridge.groovy DH is NOT REQUIRED for this program to work properly.

History:
05-May-2017 - Initial release
*/
//-------------------------------------------------------------------------------
"use strict";
console.log("Yeelight Bridge - Manage Yeelight devices")
var http = require('http')
var URL = require('url')
var net = require('net')
var yeeLight = require('./yee.js');
var COLORS=require("color-convert")
var SSDP = require('node-ssdp').Server
var ip=require("ip")
var uuid=require('uuid/v1')
var ARP=require('node-arp')
var NCONF=require('nconf')
NCONF.argv()
	.env()
	.file({ file: './config.json' });
const serverPort=NCONF.get("bridge").port
const bridgeMac=require('node-getmac').replace(/:/g,"").toUpperCase()
const yeelightTransition=NCONF.get("yeelight").transition
var handleSSDPEvents = {}
var smartSDDPs=[],smartLocations=[],smartIDs=[],smartMacs=[],macSmarts=[],smartDevs=[],yeeConfigs=[]
var messageStack=[],deviceNameForResponse=[]
var properties=["power","name","bright","ct","rgb","hue","sat","color_mode","delayoff","flowing","flow_params","music_on"]
var yeeSSDPHandler  = new yeeLight.YeeAgent("0.0.0.0",handleSSDPEvents)
yeeSSDPHandler.startDisc()
//var bridgeMac=require('node-getmac').replace(/:/g,"").toUpperCase()

console.log("Yeelight Bridge - Starting SSDP Annoucements for Bridge Device (YeeBridge) IP:PORT=" + ip.address() + ":" + serverPort + " mac=" + bridgeMac)
var	yeeBridgeSSDP = new SSDP({allowWildcards:true,sourcePort:1900,udn:"YeeBridge "+uuid(),location:"http://"+ ip.address() + ":" + serverPort + '/bridge'})
	yeeBridgeSSDP.addUSN('urn:schemas-upnp-org:device:YeeBridge:1')
	yeeBridgeSSDP.start()
	
var server = http.createServer(httpRequestHandler)
var configs={pos:"off", transition:"Sudden", dcolor:"Previous", custom:"", level:100, transitionspeed:250, autooff:0}
/*
<Value type="list" byteSize="1" index="pos" label="Boot Up State" min="0" max="2" value="0" setting_type="lan" fw="">
<Value type="list" byteSize="1" index="transition" label="Default Transition" min="0" max="1" value="0" setting_type="preference" fw="">
<Value type="list" byteSize="1" index="dcolor" label="Default Color" min="" max="" value="" setting_type="lan" fw="">
<Value type="text" byteSize="1" index="custom" label="Custom Color in Hex" min="" max="" value="" setting_type="preference" fw="">
<Value type="number" byteSize="1" index="level" label="Default Level" min="1" max="100" value="" setting_type="preference" fw="">
<Value type="list" byteSize="1" index="transitionspeed" label="Transition Speed" min="1" max="3" value="1" setting_type="lan" fw="">
<Value type="number" byteSize="1" index="autooff" label="Auto Off" min="0" max="65536" value="0" setting_type="lan" fw="" disabled="true">
*/

server.listen(serverPort)
function retProps(obj){
	var props=""
	for (var property in obj) {
		if (obj.hasOwnProperty(property)) {
			if (props=="") {
				props=property+":"+obj[property]
			} else {
				props=props+","+property+":"+obj[property]
			}
		}
	}
return props
}
function retPropNames(obj){
	var props=""
	for (var property in obj) {
		if (obj.hasOwnProperty(property)) {
			if (props=="") {
				props=property
				props=props+","+property
			}
		}
	}
return props
}
//function httpRequestHandler(req,resp) {
function httpRequestHandler(req,resp) {
	req.on("error",function(err){
		console.error("httpRequestHandler: request onerror:"+err);
		resp.statusCode = 400;
		resp.end();
	})
	resp.on('finish', function(err) {
		//console.error("Debug Finish event "+ retPropNames(err) );
	});
	resp.on('error', function(err) {
		console.error("httpRequestHandler: response onerror:"+err);
	});
		var devName,devMac,devIP,devID
		var comm=""
		if (req.url.includes("HubAction") || req.url.includes("HubVerify")  ) {
			var url=URL.parse(req.url, true)
			console.log("httpRequestHandler: received request url=" + req.url + " query=" + retProps(url.query))
			//console.log("httpRequestHandler  transition=" + url.query.transition + " transitionspeed=" + url.query.transitionspeed)
			var posAfterHubAction=req.url.indexOf("/HubAction/")+11
			var posAfterMac=req.url.indexOf("/",posAfterHubAction)+1
			var posAfterCommand=req.url.indexOf("?",posAfterMac)
			var yeeDevice
			if (req.url.includes("HubAction")){
				devMac = req.url.slice(posAfterHubAction,posAfterMac-1)
				devName = smartMacs[devMac]
				devID = smartMacs[devMac]
				if (posAfterCommand!=-1) {comm=req.url.slice(posAfterMac,posAfterCommand)} else {comm=req.url.slice(posAfterMac)}
			} else {
				devName = req.url.slice(posAfterHubAction+1)
				devMac = macSmarts[devName]
				devID = req.url.slice(posAfterHubAction+1)
				yeeDevice = smartDevs[devID]
				comm="deviceDescription"
			}
			this.respDone=function(){
				//console.log("response sent! ")
			}
			function doCommand(resp,devMac,method,params,id,devName,stColor){
				if (params) {
					resp.writeHead(200, {"Content-Type": "application/json"}); //application/json
					resp.write(JSON.stringify({"deviceID":devMac,"stColor":stColor,"method":method,"params":params}))
				}
				messageStack[id]=resp
				deviceNameForResponse[id]=devName
				//console.log("httpRequestHandler: doCommand: devMac=" + devMac +
				//			" method=" + method + " params="+retProps(params) +
				//			" id=" + id + " devName=" + devName)
			}
			//console.log("httpRequestHandler: method=" + req.method + " devMac=" + devMac + " devName=" + devName + 
			//				" command=" + comm + " url=" +req.url+ " query=" + retProps(url.query))
			if (smartDevs[devName]) {
				devIP=smartDevs[devName].host
				var yeeLightEffect=url.query.transition
				var yeeLightDuration=url.query.transitionspeed
				if ( (yeeLightEffect!="Smooth") && ((yeeLightEffect!="Sudden")) ) {(yeeLightEffect=="Sudden")};
				if ( (!yeeLightDuration) || (yeeLightDuration<30) || (yeeLightDuration>2000) ) {yeeLightDuration=500};
				var id = 1 + (Math.random() * 1e3) & 0xff;		
				switch (comm) {
					case "on":			
					case "off":
						smartDevs[devName].setPower((comm=="on")?1:0,yeeLightEffect.toLowerCase(),yeeLightDuration,id)
						doCommand(resp,devMac,"set_power",{"value":[comm,yeeLightEffect.toLowerCase(),yeeLightDuration]},id,devName,null)
					break
					case "set_bright":
						smartDevs[devName].set_bright(url.query.value,yeeLightEffect.toLowerCase(),yeeLightDuration,id)
						doCommand(resp,devMac,"set_bright",{"value":[url.query.value,yeeLightEffect.toLowerCase(),yeeLightDuration]},id,devName,null)
					break
					case "ctx":
						smartDevs[devName].set_ctx(url.query.value,yeeLightEffect.toLowerCase(),yeeLightDuration,id)
						doCommand(resp,devMac,"set_ctx",{"value":[url.query.value,yeeLightEffect.toLowerCase(),yeeLightDuration]},id,devName,null)
					break
					case "rgb":
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
						//console.log("DEBUG HUE="+hsl[0])
						/*stColorValue = {	red:rgb[0], green:rgb[1], blue:rgb[2],
											hue:((hsl[0]/360)*100),saturation:hsl[1],
											hex:hex }*/
						stColorValue = {	red:rgb[0], green:rgb[1], blue:rgb[2],
											hue:qQuery.hue,saturation:qQuery.saturation,
											hex:hex }
						
						//console.log("httpRequestHandler rgb="+retProps(rgb) + " hsl=" + retProps(hsl) + " hex=" + hex + " stColorValue=" + retProps(stColorValue))
						smartDevs[devName].setRGB(stColorValue.red,stColorValue.green,stColorValue.blue,yeeLightEffect.toLowerCase(),yeeLightDuration,id)
						doCommand(resp,devMac,"set_rgb",{"value":[rgb,yeeLightEffect.toLowerCase(),yeeLightDuration]},id,devName,stColorValue)
					break
					case "refresh":
						smartDevs[devName].get_props(id)
						doCommand(resp,devMac,"get_props",null,id,devName,null)
						deviceNameForResponse[id]=devName		
					break
					case "configGet":
					case "configSet":
						//console.log("httpRequestHandler: " + comm + " received params=" + retProps(url.query))
						resp.writeHead(200, {"Content-Type": "application/json"}); //application/json
						var retval={}
						if (yeeConfigs[devName]) {
							//console.log("httpRequestHandler:Configs found     : " + retProps(yeeConfigs[devName]))
							if (comm=="configSet") {
								yeeConfigs[devName][url.query["name"]]=url.query["value"]
							}
							if (!yeeConfigs[devName][url.query["name"]]) {
								yeeConfigs[devName][url.query["name"]]=configs["value"]
								
							}
							retval[url.query["name"]]=yeeConfigs[devName][url.query["name"]]
							//console.log("httpRequestHandler:Configs returning: " + retProps(retval))
							resp.write(JSON.stringify({"deviceID":devMac,"stColor":null,"method":comm,"params":retval}))
						} else {
							//console.log("httpRequestHandler:found Configs Not found returning default")
							resp.write(JSON.stringify({"deviceID":devMac,"stColor":null,"method":comm,"params":configs}))
						}
						resp.end(this.respDone);
					break			
					case "deviceDescription":
						resp.writeHead(200, {"Content-Type": "text/xml"});
						writeDeviceDescriptionResponse(resp,bridgeMac,devMac,devName,devIP)
						resp.write("<yeeName>"+yeeDevice.name+"</yeeName>");
						resp.write("<ctx>"+yeeDevice.ctx+"</ctx>");
						resp.write("<firmware>"+yeeDevice.fw_ver+"</firmware>");
						resp.write("<support>"+yeeDevice.support+"</support>");
						resp.write("</device>");
						resp.write("</root>");					
						resp.end(this.respDone);
						//console.log("httpRequestHandler: Response sent for deviceDescription - url"+req.url)
					break
					default:
						console.log("httpRequestHandler: Unknown Command comm="+comm)
						resp.writeHead(400, {"Content-Type": "application/json"}); //application/json
						resp.write("Unknown Command -"+comm)
						resp.end(this.respDone);
				}
			} else {
				console.log("httpRequestHandler: Can't find device "+devName+" devMac="+devMac+" req.url="+req.url)
				resp.writeHead(400, {"Content-Type": "application/json"}); //application/json
				resp.write("Can't find device "+devName)
				resp.end(this.respDone);
			}
		} else {
			//console.log("httpRequestHandler: DEBUG - device description responded url="+req.url)
			resp.writeHead(200, {"Content-Type": "text/xml"});
			writeDeviceDescriptionResponse(resp,bridgeMac,devMac,devName,devIP)
			resp.write("</device>");
			resp.write("</root>");
			if (req.url!= "/light" && req.url!="/bridge") {
				console.log("httpRequestHandler: Weird - device description responded url="+req.url)
			}
			resp.end(this.respDone);
		} 
		if (req.url!= "/light" && req.url!="/bridge"){
			//console.log("DEBUG Finished handling request uri="+req.url)
		}
}
handleSSDPEvents.onDevFound = function(dev) {
		if (dev.did in smartIDs) {
			console.log("onDevFound: Already found " + dev.did + " " + dev.name)
		} else {
			console.log("onDevFound: Adding device " + dev.did + " " + dev.name + " host=" + dev.host+":"+dev.port )
			smartSDDPs[did]=null
			smartIDs[did]=dev.name
			smartLocations[did]=dev.host+":"+dev.port
			yeeConfigs[did]= Object.assign({}, configs);
		}
		
	}
handleSSDPEvents.onDevConnected = function(dev) {
		//console.log("onDevConnected: host:port=" + dev.host + ":" + dev.port + " " + dev.did + " model=" + dev.model + " bright:hue:sat=" + dev.bright + ":" + dev.hue + ":" + dev.sat)
		var startSDDP = true
		if (dev.did in smartIDs) {
			if (dev.name == smartIDs[dev.did] && dev.host+":"+dev.port == smartLocations[dev.did] && smartSDDPs[dev.did] != null) {
				startSDDP = false
				//console.log("onDevConnected: Device already advertised with correct details" + dev.did + " " + dev.name)
			} else {
				startSDDP = true
				delete smartSDDPs[did]
			}
		}
		if (startSDDP){
			ARP.getMAC(dev.host,function(notFound,result){
				if (notFound) {
					console.log("onDevConnected:getMAC MAC notFound dev.did=" + dev.did + " dev.host=" + dev.host +  result)
				} else {
					var mac=result.replace(/:/g,"").toUpperCase()
					console.log("onDevConnected: Creating SSDP Server for did=" + dev.did + " name=" + dev.name + " MAC=" + mac + 
							" location=" + "http://"+ ip.address() + ":" + serverPort + '/light' + " dev location=" + dev.host + ":" + dev.port)
					smartSDDPs[dev.did] = new SSDP({allowWildcards:true,sourcePort:1900,udn:dev.did,location:"http://"+ ip.address() + ":" + serverPort + '/light'})
					smartSDDPs[dev.did].addUSN('urn:schemas-upnp-org:device:YeeLight:1')
					smartIDs[dev.did]=dev.name
					smartLocations[dev.host+":"+dev.port]=dev.did
					smartMacs[mac]=dev.did
					macSmarts[dev.did]=mac
					smartSDDPs[dev.did].start()
					smartDevs[dev.did]=dev
				}
			})
		}
		
	}
handleSSDPEvents.onDevDisconnected = function(dev) {
		console.log("onDevDisconnected: host:port=" + dev.host + ":" + dev.port + " " + dev.did + " model=" + dev.model + " bright:hue:sat=" + dev.bright + ":" + dev.hue + ":" + dev.sat)
		if (dev.did in smartIDs) {
			delete smartSDDPs[did]
			delete smartLocations[did]
			delete smartIDs[did]
		} else {
			console.log("onDevDisconnected: ERROR DEVICE NOT FOUND" + dev.did + " " + dev.name)
		}
	}
handleSSDPEvents.onDevPropChange = function(dev, prop, val,ind) {
		//console.log("onDevPropChange:(1)  " + dev.did + " prop: " + prop+ " ind=" + ind + " val: " + val)
		if (prop=="all") {
			if (ind in messageStack) {
				var result, stuff
				try {
					result=JSON.parse(val)["result"]
					stuff=JSON.parse(val)
				} catch(e) {
					result="Invalid result"
				}
				console.log("onDevPropChange: (2)" + dev.did + " response received id=" + ind + " prop: " + prop + " result is "+ result + " response.finished=" + messageStack[ind].finished)					
				var res={}
				if (result=="ok") {
					messageStack[ind].end();
					//console.log("onDevPropChange: Result OK")
				} else if (typeof(result)=="object") {
					for (var index in properties) {
						//console.log("DEBUG: index=" + index + " property=" + properties[index] + "result=" + result[index])
						if (result[index]) {
							res[properties[index]]=result[index]
						} else {
							res[properties[index]]=null
						}
					}
					var devMac=macSmarts[deviceNameForResponse[ind]]
					messageStack[ind].writeHead(200, {"Content-Type": "application/json"}); //application/json
					messageStack[ind].write(JSON.stringify({"deviceID":devMac,"method":"get_props",
															"params":res}))							
					messageStack[ind].end();
					//console.log("Received object as result ="+JSON.stringify({"props":res}))
 				} else {
					messageStack[ind].end();
					console.log("onDevPropChange: Result NOT OK result="+result+" stuff="+retProps(stuff))
				}
				//console.log("onDevPropChange: (3)" + dev.did + " response received id=" + ind + " prop: " + prop + " result is "+ result + " response.finished=" + messageStack[ind].finished)				
				messageStack[ind]=null
				deviceNameForResponse[ind]=null
			} else if (ind!=1) {
				console.log("onDevPropChange: Weird response but no request received") 
			}
		} else {
			//console.log("onDevPropChange: (3)" + dev.did + " response received id=" + ind + " prop: " + prop + " result is "+ result)
		}
		//console.log("onDevPropChange: host:port=" + dev.host + ":" + dev.port + " model=" + dev.model + " bright:hue:sat=" + dev.bright + ":" + dev.hue + ":" + dev.sat)
	}
function writeDeviceDescriptionResponse(resp,bridgeMac,devMac,devName,devIP) {
	resp.write("<?xml version=\"1.0\"?> ");
	resp.write("<root xmlns=\"urn:schemas-upnp-org:device:YeeLight:1\">");
	resp.write("<device>");
	resp.write("<deviceType>urn:schemas-upnp-org:device:YeeLight:1</deviceType>");
	resp.write("<friendlyName>Yeelight RGBBulb</friendlyName>");
	resp.write("<bridgeMac>"+bridgeMac+"</bridgeMac>");
	resp.write("<devMac>"+devMac+"</devMac>");
	resp.write("<UDN>"+devName+"</UDN>");
	resp.write("<devIP>"+devIP+"</devIP>");
	resp.write("<devPort>"+1982+"</devPort>");
	resp.write("<bridgeIP>"+ip.address()+"</bridgeIP>");
	resp.write("<bridgePort>"+serverPort+"</bridgePort>");
	//resp.write("<UDN>uuid:0622707c-da97-4286-cafe-001ff3590148</UDN>");
	//resp.write("</device>");
	//resp.write("</root>");
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
