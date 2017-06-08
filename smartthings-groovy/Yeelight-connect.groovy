/**
 *  Yeelight
 *
 *  Copyright 2017 WEI WEI
 *
 *  Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
 *  in compliance with the License. You may obtain a copy of the License at:
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software distributed under the License is distributed
 *  on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License
 *  for the specific language governing permissions and limitations under the License.
 *
 */
definition(
    name: "Yeelight Connect",
    namespace: "davec1001",
    author: "David Creager",
    description: "Allows you to connect your Yeelight smart lights (Singapore only currently) with SmartThings and control them from your Things area or Dashboard in the SmartThings Mobile app.",
    category: "SmartThings Labs",
    iconUrl: "https://s3.amazonaws.com/yeelight-images/yeelightlogo.png",
    iconX2Url: "https://s3.amazonaws.com/yeelight-images/yeelightlogo%402x.png",
    iconX3Url: "https://s3.amazonaws.com/yeelight-images/yeelightlogo%402x.png",
    singleInstance: true)




preferences {
	page(name: "mainPage")
    page(name: "configurePDevice")
    page(name: "deletePDevice")
    page(name: "changeName")
    page(name: "discoveryPage", title: "Device Discovery", content: "discoveryPage", refreshTimeout:5)
    page(name: "addDevices", title: "Add Yeelight Devices", content: "addDevices")
    page(name: "deviceDiscovery")
}

def mainPage() {
	dynamicPage(name: "mainPage", title: "Manage your Yeelight Devices", nextPage: null, uninstall: true, install: true) {
        section("Configure"){
           href "deviceDiscovery", title:"Discover Devices", description:""
        }
        section("Scene"){
        	input(name:"scene", required:false, type:"enum",title:"Scene", options:["None", "Candle", "Date Night", "Notify", "Happy Birthday", 
            									"Welcome Home", "Movie Night", "Good Night", "Romantic", "Sunrise", "Sunset"])
        }
        section("Installed Devices"){
            getChildDevices().sort({ a, b -> a["deviceNetworkId"] <=> b["deviceNetworkId"] }).each {
                href "configurePDevice", title:"$it.label", description:"", params: [did: it.deviceNetworkId]
            }
        }
    }
}

def configurePDevice(params){
   def currentDevice
   getChildDevices().each {
       if(it.deviceNetworkId == params.did){
           state.currentDeviceId = it.deviceNetworkId
           state.currentDisplayName = it.displayName
       }      
   }
   if (getChildDevice(state.currentDeviceId) != null) getChildDevice(state.currentDeviceId).configure()
   dynamicPage(name: "configurePDevice", title: "Configure Yeelight Devices created with this app", nextPage: null) {
		section {
            app.updateSetting("${state.currentDeviceId}_label", getChildDevice(state.currentDeviceId).label)
            input "${state.currentDeviceId}_label", "text", title:"Device Name", description: "", required: false
            href "changeName", title:"Change Device Name", description: "Edit the name above and click here to change it", params: [did: state.currentDeviceId]
        }
        section {
              href "deletePDevice", title:"Delete $state.currentDisplayName", description: "", params: [did: state.currentDeviceId]
        }
   }
}




def deletePDevice(params){
    try {
        unsubscribe()
        deleteChildDevice(state.currentDeviceId)
        dynamicPage(name: "deletePDevice", title: "Deletion Summary", nextPage: "mainPage") {
            section {
                paragraph "The device has been deleted. Press next to continue"
            } 
        }
    
	} catch (e) {
        dynamicPage(name: "deletePDevice", title: "Deletion Summary", nextPage: "mainPage") {
            section {
                paragraph "Error: ${(e as String).split(":")[1]}."
            } 
        }
    
    }
}

def changeName(params){
    def thisDevice = getChildDevice(state.currentDeviceId)
    thisDevice.label = settings["${state.currentDeviceId}_label"]

    dynamicPage(name: "changeName", title: "Change Name Summary", nextPage: "mainPage") {
	    section {
            paragraph "The device has been renamed. Press \"Next\" to continue"
        }
    }
}

