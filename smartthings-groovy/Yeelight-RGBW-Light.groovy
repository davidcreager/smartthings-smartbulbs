/*
 *  Copyright 2016 David Creager
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
 *  Yeelight RGBW Light
 *
 *  Author: David Creager
 *  Date: 2017-05-12
 */

import groovy.json.JsonSlurper

metadata {
	definition (name: "Yeelight RGBW Light", namespace: "davec1001", author: "David Creager") {
		capability "Switch Level"
		capability "Actuator"
        capability "Color Control"
		capability "Switch"
		capability "Refresh"
		capability "Sensor"
        capability "Configuration"
        capability "Health Check"

		//capability "Switch"  // from yeelight.light.colour
		capability "Color Temperature"
		capability "Switch Level"
        capability "Actuator"
		capability "Refresh"
		capability "Sensor"
		capability "Health Check"
		//capability "Light" 
        
        
		attribute "deviceID","string"
        attribute "mac","string"
        attribute "color","string"
        attribute "firmware","string"
        attribute "devIP","string"
        attribute "devPort","string"
        attribute "bridgeIP","string"
        attribute "bridgePort","string"
        attribute "colorMode","string"
        

        command "reset"
        command "setScene"
        command "update" // from yeelight.light.colour

	}

	simulator {
	}
    
    preferences {
        input description: "Once you change values on this page, the corner of the \"configuration\" icon will change orange until all configuration parameters are updated.", title: "Settings", displayDuringSetup: false, type: "paragraph", element: "paragraph"
		generate_preferences(configuration_model())
	}

	tiles(scale: 2) {
		multiAttributeTile(name:"switch", type: "lighting", width: 6, height: 4, canChangeIcon: true){
			tileAttribute ("device.switch", key: "PRIMARY_CONTROL") {
				attributeState "off", label:'${name}', action:"switch.on", icon:"st.lights.philips.hue-single", backgroundColor:"#ffffff", nextState:"turningOn"
                attributeState "on", label:'${name}', action:"switch.off", icon:"st.lights.philips.hue-single", backgroundColor:"#00a0dc", nextState:"turningOff"
				attributeState "turningOn", label:'${name}', action:"switch.off", icon:"st.lights.philips.hue-single", backgroundColor:"#00a0dc", nextState:"turningOff"
				attributeState "turningOff", label:'${name}', action:"switch.on", icon:"st.lights.philips.hue-single", backgroundColor:"#ffffff", nextState:"turningOn"                
			}
 			
			tileAttribute ("device.level", key: "SLIDER_CONTROL") {
				attributeState "level", action:"switch level.setLevel"
            }
			tileAttribute ("device.colorTemperature", key: "SECONDARY_CONTROL") {
				attributeState "level", label:'${currentValue}K'
			}
			tileAttribute ("device.color", key: "COLOR_CONTROL") {
				attributeState "color", action:"setColor"
			}
        }
  /*
            tileAttribute ("device.colorTemperature", key: "SLIDER_CONTROL") {
				attributeState "colorTemp", action:"color temperature.setColorTemperature"
			}
	*/ 
       
		standardTile("refresh", "device.switch", inactiveLabel: false, decoration: "flat", width: 2, height: 1) {
			state "default", label:"", action:"refresh.refresh", icon:"st.secondary.refresh"
		}

		controlTile("colorTempSliderControl", "device.colorTemperature", "slider", height: 1, width: 4, inactiveLabel: false, range:"(1700..6500)") {
			state "colorTemp", action:"color temperature.setColorTemperature"
		}

		//valueTile("colorTemp", "device.colorTemperature", inactiveLabel: false, decoration: "flat", height: 1, width: 2) {
        valueTile("colorTemp", "device.colorTemperature", inactiveLabel: false, height: 1, width: 2) {
			state "colorTemp", label: '${currentValue}K'
		}
        valueTile("devIP", "devIP", width: 2, height: 1) {
    		state "ip", label:'Device IP\r\n${currentValue}'
		}
        
        valueTile("bridgeIP", "bridgeIP", width: 2, height: 1) {
    		state "ip", label:'Bridge IP\r\n${currentValue}'
		}
		valueTile("firmware", "firmware", width: 2, height: 1) {
    		state "firmware", label:'Firmware ${currentValue}'
		}
        valueTile("colorMode","device.colorMode", width: 2,height:1) {
            state "colorMode", label:'Color Mode \r\n${currentValue}' ,  backgroundColors:[
            	[value:1,color:"#D3D3D3"],
                [value:2,color:"#ff0000"],
				[value:3,color:"#00ff00"]
                ]
        }
    main "switch"
	details(["switch", "colorTempSliderControl", "colorTemp", "refresh", "configure", "devIP", "firmware","bridgeIP","colorMode" ])      
   }
}

