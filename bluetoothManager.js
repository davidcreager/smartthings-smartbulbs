'use strict';
const maxDevices = 8;
var Playbulb = require("./Playbulb");
var YeeBTLamp = require("./YeeBTLamp");
var managerTypes = require("./properties.json").ManagerPrefixes
var prefixTypes = {};
var tmp;
for (tmp in managerTypes) {
	//console.log("DEBUG " + tmp + " " + JSON.stringify(propers[managerTypes[tmp]].AdvertismentPrefixTypes) )
	prefixTypes[tmp] = require("./properties.json")[managerTypes[tmp]].AdvertismentPrefixTypes;
}
exports.BluetoothManager = function (handler) {
	var that = this;
	this.numberOfDevices = 0;
	this.noble = require('noble');
	this.smartType = "Bluetooth";
	this.btDevices = [];
	this.peripheralPairingStates = {};
	this.peripherals = {};
	this.cbHandler = handler;
	this.powerState = "startUp"
	this.scanState = "off"
	this.scanInProgess = null;
	this.stopScanningTimer = null;
	this.startScanningTimer = null;
	this.discoverTimer = null;
	var unknownDevices = {}
	this.discoverDevices= function(){
		//console.log("BluetoothManager: discovering")
		if (that.discoverTimer) {
			that.discoverTimer = null;
			clearTimeout(that.discoverTimer)
		}
		if (that.startScanningTimer) {
			that.startScanningTimer = null;
			clearTimeout(that.startScanningTimer)
		}
		if ( (that.powerState=="poweredOn") && (that.scanState=="off") ) {
			//console.log("BluetoothManager: discoverDevices - Scanning")
			that.noble.startScanning([],false);
			//that.noble.startScanning([],true);
		} else {
			that.discoverTimer = setTimeout(that.discoverDevices, (that.powerState != "poweredOn") ? 2000 : 10000); 
		}
		//console.log("Discover ends")		
	}.bind(this)
	this.createBulbObject = function(type) {
		console.log("BluetoothManager: createBulbObject: type=" + type)
		var args = Array.from(arguments)
		var instance;
		if (type=="YeeBTLamp") {
			//console.log("DEBUG args[0]=" + args[0] + " args[1]=" + args[1] + "args[2]=" + args[2] + " args[3].uuid=" + args[3].uuid)
			return new (Function.prototype.bind.apply(YeeBTLamp.YeeBTLamp, args));
		} else if (type=="Playbulb") {
			//console.log("DEBUG args=" + args + " sliced=" + args.slice[1]);
			return new (Function.prototype.bind.apply(Playbulb.Playbulb, args));

		} else {
			console.log("BluetoothManager: createBulbObject: Unknown Type " + type)
		}
	};
	this.findDevice = function(name,unique=true) {
		//console.log("BluetoothManager: findDevice: We have " + this.btDevices.length + " Devices" )
		var obj = null;
		var tmpPb = null;
		if (this.btDevices.length>0) {
			for ( tmpPb in this.btDevices) {
				//console.log("BluetoothManager: findDevice: checking name=" + name + " pbDevice=" + this.btDevices[tmpPb].playbulbName)
				if ( ( (this.btDevices[tmpPb].playbulbName==name) && (!unique) ) ||  ( (this.btDevices[tmpPb].uniqueName==name) && (unique) ) ) {
					console.log("BluetoothManager: findDevice: Found name=" + name + " pbDevice=" + this.btDevices[tmpPb].playbulbName)
					obj=this.btDevices[tmpPb];
				} else {
					//console.log("BluetoothManager: findDevice: didnt find name=" + name + " pbDevice=" + this.btDevices[tmpPb].playbulbName + " " + this.btDevices[tmpPb].uniqueName)
				}
			}
		}
		return obj;
	}.bind(this);
	this.connectPeripheral = function(peripheral,cb) {
		if (peripheral.state=="connected") {
			cb(null,periph);
		} else {
			peripheral.connect(function (error,btBulb) {
				if (error) {
					if (peripheral.state != "connected") {
						console.log("BluetoothManager: " + peripheral.advertisement.localName + " device cant connect state=" + peripheral.state)
						throw error;
						cb(error,null)
					}
				}
				cb(null,peripheral)
			});
		}
	};
	this.connectDevice = function(peripheral,cb) {
		var pbPrefix;
		this.connectPeripheral(peripheral, function (error,btBulb) {
			if (error) {
				console.log("BluetoothManager:connectDevice " + peripheral.advertisement.localName + " error connecting " + error);
				cb(error,null)
				return;
			}
			if (peripheral.state == "connected") {
				//console.log("BluetoothManager:connectDevice: Debug periph=" + peripheral.uuid + " " + 
				//" length of services=" + peripheral.services);
				//(peripheral.services!={}) ? peripheral.services.length : "null" )
				
				btBulb = that.findDevice(peripheral.advertisement.localName,false)
				if (!btBulb) {
					var pbType = null;
					if (that.numberOfDevices < maxDevices) {
						//btBulb = new Playbulb.Playbulb(peripheral.advertisement.localName, pbType, peripheral, that.cbHandler);
						//YeeBTLampName, pbType, peripheral,handler)
						var devType = that.getDeviceType(peripheral.advertisement.localName)
						console.log("bluetoothManager:connectDevice name=" + peripheral.advertisement.localName + " managerType=" + devType.managerType + " pbType=" + devType.pbType )
						btBulb = that.createBulbObject(devType.managerType, peripheral.advertisement.localName, devType.pbType, peripheral, that.cbHandler);
						that.btDevices.push(btBulb);
						that.numberOfDevices++;
						cb(null,btBulb)
						console.log("BluetoothManager:connectDevice: creating bulb localName=" + btBulb.periph.advertisement.localName + 
										" uniqueName=" + btBulb.uniqueName + " pbType=" + pbType + " MAC=" + btBulb.periph.uuid.toUpperCase() + " #devices=" + that.numberOfDevices);
					} else {
						console.log("BluetoothManager:connectDevice " + peripheral.advertisement.localName + " too many bluetooth devices we already have " + that.numberOfDevices)
							cb("too many bluetooth devices",null)
					}
				} else {
					console.log("BluetoothManager:connectDevice " + peripheral.advertisement.localName + " already in devices array")
				}
			} else {
				console.log("BluetoothManager:connectDevice " + peripheral.advertisement.localName + " device cant connect, do not know why")
				throw " device cant connect, do not know why";
				cb(" device cant connect, do not know why",null)
			}
		});
	}.bind(this);
	this.getDeviceType = function(peripheralName) {
		var pbPrefix;
		var pbType = "Unknown"
		var valid = false;
		var managerPrefix;
		var managerType;
		var tmp;
		var tmp0;
		for (managerPrefix in managerTypes) {
			if ( (peripheralName) && (peripheralName.substring(0,managerPrefix.length) == managerPrefix)) {
				valid = true;
				managerType = managerTypes[managerPrefix];
				for (pbPrefix in prefixTypes[managerPrefix]) {
					if (peripheralName.substring(0,pbPrefix.length) == pbPrefix) {
						pbType = prefixTypes[managerPrefix][pbPrefix];
					}
				}
			}
		}
		//console.log("DEBUG valid=" + valid + " managerType=" + managerTypes[managerPrefix] + " pbType=" +pbType)
		return {"valid":valid, "managerType":managerType, "pbType":pbType};
	};
	this.noble.on('discover', function (peripheral) {
		
		//var prefixTypes = { "PB_Candle" : "CANDLE", "PB_Sphere" : "SPHERE" };
		var parsedPrefix = this.getDeviceType(peripheral.advertisement.localName)
		//console.log("BluetoothManager:onNoble: name=" + peripheral.advertisement.localName + " pbType=" + parsedPrefix.pbType + " ManagerTypes =" + tmp0 + " prefixTypes=" + tmp);
		if (parsedPrefix.valid) {
			console.log("BluetoothManager:onNoble: Valid BT Device found " + peripheral.advertisement.localName + " pbType=" + parsedPrefix.pbType )
			//console.log("BluetoothManager:onNoble: name=" + peripheral.advertisement.localName + " pbType=" + parsedPrefix.pbType + " ManagerTypes =" + tmp0 + " prefixTypes=" + tmp);
			if (!that.peripherals[peripheral.uuid]) {
				that.peripherals[peripheral.uuid] = peripheral;
				if (that.stopScanningTimer) {
					that.stopScanningTimer = null;
					clearTimeout(that.stopScanningTimer)
				}
				//console.log("BluetoothManager: on discover: DEBUG scheduling end to scanning in 3 seconds");
				that.stopScanningTimer = setTimeout(function(){
							//console.log("BluetoothManager: on discover: DEBUG executing end to scanning");
							that.noble.stopScanning();
						}
						,3000) // Stop scanning 5000  - reset when peripheral found
			}
		} else {
			if (! unknownDevices[peripheral.id] )
			{
				console.log("BluetoothManager: Device not a playbulb " + peripheral.advertisement.localName + " id=" + peripheral.id);
				unknownDevices[peripheral.id] = peripheral.id
			}
		}
	}.bind(this));
	this.handleStateChange = function(state) {
		console.log("BluetoothManager: state changed received -" + state + " old powerState=" + this.powerState)
		this.powerState=state;
		console.log("BluetoothManager: state changed received -" + state + " new powerState=" + this.powerState)
		if (state === 'poweredOn') {
			console.log("BluetoothManager: Powered On")
			//noble.startScanning([],true);
		};
	}.bind(this);
	this.handleScanStart = function(message) {
		console.log("BluetoothManager: Scan starts")
		this.scanState="on"
	}.bind(this);
	this.handleScanStop = function(message) {
		console.log("BluetoothManager: Scan stops ")
		that.scanState = "off"
		var uuid;
		for (uuid in that.peripherals) {
			//console.log("Process for " + that.peripherals[uuid].advertisement.localName + " id=" + that.peripherals[uuid].id + " index=" + uuid)
			if ( (that.peripherals[uuid]) && (that.peripherals[uuid].state != "connected") && (that.peripherals[uuid].state != "connecting") ){
				console.log("calling connect device for " + that.peripherals[uuid].advertisement.localName + " id=" + " index=" + uuid)
				that.connectDevice(that.peripherals[uuid], function(error,pbBulb){
					if (error) {
						console.log("error connecting to device " + error + " for " + that.peripherals[uuid].advertisement.localName )
					}
					if (pbBulb) {
						console.log("Calling discover services for " + that.peripherals[uuid].advertisement.localName + " id=" + that.peripherals[uuid].id +
									" pbBulb id=" + pbBulb.periph.uuid + " pbBulb name=" + pbBulb.periph.advertisement.localName + " uuid=" + uuid)
						pbBulb.periph.discoverAllServicesAndCharacteristics();
						pbBulb.periph.on('servicesDiscover', function (services) {
							console.log("BluetoothManager: " + pbBulb.periph.advertisement.localName + " uuid=" + pbBulb.periph.uuid + " Services Discovered")
							services.map(function (service) {
								service.on('characteristicsDiscover', function (characteristics) {
									//console.log("BluetoothManager:DEBUG " + pbBulb.periph.advertisement.localName + " service uuid=" + service.uuid +
									//				" type=" + service.type + " name=" + service.name)
									characteristics.map(function (characteristic) {
										pbBulb.processCharacteristic(characteristic);
									});
								});
							});
						});

					} else {
						console.log("BluetoothManager:handleScanStop:Weird error pbBulb not found for " + that.peripherals[uuid].id )		
					}
				});
			}	else {
				console.log("Weird error peripheral state is not correct for " + that.peripherals[uuid].id + " state=" + that.peripherals[uuid].state )
			}
		}
		if (!that.startScanningTimer) {
			// HACK that.startScanningTimer =  setTimeout(that.discoverDevices,5000);
		}
	}.bind(this);
	this.noble.on('stateChange',this.handleStateChange);
	this.noble.on('scanStop',this.handleScanStop );
	this.noble.on('scanStart',this.handleScanStart );
	this.noble.on('warning', function(message) {
		console.log("Nobel warning " + message)
		throw message
	});	
 return this;
}.bind(this);