def discoveryPage(){
   return deviceDiscovery()
}

def deviceDiscovery(params=[:])
{
	def devices = devicesDiscovered()
    
	int deviceRefreshCount = !state.deviceRefreshCount ? 0 : state.deviceRefreshCount as int
	state.deviceRefreshCount = deviceRefreshCount + 1
	def refreshInterval = 3
    
	def options = devices ?: []
	def numFound = options.size() ?: 0

	if ((numFound == 0 && state.deviceRefreshCount > 25) || params.reset == "true") {
    	log.trace "Cleaning old device memory"
    	state.devices = [:]
        state.deviceRefreshCount = 0
        app.updateSetting("selectedDevice", "")
    }

	ssdpSubscribe()
	if((deviceRefreshCount % 5) == 0) {
		ssdpDiscover()
	}
	//setup.xml request every 3 seconds except on discoveries
	if(((deviceRefreshCount % 3) == 0) && ((deviceRefreshCount % 5) != 0)) {
		verifyDevices()
	}

	return dynamicPage(name:"deviceDiscovery", title:"Discovery Started!", nextPage:"addDevices", refreshInterval:refreshInterval, uninstall: true) {
		section("Please wait while we discover your Yeelight devices. Discovery can take five minutes or more, so sit back and relax! Select your device below once discovered.") {
			input "selectedDevices", "enum", required:false, title:"Select Yeelight Devices (${numFound} found)", multiple:true, options:options
		}
        section("Options") {
			href "deviceDiscovery", title:"Reset list of discovered devices", description:"", params: ["reset": "true"]
		}
	}
}

Map devicesDiscovered() {
	def vdevices = getVerifiedDevices()
	def map = [:]
	vdevices.each {
		def value = "${it.value.name}"
		def key = "${it.value.mac}"
		map["${key}"] = value
	}
	map
}

def getVerifiedDevices() {
	getDevices().findAll{ it?.value?.verified == true }
}


def configured() {
	
}

def buttonConfigured(idx) {
	return settings["lights_$idx"]
}

def isConfigured(){
   if(getChildDevices().size() > 0) return true else return false
}

def isVirtualConfigured(did){ 
    def foundDevice = false
    getChildDevices().each {
       if(it.deviceNetworkId != null){
       if(it.deviceNetworkId.startsWith("${did}/")) foundDevice = true
       }
    }
    return foundDevice
}

private virtualCreated(number) {
    if (getChildDevice(getDeviceID(number))) {
        return true
    } else {
        return false
    }
}

private getDeviceID(number) {
    return "${state.currentDeviceId}/${app.id}/${number}"
}


def installed() {
	log.debug("installed: setting bridgeIP and port to blank, was " + state.bridgeIP + ":" + state.bridgePort )
	//state.bridgeIP=""
	//state.bridgePort=""
	initialize()
}

def updated() {
	log.debug("updated:  bridgeIP and port=" + state.bridgeIP + ":" + state.bridgePort )
	unsubscribe()
    unschedule()
	initialize()
}

def initialize() {
	log.debug("initialize:  bridgeIP and port=" + state.bridgeIP + ":" + state.bridgePort )	
    ssdpSubscribe()
    runEvery5Minutes("ssdpDiscover")
}


void ssdpDiscover() {
		log.debug("ssdpDiscover: Bridge IP="+state.bridgeIP+":"+state.bridgePort)
		log.debug "ssdpDiscover: lan discovery urn:schemas-upnp-org:device:YeeLight:1"
		sendHubCommand(new physicalgraph.device.HubAction("lan discovery urn:schemas-upnp-org:device:YeeLight:1", physicalgraph.device.Protocol.LAN))
		log.debug("ssdpDiscover: Discovering bridge IP")
		sendHubCommand(new physicalgraph.device.HubAction("lan discovery urn:schemas-upnp-org:device:YeeBridge:1", physicalgraph.device.Protocol.LAN))		
}

