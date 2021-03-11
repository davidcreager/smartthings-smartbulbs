#!/usr/bin/env node
'use strict';
const xiaomiThermostatBindKeys = ["937ac1412e511bf43c0be0ccad342fbc","6409e0c4e83e4486e45223d0cfa0985b"];
const xiaomiThermostatAddresses = ["A4:C1:38:03:D4:0D","A4:C1:38:F7:92:27","A4:C1:38:AA:CD:3D"];
const {createBluetooth} = require('node-ble');
const XiaomiThermostat = require("./xdevice");
const {bluetooth, destroy} = createBluetooth();
const mqtt = require("mqtt");
let testStats = {};
let testDevs = {};

let mqttServer= "mqtt://192.168.1.144";
let mqttPort = 1883;
let mqttTopic = "smartserver/";

function startMQTT(){
	const client = mqtt.connect(mqttServer);
	client.on("connect", () => {
	  //this.log.info("MQTT Client connected.");
	  console.log("startMQTT\t Client connected");
	});
	client.on("reconnect", () => {
	  //this.log.debug("MQTT Client reconnecting.");
	  console.log("startMQTT\t Client reconnecting");
	});
	client.on("close", () => {
	  //this.log.debug("MQTT Client disconnected");
	  console.log("startMQTT\t Client disconnected");
	});
	client.on("error", error => {
	  //this.log.error(error);
	  console.log("startMQTT\t Error " + error);
	  client.end();
	});
	//log.info("MQTTClient" , " running on " + mqttServer + ":" + mqttPort + " with topic " + mqttTopic);
	console.log("startMQTT\t running on " + mqttServer + ":" + mqttPort + " with topic " + mqttTopic);
	return client;
}

const mqttClient = startMQTT();

function publishMQTTMessage(topic,msg){
	mqttClient.publish(topic, String(msg));
}
function fmtDate(inp) {
		let wk = new Date(inp);
		return wk.toLocaleDateString() + " " + wk.toLocaleTimeString()
}

main();

async function main() {
	const adapter = await bluetooth.defaultAdapter();
	if (! await adapter.isDiscovering()) await adapter.startDiscovery();
	let devs = await adapter.devices();
	console.log("Found " + devs.length + " Devices");
	devs.forEach( (dev)=> {
		adapter.getDevice(dev).then( (devy)=>{
			testDevs[devy.device] = devy;
			//console.log("device - " + dev + " got devy=" + devy.device);
			if (xiaomiThermostatAddresses.includes(dev)) {
				if (!testStats[dev]) {
					testStats[dev] = new XiaomiThermostat(adapter,dev,xiaomiThermostatBindKeys[xiaomiThermostatAddresses.indexOf(dev)],testDevs[devy.device]);
					console.log("\t\t Creating stat " + " for dev=" + dev);
					testStats[dev].on("change", (value, obj)=>{
						console.log("Main\t Received Change Message \t " + fmtDate(obj.time) + "\tobject=" + JSON.stringify(obj) + " value=" + value);
						publishMQTTMessage(mqttTopic + obj.id + "/" + obj.type,value);
					});
					testStats[dev].prepare();
					//setInterval(testStats[dev].pollForUpdates.bind(testStats[dev]),2000);
				}
			}			
		});
	});
	let allFound = true;
	xiaomiThermostatAddresses.forEach((add) => {
		if (!testStats[add]) allFound = false;
	});
	if (!allFound) {
		setTimeout(main,2000);
	} else {
		console.log ("all found");
	};
}