def installed() {
	log.debug "installed()"
	//configure()
}

def configure() {
    logging("configure()", 1)
    def cmds = []
    cmds = update_needed_settings()
    if (cmds != []) cmds
}

def updated()
{
    logging("updated()", 1)
    def cmds = [] 
    cmds = update_needed_settings()
    sendEvent(name: "checkInterval", value: 12 * 60 * 2, data: [protocol: "lan", hubHardwareId: device.hub.hardwareID], displayed: false)
    sendEvent(name:"needUpdate", value: device.currentValue("needUpdate"), displayed:false, isStateChange: true)
    if (cmds != []) response(cmds)
}

private def logging(message, level) {
    if (logLevel != "0"){
    switch (logLevel) {
       case "1":
          if (level > 1)
             log.debug "$message"
       break
       case "99":
          log.debug "$message"
       break
    }
    }
}

def getDefault(){
    if(settings.dcolor == "Previous") {
        return "Previous"
    } else if(settings.dcolor == "Random") {
        return "${transition == "false"? "d~" : "f~"}${getHexColor(settings.dcolor)}"
    } else if(settings.dcolor == "Custom") {
        return "${transition == "false"? "d~" : "f~"}${settings.custom}"
    } else if(settings.dcolor == "Soft White" || settings.dcolor == "Warm White") {
        if (settings.level == null || settings.level == "0") {
            return "${transition == "false"? "x~" : "w~"}${getDimmedColor(getHexColor(settings.dcolor), "100")}"
        } else {
            return "${transition == "false"? "x~" : "w~"}${getDimmedColor(getHexColor(settings.dcolor), settings.level)}"
        }
    } else if(settings.dcolor == "W1") {
        if (settings.level == null || settings.level == "0") {
            return "${transition == "false"? "x~" : "w~"}${getDimmedColor(getHexColor(settings.dcolor), "100")}"
        } else {
            return "${transition == "false"? "x~" : "w~"}${getDimmedColor(getHexColor(settings.dcolor), settings.level)}"
        }
    } else if(settings.dcolor == "W2") {
        if (settings.level == null || settings.level == "0") {
            return "${transition == "false"? "z~" : "y~"}${getDimmedColor(getHexColor(settings.dcolor), "100")}"
        } else {
            return "${transition == "false"? "z~" : "y~"}${getDimmedColor(getHexColor(settings.dcolor), settings.level)}"
        }
    } else {
        if (settings.level == null || settings.dcolor == null){
           return "Previous"
        } else if (settings.level == null || settings.level == "0") {
            return "${transition == "false"? "d~" : "f~"}${getDimmedColor(getHexColor(settings.dcolor), "100")}"
        } else {
            return "${transition == "false"? "d~" : "f~"}${getDimmedColor(getHexColor(settings.dcolor), settings.level)}"
        }
    }
}

def parse(description) {
    def map = [:]
    def events = []
    def cmds = []
    log.debug("parse: description="+description)
	return events
}

void on() {
	sendToParent(this,"/on?transition=$transition")
}

void off() {
	sendToParent(this,"/off?transition=$transition")
}