void ssdpSubscribe() {
	log.debug "ssdpSubscribe: ssdpTerm.urn:schemas-upnp-org:device:YeeLight:1"
    subscribe(location, "ssdpTerm.urn:schemas-upnp-org:device:YeeLight:1", ssdpHandler)
	subscribe(location, "ssdpTerm.urn:schemas-upnp-org:device:YeeBridge:1", ssdpHandler)
	log.debug "ssdpSubscribe: ssdpTerm.urn:schemas-upnp-org:device:YeeBridge:1"
}
def ssdpHandler(evt) {
    def description = evt.description
	def hub = evt?.hubId
	def parsedEvent = parseLanMessage(description)
	log.debug("ssdpHandler: description="+evt.description)
	if ( description?.contains("YeeBridge") || description?.contains("YeeLight") ) {
 		if ( description?.contains("YeeBridge") ) {
			state.bridgeIP = convertHexToIP(parsedEvent.networkAddress)
			state.bridgePort = convertHexToInt(parsedEvent.deviceAddress)
			log.debug("ssdpHandler:" + " Setting Bridge ip and port " + state.bridgeIP+":" + state.bridgePort+" ssdpUSN=" + parsedEvent?.ssdpUSN?.toString())
		} else {
            parsedEvent << ["hub":hub]
            def devices = getDevices()
            String ssdpUSN = parsedEvent.ssdpUSN.toString()
            //log.debug("ssdpHandler:"+description+" ssdpUSN="+ssdpUSN)#
            def lightDeviceName
            if (ssdpUSN?.indexOf("::urn") > 1){
                lightDeviceName = ssdpUSN[0..(ssdpUSN?.indexOf("::urn") - 1)]
            }
            log.debug("ssdpHandler: Bridge "+state.bridgeIP+":"+state.bridgePort + "light device="+lightDeviceName)
            log.debug("ssdpHandler:"+" ssdpUSN="+ssdpUSN)
            if (devices."${ssdpUSN}") {
                def d = devices."${ssdpUSN}"
                def child = getChildDevice(parsedEvent.mac)
                log.debug("ssdpHandler:"+" child="+child)
                def childIP
                def childPort
                if (child) {
                    childIP = child.getDeviceDataByName("ip")
                    childPort = child.getDeviceDataByName("port").toString()
                    log.debug "Device data: ($childIP:$childPort) - reporting data: (${convertHexToIP(parsedEvent.networkAddress)}:${convertHexToInt(parsedEvent.deviceAddress)})."
                    if(childIP != convertHexToIP(parsedEvent.networkAddress) || childPort != convertHexToInt(parsedEvent.deviceAddress).toString()){
                        log.debug "Device data (${child.getDeviceDataByName("ip")}) does not match what it is reporting(${convertHexToIP(parsedEvent.networkAddress)}). Attempting to update."
                        child.sync(convertHexToIP(parsedEvent.networkAddress), convertHexToInt(parsedEvent.deviceAddress).toString())
                    }
                }
                if (d.networkAddress != parsedEvent.networkAddress || d.deviceAddress != parsedEvent.deviceAddress) {
                    d.networkAddress = parsedEvent.networkAddress
                    d.deviceAddress = parsedEvent.deviceAddress
                }
            } else {
                log.debug("ssdpHandler: Adding Device"+" parsedEvent="+parsedEvent)
                log.debug("ssdpHandler: Adding Device ssdpPath="+parsedEvent?.ssdpPath?.toString()+" ssdpUSN="+parsedEvent?.ssdpUSN?.toString())
                devices << ["${ssdpUSN}": parsedEvent]
            }
        }

	} else {
		log.debug("ssdpHandler: Received an unknown device code in description - description="+description)
	}
}

