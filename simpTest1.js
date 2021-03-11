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
let cnt = 0;
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
console.log("Finished");
function dropRandoms(adapter) {
	let cnt2 = 0;
	adapter.devices().then(async (devs)=>{
		let adTypePromises = devs.map(async (dev) => {
			const devi = await adapter.getDevice(dev);
			const typ = await devi.getAddressType();
			return {dev: dev, typ: typ, devi:devi};
		});
		const adTypes = await Promise.all(adTypePromises);
		adTypes.forEach( async (adType) => {
			if (adType.typ=="random") {
				cnt2++;
				await adType.devi.disconnect();
				await adapter.removeDevice(adType.dev);
				//console.log("dropRandoms\t  device dropped " + adType.dev);
			}
		});
		console.log("dropRandoms\t run #" + cnt + "\t" + " found=" + devs.length + "\t random=" + cnt2)
	})
}
function waitForDevices(adapter) {
	cnt++;
	dropRandoms(adapter);
	let cnt2 = 0;
	adapter.devices().then(async (devs)=>{
		let adTypePromises = devs.map(async (dev) => {
			const devi = await adapter.getDevice(dev);
			return await devi.getAddressType();
		});
		const adTypes = await Promise.all(adTypePromises);
		adTypes.forEach( (adType) => {
			if (adType=="random") cnt2++;
		});
		console.log("waitForDevices\t run #" + cnt + "\t" + " found=" + devs.length + "\t random=" + cnt2)
		setTimeout(waitForDevices,5000,adapter);
	})
}
/*
properties.on('PropertiesChanged', (iface, changed, invalidated) => {
  for (let prop of Object.keys(changed)) {
    console.log(`property changed: ${prop}`);
  }
});
*/