#!/usr/bin/env node
'use strict';
const {createBluetooth} = require('node-ble')
const {bluetooth, destroy} = createBluetooth()
const util = require("util");
const uuidv4 = require('uuid/v4');
const uuid  = require("./uuidHack");
const { Parser, EventTypes, SERVICE_DATA_UUID } = require("./parser");
async function getAdapter() {
	try {
		 const adapter = await bluetooth.defaultAdapter();
		 return adapter;
	} catch (err) {
		console.log(err);
		throw err;
	}
}
async function getDevices(adapter) {
	try {
		if (!adapter) {
			console.log("adapter not there!!");
			return null;
		}
		if (! await adapter.isDiscovering())
			await adapter.startDiscovery()
		let devices = await adapter.devices();
		
		//console.log(" devices=" + devices + " #=" + devices.length);
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
async function test(){
	try {
		let devs = {};
		const adapter = await bluetooth.defaultAdapter();
		console.log("Weirdness");
		if (! await adapter.isDiscovering()) {
			await adapter.startDiscovery();
			console.log("started discovery adapter = " + adapter.adapter);
			devs = await adapter.devices;
		}
		
		//return [adapter,device,gattServer,service,char1,char2]
		//return {adapter:adapter, device:device, gattServer:gattServer, service:service};
		return devs;
	} catch (error) {
		console.log("ARRGH");
		throw (error)
	}
	
}
;
let addresses = ["A4:C1:38:03:D4:0D","A4:C1:38:F7:92:27"];
let bindKeys = ["937ac1412e511bf43c0be0ccad342fbc","6409e0c4e83e4486e45223d0cfa0985b"];
let btdevices = [];
getAdapter().then( adapter => {
	const handler = setInterval( () => {
	  adapter.isDiscovering().then( (isdisc) => {console.log("isDiscovering=" + isdisc)} )
	}, 30000);
	Promise.all([
		adapter.getName().catch((err) => {return err}),
		adapter.getAlias().catch((err) => {return err}),
		adapter.isPowered().catch((err) => {return err})
		]).then( (vals) => {
			console.log(" Adapter Name=" + vals[0] + " alias=" + vals[1] + " isPowered=" + vals[2]);
		});
	getDevices(adapter).then( (devs) => {
					//console.log(devs)
					devs.forEach( dev => {
						//getDev(adapter, dev).then(devi =>{
						adapter.getDevice(dev).then(devi =>{
								Promise.all([
									devi.getAlias().catch( (err) => {return err}),
									devi.getServiceData().catch( (err) => {return "no Service Data"}),
									devi.getManufacturerData().catch( (err) => {return "no Manufacturer Data"}),
									devi.getAddress().catch( (err) => {return err})
									]).then( (vals) => {
										if (addresses.includes(vals[3])) {
											console.log(" address=" + vals[3] + " alias=" + vals[0]);
											btdevices.push({"devi":devi, "sdata":vals[1]});
											let sdatas = "";
											let uids = "";
											const SERVICE_ID = "0000fe95-0000-1000-8000-00805f9b34fb"
											let cnt =0;
											let servObject;
											let bindKey = bindKeys[addresses.indexOf(vals[3])];
											if (typeof(vals[1]) == "string") {
												sdatas = vals[1];
											} else {
												for (const uid in vals[1]) { 
														cnt++;
														sdatas = (sdatas=="") ? "[" + vals[1][uid].value + "]" : sdatas + ",[" + vals[1][uid].value + "]"
														uids = (uids=="") ? "[" + uid + "]" : uids + ",[" + uid + "]"
													}
												console.log("we have an array of sdata cnt=" + cnt + " sdata=" + sdatas + " uids=" + uids);
												//console.log(" debug vals[1] = " + JSON.stringify(vals[1]));
												let buff = new Buffer.from(vals[1][SERVICE_ID].value);
												console.log("about to parse bindkey=" + bindKey);
												try {
												  servObject = new Parser(buff, bindKey).parse();
												  console.log(" Parsed ");// + JSON.stringify(servObject));
												  if (servObject && servObject.frameControl.hasEvent) {
													  const eventSD = parseServiceEvent(({ eventType, event } = result));
													  if (Array.isArray(eventSD)) {
														  eventSD.forEach( (eve) => {
															console.log(" successfully parsed events " + eve.evType + " val=" + eve.value);
															})
													  } else {
														  console.log(" successfully parsed event " + eventSD.event + " val=" + eventSD.value);
													  }
												  } else {
													  console.log("failing servObject/framecontrol");
												  }
												} catch (error) {
												  console.log("Error caught " + error);
												}
											}
											let mdatas = "";
											if (typeof(vals[2]) == "string") {
												mdatas = vals[2];
											} else {
												for (const uid in vals[2]) { mdatas = (mdatas=="") ? "[" + vals[2][uid].value + "]" : mdatas + ",[" + vals[2][uid].value + "]"}
											}
										} else {
											console.log(" invalid address=" + vals[3] + " alias=" + vals[0]);
										}
										//console.log(" Device " + devi.device + "\t" + vals[0] + " sdata=" + sdatas + " mdata=" + mdatas);
										//console.log(" address=" + vals[3]);
									});									
						});
					})
		//adapter.stopDiscovery();
	})
});
/*
primaryService('F8:24:41:C0:51:71','0000fe87-0000-1000-8000-00805f9b34fb',"aa7d3f34-2d4f-41e0-807f-52fbf8cf7443","8f65073d-9f57-4aaa-afea-397d19d5bbeb").then(result => {
	const [adapter, device, gattServer, service] = result;
	console.log("adapter=" + adapter.adapter + " device=" + device.device + " service=");
});N071W 

// */

const longToByteArray = function(along) {
    // we want to represent the input as a 8-bytes array
    var byteArray = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,0,0];

    for ( var index = 0; index < byteArray.length; index ++ ) {
        var byte = along & 0xff;
        byteArray [ index ] = byte;
        along = (along - byte) / 256 ;
    }

    return byteArray;
};

const byteArrayToLong = function(byteArray) {
    var value = 0;
    for ( var i = byteArray.length - 1; i >= 0; i--) {
        value = (value * 256) + byteArray[i];
    }

    return value;
};
function getInt64Bytes(x) {
  let y= Math.floor(x/2**32);
  return [y,(y<<8),(y<<16),(y<<24), x,(x<<8),(x<<16),(x<<24)].map(z=> z>>>24)
}

function intFromBytes(byteArr) {
    return byteArr.reduce((a,c,i)=> a+c*2**(56-i*8),0)
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
		return {"evType":"batteryChange", "value": temperature}
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
console.log ('FInished')