void verifyDevices() {
	//devicetype:04, mac:000E58F0FFFF, networkAddress:0A00010E, deviceAddress:0578, stringCount:04, ssdpPath:/xml/device_description.xml, ssdpUSN:uuid:RINCON_000E58F0FFFFFF400::urn:schemas-upnp-org:device:ZonePlayer:1, ssdpTerm:urn:schemas-upnp-org:device:ZonePlayer:1, ssdpNTS:
	if (state.bridgeIP) {
		def devices = getDevices().findAll { it?.value?.verified != true }
		log.debug("verifyDevices: Bridge ip and port " + state.bridgeIP+":" + state.bridgePort)
		devices.each {
			def ip = convertHexToIP(it.value.networkAddress)
			def port = convertHexToInt(it.value.deviceAddress)
			String ssdpUSN = it.value.ssdpUSN.toString()
			def lightDeviceName
			if (ssdpUSN?.indexOf("::urn") > 1){
				lightDeviceName = ssdpUSN[0..(ssdpUSN?.indexOf("::urn") - 1)]
			}			
			String host = "${ip}:${port}"
			//def uri="http://"+state.bridgeIP+":"+state.bridgePort+it.value.ssdpPath+"/HubAction/"+lightDeviceName
            def uri="/HubVerify/"+lightDeviceName
			log.debug("verifyDevices: ssdpPath="+it.value.ssdpPath+" host="+host+" uri="+uri+" mac="+it.value.mac)
			sendHubCommand(new physicalgraph.device.HubAction("""GET ${uri} HTTP/1.1\r\nHOST: $host\r\n\r\n""",
					physicalgraph.device.Protocol.LAN,
					mac,
					[callback: deviceDescriptionHandler]))
		}
	} else {
		log.debug("verifyDevices: bridge ip not set")
	}
}

def getDevices() {
    state.devices = state.devices ?: [:]
}

void deviceDescriptionHandler(physicalgraph.device.HubResponse hubResponse) {
	log.debug("deviceDescriptionHandler: status="+hubResponse.status+" json="+hubResponse.json+" xml="+hubResponse.xml+" body="+hubResponse.body)
    log.trace "description.xml response (application/xml)"
	def body = hubResponse.xml
    log.debug("deviceDescriptionHandler: incoming key="+body?.device?.UDN?.text())
    log.debug body?.device?.friendlyName?.text()
	def devices = getDevices()
	def device = devices.find {it?.key?.contains(body?.device?.UDN?.text())}
    devices.each {
    	log.debug("deviceDescriptionHandler: "+it?.key)
    }
	if (device) {
    	if (state.bridgeMac==null) {
        	state.bridgeMac=body?.device?.bridgeMac?.text()
            log.debug("deviceDescriptionHandler: bridgeMac set to "+body?.device?.bridgeMac?.text())
         }
        device.value << [	name: body?.device?.friendlyName?.text() + " (" + body?.device?.devIP?.text() + ")", 
        					serialNumber: body?.device?.serialNumber?.text(), 
        					UDN: body?.device?.UDN?.text(),
                            mac: body?.device?.devMac?.text(),
                            devIP: body?.device?.devIP?.text(),
                            devPort:body?.device?.devPort?.text(),
                            bridgeIP:body?.device?.bridgeIP?.text(),
                            bridgePort:body?.device?.bridgePort?.text(),
                            bridgeMac:body?.device?.bridgeMac?.text(),
                            devMac:body?.device?.devMac?.text(),
                            yeeName:body?.device?.yeeName?.text(),
                            firmware:body?.device?.firmware?.text(),
                            support:body?.device?.support?.text(),
                            verified: true]
        log.debug("deviceDescriptionHandler: Adding Device name="+body?.device?.friendlyName?.text() + " (" + convertHexToIP(hubResponse.ip) + ")"+" mac="+body?.device?.mac?.text())
        log.debug("deviceDescriptionHandler: devIP="+body?.device?.devIP?.text()+" devPort="+body?.device?.devPort?.text()+" devMac="+body?.device?.devMac?.text()+
        									" bridgeIP="+body?.device?.bridgeIP?.text()+" bridgePort="+body?.device?.bridgePort?.text()+" bridgeMac="+body?.device?.bridgeMac?.text())
	} else {
		log.error "/description.xml returned a device that didn't exist"
	}
}

