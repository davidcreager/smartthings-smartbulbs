/**
 *  Smartbridge
 *
 *  Copyright 2017 David Creager
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
import groovy.json.JsonSlurper
definition(
    name: "Smartbridge Connect",
    namespace: "davec1001",
    author: "David Creager",
    description: "Allows you to connect your Yeelight or Mipow Playbulb smart lights  with SmartThings and control them from your Things area or Dashboard in the SmartThings Mobile app.",
    category: "SmartThings Labs",
    iconUrl: "https://s3.amazonaws.com/yeelight-images/yeelightlogo.png",
    iconX2Url: "https://s3.amazonaws.com/yeelight-images/yeelightlogo%402x.png",
    iconX3Url: "https://s3.amazonaws.com/yeelight-images/yeelightlogo%402x.png",,
    singleInstance: true)




preferences {
	page(name: "mainPage")
    page(name: "configurePDevice")
    page(name: "deletePDevice")
    page(name: "changeName")
    page(name: "discoveryPage", title: "Device Discovery", content: "discoveryPage", refreshTimeout:5)
    page(name: "addDevices", title: "Add  Devices", content: "addDevices")
    page(name: "deviceDiscovery")
}

def mainPage() {
	dynamicPage(name: "mainPage", title: "Manage your Devices", nextPage: null, uninstall: true, install: true) {
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
   dynamicPage(name: "configurePDevice", title: "Configure Devices created with this app", nextPage: null) {
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
		section("Please wait while we discover your devices. Discovery can take five minutes or more, so sit back and relax! Select your device below once discovered.") {
			input "selectedDevices", "enum", required:false, title:"Select Devices (${numFound} found)", multiple:true, options:options
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
		def key = "${it.value.dni}"
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
    log.debug("API = " + getApiServerUrl())
	unsubscribe()
    unschedule()
	initialize()
}

def initialize() {
	log.debug("initialize:  bridgeIP and port=" + state.bridgeIP + ":" + state.bridgePort )	
    ssdpSubscribe()
    subscribe(location, null, onLocation, [filterEvents:false])
    runEvery5Minutes("ssdpDiscover")
}
def onLocation(evt) {
    //log.trace("onLocation(${evt})")
    def event = parseLanMessage(evt.description)
    if ( (event.headers) && (event.headers.nt) && (event.headers.nt=="upnp:event") ) {
    	if (event.body) {
    		//log.debug("onLocation: body=" + event.body)
            def xmlCmd = parseXml(event.body.toString())
            //log.debug("onLocation: parsed xmlCmd=" + xmlCmd)
            def jsonCmd = parseJson(xmlCmd.toString())
            //log.debug("onLocation: parsed jsonCmd=" + jsonCmd)
            log.debug("onLocation: json object command=" + jsonCmd.command + " value =" + jsonCmd.value)
		} else {
        	log.debug("onLocation: body is blank")
        }
    
    } else if (event.networkAddress) {
    	/*
    	log.debug("onLocation: source=" + evt.eventSource + 
        			" index=" + event.index +
    				" Network address:Device Address=" + convertHexToIP(event.networkAddress) + ":" + convertHexToInt(event.deviceAddress) +
                    " ssdpPath=" + event.ssdpPath + " ssdpNTS=" + event.ssdpNTS + 
                    " ssdpTerm=" + event.ssdpTerm +
                    " ssdpUSN=" + event.ssdpUSN
                    )
        */

	} else if (event.ip) {
        	log.debug("onLocation:subscription: source=" + evt.eventSource + 
            		" index=" + event.index +
    				" IP address:port=" + convertHexToIP(event.ip) + ":" + convertHexToInt(event.port) +
                    " ssdpPath=" + event.ssdpPath + " ssdpNTS=" + event.ssdpNTS + " requestID=" + event.requestId +
                    " sid=" + event.headers.sid +
                    " mac=" + event.mac +
                    " ssdpUSN=" + event.ssdpUSN
                    )
             log.debug("onLocation:subscription: DEBUG headers=" + event.headers)
    } else {
    	log.debug("onLocation: unknown description=" + evt.description + " Headers=" + event.headers)
    }

	
    if (evt.eventSource == 'HUB') {
        if (evt.description == 'ping') {
            // ignore ping event
            return
        }
/*
        // Parse Hub event
        def hubEvent = stringToMap(evt.description)
        def prs=parseLanMessage(evt.description)
        def zzz=""
        evt.properties.each{prop,val ->
        	if (zzz=="") {
            	zzz = prop + ":" + val
            } else {
            	zzz = zzz + ", " + prop + ":" + val
            }
        }
*/
        /*
        log.debug("Props:" + zzz)
        log.debug("Source:" + evt.source + " deviceId=" + evt.deviceId + " installedSmartAppId=" + evt.installedSmartAppId + " isPhysical()=" + evt.isPhysical())
        //log.debug("event device=" + evt.getDevice() + " deviceID=" + evt.getDeviceId() + " name=" + evt.getName() + " source=" + evt.getSource() )
        // + " display name=" + evt.getDisplayName() 
        log.debug "hubEvent Description: ${prs}"
        */
    }
}

