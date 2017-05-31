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
r XMLESCAPE = require('xml-escape');

//var handleSSDPEvents = {smartSDDPs:[],smartLocations:[],smartIDs:[],smartMacs:[],macSmarts:[]}
var handleSSDPEvents = {}
var smartSDDPs=[],smartLocations=[],smartIDs=[],smartMacs=[],macSmarts=[],smartDevs=[]
var messageStack=[],deviceNameForResponse=[]
var properties=["power","name","bright","ct","rgb","hue","sat","color_mode","delayoff","flowing","flow_params","music_on"]
var yeeSSDPHandler  = new yeeLight.YeeAgent("0.0.0.0",handleSSDPEvents)
yeeSSDPHandler.startDisc()
//00155D012D00
var bridgeMac=require('node-getmac').replace(/:/g,"").toUpperCase()

var serverPort = '8082'  // Same is in various groovy files.
console.log("Yeelight Bridge - Starting SSDP Annoucements for Bridge Device (YeeBridge) IP:PORT=" + ip.address() + ':8082' + " mac=" + bridgeMac)
var	yeeBridgeSSDP = new SSDP({allowWildcards:true,sourcePort:1900,udn:"YeeBridge "+uuid(),location:"http://"+ ip.address() + ':8082/bridge'})
	yeeBridgeSSDP.addUSN('urn:schemas-upnp-org:device:YeeBridge:1')
	yeeBridgeSSDP.start()
	
var server = http.createServer(httpRequestHandler)
var reqCnt=0
var rspCnt=0