def addDevices() {
    def devices = getDevices()
    def sectionText = ""

    selectedDevices.each { dni ->bridgeLinking
        def selectedDevice = devices.find { it.value.mac == dni }
        def d
        if (selectedDevice) {
            d = getChildDevices()?.find {
                it.deviceNetworkId == selectedDevice.value.mac
            }
        }

        if (!d) {
            log.debug selectedDevice
            log.debug "Creating Yeelight Device with dni: ${selectedDevice.value.mac} ip="+convertHexToIP(selectedDevice.value.networkAddress)
            log.debug Integer.parseInt(selectedDevice.value.deviceAddress,16)
            addChildDevice("davec1001", (selectedDevice?.value?.name?.startsWith("Yeelight") ? "Yeelight RGBW Light" : "Yeelight RGBW Light"), selectedDevice.value.mac, selectedDevice?.value.hub, [
                "label": selectedDevice?.value?.name ?: "Yeelight RGBW Light",
                "data": [
                    "mac": selectedDevice.value.devMac.toUpperCase(),
                    "ip": convertHexToIP(selectedDevice.value.networkAddress),
                    "port": "" + Integer.parseInt(selectedDevice.value.deviceAddress,16),
                    "UDN":selectedDevice.value.UDN,
                    "devIP":selectedDevice.value.devIP,
                    "devPort":selectedDevice.value.devPort,
                    "bridgeIP":selectedDevice.value.bridgeIP,
                    "bridgePort":selectedDevice.value.bridgePort,
                    "bridgeMac":selectedDevice.value.bridgeMac.toUpperCase(),
                    "devMac":selectedDevice.value.devMac.toUpperCase(),
                    "yeeName":selectedDevice.value.yeeName,
                    "firmware":selectedDevice.value.firmware,
                    "support":selectedDevice.value.support
                ]
            ])
            sectionText = sectionText + "Succesfully added Yeelight device with ip address ${convertHexToIP(selectedDevice.value.networkAddress)} \r\n"
        }
        
	} 
    log.debug sectionText
        return dynamicPage(name:"addDevices", title:"Devices Added", nextPage:"mainPage",  uninstall: true) {
        if(sectionText != ""){
		section("Add Yeelight Results:") {
			paragraph sectionText
		}
        }else{
        section("No devices added") {
			paragraph "All selected devices have previously been added"
		}
        }
}
    }

def uninstalled() {
    getChildDevices().each {
        deleteChildDevice(it.deviceNetworkId)
    }
}



private String convertHexToIP(hex) {
	[convertHexToInt(hex[0..1]),convertHexToInt(hex[2..3]),convertHexToInt(hex[4..5]),convertHexToInt(hex[6..7])].join(".")
}

private Integer convertHexToInt(hex) {
	Integer.parseInt(hex,16)
}

private String convertIPtoHex(ipAddress) { 
    String hex = ipAddress.tokenize( '.' ).collect {  String.format( '%02x', it.toInteger() ) }.join()
    return hex
}

private String convertPortToHex(port) {
	String hexport = port.toString().format( '%04x', port.toInteger() )
    return hexport
}

public  Map getQueryMap( query)
{
    def params = query.split("&");
    Map map = [:]
    //log.debug("getQueryMap: params="+params)
    for (param in params)
    {
        def name = param.split("=")[0];
        def value
        if (param.split("=").size()>1) value = param.split("=")[1];
        map["${name}"]=value
        //log.debug("getQueryMap: value="+value+" params="+params)
    }
    return map;
}