void ssdpDiscover() {
    log.debug("ssdpDiscover: Discovering SmartBridge current Bridge address = " + state.bridgeIP + ":" + state.bridgePort)
    sendHubCommand(new physicalgraph.device.HubAction("lan discovery urn:schemas-upnp-org:device:SmartBridge:1", physicalgraph.device.Protocol.LAN))
    if (state.supportedDevices) {
        state.supportedDevices.each{
        	sendHubCommand(new physicalgraph.device.HubAction(it.discoverString, physicalgraph.device.Protocol.LAN))
            //log.debug(" ssdpDiscover Discovering " + it.type + "(s)" + " discover string=" + it.discoverString)
        }
    }
}

void ssdpSubscribe() {
	subscribe(location, "ssdpTerm.urn:schemas-upnp-org:device:SmartBridge:1", ssdpHandler)
	//log.debug "ssdpSubscribe: ssdpTerm.urn:schemas-upnp-org:device:   SmartBridge"
	if (state.supportedDevices) {
		state.supportedDevices.each{
        //log.debug(" ssdpSubscribe subscribing to " + "ssdpTerm." + it.usn + " for " + it.type + "(s)")
        subscribe(location, "ssdpTerm." + it.usn, ssdpHandler)
        }
	}
}
void bridgeDescriptionHandler(physicalgraph.device.HubResponse hubResponse) {
	def xml = hubResponse.xml
    def parsedEvent = parseLanMessage(hubResponse?.description)
	state.bridgeIP = convertHexToIP(parsedEvent.ip)
	state.bridgePort = convertHexToInt(parsedEvent.port)
	state.bridgeMac = parsedEvent.mac.toUpperCase()
    state.supportedDevices =  parseJson(xml.device.supportedDevices.toString())
    log.debug("bridgeDescriptionHandler bridge address=" + state.bridgeIP + ":" + state.bridgePort + " mac=" + state.bridgeMac )
    //log.debug("bridgeDescriptionHandler parsedJSON xml ssdps="+parseJson(xml.device.supportedDevices.toString()))
}
def ssdpHandler(evt) {
	def hub = evt?.hubId
	def parsedEvent = parseLanMessage(evt?.description)
    /*
    log.debug("ssdpHandler: DEBUG event details - " + " networkAddress=" + parsedEvent?.networkAddress + " deviceAddress=" + parsedEvent?.deviceAddress + " mac=" + parsedEvent.mac +
              " ip=" + getIPPort(parsedEvent.networkAddress,parsedEvent.deviceAddress) +
              " ssdpUSN=" + parsedEvent?.ssdpUSN +
              " ssdpPath=" + parsedEvent?.ssdpPath +
              " ssdpTerm=" + parsedEvent?.ssdpTerm +
              " ssdpNTS="  + parsedEvent?.ssdpNTS +
              " StateBrIP=" + state.bridgeIP + ":" + state.bridgePort )
    */
    def defDetails
    if (state.supportedDevices) {
    	//state.supportedDevices.each {log.debug("ssdpHandler:supportedDevices usn=" + it.usn + " type=" + it.type + " deviceType=" + it.deviceType)}
        defDetails = state.supportedDevices.find{ it?.usn == parsedEvent.ssdpTerm }
    }
    //log.debug("ssdpHandler - DEBUG ssdUSN=" + parsedEvent?.ssdpUSN + " ssddpTerm=" + parsedEvent?.ssdpTerm + " def Detaukstype=" + defDetails?.type)
    if (parsedEvent?.ssdpUSN?.toString()=="SmartBridge::urn:schemas-upnp-org:device:SmartBridge:1") {
    	//log.debug("ssdpHandler:" + " Setting Bridge ip and port from " + state.bridgeIP+":" + state.bridgePort +
        //		 		" to" + convertHexToIP(parsedEvent.networkAddress) + ":" + convertHexToInt(parsedEvent.deviceAddress) )
		state.bridgeIP = convertHexToIP(parsedEvent.networkAddress)
		state.bridgePort = convertHexToInt(parsedEvent.deviceAddress)
		state.bridgeMac = parsedEvent.mac.toUpperCase()
        log.debug("ssdpHandler: Getting device description for Bridge host=" + state.bridgeIP + ":" + state.bridgePort + " uri=" + parsedEvent.ssdpPath + " mac=" + state.bridgeMac)
		sendHubCommand(new physicalgraph.device.HubAction("""GET ${parsedEvent.ssdpPath} HTTP/1.1\r\nHOST: ${state.bridgeIP}:${state.bridgePort}\r\n\r\n""",
					physicalgraph.device.Protocol.LAN,
					state.bridgeMac,
					[callback: bridgeDescriptionHandler]))
    } else if (defDetails) {
    	//log.debug("ssdpHandler - DEBUG parsedEvent=" + parsedEvent)
        def devices = getDevices()
        def lightDeviceName = (parsedEvent.ssdpUSN?.indexOf("::urn") > 1) ? parsedEvent.ssdpUSN[0..(parsedEvent.ssdpUSN?.indexOf("::urn") - 1)] : "Bad Device Name"        
        def dni = convertHexToIP(parsedEvent.networkAddress).toUpperCase() + convertHexToInt(parsedEvent.deviceAddress)
		parsedEvent << ["hub":hub]
        /*
        log.debug("ssdpHandler: We have a " + defDetails.type + " deviceType=" + defDetails.deviceType + " Name=" + lightDeviceName + 
        								" USN=" + parsedEvent?.ssdpUSN + " dni=" + dni + 
                                        " ip=" + getIPPort(parsedEvent.networkAddress,parsedEvent.deviceAddress) +
                                        " mac=" + parsedEvent.mac +
                                        " StateBrIP=" + state.bridgeIP + ":" + state.bridgePort )
		*/
        if (devices."${lightDeviceName}") {
        	log.debug("ssdpHandler: device exists name=" + lightDeviceName + " dni=" + parsedEvent?.dni)
        	def d = devices."${lightDeviceName}"
        	def child = getChildDevice(parsedEvent.dni)
			def childIP
            def childPort
            def childName
            if (child) {
        		log.debug("ssdpHandler: Child already exists" + " Name=" + child.getDeviceDataByName("uniqueName") + " dni=" + child.getDeviceDataByName("dni") + 
        								" ip=" + child.getDeviceDataByName("ip") + ":" + child.getDeviceDataByName("port") +
                                        " mac=" + child.getDeviceDataByName("devMac") +
                                        " bridgeIP=" + child.getDeviceDataByName("bridgeIP") + ":" + child.getDeviceDataByName("bridgePort") + 
                                        " bridgeMac=" + child.getDeviceDataByName("bridgeMac"))
                childIP = child.getDeviceDataByName("ip")
                childPort = child.getDeviceDataByName("port").toString()
                childName = child.getDeviceDataByName("uniqueName")
                //log.debug "ssdpHandler: Device data: ($childIP:$childPort) - reporting data: (${convertHexToIP(parsedEvent.networkAddress)}:${convertHexToInt(parsedEvent.deviceAddress)})."
                if(childIP != convertHexToIP(parsedEvent.networkAddress) || childPort != convertHexToInt(parsedEvent.deviceAddress).toString()){
                    log.debug "ssdpHandler: Device data (${child.getDeviceDataByName("ip")}) does not match what it is reporting(${convertHexToIP(parsedEvent.networkAddress)}). Attempting to update."
                    child.sync(convertHexToIP(parsedEvent.networkAddress), convertHexToInt(parsedEvent.deviceAddress).toString())
                }
            }
            if (d.networkAddress != parsedEvent.networkAddress || d.deviceAddress != parsedEvent.deviceAddress) {
            	log.debug("ssdpHandler: Ok this is weird, our device list has a different IP/port to the incoming for this name")
                d.networkAddress = parsedEvent.networkAddress
                d.deviceAddress = parsedEvent.deviceAddress
            }
        
 		} else {
                log.debug("ssdpHandler: Adding Device name=" + lightDeviceName + " ssdpPath="+parsedEvent?.ssdpPath?.toString()+" ssdpUSN="+parsedEvent?.ssdpUSN?.toString())
                devices << ["${lightDeviceName}": parsedEvent]
		}
	} else {
    	log.debug("ssdpHandler Ignored - unknown device type ssdpUSN=" + parsedEvent.ssdpUSN)
    }
}
void verifyDevices() {
	if (state.bridgeIP) {
		def devices = getDevices().findAll { it?.value?.verified != true }
		devices.each {
			def ip = convertHexToIP(it.value.networkAddress)
			def port = convertHexToInt(it.value.deviceAddress)
			String ssdpUSN = it.value.ssdpUSN.toString()
			def lightDeviceName
			if (ssdpUSN?.indexOf("::urn") > 1){
				lightDeviceName = ssdpUSN[0..(ssdpUSN?.indexOf("::urn") - 1)]
			}			
			String host = "${ip}:${port}"
            def uri = it.value.ssdpPath
            def gParams = [ "path" : "/light",
            				"headers" : ["HOST":host],
                            "query" : ["uniqueName":it.key]
                          ]
            log.debug("verifyDevices: Getting device description for " + it.key + " params=" + gParams + " map =[callback: deviceDescriptionHandler]" )
            sendHubCommand(new physicalgraph.device.HubAction(gParams, null, ["callback": deviceDescriptionHandler]))
			//log.debug("verifyDevices: Getting device description for " + it.key + " host=" + host + " uri=" + uri + " mac=" + state.bridgeMac)
            //sendHubCommand(new physicalgraph.device.HubAction("""GET ${uri} HTTP/1.1\r\nHOST: $host\r\n\r\n""",
			//		physicalgraph.device.Protocol.LAN,
			//		state.bridgeMac,
			//		[callback: deviceDescriptionHandler]))                  
		}
	} else {
		log.debug("verifyDevices: bridge ip not set")
	}
}

