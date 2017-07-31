var COLORS=require("color-convert")
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
var types = {
    SPHERE: {
        modes: {
            FLASH: 0,
            PULSE: 1,
            RAINBOWJUMP: 2,
            RAINBOWFADE: 3
        }
    },
    CANDLE: {
        modes: {
            FADE: 0,
            JUMPRGB: 1,
            FADERGB: 2,
            FLICKER: 3
        }
     },
};
*/
exports.Playbulb = function ( playbulbName, pbType, peripheral, handler, agent, bri) {
    playbulbName = playbulbName || "Playbulb";
	//console.log("BluetoothManager: type=" + type + " colorUuid=" + " types[type].colorUuid=" + types[type].colorUuid)
	//abyss 
	var that = this;
	this.type = pbType || "Unknown";
	this.agent = agent;
	this.smartType = "Playbulb";
	
	
	this.deviceHandler = "Playbulb RGBW Light";
	this.cbHandler = handler;
	this.playbulbName = playbulbName;
	this.friendlyName = this.playbulbName;
	this.uniqueName=playbulbName + "(" + peripheral.uuid.toUpperCase() + ")"
	this.characteristicsByName = {};
	this.requiredCharacteristics = ["battery_level",
									"serial_number_string",
									"hardware_revision_string",
									"manufacturer_name_string",
									"software_revision_string",
									"colorUuid",
									"effectsUuid"];
	this.periph = peripheral;
    this.yesReady = false;
	this.allReady = false;
    this.waiting = [];
    this.modes = { FLASH: 0, PULSE: 1, RAINBOWJUMP: 2, RAINBOWFADE: 3}
	this.saturation = 0;
	this.bright = parseInt(bri,10) || 100;
	this.red = 255;
	this.green = 255;
	this.blue = 255;
	this.retry_cnt = 0;
	this.periph.on("disconnect", function(){
		console.log("disconnected " + peripheral.advertisement.localName);
		that.reconnect();
	}.bind(this));

	this.processCharacteristic = function(characteristic) {
		var charTable = require("./characteristics.json")
		var miPowCharTable = require("./properties.json").Playbulb.Characteristics
		
		var lookedUpName = charTable["0x" + characteristic.uuid ];
		var chrType = ""
		var mipow = false;
		if (!lookedUpName) {
			lookedUpName = miPowCharTable["0x" + characteristic.uuid ];
			chrType="hex";
			mipow=true;
		}
		if (lookedUpName) {
			//console.log("processing characteristic pbulb=" + this.uniqueName + " " + lookedUpName + " properties=" + characteristic.properties)
			chrType = (lookedUpName.indexOf("battery") != -1) ? "uint8" : chrType
			chrType = (lookedUpName.indexOf("pnp_id") != -1) ? "hex" : chrType
			if (this.characteristicsByName[lookedUpName]) {
				if ((this.characteristicsByName[lookedUpName]!=characteristic) && mipow) {
					console.log("DEBUG weirdness characteristic already set pbulb=" + this.uniqueName + " name=" + lookedUpName + 
								//" array=" + retProps(characteristic))
								" array uuid=" + this.characteristicsByName[lookedUpName]._peripheralId +
								" incoming.uuid=" + characteristic._peripheralId)
				}
			}
			this.characteristicsByName[lookedUpName] = characteristic
			characteristic.read(function(error,data){
				var attData;
				if (error) {
					console.log("Reading Characteristic: " + peripheral.advertisement.localName + " data error " + error )
				} else {
					attData = (chrType == "uint8") ? attData = data.readUInt8(0) : attData = data.toString();
					attData = (chrType == "hex") ? attData = bytesToHex(data) : attData = attData;
					//console.log("found for " + this.playbulbName + " " + characteristic.uuid + " characterist.name=" + characteristic.name + 
					//		" lookedUpName=" + lookedUpName + " data=" + attData );
				}
			});
			var chr;
			var tmpReady = true;
			for (chr in this.requiredCharacteristics) {
				if (!this.characteristicsByName[this.requiredCharacteristics[chr]]) {
					tmpReady=false;
				}
			};
			if ( (tmpReady) && (!this.yesReady) ) {
				//console.log("Calling isReady for " + this.uniqueName)
				this.isReady(null);
				this.cbHandler.onDevFound(this, "Playbulb", this.periph.advertisement.localName, this.uniqueName, this.BTAgent);
			}
		} else {
			//console.log("processCharacteristic looked up Name not found " + "0x" + characteristic.uuid )
		}
	}.bind(this);
	this.reconnect = function () {
		console.log("retry connect (" + that.retry_cnt + ") ...: " + that.periph.advertisement.localName);	
		that.retry_cnt = that.retry_cnt + 1;
		if (that.retry_cnt > 9) return;
		that.connect(function(error,retval){
						if (error) {
							console.log("reconnecting error " + error + " " + that.friendlyName);
							setTimeout(that.reconnect,2000);
						} else {
							console.log("reconnecting ok " + that.periph.advertisement.localName + " state=" + that.periph.state);
							that.periph.discoverAllServicesAndCharacteristics();
							that.periph.on('servicesDiscover', function (services) {
								//console.log("BluetoothManager: " + btBulb.periph.advertisement.localName + " uuid=" + btBulb.periph.uuid + " Services Discovered")
								services.map(function (service) {
									service.on('characteristicsDiscover', function (characteristics) {
										characteristics.map(function (characteristic) {
											that.processCharacteristic(characteristic);
										});
									});
								});
							});
						}
		});
	}
	this.connect = function (cb) {
		if (this.periph) {
			if (this.periph.state === "connected") {
				cb(null,"connected")
			} else {
				this.periph.connect( function(error){
					if (error) {
						cb(error,null);
					} else {
						cb(null,"connected");
					}
				});
			}
			
		} else {
			cb("Peripheral is null")
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
			//if (this.characteristicsByName["colorUuid"] !== null && this.characteristicsByName["effectsUuid"] !== null) {
				this.yesReady = true;
				var waiter;
				while (this.waiting.length > 0) {
					waiter = this.waiting.pop(0);
					setTimeout(waiter, 0); // run each waiter async
				}
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
					console.log("BluetoothManager: " + this.uniqueName+ " data error " + error)
					if (callback) {
						callback(error,null);
					} else {
						return [error,null];
					}
				} else {
					//console.log("BluetoothManager: " + this.uniqueName+ " " + attr + "= " + parseInt(bytesToHex(data),16));
					attrDetails = (type == "uint8") ? attrDetails = data.readUInt8(0) : attrDetails = data.toString();
					attrDetails = (type == "hex") ? attrDetails = bytesToHex(data) : attrDetails = attrDetails;
					//console.log("BluetoothManager: getAttribute:" + this.uniqueName+ " " + attr + "=" + attrDetails)
					if (callback) {
						callback(null,attrDetails);
					} else {
						 //console.log("returning " + attrDetails)
					 	 return [null,attrDetails];
					}
				}
			}.bind(this));
		} else {
			console.log("BluetoothManager: " + this.uniqueName+ " unknown attribute "+attr);
			callback("Unknown attribute "+attr,null)
		};
	}.bind(this);
    this.runEffect = function (saturation, r, g, b, effect, speed) {
		//abyss var that=this;
        if (!this.isReady) {
            throw "playbulb not ready";
        }
        if (saturation < 0 || saturation > 255 || r < 0 || r > 255 || g < 0 || g > 255 || b < 0 || b > 255) {
            throw "saturation, r, g and b must be between 0 and 255";

        }
        if (effect !== SETCOLOR) {
            if (speed < 0 || speed > 1) {
                throw "speed must be between 0 and 1";
            }
            var max;
            var speedBytes;
            if (this.type === "COLOR") {
                speed = 1 - speed; // 0 is slow, 1 is fast
                max = effect === this.modes.PULSE ? 7710 : 17990;
                speedBytes = decimalToHexBytes(speed, max); // max hex is: 1E 1E
            } else if (this.type === "CANDLE") {
                max = 255;
                // special handling for this:
                // 00-> ff, 00 => really slow, 01 => really fast, 02 => slower
                if (speed === 0) {
                    speedBytes = 0;
                } else if (speed === 1) {
                    speedBytes = 1;
                } else {
                    speedBytes = decimalToHexBytes(speed, max); // max hex is: 1E 1E
                    if (speedBytes < 3) {
                        speedBytes = 3;
                    }
                }
            }
            var effectBytes = new Buffer([0, r, g, b, effect, 0, speedBytes[0], speedBytes[1]]);
            this.characteristicsByName["effectsUuid"].write(effectBytes);
        } else {
            var colorBytes = new Buffer([0, r, g, b]);
			var cbin
			this.characteristicsByName["colorUuid"].read(function(err,cbin){
				if (err) {
					console.log("Read color error "+err)
				}
				//console.log("Setting Color red=" + r + " green=" + g + " blue=" + b + " colorUuid="
				//				+ that.characteristicsByName["colorUuid"].uuid + " colorBytes=" + bytesToHex(colorBytes) + " old color="+bytesToHex(cbin))

				var withoutResponse = (that.characteristicsByName["colorUuid"].properties.indexOf('writeWithoutResponse') !== -1) &&
										(that.characteristicsByName["colorUuid"].properties.indexOf('write') === -1);

				that.characteristicsByName["colorUuid"].write(colorBytes, withoutResponse, function(error) {
					if (error) {
						console.log("BluetoothManager: Write color error"+error)
					} else {
						console.log("BluetoothManager: Write color success")
					}
				  });
			});
        }
    }.bind(this);

	this.on = function () {
		this.updateColorChar(this.saturation,this.red,this.green,this.blue);
	}.bind(this);
	this.off = function () {
		this.updateColorChar();
	}.bind(this);
	this.setPower = function (onoff) {
		(onoff) ? this.on() : this.off();
	}.bind(this);
	this.setColor = function (r,g,b) {
		var hsv = COLORS.rgb.hsv.raw(r,g,b);
		this.updateColorChar(hsv[1],r,g,b)
	}.bind(this);
	this.setRGB = function (r,g,b) {
		var hsv = COLORS.rgb.hsv.raw(r,g,b);
		this.updateColorChar(hsv[1],r,g,b)
	}.bind(this);
	this.getColor = function (cb) {
		//abyss var that=this
		this.characteristicsByName["colorUuid"].read( function(err,currentColorBytes){
			if (err) {
				//console.log("BluetoothManager: Read color error "+err)
				if (cb) {
					cb(err,null)
				} else {
					return err,null
				}
			} else {
				var cbin=bytesToHex(currentColorBytes).substring(0,2) + "," + COLORS.hex.rgb(bytesToHex(currentColorBytes).substring(2));
				that.saturation = parseInt(cbin.split(",")[0],10)
				that.red = parseInt(cbin.split(",")[1],10)
				that.green = parseInt(cbin.split(",")[2],10)
				that.blue = parseInt(cbin.split(",")[3],10)
				if (cb) {
					cb(null, that.saturation, that.red, that.green, that.blue, cbin)
					//console.log("Playbulb:getColor calling back - cbin=" + cbin + " a=" + that.saturation + 
					//	" r=" + that.red + " g=" + that.green + " b=" +that.blue );
				} else {
					return null,COLORS.hex.rgb(null, that.saturation, that.red, that.green, that.blue, cbin)
				}
			}
			//console.log("BluetoothManager: Getting Color for " + that.playbulbName + " " +bytesToHex(currentColorBytes) + " conved=" + COLORS.hex.rgb(bytesToHex(currentColorBytes)) + " cbytes=" + currentColorBytes);
		});
	}.bind(this);
	this.getBright = function () {
		var hsv = COLORS.rgb.hsv.raw(this.red,this.green,this.blue);
		return hsv[2];
	}.bind(this);
	this.setBright = function (a) {
		//console.log("Playbulb:setBright: current rgb =" + this.red + "," + this.green + "," + this.blue + " sat:" + this.saturation + " bright=" + this.bright)
		this.bright = a;
		var hsv = COLORS.rgb.hsv.raw(this.red,this.green,this.blue);
		//console.log("Playbulb:setBright: current hsv =" + hsv[0] + "," + hsv[1] + "," + hsv[2]);
		hsv[2] = a;
		var rgb = COLORS.hsv.rgb(hsv);
		//console.log("Playbulb:setBright: about to set rgb =" + rgb[0] + "," + rgb[1] + "," + rgb[2] + " sat:" + hsv[1] + " bright=" + this.bright)
		this.updateColorChar(hsv[1],rgb[0],rgb[1],rgb[2]);
	}.bind(this);
	this.setCTX = function(val) {
		var rgb = CTXtoRGB(val);
		this.setRGB(rgb.red,rgb.green,rgb.blue);
	}.bind(this);
	this.setEffect = function (effect,delay) {
		//Pulse [0x00, r, g, b, 0x01, 0x00, 0x09, 0x00]
		//Rainbow [0x01, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01, 0x00]
		//Rainbow Fade[0x01, 0x00, 0x00, 0x00, 0x03, 0x00, 0x26, 0x00]
		/*
		    setColor(r, g, b) {
			  let data = new Uint8Array([0x00, r, g, b]);
			  return this.device.gatt.getPrimaryService(CANDLE_SERVICE_UUID)
			  .then(service => service.getCharacteristic(CANDLE_COLOR_UUID))
			  .then(characteristic => characteristic.writeValue(data))
			  .then(() => [r,g,b]);
			}
		*/
	}.bind(this);
	this.updateColorChar = function(a,r,g,b) {
		//console.log("Update color for " + this.friendlyName + " saturation=" + a + " red=" + r + " green" + g + " blue=" + b);

		that.connect( function() {
			if (that.periph.state != "connected") {
				console.log("BluetoothManager:updateColorChar " + that.uniqueName + " Not connected " + that.periph.state);
				return;
			};
			//console.log("Playbulb:updateColorChar: input r,g,b=" + r + "," + g + "," + b + " current rgb=" + that.red + "," + that.green + "," + that.blue)
			that.saturation = (a) ? parseInt(a,10) : that.saturation;
			that.red = (r) ? parseInt(r,10) : that.red;
			that.green = (g) ? parseInt(g,10) : that.green;
			that.blue = (b) ? parseInt(b,10) : that.blue;
			var colorBytes = new Buffer([a, r, g, b]);
			//console.log("Playbulb:updateColorChar: current rgb now =" + that.red + "," + that.green + "," + that.blue)
			var withoutResponse = (that.characteristicsByName["colorUuid"].properties.indexOf('writeWithoutResponse') !== -1) &&
										(that.characteristicsByName["colorUuid"].properties.indexOf('write') === -1);
			that.characteristicsByName["colorUuid"].read(function(err,cbin){
				if (err) {console.log("BluetoothManager:updateColorChar: Read color error "+err)}
				that.characteristicsByName["colorUuid"].write(colorBytes, withoutResponse, function(error) {
					if (error) {
						console.log("BluetoothManager: Write color error"+error)
					} else {
						//console.log("BluetoothManager: Write color success")
					}
				  });
			});
			
		});	
	}.bind(this);
	
	return (this)
}.bind(this);
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