#!/usr/bin/env node
'use strict';
const {createBluetooth} = require('node-ble')
const {bluetooth, destroy} = createBluetooth()
const util = require("util");
const uuidv4 = require('uuid/v4');
const uuid  = require("./uuidHack");
const { Parser, EventTypes, SERVICE_DATA_UUID } = require("./parser");
const SERVICE_ID = "0000fe95-0000-1000-8000-00805f9b34fb"
const maxListenersExceededWarning = require('max-listeners-exceeded-warning');
const mqtt = require("mqtt");
const logs = require("./logs");
var log = new logs.Log("P1",false,true);
async function getAdapter() {
	try {
		 const adapter = await bluetooth.defaultAdapter();
		 return adapter;
	} catch (err) {
		console.log(err);
		throw err;
	}
}
async function startDiscovery(adapter) {
	try {
		if (!adapter) {
			console.log("adapter not there!!");
			return null;
		}
		if (! await adapter.isDiscovering())
			await adapter.startDiscovery()
		return
	} catch (err) {
		console.log(err);
		return null;
	}
}

let addresses = ["A4:C1:38:03:D4:0D","A4:C1:38:F7:92:27"];
//let addresses = ["A4:C1:38:F7:92:27"];
let bindKeys = ["937ac1412e511bf43c0be0ccad342fbc","6409e0c4e83e4486e45223d0cfa0985b"];
let statNames = ["Stat11","Stat22"]
//let bindKeys = ["6409e0c4e83e4486e45223d0cfa0985b"];
let savedTopic = "testBLE"
const mqt = setupMQTTClient({"topic": "testble", "url": "mqtt://192.168.1.144"});
maxListenersExceededWarning();
getAdapter().then( adapter => {
		startDiscovery(adapter).then( ()=>{
		Promise.all([
			adapter.getName().catch((err) => {return err}),
			adapter.getAlias().catch((err) => {return err}),
			adapter.isPowered().catch((err) => {return err})
			]).then( (vals) => {
				console.log("main\t Adapter Name=" + vals[0] + " alias=" + vals[1] + " isPowered=" + vals[2]);
				waitForDevices(adapter);
			});
		});
});
console.log ('FInished')
function waitForDevices(adapter) {
	addresses.forEach( (address, ind) => {
		console.log(" array index=" + ind + " address=" + address);
		adapter.waitDevice(address).then( (dev) => {
				processDevice(dev, bindKeys[ind]);
			});
		});
}
function processDevice(devi, bindKey) {
	//console.log("processDevice\t starts with bindKey=" + bindKey);
	Promise.all([
		devi.getAlias().catch( (err) => {return err}),
		devi.getServiceData().catch( (err) => {return "no Service Data"}),
		devi.getAddress().catch( (err) => {return err})
		]).then( (vals) => {
				//console.log("processDevice\t address=" + vals[2] + " alias=" + vals[0]);
				if (!(typeof(vals[1]) == "string")) {
					let buff = new Buffer.from(vals[1][SERVICE_ID].value);
					//console.log("processDevice\t address=" + vals[2] + " alias=" + vals[0] + " buff=" + buff.toString("hex"));
					try {
					  const servObject = new Parser(buff, bindKey).parse();
					  if (servObject && servObject.frameControl.hasEvent) {
						  const eventSD = parseServiceEvent(servObject);
						  if (Array.isArray(eventSD)) {
							  eventSD.forEach( (eve) => {
								publishValueToMQTT(savedTopic + "/" + statNames[addresses.indexOf(vals[2])],{"type": eve.evType, "value":eve.value})
								console.log("parseDevice\t successfully parsed events " + eve.evType + " val=" + eve.value);
								})
						  } else {
							  publishValueToMQTT(savedTopic + "/" + statNames[addresses.indexOf(vals[2])],{"type": eventSD.evType, "value":eventSD.value})
							  console.log("parseDevice\t successfully parsed event " + eventSD.evType + " val=" + eventSD.value);
						  }
					  }
					} catch (error) {
					  console.log("parseDevice\t HERE Error caught " + error);
					  throw error;
					}
				} else {
					console.log("parseDevice\t sdata is a string " + typeof(vals[1]) + " sdata=" + vals[1])
				}
			setTimeout(processDevice,2000,devi,bindKey);
		});	
}
//this.btBaseUUID = "xxxxxxxx-0000-1000-8000-00805F9B34FB"
//128_bit_value = 16_bit_value * 2^96 + Bluetooth_Base_UUID
//128_bit_value = 32_bit_value * 2^96 + Bluetooth_Base_UUID
function convertUUIDs(inpUUID) {
	let baseUUID = "-0000-1000-8000-00805F9B34FB"
	if (inpUUID.length==4) {
		return ("0000" + inpUUID + baseUUID).toLowerCase();
	}  else if (inpUUID.length==8) {
		return (inpUUID + baseUUID);
	} else {
		console.log("INVALID inpUUID " + inpUUID).toLowerCase();
		return null;
	}
}
let parseServiceEvent = function(result) {
	const { eventType, event } = result;
    switch (eventType) {
      case EventTypes.temperature: {
        const { temperature } = event;
		return {"evType":"temperatureChange", "value": temperature}
        //this.emit("temperatureChange", temperature, { id, address });
        break;
      }
      case EventTypes.humidity: {
        const { humidity } = event;
		return {"evType":"humidityChange", "value": humidity}
        //this.emit("humidityChange", humidity, { id, address });
        break;
      }
      case EventTypes.battery: {
        const { battery } = event;
		return {"evType":"batteryChange", "value": battery}
        //this.emit("batteryChange", battery, { id, address });
        break;
      }
      case EventTypes.temperatureAndHumidity: {
        const { temperature, humidity } = event;
		return [{"evType":"temperatureChange", "value": temperature},{"evType":"humidityChange", "value": humidity}]
        //this.emit("temperatureChange", temperature, { id, address });
        //this.emit("humidityChange", humidity, { id, address });
        break;
      }
      case EventTypes.illuminance: {
        const { illuminance } = event;
		return {"evType":"illuminanceChange", "value": illuminance}
        //this.emit("illuminanceChange", illuminance, { id, address });
        break;
      }
      case EventTypes.moisture: {
        const { moisture } = event;
		return {"evType":"moistureChange", "value": moisture}
        //this.emit("moistureChange", moisture, { id, address });
        break;
      }
      case EventTypes.fertility: {
        const { fertility } = event;
		return {"evType":"fertilityChange", "value": fertility}
        //this.emit("fertilityChange", fertility, { id, address });
        break;
      }
      default: {
		return {"evType":"error", "value": (`Unknown event type ${eventType}`)}
        //this.emit("error", new Error(`Unknown event type ${eventType}`));
        return;
      }
    }
}
 function setupMQTTClient(config) {
    if (config == null || config.url == null) {return}
    const {
      topic,
      url
    } = config;
    const client = mqtt.connect(url);
	savedTopic = topic;
    client.on("connect", () => {
      log.info("MQTT Client connected.");
    });
    client.on("reconnect", () => {
      log.debug("MQTT Client reconnecting.");
    });
    client.on("close", () => {
      log.debug("MQTT Client disconnected");
    });
    client.on("error", error => {
      log.error(error);
      client.end();
    });
    return client;
  }
  function publishValueToMQTT(topic, value) {
    if (
      mqt == null ||
      mqt.connected === false ||
      topic == null ||
      value == null
    ) {
      return;
    }
    mqt.publish(topic, String(value), {
      qos: 0, 
      retain: false
    });
  }