def getDevices() {
    state.devices = state.devices ?: [:]
}

void deviceDescriptionHandler(physicalgraph.device.HubResponse hubResponse) {
	def body = hubResponse.xml
	def devices = getDevices()
	def device = devices.find {it?.key?.contains(body?.device?.UDN?.text())}
    def deviceDNI
    /*
    devices.each {
    	log.debug("deviceDescriptionHandler: devices: name="+it?.key)
    }
    */
	if (body?.device?.friendlyName?.text()!="PlayBridge-Pi") {
    	if (device) {
            if (state.bridgeMac==null) {
                state.bridgeMac=body?.device?.bridgeMac?.text()
                log.debug("deviceDescriptionHandler: bridgeMac was null now set to "+body?.device?.bridgeMac?.text())
             }
            deviceDNI = convertIPtoHex(body?.device?.IP?.text()).toUpperCase() + convertPortToHex(body?.device?.port?.text())
			/*
            log.debug("deviceDescriptionHandler: status=" + hubResponse.status + 
   				 " incoming key="+body?.device?.UDN?.text() + " name=" + body?.device?.friendlyName?.text() + " uniqueName=" + body?.device?.uniqueName?.text() +
                 " IP=" + body?.device?.IP?.text() + " port=" + body?.device?.port?.text() + " smartType =" + body?.device?.smartType.text() +
                 " deviceDNI=" + deviceDNI )
            */
            def defDetails
		    if (state.supportedDevices) {
		        defDetails = state.supportedDevices.find{ it?.type == body?.device?.smartType.text() }
    		}
            if (defDetails) {
                 device.value << [	name: body?.device?.friendlyName?.text(),
                                    deviceType: body?.device?.deviceType.text(),
                                    dni:deviceDNI,
                                    UDN: body?.device?.UDN?.text(),
                                    IP: body?.device?.IP?.text(),
                                    port: body?.device?.port?.text(),
                                    deviceHandler: body?.device.deviceHandler.text(),
                                    uniqueName: body?.device?.uniqueName?.text(),
                                    verified: true]
                log.debug("deviceDescriptionHandler: Adding, friendly name=" + body?.device?.friendlyName?.text() + " uniqueName=" + body?.device?.uniqueName?.text() + 
                									" IP=" + body?.device?.IP?.text() + " port=" + body?.device?.port?.text() + " dh=" + body?.device.deviceHandler.text() +
                                                    " smartType =" + body?.device?.smartType.text()
                                                    )
            } else {
                    log.debug("deviceDescriptionHandler: devicetype unrecognised =" + body?.device?.deviceType)
            }
        } else {
            log.error "/description.xml returned a device that didn't exist"
        }
	}
}

