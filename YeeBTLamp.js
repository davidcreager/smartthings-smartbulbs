'use strict';
var G_charTable = require("./characteristics.json")
function bytesToHex (bytes) {
	if (bytes) {
        for (var hex = [], i = 0; i < bytes.length; i++) {
            hex.push((bytes[i] >>> 4).toString(16));
            hex.push((bytes[i] & 0xF).toString(16));
        }
        return hex.join("");
	}
};
/*
•Disconnect:  4368 
•Read color flow:  434c %02lx 
•Delete color flow:  4373 %02lx 
•Read lamp name:  4352 
•Get statistics Data:  438c 
•Set delay to off:  437f01%02x  Will add more soon...

*/
exports.YeeBTLamp = function ( YeeBTLampName, pbType, peripheral,handler,agent, bri) {
    YeeBTLampName = YeeBTLampName || "YeeBTLamp";
	//console.log("YeeBTLamp: type=" + type + " colorUuid=" + " types[type].colorUuid=" + types[type].colorUuid)
	//abyss 
	var that = this;
	this.type = pbType || "Unknown";
	this.smartType = "YeeBTLamp";
	this.responds = "changes";
	this.agent = agent;
	this.cbHandler = handler;
	this.YeeBTLampName = YeeBTLampName;
	this.deviceHandler = "YeeBTLamp RGBW Light"; //YeeBTLamp RGBW Light
	this.friendlyName = this.YeeBTLampName
	this.uniqueName=YeeBTLampName + "(" + peripheral.uuid.toUpperCase() + ")"
	this.characteristicsByName = {};
	/*this.requiredCharacteristics = ["battery_level",
									"serial_number_string",
									"hardware_revision_string",
									"manufacturer_name_string",
									"software_revision_string",
									"colorUuid",
									"effectsUuid"]; */
	this.requiredCharacteristics = ["NOTIFY_CHARACT_UUID","COMMAND_CHARACT_UUID"]
	this.periph = peripheral;
    this.yesReady = false;
	this.allReady = false;
    this.waiting = [];
    this.modes = { FLASH: 0, PULSE: 1, RAINBOWJUMP: 2, RAINBOWFADE: 3}
	this.alpha = 255;
	this.red = 255;
	this.green = 255;
	this.blue = 255;
	this.bright = parseInt(bri,10) || 100;
	this.retry_cnt = 0;
	this.paired = "Unpaired";
	this.keepAliveTimer = null;

	this.periph.on("disconnect", function(){
		console.log("YeeBTLamp:disconnected " + peripheral.advertisement.localName);
		that.cbHandler.BTDisconnect(that.periph,that);
	}.bind(this));
	this.sendBlueToothCommand = function(array) {
		//const bfr = Buffer.from(array);
		var bfr = Buffer(18)
		var i;
		for (i = 0; i < array.length; i++) {
			bfr[i] = array[i]
		};
		//console.log("YeeBTLamp:sendBlueToothCommand:DEBUG - sending command for "+ this.friendlyName + " array=" + bfr.toString("hex"));
		/*
		if (this.periph.state != "connected") {
			console.log("YeeBTLamp:sendBlueToothCommand: connect error Not connected state=" + this.periph.state + 
									" paired=" + this.paired +
									" device=" + this.friendlyName);
			return
		};
		*/
		if (that.characteristicsByName["COMMAND_CHARACT_UUID"]) {
				var withoutResponse = (that.characteristicsByName["COMMAND_CHARACT_UUID"].properties.indexOf('writeWithoutResponse') !== -1) &&	
										(that.characteristicsByName["COMMAND_CHARACT_UUID"].properties.indexOf('write') === -1);				
				that.characteristicsByName["COMMAND_CHARACT_UUID"].write(bfr, withoutResponse, function(error) {
				if (error) {
					console.log("YeeBTLamp:sendBlueToothCommand: write error " + error + " " + that.friendlyName);
					return;
				} else {
					//console.log("YeeBTLamp:sendBlueToothCommand: Write success")
				}
			  });
		} else {
			console.log("YeeBTLamp:sendBlueToothCommand: COMMAND_CHARACT_UUID not set up " + error + " " + that.friendlyName);
			return;
		}
	}.bind(this);
	this.handleNotification = function(data, isNotify) {
		var command;
		var value={};
        if (data[0] == 0x43 && data[1] == 0x45) {
            if (data[2] == 1) {
                //this.cbHandler.BTNotify(this, 'power', 1); 
				command = "Power 1";
				value.power = 1;
            } else {
                //this.cbHandler.BTNotify(this, 'power', 0);
				command = "Power 0";
				value.power = 0;
			}
			var mode = "";
			if (data[3] == 0x01) {			
				mode = "RGB";
				value.red = data[4];
				value.green = data[5];
				value.blue = data[6];
			} else if (data[3] == 0x02) {
				mode = "White";
				value.ctx = data[10];
			} else if (data[3] == 0x03) {
				mode = "Flow";
			} else {
				mode = "Unknown";
				command = (command == "" ? "set mode " + mode : command + "," + "set mode " + mode);
				console.log("YeeBTLamp:handleNotification: Unknown notify device: " + this.friendlyName + 
									" command=" + command +
									" D[0]=" + data[0] + " D[1]=" + data[1] + " D[2]=" + data[2] + " D[3]=" + data[3] + " D[8]=" + data[8]);
			}
			value.mode = mode;
			value.bright = data[8];
            //this.cbHandler.BTNotify(this, 'bright', data[8]);
			this.cbHandler.BTNotify(this, value);
			command = (command == "" ? "setBright" + data[8] : command + "," + "setBright" + data[8]);
			//console.log("YeeBTLamp:handleNotification: Received: " + this.friendlyName + 
			//						" command=" + command + " mode=" + mode + " value=" + JSON.stringify(value)
									//" D[0]=" + data[0] + " D[1]=" + data[1] + " D[2]=" + data[2] + " D[3]=" + data[3]
									//+ " D[4]=" + data[4] + " D[5]=" + data[5] + " D[6]=" + data[6]
									//+ " D[8]=" + data[8]
			//						);
        } else if (data[0] == 0x43 && data[1] == 0x63) {
			var statusMessage;
			if (data[2]== 0x01) {
				statusMessage = "Unauthorised/Not Paired"
				this.paired = "Failed";
				value = {paired: "Unpaired"}
			} else if (data[2]== 0x02) {
				statusMessage = "Authorised/Paired"
				this.paired = "Paired";
				value = {paired: "Paired"}
				this.sendBlueToothCommand([0x43,0x52]); //get name
			} else if (data[2]== 0x04) {
				statusMessage = "Authorised Device (UDID)"
				value = {paired: "Paired"}
			} else if (data[2]== 0x07) {
				statusMessage = "Imminent disconnect!!!"
			} else {
				statusMessage = "Unknown status response=" + data[2];
			}
			console.log("YeeBTLamp:handleNotification:" + this.friendlyName + " status " + statusMessage + " D[2]=" + data[2] + " D[3]=" + data[3])
			this.cbHandler.BTNotify(this, value);
		} else if (data[0] == 0x43 && data[1] == 0x53) {
			var i = 0;
			var notEmpty = false;
			for (i=4;i<data.length;i++) {
				if (data[i] != 0) {
					notEmpty = true;
				}
			}
			var tmpName = data.toString().substring(5,data.toString().length - 2)
			if ( (tmpName) && (tmpName!="") && (notEmpty) ) {
				this.friendlyName = tmpName
				this.uniqueName = tmpName + "(" + this.periph.uuid.toUpperCase() + ")"
				console.log("YeeBTLamp:handleNotification: Name of device received friendlyName=" + this.friendlyName + " uniqueName=" + this.uniqueName + 
										" Sent Name =" + tmpName + " len=" + tmpName.length + " hex=" + tmpName.toString("hex"));
			} else {
				console.log("YeeBTLamp:handleNotification: Name of device received but not set " + tmpName + " notEmpty=" + notEmpty)
				console.log("DEBUG data received " + 
								" D[0]=" + data[0] + " D[1]=" + data[1] + " D[2]=" + data[2] + " D[3]=" + data[3] + " D[8]=" + data[8]);
			}
			/*
			var chr;
			var tmpReady = true;
			for (chr in this.requiredCharacteristics) {
				if (!this.characteristicsByName[this.requiredCharacteristics[chr]]) {
					tmpReady=false;
				}
			};
			//if (this.paired!="Paired") {tmpReady=false;};  //TODO
			console.log("DEBUG:YeeBTLamp:handleNotification: ready state=" + tmpReady + " yesReady=" + this.yesReady);
			if ( (tmpReady) && (!this.yesReady) ) {
				//console.log("Calling isReady for " + this.uniqueName)
				this.isReady(null);
				this.cbHandler.onDevFound(this, "YeeBTLamp", this.periph.advertisement.localName, this.uniqueName);
			}
			*/
		} else {
			console.log("YeeBTLamp:handleNotification: receive notify Unknown Data for device: " + this.friendlyName +  " data=" + data + " D[0]=" + data[0] + 
									" D[1]=" + data[1] + " D[2]=" + data[2] + " D[8]=" + data[8]);
		}
    }.bind(this);
	this.processCharacteristic = function(characteristic) {
		var {lookedUpName,chrType,proprietaryCharacteristic} = this.lookupCharacteristic(characteristic);
		//this.debugCharacteristic(characteristic);
		if (lookedUpName) {
			//console.log("processing characteristic pbulb=" + this.uniqueName  + " characteristic.uuid=" + characteristic.uuid +  " " + lookedUpName + " properties=" + characteristic.properties)
			chrType = (lookedUpName.indexOf("battery") != -1) ? "uint8" : chrType
			chrType = (lookedUpName.indexOf("pnp_id") != -1) ? "hex" : chrType
			this.characteristicsByName[lookedUpName] = characteristic;
			if (lookedUpName == "NOTIFY_CHARACT_UUID") {
				this.characteristicsByName[lookedUpName].on("data", function(data, isNotify){
					that.handleNotification( data, isNotify);
					//console.log("DEBUG: received notify event for " + this.friendlyName + " data=" + data.toString("hex") + " isNotify=" + isNotify)
				}.bind(this));
				this.characteristicsByName[lookedUpName].subscribe( function(error,data) {
					 console.log("YeeBTLamp:processCharacteristic: ble in return from subscribe - now Pairing" + " error=" + error + " data=" + data);
					 that.paired = "Pairing"
					 that.sendBlueToothCommand([0x43,0x67,0xde,0xad,0xbe,0xbf])					 
					 // 43 67 for auth
					 // deadbeef as magic for our Pi - 0xde,0xad,0xbe,0xbf
			   });
			};
			var chr;
			var tmpReady = true;
			for (chr in this.requiredCharacteristics) {
				if (!this.characteristicsByName[this.requiredCharacteristics[chr]]) {
					tmpReady=false;
				}
			};
			//if (this.paired!="Paired") {tmpReady=false;};  //TODO
			//console.log("DEBUG:YeeBTLamp:handleNotification: ready state=" + tmpReady + " yesReady=" + this.yesReady);
			if ( (tmpReady) && (!this.yesReady) ) {
				//console.log("Calling isReady for " + this.uniqueName)
				this.isReady(null);
				this.cbHandler.onDevFound(this, "YeeBTLamp", this.periph.advertisement.localName, this.uniqueName);
			}			
		} else {
			//console.log("processCharacteristic looked up Name not found " + "0x" + characteristic.uuid )
		}
	}.bind(this);

	this.disconnect = function(cb) {
		if (this.periph) {
			if (this.periph.state != "connected") {
				cb(null,"disconnected" + this.periph.state)
			} else {
				this.periph.disconnect( function(error){
					if (error) {
						cb(error,null);
					} else {
						cb(null,"disconnected");
					}
				});
			}
		} else {
			cb("Peripheral is null")
		}
	}.bind(this);
	this.keepAlive = function() {
		this.sendBlueToothCommand([0x43,0x44,0x00]);
		this.keepAliveTimer = setTimeout(this.keepAlive,20000);
	}.bind(this);
    this.isReady = function (callback) {
        if (callback) {
			if (this.yesReady) {
				setTimeout(callback, 0); // run async
			} else {
				waiting.push(callback);
			}
        } else {
			var chr;
			var tmpReady = true;
			for (chr in this.requiredCharacteristics) {
				if (!this.characteristicsByName[this.requiredCharacteristics[chr]]) {
					tmpReady=false;
				}
			};
			if (tmpReady) {
				this.yesReady = true;
				var waiter;
				while (this.waiting.length > 0) {
					waiter = this.waiting.pop(0);
					setTimeout(waiter, 0); // run each waiter async
				}
				/*if (!this.keepAliveTimer) {
					this.keepAliveTimer = setTimeout(this.keepAlive,20000);
				}*/
			}
		}
	}.bind(this);
    var decimalToHexBytes = function (speed, max) {
        var speedRanged = speed * max;
        var speedHex = speedRanged.toString(16);
        while (speedHex.length < 4) {
            speedHex = "0" + speedHex;
        }
        return [parseInt(speedHex.substring(0, 2), 16), parseInt(speedHex.substring(2, 4), 16)];
    };
	this.getAttribute = function(attr,type="",callback) {
		var attrDetails=null;
		if (this.characteristicsByName[attr]) {
			this.characteristicsByName[attr].read(function(error,data){
				if (error) {
					console.log("YeeBTLamp:getAttribute: " + this.uniqueName+ " data error " + error)
					if (callback) {
						callback(error,null);
					} else {
						return [error,null];
					}
				} else {
					//console.log("YeeBTLamp: " + this.uniqueName+ " " + attr + "= " + parseInt(bytesToHex(data),16));
					attrDetails = (type == "uint8") ? attrDetails = data.readUInt8(0) : attrDetails = data.toString();
					attrDetails = (type == "hex") ? attrDetails = bytesToHex(data) : attrDetails = attrDetails;
					//console.log("YeeBTLamp: getAttribute:" + this.uniqueName+ " " + attr + "=" + attrDetails)
					if (callback) {
						callback(null,attrDetails);
					} else {
						 console.log("returning " + attrDetails)
					 	 return [null,attrDetails];
					}
				}
			}.bind(this));
		} else {
			console.log("YeeBTLamp: " + this.uniqueName+ " unknown attribute "+attr);
			callback("Unknown attribute "+attr,null)
		};
	}.bind(this);
 	this.pair = function () {
		this.paired = "Pairing";
		this.sendBlueToothCommand([0x43,0x67,0xde,0xad,0xbe,0xbf]);
	}.bind(this);
 	this.on = function () {
		this.sendBlueToothCommand([0x43,0x40,0x01]);
	}.bind(this);
	this.off = function () {
		this.sendBlueToothCommand([0x43,0x40,0x02]);
	}.bind(this);
	this.setPower = function (onoff) {
		this.sendBlueToothCommand([0x43,0x40,(onoff ? 0x01 : 0x02)]);
		//(onoff) ? this.on() : this.off();
	}.bind(this);
	this.setColor = function (r,g,b) {
		/* BRIGHT_CMD = "42" 
		COLORTEMP_CMD = "43" 
		TEMP_MODE = "65"
		COLORFLOW_CMD = "4a" */
		this.updateColorChar(this.alpha,r,g,b)
	}.bind(this);
	this.setRGB = function (r,g,b) {
		this.updateColorChar(this.alpha,r,g,b)
	}.bind(this);
	this.setMode = function(val) {
		//this.sendBlueToothCommand([
	}.bind(this);
	this.setBright = function (val) {
		console.log("DEBUG received setbright val=" + val + " parseInt(16)=" + parseInt(val,10) + " toString=" + parseInt(val,10).toString(16))
		//this.sendBlueToothCommand([0x43,0x42,parseInt(val.toString(16), 16)]);
		//this.sendBlueToothCommand([0x43,0x42,parseInt(val,10).toString(16)]);
		if (parseInt(val,10) > 100 || parseInt(val,10) < 1 ) {
			console.log("YeeBTLamp:setBright:INVALID Brightness " + val + " , must be between 1 and 100")
		} else {		
			this.bright = parseInt(val,10);
			this.sendBlueToothCommand([0x43,0x42,parseInt(val,10)]);
			this.on();
		}
	}.bind(this);
	this.setCTX = function(val) {
		//var rgb = CTXtoRGB(val);
		if (parseInt(val,10) > 6500 || parseInt(val,10) < 1700 ) {
			console.log("YeeBTLamp:setCTX:INVALID CTX " + val + " , must be between 1700 and 6500")
		} else {
			//var padded = (parseInt(val,10) + 1e5).toString().slice(-4).toString(16);
			var padded = ("00000" + parseInt(val,10).toString(16)).slice(-4);
			console.log("DEBUG CTX val=" + val + " tostring(16)=" + parseInt(val,10).toString(16) + 
				" padded=" + padded + " " + padded.slice(0,2) + " " + padded.slice(-2));
			this.sendBlueToothCommand([0x43,0x43,parseInt(padded.slice(0,2),16),parseInt(padded.slice(-2),16),this.bright]);
			//this.setRGB(rgb.red,rgb.green,rgb.blue);
		}
	}.bind(this);
	this.updateColorChar = function(a,r,g,b) {
		this.sendBlueToothCommand([0x43,0x41,parseInt(r.toString(16), 16),parseInt(g.toString(16), 16),parseInt(b.toString(16), 16),0xFF,0x65]);
	}.bind(this);
	this.debugCharacteristic =  function(characteristic) {
		var {lookedUpName,chrType,proprietaryCharacteristic} = this.lookupCharacteristic(characteristic);
		console.log("BluetoothAgent:debugCharacteristic: " + this.periph.advertisement.localName + " service uuid=" + characteristic._serviceUuid + " char uuid=" + characteristic.uuid +
							" type=" + characteristic.type + 
							(characteristic.name=="" ? " name=" + characteristic.name : " looked up=" + lookedUpName) + characteristic.properties)
		characteristic.discoverDescriptors(function(error,descriptors) {
			var ind;
			if (error) {
				console.log("BluetoothAgent:debugCharacteristic: discover descriptors error " + error + " characteristic uuid=" + characteristic.uuid)
			} else {
				for (ind in descriptors) {
					console.log("BluetoothAgent:debugCharacteristic:Descriptors " + characteristic.uuid + " " + lookedUpName + 
					" descriptor name=" + descriptors[ind].name + " type=" + descriptors[ind].type);
				}
			}
		});
		characteristic.read(function(error,data){
			var attData;
			if (error) {
				console.log("BluetoothAgent:debugCharacteristic:readValues: error " + error + " characteristic uuid=" + characteristic.uuid)
			} else {
				attData = (chrType == "uint8") ? attData = data.readUInt8(0) : attData = data.toString();
				attData = (chrType == "hex") ? attData = bytesToHex(data) : attData = attData;
				console.log("BluetoothAgent:debugCharacteristic:readValues: " + characteristic.uuid + " " + lookedUpName + " value=" + attData);
			}
		});
	}.bind(this);
	this.lookupCharacteristic = function (characteristic) {
		var lookedUpName = G_charTable["0x" + characteristic.uuid.toLowerCase() ];
		var chrType = ""
		var proprietaryCharacteristic = false;
		if (!lookedUpName) {
			lookedUpName = require("./properties.json").YeeBTLamp.Characteristics["0x" + characteristic.uuid.toLowerCase()];
			chrType="hex";
			proprietaryCharacteristic=true;
		}
		return {lookedUpName: lookedUpName, chrType: chrType, proprietaryCharacteristic: proprietaryCharacteristic};
	};
	return (this);
}.bind(this);