def setLevel(level) {
    log.debug "Executing 'setLevel'"
	setLevel(level, 1)
}

def setLevel(level, duration) {
	log.debug "setLevel() level = ${level}"
    if(level > 100) level = 100
    if (level == 0) { off() }
    else if (device.latestValue("switch") == "off") { on() }
    state.level=level
	sendEvent(name: "level", value: level)
	setColor(aLevel: level)
}
def setSaturation(percent) {
	log.debug "setSaturation($percent)"
	setColor(saturation: percent)
}
def setHue(value) {
	log.debug "setHue($value)"
	setColor(hue: value)
}
def setColor(value) {
    log.debug "setColor being called with ${value}"
    def uri
    def validValue = true
    if (value.hex) {
       log.debug "setting color with hex"
       if (!value.hex ==~ /^\#([A-Fa-f0-9]){6}$/) {
           log.debug "$value.hex is not valid"
           validValue = false
       } else {
           def rgb = value.hex.findAll(/[0-9a-fA-F]{2}/).collect { Integer.parseInt(it, 16) }
           def myred = rgb[0] < 40 ? 0 : rgb[0]
           def mygreen = rgb[1] < 40 ? 0 : rgb[1]
           def myblue = rgb[2] < 40 ? 0 : rgb[2]
           log.debug("setcolor red="+myred+" green="+mygreen+" blue="+myblue)
           uri = "/rgb?mode=hex&value="+URLEncoder.encode(value.hex)+"&saturation="+URLEncoder.encode(value.saturation.toString())+"&hue="+URLEncoder.encode(value.hue.toString())
           log.debug("setColor: test URLEncoder.encode="+URLEncoder.encode(value.hex))
           //uri = "/rgb?decimal=${RGBToDec(myred,mygreen,myblue)}"
           state.color=value
       }
    } else if ((value.saturation != null) && (value.hue != null)) {
        def hue = (value.hue != null) ? value.hue : 13
		def saturation = (value.saturation != null) ? value.saturation : 13
		def rgb = huesatToRGB(hue as Integer, saturation as Integer)
        value.hex = rgbToHex([r:rgb[0], g:rgb[1], b:rgb[2]])
		uri = "/rgb?mode=hsv&hue="+value.hue+"&saturation="+value.saturation+"&level="+state.level
    } else if (value.aLevel) {
        uri="/set_bright?value=${value.aLevel}"
    } else {
       // A valid color was not chosen. Setting to white
       //uri = "/rgb?mode=hex&value=${RGBToDec(255,240,255)}"
       uri = "/rgb?mode=hex&value=FFFAF0"
    }
    
    //if (uri != null && validValue != false) sendToParent("$uri&channels=$channels&transition=$transition")
    if (uri!=null) {
	    log.trace sendToParent(this,uri)
    }

}
def setColorTemperature(kelvin) {
	log.debug "Executing 'setColorTemperature' to ${kelvin}"
    state.colorTemperature=kelvin
    sendToParent(this,"/ctx?value=${kelvin}")
}

private sendToParent(thisDevice,uri){
	updateDNI()
    log.debug("sendToParent: uri="+uri)
    if (thisDevice==null) {
    	log.debug("sendToParent thisDevice is null")
    } else {
		parent.doThis(thisDevice,uri)
   }
	
}
def generateEvent(results){
	log.debug("generateEvent: Received Events name="+results.name+" value="+results.value)
    sendEvent(name: results.name, value: results.value)
  return null
}
private getAction(uri){ 
  updateDNI()
  def userpass
  def newURI="/HubAction/" + device.deviceNetworkId + uri
  def headers = getHeader(userpass)
  log.debug ("getAction: newuri=" + newURI + " uri=" + uri + " name=" + device.getName() + "mac=" + device.deviceNetworkId + " header.host=" + getHeader(userpass).HOST)
  if (password != null && password != "") {
    userpass = encodeCredentials("admin", password)
	headers = getHeader(userpass)
  }
  def hubAction = new physicalgraph.device.HubAction(
    	method: "GET", path: newURI, headers: headers
  )
  log.debug("getAction:headers="+headers)
  return hubAction    
}

