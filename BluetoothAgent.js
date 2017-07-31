'use strict';
const maxDevices = 8;
var Playbulb = require("./Playbulb");
var YeeBTLamp = require("./YeeBTLamp");
var properties = require ("./properties.json");
exports.BluetoothAgent = function (handler) {
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
	this.discoveryInProgress = null;
	this.stopScanningTimer = null;
	this.startScanningTimer = null;
	var unknownDevices = {}
	this.discoverDevices= function(){
		//console.log("BluetoothAgent: discovering")
		that.discoveryInProgress = true;
		if (that.startScanningTimer) {
			that.startScanningTimer = null;
			clearTimeout(that.startScanningTimer)
		}
		if ( (that.powerState=="poweredOn") && (that.scanState=="off") ) {
			//console.log("BluetoothAgent: discoverDevices - Scanning")
			that.noble.startScanning([],false);
		} else {
			that.startScanningTimer = (that.powerState != "poweredOn" ? 2000 : 10000)
			that.startScanningTimer = setTimeout(that.discoverDevices, that.startScanningTimer );
		}
		//console.log("Discover ends")		
	}.bind(this)
	this.reconnect = function(peripheral, cb){
		this.connectDevice(peripheral, function(error, pbBulb){
			if (error) {
				console.log("BluetoothAgent:reconnecting error " + error);
				if (cb) {
					cb(error, null);
				};
			} else {
				pbBulb.periph.discoverAllServicesAndCharacteristics();
				pbBulb.periph.on('servicesDiscover', function (services) {
					services.map(function (service) {
						service.on('characteristicsDiscover', function (characteristics) {
							characteristics.map(function (characteristic) {
								pbBulb.processCharacteristic(characteristic);
							});
						});
					});
				});		
				if (cb) {
					cb(null,periperhal);
				};
			}
		});
	}.bind(this);
	this.connectDevice = function(peripheral,cb) {
		var pbPrefix;
		this.connectPeripheral(peripheral, function (error,btBulb) {
			if (error) {
				console.log("BluetoothAgent:connectDevice " + peripheral.advertisement.localName + " error connecting " + error);
				cb(error,null)
				return;
			}
			if (peripheral.state == "connected") {		
				btBulb = that.findDevice(peripheral.advertisement.localName,false)
				if (!btBulb) {
					var pbType = null;
					if (that.numberOfDevices < maxDevices) {
						var devType = that.getDeviceType(peripheral.advertisement.localName)
						btBulb = that.createBulbObject(devType.managerType, peripheral.advertisement.localName, devType.pbType, peripheral, that.cbHandler, that);
						that.btDevices.push(btBulb);
						that.numberOfDevices++;
						cb(null,btBulb)
						console.log("BluetoothAgent:connectDevice: creating bulb localName=" + btBulb.periph.advertisement.localName + 
										" uniqueName=" + btBulb.uniqueName + " pbType=" + pbType + " MAC=" + btBulb.periph.uuid.toUpperCase() + " #devices=" + that.numberOfDevices);
					} else {
						console.log("BluetoothAgent:connectDevice " + peripheral.advertisement.localName + " too many bluetooth devices we already have " + that.numberOfDevices)
						cb("too many bluetooth devices",null)
					}
				} else {
					console.log("BluetoothAgent:connectDevice " + peripheral.advertisement.localName + " already in devices array")
				}
			} else {
				console.log("BluetoothAgent:connectDevice " + peripheral.advertisement.localName + " device cant connect, do not know why")
				throw " device cant connect, do not know why";
				cb(" device cant connect, do not know why",null)
			}
		});
	}.bind(this);
	this.connectPeripheral = function(peripheral, cb) {
		this.scanStop( function(error,discoverInProgress) {
			if (peripheral.state=="connected") {
				cb(null, peripheral);
				if (discoverInProgress) {
					this.startScanningTimer =  setTimeout(this.discoverDevices,5000);
				};
			} else {
				peripheral.connect( function (error,btBulb) {
					if (error) {
						if (peripheral.state != "connected") {
							console.log("BluetoothAgent: " + peripheral.advertisement.localName + " device cant connect state=" + peripheral.state)
							throw error;
							cb(error, null);
						}
					}
					cb(null, peripheral);
					if (discoverInProgress) {
						that.startScanningTimer =  setTimeout(that.discoverDevices,5000);
					};
				});
			};
		});
	}.bind(this);
	this.scanStop = function(cb) {
		//var savedDiscoveryInProgress=this.discoveryInProgress;
		//this.discoveryInProgress = false;
		if (this.stopScanningTimer) {
			this.stopScanningTimer = null;
			clearTimeout(this.stopScanningTimer)
		} // NOT SURE THIS IS NEEDED
		if (this.startScanningTimer) {
			this.startScanningTimer = null;
			clearTimeout(this.startScanningTimer)
		}
		if (this.scanState=="off") {
			if (cb) {
				cb(null, this.discoveryInProgress);
			};
		} else {
			this.noble.stopScanning(function(){
				if (cb) {
					cb(null,this.discoveryInProgress);
				};
			});
		}
	}.bind(this);
	this.createBulbObject = function(type) {
		//console.log("BluetoothAgent: createBulbObject: type=" + type)
		var args = Array.from(arguments)
		var instance;
		if (type=="YeeBTLamp") {
			//console.log("DEBUG args[0]=" + args[0] + " args[1]=" + args[1] + "args[2]=" + args[2] + " args[3].uuid=" + args[3].uuid)
			return new (Function.prototype.bind.apply(YeeBTLamp.YeeBTLamp, args));
		} else if (type=="Playbulb") {
			//console.log("DEBUG args=" + args + " sliced=" + args.slice[1]);
			return new (Function.prototype.bind.apply(Playbulb.Playbulb, args));

		} else {
			console.log("BluetoothAgent: createBulbObject: Unknown Type " + type)
		}
	};
	this.findDevice = function(name,unique) {
		//console.log("BluetoothAgent: findDevice: We have " + this.btDevices.length + " Devices" )
		var obj = null;
		var tmpPb = null;
		if (this.btDevices.length>0) {
			for ( tmpPb in this.btDevices) {
				//console.log("BluetoothAgent: findDevice: checking name=" + name + " pbDevice=" + this.btDevices[tmpPb].playbulbName)
				if ( ( (this.btDevices[tmpPb].playbulbName==name) && (!unique) ) ||  ( (this.btDevices[tmpPb].uniqueName==name) && (unique) ) ) {
					console.log("BluetoothAgent: findDevice: Found name=" + name + " pbDevice=" + this.btDevices[tmpPb].playbulbName)
					obj=this.btDevices[tmpPb];
				} else {
					//console.log("BluetoothAgent: findDevice: didnt find name=" + name + " pbDevice=" + this.btDevices[tmpPb].playbulbName + " " + this.btDevices[tmpPb].uniqueName)
				}
			}
		}
		return obj;
	}.bind(this);
	this.getDeviceType = function(peripheralName) {
		 var enabledTypes = (function () {
			var tmp="";
			var enabledTypes = []
			process.argv.forEach((val, index) => {
				tmp == "" ? tmp = index + ":" + val : tmp = tmp + "," + index + ":" + val
				if (index > 1) {
					enabledTypes[index-2] = val;
				}
			});
			//console.log("bluetoothAgent: input arguments are " + tmp + " enabledtypes (overriding properties.json)=" + enabledTypes);
			return enabledTypes;
		})();
		var pbPrefix;
		var pbType = "Unknown"
		var valid = false;
		var managerPrefix;
		var managerType;
		var tmp;
		var tmp0;
		for (managerPrefix in properties.ManagerPrefixes) {
			if ( (peripheralName) && (peripheralName.substring(0,managerPrefix.length) == managerPrefix)) {
				managerType = properties.ManagerPrefixes[managerPrefix];
				for (pbPrefix in properties[managerType].AdvertismentPrefixTypes) {
					if (peripheralName.substring(0,pbPrefix.length) == pbPrefix) {
						pbType = properties[managerType].AdvertismentPrefixTypes[pbPrefix];
						if ( (enabledTypes.length!=0) && (enabledTypes.includes(managerType)) ) {
							valid = true;
						} else if (enabledTypes.length==0) {
							valid = properties[managerType].AdvertismentPrefixTypes[pbPrefix]
						} else {
							valid = false
						}
					}
				}
			}
		}
		//console.log("bluetoothAgent: valid=" + valid + " managerType=" + managerType + " pbType=" + pbType)
		return {"valid" : valid, "managerType" : managerType, "pbType" : pbType};
	};
	this.noble.on('discover', function (peripheral) {
		var parsedPrefix = this.getDeviceType(peripheral.advertisement.localName)
		//console.log("BluetoothAgent:onNoble: name=" + peripheral.advertisement.localName + " pbType=" + parsedPrefix.pbType + " ManagerTypes =" + tmp0 + " prefixTypes=" + tmp);
		if (parsedPrefix.valid) {
			console.log("BluetoothAgent:onNoble: Valid BT Device found " + peripheral.advertisement.localName + " pbType=" + parsedPrefix.pbType )
			//console.log("BluetoothAgent:onNoble: name=" + peripheral.advertisement.localName + " pbType=" + parsedPrefix.pbType + " ManagerTypes =" + tmp0 + " prefixTypes=" + tmp);
			if (!that.peripherals[peripheral.uuid]) {
				that.peripherals[peripheral.uuid] = peripheral;
				if (that.stopScanningTimer) {
					that.stopScanningTimer = null;
					clearTimeout(that.stopScanningTimer)
				}
				//console.log("BluetoothAgent: on discover: DEBUG scheduling end to scanning in 3 seconds");
				that.stopScanningTimer = setTimeout(that.scanStop,3000);
				/* that.stopScanningTimer = setTimeout(function() {
							that.noble.stopScanning();
						}
						, 3000) */ 	// Stop scanning 5000  - reset when peripheral found
			}
		} else {
			if (! unknownDevices[peripheral.id] )
			{
				console.log("BluetoothAgent: Device not supported " + peripheral.advertisement.localName + " id=" + peripheral.id);
				unknownDevices[peripheral.id] = peripheral.id
			}
		}
	}.bind(this));
	this.handleStateChange = function(state) {
		console.log("BluetoothAgent: state changed received -" + state + " old powerState=" + this.powerState)
		this.powerState=state;
		console.log("BluetoothAgent: state changed received -" + state + " new powerState=" + this.powerState)
		if (state === 'poweredOn') {
			console.log("BluetoothAgent: Powered On")
		};
	}.bind(this);
	this.handleScanStart = function(message) {
		console.log("BluetoothAgent: Scan starts")
		this.scanState="on"
	}.bind(this);
	this.handleScanStop = function(message) {
		console.log("BluetoothAgent: Scan stops ")
		that.scanState = "off"
		//var savedDiscoveryInProgress = that.discoveryInProgress;
		//that.discoveryInProgress = false;
		var uuid;
		for (uuid in that.peripherals) {
			//console.log("Process for " + that.peripherals[uuid].advertisement.localName + " id=" + that.peripherals[uuid].id + " index=" + uuid)
			if ( (that.peripherals[uuid]) && (that.peripherals[uuid].state != "connected") && (that.peripherals[uuid].state != "connecting") ){
				//console.log("calling connect device for " + that.peripherals[uuid].advertisement.localName + " id=" + " index=" + uuid)
				that.connectDevice(that.peripherals[uuid], function(error, pbBulb){
					if (error) {
						console.log("error connecting to device " + error + " for " + that.peripherals[uuid].advertisement.localName )
					}
					if (pbBulb) {
						pbBulb.periph.discoverAllServicesAndCharacteristics();
						pbBulb.periph.on('servicesDiscover', function (services) {
							services.map(function (service) {
								service.on('characteristicsDiscover', function (characteristics) {
									characteristics.map(function (characteristic) {
										pbBulb.processCharacteristic(characteristic);
									});
								});
							});
						});

					} else {
						console.log("BluetoothAgent:handleScanStop:Weird error pbBulb not found for " + that.peripherals[uuid].id )		
					}
				});
			}	else {
				console.log("Weird error peripheral state is not correct for " + that.peripherals[uuid].id + " state=" + that.peripherals[uuid].state )
			}
		}
		//that.discoveryInProgress = savedDiscoveryInProgress;
		//if ( (!that.startScanningTimer) && (savedDiscoveryInProgress) ) { 
		/*
		if (!that.startScanningTimer) { 
			that.startScanningTimer =  setTimeout(that.discoverDevices,5000);
		}*/
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
