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
		//await adapter.stopDiscovery();
		
		//console.log(" devices=" + devices + " #=" + devices.length);
		return devices
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

//let addresses = ["A4:C1:38:03:D4:0D","A4:C1:38:F7:92:27"];
let addresses = ["A4:C1:38:F7:92:27"];
//let bindKeys = ["937ac1412e511bf43c0be0ccad342fbc","6409e0c4e83e4486e45223d0cfa0985b"];
let bindKeys = ["6409e0c4e83e4486e45223d0cfa0985b"];

let btdevices = [];
let inprogress = false;
maxListenersExceededWarning();
getAdapter().then( adapter => {
	const handler = setInterval( () => {
	  adapter.isDiscovering().then( (isdisc) => {console.log("isDiscovering=" + isdisc)} )
	}, 30000);
	Promise.all([
		adapter.getName().catch((err) => {return err}),
		adapter.getAlias().catch((err) => {return err}),
		adapter.isPowered().catch((err) => {return err})
		]).then( (vals) => {
			console.log("main\t Adapter Name=" + vals[0] + " alias=" + vals[1] + " isPowered=" + vals[2]);
			addresses.forEach( (address, ind) => {
				console.log(" array index=" + ind + " address=" + address);
			} );
			dotheBus(adapter);
			const mainHandler = setInterval( () => {
				//chkDevices(adapter);
				dotheBus(adapter);
			}, 10000);
		});
});
function dotheBus(adapter) {
	//console.log("parseDevice\t starting dothebus");
	//async waitDevice (uuid, timeout = DEFAULT_TIMEOUT, discoveryInterval = DEFAULT_DISCOVERY_INTERVAL) {
	if (!inprogress) {
		inprogress = true;
		getDevices(adapter).then( (devs) => {
						devs.forEach( dev => {
							adapter.getDevice(dev).then(devi =>{
									Promise.all([
										devi.getAlias().catch( (err) => {return err}),
										devi.getServiceData().catch( (err) => {return "no Service Data"}),
										devi.getAddress().catch( (err) => {return err})
										]).then( (vals) => {
											if (addresses.includes(vals[2])) {
												const bindKey = bindKeys[addresses.indexOf(vals[2])];
												console.log("dotheBus\t valid address=" + vals[2] + " alias=" + vals[0] + " dev UUID=" + dev);
												let btdevice = {"devi":devi, "sdata":vals[1], "address":vals[2], "dev":dev}
												//btdevices.push(btdevice);
												let uids = "";
												if (!(typeof(vals[1]) == "string")) {
													let buff = new Buffer.from(vals[1][SERVICE_ID].value);
													console.log("parseDevice\t buff =" + buff.toString("hex"));
													try {
													  const servObject = new Parser(buff, bindKey).parse();
													 // console.log("parseDevice\t Parsed ");// + JSON.stringify(servObject));
													  if (servObject && servObject.frameControl.hasEvent) {
														  const eventSD = parseServiceEvent(servObject);
														  if (Array.isArray(eventSD)) {
															  eventSD.forEach( (eve) => {
																console.log("parseDevice\t successfully parsed events " + eve.evType + " val=" + eve.value);
																})
														  } else {
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
											} else {
												//console.log("dotheBus\t invalid address=" + vals[2] + " alias=" + vals[0]);
											}
											//devi.disconnect().then( ()=>{console.log("parseDevice\t Device " + vals[2] + " disconnected")})
											inprogress=false;
										});									
										devi.disconnect().catch( (err) => {console.log("parseDevice\t Device " + vals[2] + " disconnect failed " + err)})
							});
						})
			//adapter.stopDiscovery();
		})
	} else {
		console.log("Function already in progress");
	}
}

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