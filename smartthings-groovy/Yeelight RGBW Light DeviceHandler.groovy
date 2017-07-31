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
import groovy.json.JsonOutput

metadata {
	definition (name: "Yeelight RGBW Light", namespace: "davec1001", author: "David Creager") {
		capability "Switch Level"
        capability "Color Control"
		capability "Switch"
		capability "Refresh"
        capability "Configuration"
        capability "Health Check"
        capability "Color Temperature"
       
		attribute "deviceID","string"
        attribute "mac","string"
        attribute "color","string"
        attribute "firmware","string"
        attribute "colorMode","string"
        

        command "reset"
        command "setScene"
        command "generateEvent"
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
        
        valueTile("IP", "IP", width: 2, height: 1) {
    		state "IP", label:'Device \r\n${currentValue}'
		}
        
        valueTile("DeviceIP", "DeviceIP", width: 2, height: 1) {
    		state "DeviceIP", label:'Device \r\n${currentValue}'
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
	details(["switch", "colorTempSliderControl", "colorTemp", "refresh", "configure", "deviceIP", "firmware","colorMode" ])      
   }
}

def installed() {
	log.debug "installed()"
	configure()
}

def configure() {
    log.debug "configure()"
    def cmds = []
    cmds = update_needed_settings()
    log.debug("Configure(): cmds="+cmds)
    if (cmds != []) cmds
}

def updated()
{
    log.debug "updated()"
    def cmds = [] 
    cmds = update_needed_settings()
    sendEvent(name: "checkInterval", value: 12 * 60 * 2, data: [protocol: "lan", hubHardwareId: device.hub.hardwareID], displayed: false)
    sendEvent(name:"needUpdate", value: device.currentValue("needUpdate"), displayed:false, isStateChange: true)
    if (cmds != []) response(cmds)
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
	sendToParent(this,"/on","")
}

void off() {
	sendToParent(this,"/off","")
}

def setLevel(level) {
    log.debug "Executing 'setLevel' level = ${level}"
	setLevel( level.toInteger() , 1)
}

def setLevel(level, duration) {
	log.debug "setLevel() level = ${level}"
    if(level > 100) level = 100
    log.debug "setLevel traced 1"
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
    def query
	def command
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
		   command = "/rgb"
           //query = "mode=hex&value="+URLEncoder.encode(value.hex)+"&saturation="+URLEncoder.encode(value.saturation.toString())+"&hue="+URLEncoder.encode(value.hue.toString())
           query = "mode=hex&value=" + value.hex + "&saturation=" + value.saturation.toString() + "&hue=" + value.hue.toString()
           //log.debug("setColor: test URLEncoder.encode="+URLEncoder.encode(value.hex))
           //uri = "/rgb?decimal=${RGBToDec(myred,mygreen,myblue)}"
           state.color=value
       }
    } else if ((value.saturation != null) && (value.hue != null)) {
        def hue = (value.hue != null) ? value.hue : 13
		def saturation = (value.saturation != null) ? value.saturation : 13
		def rgb = huesatToRGB(hue as Integer, saturation as Integer)
        value.hex = rgbToHex([r:rgb[0], g:rgb[1], b:rgb[2]])
		command = "/rgb"
		query = "mode=hsv&hue=" + value.hue + "&saturation=" + value.saturation + "&level=" + state.level
    } else if (value.aLevel) {
		command = "/set_bright"
        query="value=${value.aLevel}"
    } else {
       // A valid color was not chosen. Setting to white
       //uri = "/rgb?mode=hex&value=${RGBToDec(255,240,255)}"
	   command = "/rgb"
	   query = "mode=hex&value=FFFAF0"
    }
    
    //if (uri != null && validValue != false) sendToParent("$uri&channels=$channels&transition=$transition")
    if (command!=null) {
	    log.trace sendToParent(this,command,query)
    }

}
def setColorTemperature(kelvin) {
	log.debug "Executing 'setColorTemperature' to ${kelvin}"
    state.colorTemperature=kelvin
    sendToParent(this,"/ctx","value=${kelvin}")
}