server.listen(serverPort)
var doneOnceFor16=false
var doneOnceFor62=false
//var server = http.createServer(httpRequestHandler)
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
	//console.log("DEBUG REQ Handler called "+req.url)
		var devName,devMac,devIP
		var comm=""
		//console.log("DEBUG Start Request (0) url="+req.url)
		if (req.url!= "/light" && req.url!="/bridge"){
			reqCnt++
			//console.log("DEBUG Start Request #"+reqCnt+" uri="+req.url)
		}
		if (req.url.includes("HubAction") || req.url.includes("HubVerify")  ) {
			var url=URL.parse(req.url, true)
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
			//console.log("httpRequestHandler: devMac="+devMac+" devName="+devName+" url="+req.url+" comm="+comm)
			this.respDone=function(){
				//console.log("response sent! ")
			}
			//console.log("httpRequestHandler: method=" + req.method + " devMac=" + devMac + " devName=" + devName + " command=" + comm + " url=" +req.url+ " query=" + retProps(url.query)+" header="+retProps(req.headers))
			console.log("httpRequestHandler: method=" + req.method + " devMac=" + devMac + " devName=" + devName + 
							" command=" + comm + " url=" +req.url+ " query=" + retProps(url.query))
			if (smartDevs[devName]) {
				devIP=smartDevs[devName].host
				//console.log("devIP="+devIP)
				var svdCB=smartDevs[devName].propChangeCb
				var id = 1 + (Math.random() * 1e3) & 0xff;		
				switch (comm) {
					case "on":				
						smartDevs[devName].setPower(1,id)
						writeCommandResponse(resp,JSON.stringify({"deviceID":devMac,"method":"set_power","params":{"value":["on","smooth",500]}}),200);		
						messageStack[id]=resp
						deviceNameForResponse[id]=devName
						console.log("httpRequestHandler: setPower On called with id="+id)
					break
					case "off":
						smartDevs[devName].setPower(0,id)
						writeCommandResponse(resp,JSON.stringify({"deviceID":devMac,"method":"set_power","params":{"value":["off","smooth",500]}}),200)
						messageStack[id]=resp
						deviceNameForResponse[id]=devName
						console.log("httpRequestHandler: setPower Off called with id="+id)
					break
	//				case "status":
	//				break
					case "set_bright":
						smartDevs[devName].set_bright(url.query.value,id)
						writeCommandResponse(resp,JSON.stringify({"deviceID":devMac,"method":"set_bright","params":{"value":[url.query.value,"smooth",500]}}),200)
						messageStack[id]=resp
						deviceNameForResponse[id]=devName
						console.log("httpRequestHandler: set_bright called with id="+id)
					break
					case "ctx":
						smartDevs[devName].set_ctx(url.query.value,id)
						writeCommandResponse(resp,JSON.stringify({"deviceID":devMac,"method":"set_ctx","params":{"value":[url.query.value,"smooth",500]}}),200)
						messageStack[id]=resp
						deviceNameForResponse[id]=devName
						console.log("httpRequestHandler: set_bright called with id="+id)
					break
					case "rgb":
						var rgb=DecToRGB(url.query.value)
						//[red:241, hex:#F1E3FF, saturation:10.980392, blue:255, green:227, hue:75.0]
						var stColorValue={red:rgb.r,green:rgb.g,blue:rgb.b,saturation:COLORS.rgb.hsv.raw(rgb.r,rgb.g,rgb.b)[1],hue:COLORS.rgb.hsv.raw(rgb.r,rgb.g,rgb.b)[0],hex:COLORS.rgb.hex(rgb.r,rgb.g,rgb.b)}
						smartDevs[devName].setRGB(rgb.r,rgb.g,rgb.b,id)
						writeCommandResponse(resp,JSON.stringify({"stColor":stColorValue,"deviceID":devMac,"method":"set_rgb","params":{"value":[rgb,"smooth",500]}}),200)
						messageStack[id]=resp
						deviceNameForResponse[id]=devName
						console.log("httpRequestHandler: setRGB called with id=" + id + " red=" + rgb.r + " green=" + rgb.g + " blue=" + rgb.b)
					break
					case "refresh":
						smartDevs[devName].get_props(id)
						//params:[["power","name","bright","ct","rgb","hue","sat","color_mode","delayoff","flowing","flow_params","music_on"]]}
//						writeCommandResponse(resp,JSON.stringify({"deviceID":devMac,"method":"get_props",
//							"params":properties}),200)
						messageStack[id]=resp
						deviceNameForResponse[id]=devName
						console.log("httpRequestHandler: get_props called with id="+id)					
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
						console.log("httpRequestHandler: Response sent for url"+req.url)
					break
					default:
						console.log("httpRequestHandler: Unknown Command comm="+comm)
						writeCommandResponse(resp,"Unknown Command -"+comm,400)
						resp.end(this.respDone);
				}
			} else {
				console.log("httpRequestHandler: Can't find device "+devName+" devMac="+devMac+" req.url="+req.url)
				writeCommandResponse(resp,"Can't find device "+devName,400)
				resp.end(this.respDone);
			}
		} else {
			resp.writeHead(200, {"Content-Type": "text/xml"});
			writeDeviceDescriptionResponse(resp,bridgeMac,devMac,devName,devIP)
			resp.write("</device>");
			resp.write("</root>");
			if (req.url!= "/light" && req.url!="/bridge") {
				console.log("httpRequestHandler: Weird - device description responded url="+req.url)
			}
			//console.log("About to end response 1 ="+retPropNames(resp))
			resp.end(this.respDone);
		}
		if (req.url!= "/light" && req.url!="/bridge"){
			//console.log("DEBUG Finished handling request #"+reqCnt+" uri="+req.url)
		}



		if ( ( !doneOnceFor16 && req.connection.remoteAddress.includes("192.168.1.16") ) || ( !doneOnceFor62 && req.connection.remoteAddress.includes("192.168.1.62") ) ) {
			req.connection.remoteAddress.includes("192.168.1.16")
			if (req.connection.remoteAddress.includes("192.168.1.16")) doneOnceFor16=true
			if (req.connection.remoteAddress.includes("192.168.1.62")) doneOnceFor62=true
				//console.log("httpRequestHandler: url=" + req.url + "headers=" + retProps(req.headers) + " req remoteAddress="+req.connection.remoteAddress)
		} else {
			if ( !(req.connection.remoteAddress.includes("192.168.1.16")) && !(req.connection.remoteAddress.includes("192.168.1.62")) ) {
				//console.log("httpRequestHandler: url=" + req.url + "headers=" + retProps(req.headers) + " req remoteAddress="+req.connection.remoteAddress)
			}
		}

}
handleSSDPEvents.onDevFound = function(dev) {
		//console.log("onDevFound: " + dev.did + " " + dev.name + " dev power: " + dev.power);
		//console.log("onDevFound: host:port=" + dev.host + ":" + dev.port + " model=" + dev.model + " bright:hue:sat=" + dev.bright + ":" + dev.hue + ":" + dev.sat)
		if (dev.did in smartIDs) {
			//console.log("onDevFound: Already found " + dev.did + " " + dev.name)
		} else {
			//console.log("onDevFound: Adding device " + dev.did + " " + dev.name + " host=" + dev.host+":"+dev.port )
			smartSDDPs[did]=null
			smartIDs[did]=dev.name
			smartLocations[did]=dev.host+":"+dev.port
		}
		
	}