def reset() {
	log.debug "reset()"
	setColor(hex: "FFFAF0")
}

def refresh() {

    def address = getCallBackAddress()

    def result = new physicalgraph.device.HubAction(
        [method: "POST",
        path: "/subscribe",
        headers: [
            HOST: getDataValue("bridgeIP")+":"+getDataValue("bridgePort"),
            CALLBACK: "<http://${address}/notify>",
            NT: "upnp:event",
            TIMEOUT: "Second-28800"
        ],
        query: [
            callback: address
        ]],
        ""//getDeviceDataByName("devMac")
    )
	result
	log.debug "refresh() bridgeIP="+getDataValue("bridgeIP")+":"+getDataValue("bridgePort")+" callback="+"<http://${address}/notify"+" devMac="+getDeviceDataByName("devMac")
    sendToParent(this,"/refresh")
}

def ping() {
    log.debug "ping()"
    refresh()
}
def hexToRgb(colorHex) {
	def rrInt = Integer.parseInt(colorHex.substring(1,3),16)
    def ggInt = Integer.parseInt(colorHex.substring(3,5),16)
    def bbInt = Integer.parseInt(colorHex.substring(5,7),16)
    
    def colorData = [:]
    colorData = [r: rrInt, g: ggInt, b: bbInt]
    colorData
}

// huesatToRGB Changed method provided by daved314
def huesatToRGB(float hue, float sat) {
	if (hue <= 100) {
		hue = hue * 3.6
    }
    sat = sat / 100
    float v = 1.0
    float c = v * sat
    float x = c * (1 - Math.abs(((hue/60)%2) - 1))
    float m = v - c
    int mod_h = (int)(hue / 60)
    int cm = Math.round((c+m) * 255)
    int xm = Math.round((x+m) * 255)
    int zm = Math.round((0+m) * 255)
    switch(mod_h) {
    	case 0: return [cm, xm, zm]
       	case 1: return [xm, cm, zm]
        case 2: return [zm, cm, xm]
        case 3: return [zm, xm, cm]
        case 4: return [xm, zm, cm]
        case 5: return [cm, zm, xm]
	}   	
}

private hex(value, width=2) {
	def s = new BigInteger(Math.round(value).toString()).toString(16)
	while (s.size() < width) {
		s = "0" + s
	}
	s
}
def RGBToDec(r,g,b){return (r*65536)+(g*256)+b}
def rgbToHex(rgb) {
    def r = hex(rgb.r)
    def g = hex(rgb.g)
    def b = hex(rgb.b)
    def hexColor = "#${r}${g}${b}"
    
    hexColor
}

def sync(ip, port, bIP, bPort) {
    def existingIp = getDataValue("devIP")
    def existingPort = getDataValue("devPort")
    def existingBIP = getDataValue("bridgeIP")
    def existingBPort = getDataValue("bridgePort")
    if (ip && ip != existingIp) {
        updateDataValue("devIP", ip)
        sendEvent(name: 'devIP', value: ip)
    }
    if (port && port != existingPort) {
        updateDataValue("devPort", port)
    }
    if (bIP && bIP != existingBIP) {
        updateDataValue("bridgeIP", bIP)
        sendEvent(name: 'bridgeIP', value: bIP)
    }
    if (bPort && bPort != existingBPort) {
        updateDataValue("bridgePort", bPort)
    }    
}

private setDeviceNetworkId(ip, port = null){
    def myDNI
    if (port == null) {
        myDNI = ip
    } else {
  	    def iphex = convertIPtoHex(ip)
  	    def porthex = convertPortToHex(port)
        
        myDNI = "$iphex:$porthex"
    }
    log.debug "Device Network Id set to ${myDNI}"
    return myDNI
}