private sendToParent(thisDevice,command,query){
	updateDNI()
    log.debug("sendToParent: command=" +command + " query=" + query)
    if (thisDevice==null) {
    	log.debug("sendToParent thisDevice is null")
    } else {
    	if ( command.indexOf("config")==-1 && (state?.currentProperties?.transition) && (state?.currentProperties?.transitionspeed) ) {
			query = query + "&transition=" + state.currentProperties.transition + "&transitionspeed=" + state.currentProperties.transitionspeed
        }
		parent.doThis(thisDevice,command,query)
   }
	
}
def generateEvent(results){
	log.debug("generateEvent: Received Events name=" + results.name + " value=" + results.value + ( (results.value instanceof String) ? " String" : " Not String") )
    if ((results.value instanceof String)) {
    	sendEvent(name: results.name, value: results.value )
     } else {
     	sendEvent(name: results.name, value: JsonOutput.toJson(results.value))
     }
  return null
}

def reset() {
	log.debug "reset()"
	setColor(hex: "FFFAF0")
}

def refresh() {
	sendToParent(this,"/refresh","")
    /*
        def subscribePath = "/subscription" + "?uniqueName=" + getDeviceDataByName("uniqueName")
        //def subscribeCallBack = "<http://" + location.hubs[0].localIP + ":" + location.hubs[0].localSrvPortTCP + "/notify/returnmessage"
        //def subscribeCallBack = "<http://" + location.hubs[0].localIP + ":" + location.hubs[0].localSrvPortTCP + "/returnmessage"
        def subscribeCallBack = "<http://" + location.hubs[0].localIP + ":" + location.hubs[0].localSrvPortTCP + "/"
        def subscribeHost = getDeviceDataByName("IP") + ":" + getDeviceDataByName("port")
        def result = new physicalgraph.device.HubAction(
                method: "SUBSCRIBE",
                path: subscribePath,
                headers: [
                    HOST: subscribeHost,
                    CALLBACK: subscribeCallBack,
                    NT: "upnp:event",
                    TIMEOUT: "Second-28800"
                ] )
        sendHubCommand(result)
        log.debug("refresh: SUBSCRIBE name=${getDeviceDataByName("uniqueName")} path=$subscribePath host=$subscribeHost callback=$subscribeCallBack")
	    return result
        */
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

def sync(ip, port) {
    def existingIp = getDataValue("IP")
    def existingPort = getDataValue("port")
    if (ip && ip != existingIp) {
        updateDataValue("IP", ip)
        sendEvent(name: 'IP', value: ip)
    }
    if (port && port != existingPort) {
        updateDataValue("port", port)
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
	log.debug( "updateDNI device host=" + getDeviceDataByName("ip") + ":" + getDeviceDataByName("port") )
	def iphex = convertIPtoHex(getDeviceDataByName("ip"))
  	def porthex = convertPortToHex(getDeviceDataByName("port"))
    def svDni = device.deviceNetworkId 
    if (state.dni != null && state.dni != "" && device.deviceNetworkId != state.dni) {
       device.deviceNetworkId = state.dni
       log.debug("old deviceNetworkId =" + svDni + " now=" + device.deviceNetworkId + " state.dni is " + state.dni)
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
    def command
    if (value == 1){
       if(state."program${program}" != null) {
          command = "/program?value=${state."program${program}"}&number=$program"
       }    
    } else if(value == 0){
       command = "/stop"
    } else {
       command = "/off"
    }
    if (command != null) return sendToParent(command)
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
    def needUpdate=false
    for ( entry in cmd ) {
        currentProperties."${entry.key}"=entry.value
        if ( (settings."${entry.key}" == null) || (convertParam("${entry.key}", settings."${entry.key}").toString() != entry.value) ) {
        	log.debug("update_current_properties: configGet: " + entry.key + " was=" +currentProperties?."${entry.key}" + " will set to " + entry.value)
        	needUpdate=true
        }
    }
    state.currentProperties = currentProperties
	sendEvent(name:"needUpdate", value:(needUpdate)?"Yes":"No", displayed:false, isStateChange: true)
}


def update_needed_settings()
{
    def cmds = []
    def currentProperties = state.currentProperties ?: [:]
     
    def configuration = parseXml(configuration_model())
    def isUpdateNeeded = "NO"
    
    log.debug("update_needed_settings: starts")
    configuration.Value.each
    {     
        if ("${it.@setting_type}" == "lan" && it.@disabled != "true"){
        	//log.debug("Config stuff (1): looking at  - ${it.@index} value is " + it.@value )
            if (currentProperties."${it.@index}" == null)
            {
               if (it.@setonly == "true"){
                  //log.debug("Config stuff (2): Setting ${it.@index} will be updated to ${convertParam("${it.@index}", it.@value)}")
                  //log.debug("Config stuff (2): cmd=" + "/configSet?name=${it.@index}&value=${convertParam("${it.@index}", it.@value)}")
                  cmds << sendToParent(this,"/configSet","name=${it.@index}&value=${convertParam("${it.@index}", it.@value)}")
               } else {
                  isUpdateNeeded = "YES"
                  //log.debug("Config stuff (3): Current value of setting ${it.@index} is unknown")
                  //log.debug("Config stuff (3): cmd=" + "/configGet?name=${it.@index}")
                  cmds << sendToParent(this,"/configGet","name=${it.@index}")
                  
               }
            }
            else if ((settings."${it.@index}" != null || it.@hidden == "true") && currentProperties."${it.@index}" != (settings."${it.@index}"? convertParam("${it.@index}", settings."${it.@index}".toString()) : convertParam("${it.@index}", "${it.@value}")))
            { 
                isUpdateNeeded = "YES"
                //log.debug("Config stuff (4): Setting ${it.@index} will be updated to ${convertParam("${it.@index}", settings."${it.@index}")}")
                cmds << sendToParent(this,"/configSet","name=${it.@index}&value=${convertParam("${it.@index}", settings."${it.@index}")}")
                //log.debug("Config stuff (4): cmd=" + "/configSet?name=${it.@index}&value=${convertParam("${it.@index}", settings."${it.@index}")}")
            } 
        }
    }
    
    sendEvent(name:"needUpdate", value: isUpdateNeeded, displayed:false, isStateChange: true)
    return cmds
}

def convertParam(name, value) {
	switch (name){
        case "dcolor":
            //getDefault()
            value
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
<Value type="list" byteSize="1" index="pos" label="Boot Up State" min="0" max="2" value="0" setting_type="lan" fw="">
<Help>
Default: Off
</Help>
    <Item label="Off" value="0" />
    <Item label="On" value="1" />
</Value>
<Value type="list" byteSize="1" index="transition" label="Default Transition" min="0" max="1" value="0" setting_type="lan" fw="">
<Help>
Corresponds to Yeelight transition effect. Supports two values: "sudden" and "smooth". If effect is "sudden",
then the color temperature or Color or brightness will be changed directly to target value, if "Smooth" then the 
change will be gradual over the number of milliseconds specified in Transition Duration
Default: Sudden
</Help>
    <Item label="Sudden" value="Sudden" />
    <Item label="Smooth" value="Smooth" />
</Value>
<Value type="number" byteSize="1" index="transitionspeed" label="Transition Duration" min="30" max="5000" value="1" setting_type="lan" fw="">
<Help>
Default: 300
Corresponds to yeelight duration. Specifies the total time of the gradual changing. The unit is
milliseconds. The minimum support duration is 30 milliseconds
</Help>
</Value>
<Value type="number" byteSize="1" index="autooff" label="Auto Off" min="0" max="65536" value="0" setting_type="lan" fw="" disabled="true">
<Help>
Automatically turn the switch off after this many seconds.
Range: 0 to 65536
Default: 0 (Disabled)
</Help>
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
private getDimmedColor(color, level) {
   if(color.size() > 2){
      def scaledColor = getScaledColor(color)
      def rgb = scaledColor.findAll(/[0-9a-fA-F]{2}/).collect { Integer.parseInt(it, 16) }
    
      def r = hex(rgb[0] * (level.toInteger()/100))
      def g = hex(rgb[1] * (level.toInteger()/100))
      def b = hex(rgb[2] * (level.toInteger()/100))

      return "${r + g + b}"
   }else{
      color = Integer.parseInt(color, 16)
      return hex(color * (level.toInteger()/100))
   }
}

private getDimmedColor(color) {
   if (device.latestValue("level")) {
      getDimmedColor(color, device.latestValue("level"))
   } else {
      return color.replaceAll("#","")
   }
}
private getScaledColor(color) {
   def rgb = color.findAll(/[0-9a-fA-F]{2}/).collect { Integer.parseInt(it, 16) }
   def maxNumber = 1
   for (int i = 0; i < 3; i++){
     if (rgb[i] > maxNumber) {
	    maxNumber = rgb[i]
     }
   }
   def scale = 255/maxNumber
   for (int i = 0; i < 3; i++){
     rgb[i] = rgb[i] * scale
   }
   def myred = rgb[0]
   def mygreen = rgb[1]
   def myblue = rgb[2]
   return rgbToHex([r:myred, g:mygreen, b:myblue])
}