def addDevices() {
    def devices = getDevices()
    def sectionText = ""
    log.debug("addDevices: Iterating thru devices size=" + devices.size())
    /*
    devices.each{
    	log.debug("addDevices: iterating devices: name=" + it?.key + " device=" + it?.value)
    }
    */
    selectedDevices.each { dni ->bridgeLinking
    	//log.debug("addDevices: iterating selectedDevices=" + dni)
        def selectedDevice = devices.find { it.value.dni == dni }
        def d
        if (selectedDevice) {
        	log.debug("addDevices: found selectedDevice in devices dni=" + selectedDevice.value.dni + 
                                " uniqueName=" + selectedDevice?.value?.uniqueName +
                                " name=" + selectedDevice?.value?.name +
                                " selectedDevice=" + selectedDevice)
                                
            d = getChildDevices()?.find {
                it.deviceNetworkId == selectedDevice.value.dni
            }
        }

        if (!d) {
            //log.debug selectedDevice
            log.debug("addDevices: Creating device with dni: ${selectedDevice.value.dni}" +
															" uniqueName=" + selectedDevice?.value?.uniqueName +
                                                            " name=" + selectedDevice?.value?.name +
                                                            " deviceHandler=" + selectedDevice.value.deviceHandler +
                                                            " ip=" + convertHexToIP(selectedDevice.value.networkAddress) +
                                                            " Port=" + Integer.parseInt(selectedDevice.value.deviceAddress,16) )
            addChildDevice("davec1001", selectedDevice.value.deviceHandler, selectedDevice.value.dni, selectedDevice?.value.hub,
						["label": selectedDevice?.value?.name ?: "Smart RGBW Light",
                             "data": [
                                 "deviceType" : selectedDevice.value.deviceType,
                                 "dni" : selectedDevice.value.dni.toUpperCase(),
                                 "uniqueName" : selectedDevice.value.uniqueName,
                                 "ip" : convertHexToIP(selectedDevice.value.networkAddress),
                                 "port" : "" + Integer.parseInt(selectedDevice.value.deviceAddress,16),
                                 "UDN" : selectedDevice.value.UDN,
                                 "IP" : selectedDevice.value.IP,
                                 "port" : selectedDevice.value.port,
                                 "userSpecifiedName" : selectedDevice.value.userSpecifiedName
                             ]
						])
            sectionText = sectionText + "Succesfully added device with ip address ${convertHexToIP(selectedDevice.value.networkAddress)} \r\n"
        } else {
        	log.debug("addDevices: found selected device in childdevices dni=" + selectedDevice.value.dni )
        }
        
	} 
    log.debug sectionText
	return dynamicPage(name:"addDevices", title:"Devices Added", nextPage:"mainPage",  uninstall: true) {
        if(sectionText != ""){
			section("Add device Results:") {
				paragraph sectionText
			}
        } else {
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

private String getIPPort(hexIP,hexPort) {
	return convertHexToIP(hexIP) + ":" + convertHexToInt(hexPort)
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

def doThis(childDevice,command,query) {
	if (childDevice==null) {log.debug("doThis:childDevice is null")}
	if (state.bridgeMac && state.bridgeIP && childDevice) {
        def parsedQuery = [:]
        if (query) {parsedQuery=getQueryMap(query)}
        log.debug("doThis childDevice.uniqueName=" + childDevice.getDeviceDataByName("uniqueName") + " command=" + command + " parsedQuery=" + (parsedQuery?parsedQuery:"empty"))
        parsedQuery["uniqueName"] = childDevice.getDeviceDataByName("uniqueName")
		sendHubCommand(new physicalgraph.device.HubAction([
                method : "GET",
                path   : "/HubAction" + command,
                headers : ["HOST":state.bridgeIP+":"+state.bridgePort],
                query	: parsedQuery
            ],
            state.bridgeMac,
            [callback: "lightsHandler"]
            ))    
        log.debug("doThis: Sent command to bridge path=" + "/HubAction" + command + " host=" + state.bridgeIP + ":" + state.bridgePort + " query=" + parsedQuery)
    } else {
    	log.debug("doThis: ERROR CANNOT SEND command to bridge path=" + "/HubAction" + command + " host=" + state.bridgeIP + ":" + state.bridgePort + " query=" + parsedQuery)
    }

    if (command.contains("refresh")) {
        def subscribePath = "/subscription"
        //def subscribeCallBack = "<http://" + location.hubs[0].localIP + ":" + location.hubs[0].localSrvPortTCP + "/notify/returnmessage"
        def subscribeCallBack = "<http://" + location.hubs[0].localIP + ":" + location.hubs[0].localSrvPortTCP + "/returnmessage"
        def subscribeHost = state.bridgeIP + ":" + state.bridgePort
        def result = new physicalgraph.device.HubAction(
                method: "SUBSCRIBE",
                path: subscribePath,
                query: ["uniqueName": childDevice.getDeviceDataByName("uniqueName")],
                headers: [
                    HOST: subscribeHost,
                    CALLBACK: subscribeCallBack,
                    NT: "upnp:event",
                    TIMEOUT: "Second-28800"
                ] )
        sendHubCommand(result)
        log.debug("doThis:refresh: SUBSCRIBE path=$subscribePath host=$subscribeHost callback=$subscribeCallBack")
       } 
  return   
}
void returnmessage(){
	log.debug("DEBUG returnmessage ")
}

void lightsHandler(physicalgraph.device.HubResponse hubResponse) {
    def resp = hubResponse.json
    //log.debug("DEBUG Lightshandler " + hubResponse.body)
    log.debug("lightsHandler: uniqueName=" + resp?.uniqueName + " method=" + resp?.method + " params=" + resp?.params + " value=" + resp?.params?.value)    
    if (resp?.params?.value) {
        log.debug("lightsHandler: value=" + resp?.params?.value + " stColor=" + resp?.stColor + " (1)=" + resp?.params?.value[0] + 
        				" (2)=" + resp?.params?.value[1] + " (3)=" + resp?.params?.value[2])
    }
	if (resp?.uniqueName) {
        def childDevice=null//=getChildDevice(resp?.deviceID)
        getChildDevices().each {
        	if (it.getDeviceDataByName("uniqueName")==resp?.uniqueName) {
            childDevice = it;
            }
        }
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
            } else if (resp?.method=="refresh") {
    			//def jsonParams = slurper.parseText(resp.params)
                childDevice.update_current_properties(resp?.params)
            	resp.params.each { entry ->
					log.debug("lightsHandler: generating event entry.key=" + entry.key + " entry.value=" + entry.value)
					childDevice.generateEvent([name: entry.key, value: entry.value , displayed: false])
                }
                log.debug("lightsHandler: generating event entry.key=" + "IP" + " entry.value=" + childDevice.getDeviceDataByName("IP") )
                childDevice.generateEvent([name: "IP", value: childDevice.getDeviceDataByName("IP") + ":" + childDevice.getDeviceDataByName("port"), displayed: false])
            } else if (resp?.method=="configGet") {
            	childDevice.update_current_properties(resp?.params)
            } else if (resp?.method=="configSet") {
            	childDevice.update_current_properties(resp?.params)
            } else if (resp?.method=="get_props") {
            	//childDevice.generateEvent([name: "firmware", value: childDevice.getDeviceDataByName("firmware") , displayed: false])
                //childDevice.generateEvent([name: "IP", value: childDevice.getDeviceDataByName("IP") , displayed: false])
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