handleSSDPEvents.onDevConnected = function(dev) {
		//console.log("onDevConnected: host:port=" + dev.host + ":" + dev.port + " " + dev.did + " model=" + dev.model + " bright:hue:sat=" + dev.bright + ":" + dev.hue + ":" + dev.sat)
		startSDDP = true
		if (dev.did in smartIDs) {
			//console.log("onDevConnected: Already found " + dev.did + " " + dev.name)
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
					console.log("onDevConnected:getMAC dev.did=" + dev.did + " dev.host=" + dev.host +  result)
				} else {
					var mac=result.replace(/:/g,"").toUpperCase()
					console.log("onDevConnected: Creating SSDP Server for did=" + dev.did + " name=" + dev.name + " MAC=" + mac + 
							" location=" + "http://"+ ip.address() + ':8082/light' + " dev location=" + dev.host + ":" + dev.port)
					smartSDDPs[dev.did] = new SSDP({allowWildcards:true,sourcePort:1900,udn:dev.did,location:"http://"+ ip.address() + ':8082/light'})
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
		rspCnt++
		console.log("onDevPropChange:(1)  #" + rspCnt+" "+ dev.did + " prop: " + prop+ " ind=" + ind + " val: " + val)
		if (prop=="all") {
			if (ind in messageStack) {
				var result, stuff
				try {
					result=JSON.parse(val)["result"]
					stuff=JSON.parse(val)
				} catch(e) {
					result="Invalid result"
				}
				//console.log("onDevPropChange: (2)" + dev.did + " response received id=" + ind + " prop: " + prop + " result is "+ result + " response.finished=" + messageStack[ind].finished)					
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
					writeCommandResponse(messageStack[ind],JSON.stringify({"deviceID":devMac,"method":"get_props",
							"params":res}),200)					
					//messageStack[ind].write(JSON.stringify({"props":res}))
					messageStack[ind].end();
					console.log("Received object as result ="+ retProps(res))
					console.log("Received object as result ="+JSON.stringify({"props":res}))
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
			console.log("onDevPropChange: (3)" + dev.did + " response received id=" + ind + " prop: " + prop + " result is "+ result)
		}
		console.log("onDevPropChange: host:port=" + dev.host + ":" + dev.port + " model=" + dev.model + " bright:hue:sat=" + dev.bright + ":" + dev.hue + ":" + dev.sat)
	}
function writeCommandResponse(resp,comm,htpStatus) {
	//var cmm=XMLESCAPE(comm.replace(/{/g,"").replace(/}/g,""))
	var cmm=encodeXml(comm)
	console.log("writing response comm="+comm)
	//resp.writeHead(htpStatus, {"Content-Type": "text/xml"}); //application/json
	resp.writeHead(htpStatus, {"Content-Type": "application/json"}); //application/json
	resp.write(comm)

	/*
	resp.write("<?xml version=\"1.0\"?> ");
	resp.write("<root>");
	resp.write("<body>");
	resp.write("<command>"+cmm+"</command>")
	//resp.write("<command>Done</command>")
	resp.write("</body>");
	resp.write("</root>");
	*/
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
