#!/usr/bin/env node
'use strict';
const {createBluetooth} = require('node-ble')
const {bluetooth, destroy} = createBluetooth()
const util = require("util");
//const {v4:uuidv4} = require ("uuid");
const uuidv4 = require('uuid/v4');
const uuid  = require("./uuidHack");

async function getAdapter() {
	try {
		 let adapter = await bluetooth.defaultAdapter();
		 return adapter;
	} catch (err) {
		return null;
	}
}
async function getDevices(adapter) {

	//f8:24:41:c0:51:71 
	try {
		if (!adapter) return null;
		if (! await adapter.isDiscovering())
			await adapter.startDiscovery()
		//let device = await adapter.waitDevice('F8:24:41:C0:51:71');
		let devices = await adapter.devices();
		console.log("adapter=" + adapter.adapter);
		console.log(" devices=" + devices + " #=" + devices.length);
		return devices
	} catch (err) {
		console.log(err);
		return null;
	}
}
async function getDev(adapter,dev) {

	//f8:24:41:c0:51:71 
	try {
		let device = await adapter.getDevice(dev);
		//console.log("here adapter=" + adapter.adapter + " dev=" + dev);
		//console.log("here device=" + device);
		return device
	} catch (err) {
		console.log(err);
		return null;
	}
}
async function getService(gattserver,uuid) {
	const service = await gattServer.getPrimaryService('uuid')
}
async function getChar(service,uuid) {
	const characteristic = await service1.getCharacteristic('uuid')
}
async function primaryService(deviceUUID,primaryServiceUUID,char1UUID,char2UUID) {
	try {
		const adapter = await bluetooth.defaultAdapter();
		if (! await adapter.isDiscovering())
		await adapter.startDiscovery();
		console.log("started discovery adapter = " + adapter.adapter);
		const device = await adapter.waitDevice(deviceUUID);
		console.log("found device = " + device.device);
		await device.connect();
		console.log("connected device = " + device.device);
		const gattServer = await device.gatt();
		console.log("found gattserver");
		const services = await gattServer.services();
		let cnt = services.length;
		console.log("found " + cnt + " services " + services);
		
		//const service = null;
		const service = await gattServer.getPrimaryService(primaryServiceUUID)
		const chars = await service.characteristics();
		console.log("got primary service chars are " + chars);
		let char1 = null;
		if (char1UUID) {
			const char1 = await service.getCharacteristic(char1UUID);
			console.log("first characteristic " + char1.characteristic); //util.inspect(char1));
		}
		let char2 = null;
		if (char2UUID) {
			char2 = await service.getCharacteristic(char2UUID);
			console.log("second characteristic " + char2.characteristic);
		}			
		return [adapter,device,gattServer,service,char1,char2]
		//return {adapter:adapter, device:device, gattServer:gattServer, service:service};
	} catch (error) {
		console.log("ARRGH");
		throw (error)
	}
	
}
/*
primaryService('F8:24:41:C0:51:71','0000fe87-0000-1000-8000-00805f9b34fb',"aa7d3f34-2d4f-41e0-807f-52fbf8cf7443","8f65073d-9f57-4aaa-afea-397d19d5bbeb").then(result => {
	const [adapter, device, gattServer, service] = result;
	console.log("adapter=" + adapter.adapter + " device=" + device.device + " service=");
});
*/
	/*
	if (values[2]) {
		let buf = new Buffer.from(values[2].Variant.value);
		console.log("buf = " + util.inspect(buf));
	} else { console.log("weird = " + values[2]) }
	
	if (values[2]) {
		let buf = Buffer.from(values[2].Variant.value);
		console.log("buf = " + util.inspect(buf));
	} else { console.log("weird")};
	*/
//this.btBaseUUID = "xxxxxxxx-0000-1000-8000-00805F9B34FB"
//128_bit_value = 16_bit_value * 2^96 + Bluetooth_Base_UUID
//128_bit_value = 32_bit_value * 2^96 + Bluetooth_Base_UUID

function convertUUIDs(inpUUID) {
	
}
let tUUID = "aa7d3f34-2d4f-41e0-807f-52fbf8cf7443"
let pUUID = uuid.parse(tUUID);
let sUUID = uuid.stringify(pUUID);
console.log(tUUID);
console.log(pUUID);
console.log(sUUID);
console.log(uuid.parse(sUUID));
console.log(uuid.stringify(uuid.parse(sUUID)));
console.log(uuidv4());


/*
getAdapter().then(adapter => {
					getDevices(adapter).then( devs => {
							console.log(devs)
							devs.forEach( dev => {
								getDev(adapter, dev).then(devi =>{
									Promise.all([devi.getAlias(),devi.getName(),
												devi.getServiceData()]).then(values => { 
																if (devi) {
																	console.log(" dev " + devi.adapter + "/" + devi.device + " " + 
																				dev + " name=" + values[0] + " alias=" + values[1] + 
																				" sdata=" + values[2]);
																} else {
																	console.log(" dev " + "**UND**" + "/" + "**UND**" + " " + dev + 
																	" name=" + values[0] + " alias=" + values[1] + 
																	" sdata=" + values[2]);
																}
																console.log("inspect values[2]= " + util.inspect(values[2]));
																if (values[2]) {
																	console.log("WTF values[2] set " + values[2]["0000fe95-0000-1000-8000-00805f9b34fb"].value)
																	let buf = new Buffer.from(values[2]["0000fe95-0000-1000-8000-00805f9b34fb"].value);
																	console.log("buf = " + util.inspect(buf));
																} else {
																	console.log("WTF values[2] NOT set")
																	console.log("weird = " + values[2])
																}
																			})
													.catch(values => {
																if (devi) {
																	console.log(" dev " + devi.adapter + "/" + devi.device + " " + 
																				dev + " name=" + values[0] + " alias=" + values[1] + 
																				" sdata=" + values[2]);
																} else {
																	console.log(" dev " + "**UND**" + "/" + "**UND**" + " " + dev + 
																	" name=" + values[0] + " alias=" + values[1] + 
																	" sdata=" + values[2]);
																}
																console.log("inspect values[2]= " + util.inspect(values[2]));
																if (values[2]) {
																	let buf = new Buffer.from(values[2].Variant.value);
																	console.log("buf = " + util.inspect(buf));
																}
																			})
									} );
								})
						})
				});
// */


//let tempchars = ['aa7d3f342d4f41e0807f52fbf8cf7443', '8f65073d9f574aaaafea397d19d5bbeb']
//await characteristic1.writeValue(Buffer.from("Hello world"))
//const buffer = await characteristic1.readValue()
//console.log(buffer)

//getAdapter().then(adapter => {console.log(adapter)});
//const {device,gatt} = getDevice(adapter);
/*
getAdapter().then(adapter =>{
					console.log(adapter.adapter);
					let dev;
					let gatt;
					getDevice(adapter).then(result => {
									dev = result.device;
									gatt = result.gattServer;
									console.log(dev.device);
									console.log(gatt);
						})
				});
*/


//const gattServer = await device.gatt()
console.log ('FInished')