def doThis(childDevice,command) {
	if (childDevice==null) {log.debug("doThis:childDevice is null")}
	def parsedCommand=new URI(command)
    def value=""
    if (parsedCommand.query) value = getQueryMap(parsedCommand.query)["value"]
	def id = childDevice.device?.deviceNetworkId
	def newURI="/HubAction/" + id + command
  	def host = state.bridgeIP+":"+state.bridgePort
  	def headers = getHeader(userpass,host)
	log.debug("doThis: newuri=" + newURI + " name=" + childDevice?.device?.name + " bridgeip=" + state.bridgeIP + ":" + state.bridgePort
    							+ " command=" + command + " value=" + value + " bridge mac=" + state.bridgeMac)    
	if (state.bridgeMac && state.bridgeIP) {
		sendHubCommand(new physicalgraph.device.HubAction([
			method : "GET",
			path   : newURI,
			headers: headers],
            state.bridgeMac,
            [callback: "lightsHandler"]
            ))    
        log.debug("doThis: Sent command to bridge path="+newURI+" responder="+state.bridgeMac+" host="+host)
    } else {
    	log.debug("doThis: cannot send hubcommand bridgeMac="+state.bridgeMac+" bridgeIP="+state.bridgeIP)
    }
  return   
}

void lightsHandler(physicalgraph.device.HubResponse hubResponse) {
    def resp = hubResponse.json
    log.debug("lightsHandler: method=" + resp?.method + " params=" + resp?.params + " value=" + resp?.params?.value)    
    if (resp?.params?.value) {
        log.debug("lightsHandler: value=" + resp?.params?.value + " stColor=" + resp?.stColor + " (1)=" + resp?.params?.value[0] + " (2)=" + resp?.params?.value[1] + " (3)=" + resp?.params?.value[2])
    }
	if (resp?.deviceID) {
        def childDevice=getChildDevice(resp?.deviceID)
        if (childDevice) {
            if (resp?.method=="set_power") {
                childDevice.generateEvent([name: "switch", value: resp?.params?.value[0], displayed: false])
            } else if (resp?.method=="set_rgb") {
            	if (resp?.stColor) {
                    childDevice.generateEvent([name: "color", value: resp.stColor , displayed: false])
				} else {
                    childDevice.generateEvent([name: "color", value: [red:resp?.params?.value[0].r,
                    													green:resp?.params?.value[0].g,
                                                                        blue:resp?.params?.value[0].b,
                                                                        displayed: false]])
                }
            } else if (resp?.method=="set_bright") {
                childDevice.generateEvent([name: "level", value: resp?.params?.value[0] , displayed: false])
            } else if (resp?.method=="set_ctx") {
                childDevice.generateEvent([name: "colorTemperature", value: resp?.params?.value[0] , displayed: false])
            } else if (resp?.method=="configGet") {
            	childDevice.update_current_properties(resp?.params)
            } else if (resp?.method=="configSet") {
            	childDevice.update_current_properties(resp?.params)
            } else if (resp?.method=="get_props") {
            	childDevice.generateEvent([name: "firmware", value: childDevice.getDeviceDataByName("firmware") , displayed: false])
                childDevice.generateEvent([name: "devIP", value: childDevice.getDeviceDataByName("devIP") , displayed: false])
                childDevice.generateEvent([name: "bridgeIP", value: childDevice.getDeviceDataByName("bridgeIP") , displayed: false])
            	for ( entry in resp?.params ) {
                	switch (entry.key) {
                    case "bright":
                    break
                    case "ct":
                    break
                    case "name":
                    break
					case "rgb":
                    break
                    case "":
                    break
					}
                }

            } else {
                log.debug("doThis: Unknown command "+resp?.method)
                return
            }
		} else {
        	log.debug("lightsHandler: ERROR childDevice is null - deviceID=" + resp?.deviceID + " resp="+resp)
        }
	} else {
    	log.debug("lightsHandler: ERROR deviceID is null - resp="+resp)
    }

}

private getHeader(userpass = null,hostIP=null){
    def headers = [:]
    headers.put("HOST", hostIP)
    headers.put("Content-Type", "application/x-www-form-urlencoded")
    if (userpass != null)
       headers.put("Authorization", userpass)
    return headers
}