private updateDNI() { 
		log.debug("old was "+device.deviceNetworkId+" new is " + state.dni)
        log.debug("devIP is "+getDeviceDataByName("devIP")+" bridgeIP is "+getDeviceDataByName("bridgeIP")+" devMac="+getDeviceDataByName("devMac")+" bridgeMac="+getDeviceDataByName("bridgemac"))
        state.dni=getDeviceDataByName("devMac")
    if (state.dni != null && state.dni != "" && device.deviceNetworkId != state.dni) {
       device.deviceNetworkId = state.dni
    }
}

private getHostAddress() {
    if(getDeviceDataByName("ip") && getDeviceDataByName("port")){
    	log.debug("IP & Port set " + "${getDeviceDataByName("ip")}:${getDeviceDataByName("port")}")
        return "${getDeviceDataByName("ip")}:${getDeviceDataByName("port")}"
    }else{
    	log.debug("IP set " + "${ip}:80")
	    return "${ip}:80"
    }
}

private String convertIPtoHex(ipAddress) { 
    String hex = ipAddress.tokenize( '.' ).collect {  String.format( '%02x', it.toInteger() ) }.join()
    return hex
}

private String convertPortToHex(port) {
	String hexport = port.toString().format( '%04x', port.toInteger() )
    return hexport
}

def parseDescriptionAsMap(description) {
	description.split(",").inject([:]) { map, param ->
		def nameAndValue = param.split(":")
		map += [(nameAndValue[0].trim()):nameAndValue[1].trim()]
	}
}

private getHeader(userpass = null){
    def headers = [:]
    headers.put("HOST", getHostAddress())
    headers.put("Content-Type", "application/x-www-form-urlencoded")
    if (userpass != null)
       headers.put("Authorization", userpass)
	log.debug("getheader:"+headers)
    return headers
}

def toAscii(s){
        StringBuilder sb = new StringBuilder();
        String ascString = null;
        long asciiInt;
                for (int i = 0; i < s.length(); i++){
                    sb.append((int)s.charAt(i));
                    sb.append("|");
                    char c = s.charAt(i);
                }
                ascString = sb.toString();
                asciiInt = Long.parseLong(ascString);
                return asciiInt;
}





def onOffCmd(value, program) {
    log.debug "onOffCmd($value, $program)"
    def uri
    if (value == 1){
       if(state."program${program}" != null) {
          uri = "/program?value=${state."program${program}"}&number=$program"
       }    
    } else if(value == 0){
       uri = "/stop"
    } else {
       uri = "/off"
    }
    if (uri != null) return sendToParent(uri)
}

def setProgram(value, program){
   state."program${program}" = value
}

def hex2int(value){
   return Integer.parseInt(value, 10)
}


private getHexColor(value){
def color = ""
  switch(value){
    case "Previous":
    color = "Previous"
    break;
    case "White":
    color = "ffffff"
    break;
    case "Daylight":
    color = "ffffff"
    break;
    case "Soft White":
    color = "ff"
    break;
    case "Warm White":
    color = "ff"
    break;
    case "W1":
    color = "ff"
    break;
    case "W2":
    color = "ff"
    break;
    case "Blue":
    color = "0000ff"
    break;
    case "Green":
    color = "00ff00"
    break;
    case "Yellow":
    color = "ffff00"
    break;
    case "Orange":
    color = "ff5a00"
    break;
    case "Purple":
    color = "5a00ff"
    break;
    case "Pink":
    color = "ff00ff"
    break;
    case "Cyan":
    color = "00ffff"
    break;
    case "Red":
    color = "ff0000"
    break;
    case "Off":
    color = "000000"
    break;
    case "Random":
    color = "xxxxxx"
    break;
}
   return color
}

