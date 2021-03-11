#!/usr/bin/env node
'use strict';
const {createBluetooth} = require('node-ble')
const {bluetooth, destroy} = createBluetooth()
const util = require("util");
const uuidv4 = require('uuid/v4');
const uuid  = require("./uuidHack");
const { Parser, EventTypes, SERVICE_DATA_UUID } = require("./parser");
const SERVICE_ID = "0000fe95-0000-1000-8000-00805f9b34fb"
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
		await adapter.stopDiscovery();
		
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

let addresses = ["A4:C1:38:03:D4:0D","A4:C1:38:F7:92:27"];
let bindKeys = ["937ac1412e511bf43c0be0ccad342fbc","6409e0c4e83e4486e45223d0cfa0985b"];

let btdevices = [];
let inprogress = false;
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
			dotheBus(adapter);
			const mainHandler = setInterval( () => {
				//chkDevices(adapter);
				dotheBus(adapter);
			}, 10000); 
		});
});
function chkDevices(adapter) {
	//console.log("chkDevices\t - Starting");
	console.log("chkDevices\t btdevices.length=" + btdevices.length);
	btdevices.forEach( (btdev) =>{
		parseDevice(adapter, btdev);

	});
	//console.log("chkDevices\t - Ending");
}
function parseDevice(adapter, btdev){
	const bindKey = bindKeys[addresses.indexOf(btdev.address)];
	
	adapter.getDevice(btdev.dev).then(devi => {
			devi.isConnected().then( res => {
				devi.isPaired().then( res2 => { console.log("parseDevice\t isConnected=" + res + " isPaired=" + res2) })
				})
			devi.getServiceData().then(sda => {
				let buff = new Buffer.from(sda[SERVICE_ID].value);
				console.log("parseDevice\t buff =" + buff.toString("hex"));
				//let buff = sda[Service_ID].value.buffer;
				//console.log("parseDevice\t about to parse bindkey=" + bindKey + " address=" + btdev.address);
				//console.log("parseDevice\t sdata=" + JSON.stringify(sda[SERVICE_ID]));
				/*console.log("parseDevice\t sdata buffer=" + typeof(sda[SERVICE_ID].value) + 
									" isArray=" + Array.isArray(sda[SERVICE_ID].value) +
									" ua=" + ua +
									" stringify=" + JSON.stringify(sda[SERVICE_ID].value) ); */
				try {
				  const servObject = new Parser(buff, bindKey).parse();
				  //const servObject = new Parser(sda[SERVICE_ID].value, bindKey).parse();
				  console.log("parseDevice\t Parsed ");// + JSON.stringify(servObject));
				  if (servObject && servObject.frameControl.hasEvent) {
					  const eventSD = parseServiceEvent(({ eventType, event } = servObject));
					  if (Array.isArray(eventSD)) {
						  eventSD.forEach( (eve) => {
							//console.log("parseDevice\t successfully parsed events " + eve.evType + " val=" + eve.value);
							})
					  } else {
						  //console.log("parseDevice\t successfully parsed event " + eventSD.event + " val=" + eventSD.value);
					  }
				  } else {
					  //console.log("parseDevice\t failing servObject/framecontrol servObject=" + JSON.stringify(servObject));
					  //console.log("parseDevice\t failing servObject/framecontrol \tevent=" + servObject.event + 
					//				"\teventType=" + servObject.eventType + "\tframeCounter=" + servObject.frameCounter);
				  }
				} catch (error) {
				  console.log("parseDevice\t HERE Error caught " + error);
				  throw error;
				}
				
			}).catch( (err) => {return "no Service Data"})
		});
}
function dotheBus(adapter) {
	console.log("parseDevice\t starting dothebus");
	if (!inprogress) {
		inprogress = true;
		getDevices(adapter).then( (devs) => {
						//console.log("dotheBus\t devs=" + devs)
						devs.forEach( dev => {
							adapter.getDevice(dev).then(devi =>{
									Promise.all([
										devi.getAlias().catch( (err) => {return err}),
										devi.getServiceData().catch( (err) => {return "no Service Data"}),
										devi.getManufacturerData().catch( (err) => {return "no Manufacturer Data"}),
										devi.getAddress().catch( (err) => {return err})
										]).then( (vals) => {
											console.log("dothebus address=" + vals[3] + " alias=" + vals[0]);
											if (addresses.includes(vals[3])) {
												console.log("dotheBus\t address=" + vals[3] + " alias=" + vals[0]);
												let btdevice = {"devi":devi, "sdata":vals[1], "address":vals[3], "dev":dev}
												//btdevices.push(btdevice);
												let sdatas = "";
												let uids = "";
												let cnt =0;
												let servObject;
												
												if (typeof(vals[1]) == "string") {
													sdatas = vals[1];
												} else {
													for (const uid in vals[1]) { 
															cnt++;
															sdatas = (sdatas=="") ? "[" + vals[1][uid].value + "]" : sdatas + ",[" + vals[1][uid].value + "]"
															uids = (uids=="") ? "[" + uid + "]" : uids + ",[" + uid + "]"
														}
													//console.log("dotheBus\t we have an array of sdata cnt=" + cnt + " sdata=" + sdatas + " uids=" + uids);
													//console.log("dotheBus\t debug vals[1] = " + JSON.stringify(vals[1]));
													parseDevice(adapter, btdevice);
												}
												let mdatas = "";
												if (typeof(vals[2]) == "string") {
													mdatas = vals[2];
												} else {
													for (const uid in vals[2]) { mdatas = (mdatas=="") ? "[" + vals[2][uid].value + "]" : mdatas + ",[" + vals[2][uid].value + "]"}
												}
											} else {
												console.log("dotheBus\t invalid address=" + vals[3] + " alias=" + vals[0]);
											}
											//console.log("dotheBus\t Device " + devi.device + "\t" + vals[0] + " sdata=" + sdatas + " mdata=" + mdatas);
											//console.log("dotheBus\t address=" + vals[3]);
											inprogress=false;
										});									
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