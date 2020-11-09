'use strict';
const maxDevices = 8;
var Playbulb = require("./Playbulb");
var YeeBTLamp = require("./YeeBTLamp");
var properties = require ("./properties.json");
exports.BluetoothAgent = function (handler) {
	var that = this;
	this.numberOfDevices = 0;
	this.noble = require('@abandonware/noble');
	this.smartType = "Bluetooth";
	this.btDevices = [];
	this.peripheralDetails = {};
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
		var scanNow = true;
		var uuid;
		that.discoveryInProgress = true;
		var devsConnecting;
		for (uuid in this.peripheralDetails) {
			if (this.peripheralDetails[uuid].status == "connecting") {
				scanNow=false
				if (devsConnecting) {
					devsConnecting = devsConnecting + ";" + uuid
				} else {
					devsConnecting = uuid
				}
			}
		}
		if (scanNow) {
			if (that.startScanningTimer) {
				that.startScanningTimer = null;
				clearTimeout(that.startScanningTimer)
			}
			if ( (that.powerState=="poweredOn") && (that.scanState=="off") ) {
				//console.log("BluetoothAgent: discoverDevices - Scanning")
				that.noble.startScanning([],false);
				clearTimeout(that.stopScanningTimer)
				that.stopScanningTimer = setTimeout(that.scanStop,5000);
			} else {
				that.startScanningTimer = (that.powerState != "poweredOn" ? 2000 : 10000)
				that.startScanningTimer = setTimeout(that.discoverDevices, that.startScanningTimer );
			}
		} else {
				console.log("BluetoothAgent:discoverDevices: Not scanning as devices are still connecting waiting 10sec " + devsConnecting)
				that.startScanningTimer = setTimeout(that.discoverDevices, 10000);
		}
		//console.log("Discover ends")		
	}.bind(this)
	this.handleDisconnect = function(peripheral) {
		peripheral = this;
		that.peripheralDetails[peripheral.uuid].status = "disconnected";
		console.log("BluetoothAgent:handleDisconnect Device disconnected " + peripheral.advertisement.localName);
	}
	this.handleConnect = function(peripheral) {
		peripheral = this;
		that.peripheralDetails[peripheral.uuid].status = "connected";
		console.log("BluetoothAgent:handleConnect Device connected " + peripheral.advertisement.localName);
	}
	this.handleNotify = function(peripheral) {
		peripheral = this;
		that.peripheralDetails[peripheral.uuid].status = "state";
		console.log("BluetoothAgent:handleDisconnect Device Notified " + peripheral.advertisement.localName);
	}
	this.connectDevice = function(peripheral,cb) {
		var pbPrefix;
		var btBulb;
		console.log("BluetoothAgent:connectDevice: Calling connect on " + peripheral.advertisement.localName + " connectable=" + peripheral.connectable );
		peripheral.connect( function (error) {
			if (peripheral.state != "connected") {
				if (!error) { error = "Unknown Error" }
				console.log("BluetoothAgent:connectDevice " + peripheral.advertisement.localName + " error connecting " + error);
				cb(error,null)
				return;
			} else {
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
			}
		});
	}.bind(this);
	this.scanStop = function(cb) {
		if (this.stopScanningTimer) {
			clearTimeout(this.stopScanningTimer);
			this.stopScanningTimer = null;
		}
		if (this.scanState=="off") {
			if (cb) {
				cb(null);
			};
		} else {
			this.noble.stopScanning(function(){
				if (cb) {
					cb(null);
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
		var enabledTypes = ( function () {
			var type;
			var tmp="";
			var enabledTypes = []
			var stringOfPossibleTypes="";
			for (let i0 in properties.bridgeEnabledTypes) {
				stringOfPossibleTypes = (stringOfPossibleTypes=="" ? i0 : stringOfPossibleTypes + " or " + i0)
			}
			process.argv.forEach((val, index) => {
				tmp == "" ? tmp = index + ":" + val : tmp = tmp + "," + index + ":" + val
				if (index > 1) {
					if (val=="TEST") {
						gTEST = true;
						console.log("smartbulbserver: setting TEST MODE")
					} else {
						enabledTypes.push(val);
						if (  (!properties.bridgeEnabledTypes[val]) ) {
							console.log("\nINPUT ERROR - type does not exist should be " + stringOfPossibleTypes)
							throw "invalid input argument";
						}
					}
				}
			});
			if (enabledTypes.length==0) {
				for (type in properties.bridgeEnabledTypes) {
					if (properties.bridgeEnabledTypes[type].enabled) {
						enabledTypes.push(type);
					}
				}
			} 
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
							valid = properties[managerType].AdvertismentPrefixTypes[pbPrefix];
							console.log("BluetoothAgent:getDeviceType:ERROR ERROR WEIRDNESS");
						} else {
							valid = false;
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
		if (parsedPrefix.valid) {
			console.log("BluetoothAgent:onNoble: " + (that.peripherals[peripheral.uuid] ? "Existing" : "New") + 
											" Valid Bluetooth Device found " + peripheral.advertisement.localName + 
											" managerType=" + parsedPrefix.managerType +
											" pbType=" + parsedPrefix.pbType );
			if (!that.peripherals[peripheral.uuid]) {
				that.peripherals[peripheral.uuid] = peripheral;
				that.peripheralDetails[peripheral.uuid] = {status: "created", device: null};
				that.peripherals[peripheral.uuid].on('disconnect',that.handleDisconnect);
				that.peripherals[peripheral.uuid].on('connect',that.handleConnect);
				that.peripherals[peripheral.uuid].on('notify',that.handleNotify);
				//that.stopScanningTimer = setTimeout(that.scanStop,3000);
			} else {
				if (that.peripheralDetails[peripheral.uuid].status == "disconnected") {
					console.log("BluetoothAgent:onNoble:discover: found a disconnected device, so try and reconnect " + peripheral.advertisement.localName);
					that.peripheralDetails[peripheral.uuid].status = "reconnect";
				}
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
			console.log("BluetoothAgent: Powered On");
		} else {
			console.log("BluetoothAgent: Weird State change " + state);
		};
	}.bind(this);
	this.handleScanStart = function(message) {
		//console.log("BluetoothAgent: Scan starts")
		this.scanState="on"
	}.bind(this);
	this.handleScanStop = function(message) {
		//console.log("BluetoothAgent: Scan stops ")
		that.scanState = "off"
		var uuid;
		for (uuid in that.peripherals) {
			//console.log("BluetoothAgent:handleScanStop: Looking at " + that.peripherals[uuid].advertisement.localName + "(" + uuid + ")" +
			//					" state=" + that.peripherals[uuid].state + " connectable=" + that.peripherals[uuid].connectable);
			if ( (that.peripherals[uuid]) && that.peripherals[uuid].state != "connected" && that.peripherals[uuid].state != "connecting" && 
											( that.peripheralDetails[uuid].status == "created" || that.peripheralDetails[uuid].status == "reconnect" ) ) {
				//unless 
				if ((!that.peripheralDetails[uuid].device) || that.peripheralDetails[uuid].device.smartType != "YeeBTLamp" || that.peripheralDetails[uuid].paired == "Paired" ) {
					that.peripheralDetails[uuid].status = "connecting";
					console.log("BluetoothAgent:handleScanStop: Set state to connecting and about to call connect " + 
											that.peripherals[uuid].advertisement.localName );
					that.connectDevice(that.peripherals[uuid], function(error, pbBulb){
						if (error) {
							console.log("BluetoothAgent:handleScanStop:error connecting to device " + error + " for " + that.peripherals[uuid].advertisement.localName )
							that.peripheralDetails[uuid].status = "Error connecting";
						}
						if (pbBulb) {
							console.log("BluetoothAgent:handleScanStop:about to discover services " + that.peripherals[uuid].advertisement.localName );
							that.peripheralDetails[uuid].device = pbBulb;
							pbBulb.periph.discoverAllServicesAndCharacteristics();
							pbBulb.periph.on('servicesDiscover', function (services) {
								services.map(function (service) {
									service.on('characteristicsDiscover', function (characteristics) {
										characteristics.map(function (characteristic) {
											//console.log("BluetoothAgent:handleScanStop: calling process characteristic  " + that.peripherals[uuid])
											pbBulb.processCharacteristic(characteristic);
										});
									});
								});
							});

						} else {
							console.log("BluetoothAgent:handleScanStop:Weird error pbBulb not found for " + that.peripherals[uuid].id )		
						}
					});
				} else {
					//console.log("BluetoothAgent:handleScanStop: YeeBTLamp needs pairing " + that.peripherals[uuid].advertisement.localName + "(" + uuid + ")" + " smarttype=" + 
					//					that.peripheralDetails[uuid].device.smartType + " pairStatus=" + that.peripheralDetails[uuid].device.pairStatus)
				}
			}	else {
				if (that.peripherals[uuid].state != "connected") {
					//console.log("Weird error peripheral state is not correct for " + that.peripherals[uuid].id + " state=" + that.peripherals[uuid].state );
				}
			}
		}
		that.startScanningTimer = setTimeout(that.discoverDevices, 10000);
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