def generate_preferences(configuration_model)
{
    def configuration = parseXml(configuration_model)
   
    configuration.Value.each
    {
        if(it.@hidden != "true" && it.@disabled != "true"){
        switch(it.@type)
        {   
            case ["number"]:
                input "${it.@index}", "number",
                    title:"${it.@label}\n" + "${it.Help}",
                    range: "${it.@min}..${it.@max}",
                    defaultValue: "${it.@value}",
                    displayDuringSetup: "${it.@displayDuringSetup}"
            break
            case "list":
                def items = []
                it.Item.each { items << ["${it.@value}":"${it.@label}"] }
                input "${it.@index}", "enum",
                    title:"${it.@label}\n" + "${it.Help}",
                    defaultValue: "${it.@value}",
                    displayDuringSetup: "${it.@displayDuringSetup}",
                    options: items
            break
            case ["password"]:
                input "${it.@index}", "password",
                    title:"${it.@label}\n" + "${it.Help}",
                    displayDuringSetup: "${it.@displayDuringSetup}"
            break
            case "decimal":
               input "${it.@index}", "decimal",
                    title:"${it.@label}\n" + "${it.Help}",
                    range: "${it.@min}..${it.@max}",
                    defaultValue: "${it.@value}",
                    displayDuringSetup: "${it.@displayDuringSetup}"
            break
            case "boolean":
               input "${it.@index}", "boolean",
                    title:"${it.@label}\n" + "${it.Help}",
                    defaultValue: "${it.@value}",
                    displayDuringSetup: "${it.@displayDuringSetup}"
            break
            case "text":
               input "${it.@index}", "text",
                    title:"${it.@label}\n" + "${it.Help}",
                    defaultValue: "${it.@value}",
                    displayDuringSetup: "${it.@displayDuringSetup}"
            break
        }
        }
    }
}

 /*  Code has elements from other community source @CyrilPeponnet (Z-Wave Parameter Sync). */

def update_current_properties(cmd)
{
    def currentProperties = state.currentProperties ?: [:]
    currentProperties."${cmd.name}" = cmd.value

    if (settings."${cmd.name}" != null)
    {
        if (convertParam("${cmd.name}", settings."${cmd.name}").toString() == cmd.value)
        {
            sendEvent(name:"needUpdate", value:"NO", displayed:false, isStateChange: true)
        }
        else
        {
            sendEvent(name:"needUpdate", value:"YES", displayed:false, isStateChange: true)
        }
    }
    state.currentProperties = currentProperties
}


def update_needed_settings()
{
    def cmds = []
    def currentProperties = state.currentProperties ?: [:]
     
    def configuration = parseXml(configuration_model())
    def isUpdateNeeded = "NO"
    
    cmds << sendToParent(this,"/configSet?name=haip&value=${device.hub.getDataValue("localIP")}")
    cmds << sendToParent(this,"/configSet?name=haport&value=${device.hub.getDataValue("localSrvPortTCP")}")
    
    configuration.Value.each
    {     
        if ("${it.@setting_type}" == "lan" && it.@disabled != "true"){
            if (currentProperties."${it.@index}" == null)
            {
               if (it.@setonly == "true"){
                  logging("Setting ${it.@index} will be updated to ${convertParam("${it.@index}", it.@value)}", 2)
                  cmds << sendToParent(this,"/configSet?name=${it.@index}&value=${convertParam("${it.@index}", it.@value)}")
               } else {
                  isUpdateNeeded = "YES"
                  logging("Current value of setting ${it.@index} is unknown", 2)
                  cmds << sendToParent(this,"/configGet?name=${it.@index}")
               }
            }
            else if ((settings."${it.@index}" != null || it.@hidden == "true") && currentProperties."${it.@index}" != (settings."${it.@index}"? convertParam("${it.@index}", settings."${it.@index}".toString()) : convertParam("${it.@index}", "${it.@value}")))
            { 
                isUpdateNeeded = "YES"
                logging("Setting ${it.@index} will be updated to ${convertParam("${it.@index}", settings."${it.@index}")}", 2)
                cmds << sendToParent(this,"/configSet?name=${it.@index}&value=${convertParam("${it.@index}", settings."${it.@index}")}")
            } 
        }
    }
    
    sendEvent(name:"needUpdate", value: isUpdateNeeded, displayed:false, isStateChange: true)
    return cmds
}

