#!/usr/bin/env node
'use strict';

const EventEmitter = require("events");
const { Parser, EventTypes, SERVICE_DATA_UUID } = require("./parser");
class XiaomiThermostat extends EventEmitter {
	constructor(handler, id, bindKey,dev){
		super();
		this.id = id;
		this.eventHandlers = {"temperatureChange": this.setTemperature, "batteryChange": this.setBatteryLevel, "humidityChange":this.setHumidity};
		this.eventToPropertyMapping = {"temperatureChange": "temperature", "batteryChange": "batteryLevel", "humidityChange": "humidity"}
		this.properties = {"temperature": { "value": undefined, "lastUpdated": undefined },
							"humidity": { "value": undefined, "lastUpdated": undefined },
							"batteryLevel": { "value": undefined, "lastUpdated": undefined },
							};
		this.bindKey = bindKey;
		this.handler = handler;
		this.temperature = null;
		this.humidity = null;
		this.batteryLevel = null;
		this.lastUpdatedAt = undefined;
		this.dev = dev;
		this.dev.helper.on("PropertiesChanged", (changedProps) => {
			const now = new Date(Date.now());
			for ( let prop in changedProps ) {
			  //if (prop!="RSSI") console.log(now.toLocaleDateString() + " " + now.toLocaleTimeString() + ": eventData: " + prop + " " + changedProps[prop].value);
			  if (prop=="ServiceData") {
				  this.handleSData(changedProps["ServiceData"].value);
			  }
			}
		});
	}
	setDeviceProp(propName, value) {
		//console.log("DEBUG 1 \t setDeviceProp called \t propname=" + propName + " value=" + value);
		if ( (this.properties[propName]) && (this.properties[propName].value != value) ) {
			//console.log("XiaomiThermostat \t " + propName + " emitting change value = " + value + " oldValue=" + this.properties[propName].value);
			this.emit("change", value, {"type": propName, "id": this.id, "oldvalue": this.properties[propName].value, "time": Date.now() });
			this.properties[propName].value = value;
			this.properties[propName].lastUpdated = Date.now();
		} else if (!properties[propName]) {
			console.log("XiaomiThermostat\t " + propName + "\t ERROR invalid property");
		} else {
			console.log("XiaomiThermostat\t " + propName + " oldValue=" + this.properties[propName].value + " newValue=" + value + " test=" + (this.properties[propName].value != value));
		}
	}
	handleSData(sdata){
		for (let uuid in sdata) {
			const unparsed = new Buffer.from(sdata[uuid].value);
			const parsed = new Parser(unparsed,this.bindKey).parse();
			const now = new Date(Date.now());
			if (parsed) {
				//console.log("XiaomiThermostat\t handleSData \t id=" + this.id + " productId=" + parsed.productId + " frameCounter=" +  parsed.frameCounter +
				//					" eventLength=" + parsed.eventLength + " version=" + parsed.version +
				//					" capabilities=" + JSON.stringify(parsed.capabilities) + " eventType=" + parsed.eventType + " event=" + JSON.stringify(parsed.event) )
			}
			if (parsed && parsed.frameControl.hasEvent) {
				const events = this.parseServiceEvent(parsed);
				events.forEach( (event) => {
					//console.log("XiaomiThermostat\t handleSData \t id=" + this.id + " eventType=" + event.evType + " value=" + event.value + " " +
					//				now.toLocaleDateString() + " " + now.toLocaleTimeString() + " fc=" + parsed.frameCounter)
					if (this.eventToPropertyMapping[event.evType]) {
						this.setDeviceProp(this.eventToPropertyMapping[event.evType],event.value);
					} else {
						console.log("handleSData\t id=" + this.id + " eventType=" + event.evType + " Handler not found");
					}
				});
			} else if (!parsed) {
				console.log("XiaomiThermostat\t handleSData \t id=" + this.id + " " + uuid + " Parsing failed" + " " +
									now.toLocaleDateString() + " " + now.toLocaleTimeString());
			} else {
				//console.log("XiaomiThermostat\t handleSData \t id=" + this.id + " " + uuid + " Framecontol does not have event" + " " +
				//					now.toLocaleDateString() + " " + now.toLocaleTimeString());
			}
		}
	}
	async prepare(){
		try {
			//console.log("dev has " + this.dev.listenerCount("ServiceData") + " listeners");
			console.log("this has " + this.listenerCount("ServiceData") + " listeners");
			let sdata = await this.dev.getServiceData();
			this.handleSData(sdata);
		} catch (err) {
			console.log("XiaomiThermostat\t Prepare \t error getting sdata " + err);
			return
		}
	}
	parseServiceEvent(result) {
		const { eventType, event } = result;
		if (eventType == EventTypes.temperature) {
			const { temperature } = event;
			return [{"evType":"temperatureChange", "value": temperature}]
		} else if (eventType == EventTypes.humidity) {
			const { humidity } = event;
			return [{"evType":"humidityChange", "value": humidity}]
		} else if (eventType == EventTypes.battery) {
			const { battery } = event;
			return [{"evType":"batteryChange", "value": battery}]
		} else if (eventType == EventTypes.temperatureAndHumidity) {
			const { temperature, humidity } = event;
			return [{"evType":"temperatureChange", "value": temperature},{"evType":"humidityChange", "value": humidity}]
		} else if (eventType == EventTypes.illuminance) {
			const { illuminance } = event;
			return [{"evType":"illuminanceChange", "value": illuminance}]
		} else if (eventType == EventTypes.moisture) {
			const { moisture } = event;
			return [{"evType":"moistureChange", "value": moisture}]
		} else if (eventType == EventTypes.fertility) {
			const { fertility } = event;
			return [{"evType":"fertilityChange", "value": fertility}]
		} else {
			return [{"evType":null, "value": (`Unknown event type ${eventType}`)}]
		}
	}
}
module.exports = XiaomiThermostat;