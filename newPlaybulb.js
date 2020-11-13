var candleName="";
var batLevel="";
var candleColor="";
var rr="";
var bb="";
var gg="";
var cmode;
function hexToBytes(hex) {
        for (var bytes = [], c = 0; c < hex.length; c += 2)
            bytes.push(parseInt(hex.substr(c, 2), 16));
        return bytes;
    };

function bytesToHex (bytes) {
        for (var hex = [], i = 0; i < bytes.length; i++) {
            hex.push((bytes[i] >>> 4).toString(16));
            hex.push((bytes[i] & 0xF).toString(16));
        }
        return hex.join("");
    };
class PlayBulb {
	constructor {
		this.batteryLevel= nulll;
	}
	configure {
		noble.on("disconnect", this.onDisconnect.bind(this));
		noble.on("Change", this.onChange.bind(this));
	}
	onDisconnect {
		this.log.warn("Disconnected");
	}
	
	onChange(data) {
		this.log.info("update : " + data);
	}
	connectAndSetup(setMode,setColor,setName) {
		this.log.warn("ConnectAndSetUp");
		this.getBatteryLevel( function(error,data) {
			if (error) {
				this.log.error("ConnectAndSetUp getBatteryLevel error =" + error);
				this.batteryLevel =   bytesToHex(parseInt(bytesToHex(data),16));
			}
		})
		this.log.warn("ConnectAndSetUp - setMode " + setMode);
		let r=0,g=0,b=0;
		if (setColor=="red") {
			r=255;
		} else if (setColor=="blue") {
			b=255;
		} else if (setColor=="green") {
			g=255;
		} else if (setColor=="green") {
			r=255;b=255;
		}
		if (setMode==null) {
			if (setColor=="off") {
				r=0;g=0,b=0
			} else if (setColor=="on") {
				r=255;g=255;b=255;
			}
			this.setColor(r,g,b);
		} else if (setMode == "candle") {
			this.setMode();
			 // mode 4
			//new Buffer([0, r, g, b, effect, 0, speedBytes[0], speedBytes[1]]);
			device.write('ff02','fffb',new Buffer([0, 255, 255, 0, 4,0,1,0 ]), function() {
																		console.log('Setting candle to CandleMode = 04 = Candle Effect.');
																			});
		} else if (setMode == "rainbow") {
			this.setCandleMode(r,g,b,02,95,0);
			//function setCandleMode (r,g,b,mode,speed1,speed2){
			// mode =01 = Fade, 02 = Jump RBG (rainbow), 03 = Fade RGB (rainbow), 04 = Candle Effect
			//new Buffer([0, r, g, b, effect, 0, speedBytes[0], speedBytes[1]]);
			device.write('ff02','fffb',new Buffer([0, r, g, b, mode,0,speed1,speed2]),function() {
														console.log("modes:00 flash , 01 = Fade, 02 = Jump RBG (rainbow), 03 = Fade RGB (rainbow), 04 = Candle Effect");
														console.log('Writing effect data:'+mode);
														readCandleMode(true);
													});
		} else if (setMode == "flash") {
			this.setCandleMode(r,g,b,0,19,0);
		} else if (setMode == "name") {
			console.log("WriteNewName ="+setname);
			device.write('ff02', 'ffff',new Buffer(setname), function() {
          //  console.log("WriteNewName ="+setname+mycounter);
            });
		}
	}
}