def convertParam(name, value) {
	switch (name){
        case "dcolor":
            getDefault()
        break
        default:
        	value
        break
    }
}
def configuration_model()
{
'''
<configuration>
<Value type="password" byteSize="1" index="password" label="Password" min="" max="" value="" setting_type="preference" fw="">
<Help>
</Help>
</Value>
<Value type="list" byteSize="1" index="pos" label="Boot Up State" min="0" max="2" value="0" setting_type="lan" fw="">
<Help>
Default: Off
</Help>
    <Item label="Off" value="0" />
    <Item label="On" value="1" />
</Value>
<Value type="list" byteSize="1" index="transition" label="Default Transition" min="0" max="1" value="0" setting_type="preference" fw="">
<Help>
Default: Fade
</Help>
    <Item label="Fade" value="true" />
    <Item label="Flash" value="false" />
</Value>
<Value type="list" byteSize="1" index="dcolor" label="Default Color" min="" max="" value="" setting_type="lan" fw="">
<Help>
Default: Previous
</Help>
    <Item label="Previous" value="Previous" />
    <Item label="Soft White - Default" value="Soft White" />
    <Item label="White - Concentrate" value="White" />
    <Item label="Daylight - Energize" value="Daylight" />
    <Item label="Warm White - Relax" value="Warm White" />
    <Item label="Red" value="Red" />
    <Item label="Green" value="Green" />
    <Item label="Blue" value="Blue" />
    <Item label="Yellow" value="Yellow" />
    <Item label="Orange" value="Orange" />
    <Item label="Purple" value="Purple" />
    <Item label="Pink" value="Pink" />
    <Item label="Cyan" value="Cyan" />
    <Item label="Random" value="Random" />
    <Item label="W1" value="W1" />
    <Item label="W2" value="W2" />
    <Item label="Custom" value="Custom" />
</Value>
<Value type="text" byteSize="1" index="custom" label="Custom Color in Hex" min="" max="" value="" setting_type="preference" fw="">
<Help>
(ie ffffff)
If \"Custom\" is chosen above as the default color. Default level does not apply if custom hex value is chosen.
</Help>
</Value>
<Value type="number" byteSize="1" index="level" label="Default Level" min="1" max="100" value="" setting_type="preference" fw="">
<Help>
</Help>
</Value>
<Value type="boolean" byteSize="1" index="channels" label="Mutually Exclusive RGB / White.\nOnly allow one or the other" min="" max="" value="false" setting_type="preference" fw="">
<Help>
</Help>
</Value>
<Value type="list" byteSize="1" index="transitionspeed" label="Transition Speed" min="1" max="3" value="1" setting_type="lan" fw="">
<Help>
Default: Slow
</Help>
    <Item label="Slow" value="1" />
    <Item label="Medium" value="2" />
    <Item label="Fast" value="3" />
</Value>
<Value type="number" byteSize="1" index="autooff" label="Auto Off" min="0" max="65536" value="0" setting_type="lan" fw="" disabled="true">
<Help>
Automatically turn the switch off after this many seconds.
Range: 0 to 65536
Default: 0 (Disabled)
</Help>
</Value>
<Value type="list" index="logLevel" label="Debug Logging Level?" value="0" setting_type="preference" fw="">
<Help>
</Help>
    <Item label="None" value="0" />
    <Item label="Reports" value="1" />
    <Item label="All" value="99" />
</Value>
</configuration>
'''
}
// gets the address of the Hub
private getCallBackAddress() {
    return device.hub.getDataValue("localIP") + ":" + device.hub.getDataValue("localSrvPortTCP")
}

private Integer convertHexToInt(hex) {
    return Integer.parseInt(hex,16)
}

private String convertHexToIP(hex) {
    return [convertHexToInt(hex[0..1]),convertHexToInt(hex[2..3]),convertHexToInt(hex[4..5]),convertHexToInt(hex[6..7])].join(".")
}