function nonBlockingWaitForCondition(condFunc,callback) {
	console.log(" wait check "+condFunc());
	var checkFunc = function() {
		if(!condFunc()) {
			console.log(" calling settime ");
			setTimeout(checkFunc, 500);
		} else {
			console.log(" finished");
			callback()
		}
	};
	checkFunc();
};
function CTXtoRGB(kelvin) {
	var tmpKelvin = kelvin/100;
	var rgb={}
	if (tmpKelvin <= 66) {
		rgb.red = 255
	} else {
		rgb.red = tmpKelvin - 60;
		rgb.red = 329.698727446 * Math.pow(rgb.red , -0.1332047592);
		if (rgb.red < 0) {rgb.red = 0;}
		if (rgb.red > 255) {rgb.red = 255;}
	}
	if (tmpKelvin <= 66) {
		rgb.green = tmpKelvin;
		rgb.green = 99.4708025861 * Math.log(rgb.green) - 161.1195681661;
		if (rgb.green < 0) {rgb.green = 0;}
		if (rgb.green > 255) {rgb.green = 255;}
	} else {
		rgb.green = tmpKelvin - 60;
		rgb.green = 288.1221695283  * Math.pow(rgb.green , -0.0755148492);
		if (rgb.green < 0) {rgb.green = 0;}
		if (rgb.green > 255) {rgb.green = 255;}
	}
	if (tmpKelvin >= 66) {
		rgb.blue = 255
	} else {
		if (tmpKelvin <=19) {
			rgb.blue = 0
		} else {
			rgb.blue = tmpKelvin - 10
			rgb.blue = 138.5177312231   * Math.log(rgb.blue) - 305.0447927307;
			if (rgb.blue < 0) {rgb.blue = 0;}
			if (rgb.blue > 255) {rgb.blue = 255;}
		}
	}
	return rgb;
}
