'use strict';
var rfxcom = require('rfxcom');
var RFXDevice = function(inpData) {
	//address,uniqueName,friendlyName,dev
	//devType.managerType, peripheral.advertisement.localName, devType.pbType, peripheral, that.cbHandler, that);
	this.address = inpData.address;
	this.device = inpData.dev;
	this.uniqueName = inpData.uniqueName;
	this.smartType = "RFXDevice";
	this.type = "Somfy";
	this.friendlyName = inpData.friendlyName;
	this.deviceHandler = "RFXCOM Somfy Blinds";
	console.log("Creating Blind " + " uniqueName=" + inpData.uniqueName + " address=" + inpData.address)
	this.up = function(seq){
		console.log("RFXAgent:RFXDevice:" + this.uniqueName + "Up command received");
		this.device.up(this.address);
	};
	this.setPower = function(val,seq) {
		if (val) {
			this.up(seq);
		} else {
			this.down(seq);
		}
	}
	this.down = function(seq){
		console.log("RFXAgent:RFXDevice:" + this.uniqueName + "Down command received");
		this.device.down(this.address);
	};
	this.stop = function(seq){
		console.log("RFXAgent:RFXDevice:" + this.uniqueName + "Stop command received");
		this.device.stop(this.address);
	};
	this.getAttribute = function(property,callback){
		console.log("RFXAgent:RFXDevice:" + this.uniqueName + "getAttribute command received");
	};
	this.get_props = function(seq){
		console.log("RFXAgent:RFXDevice:" + this.uniqueName + "get_props command received");
	};
	return this;
};
exports.RFXAgent = function(handler){
	this.devices = {};
	this.handler = handler;
	this.rfxtrx = new rfxcom.RfxCom("/dev/ttyUSB0", {debug: false});
	this.rfy = new rfxcom.Rfy(this.rfxtrx, rfxcom.rfy.RFY);
	var that = this;
	this.discoverDevices = function() {
		console.log("RFXAgent:discoverDevices:Starting Rfxcom device discovery")
		var that = this;
		this.rfxtrx.initialise(function () {
			console.log("Device initialised");
			console.log("Rfxcom:Listing remotes")
			that.rfy.listRemotes();

		});
	}.bind(this);
	this.handleDiscoverMsg = function(message) {
		var r;
		var devName;
		for (r=0;r<message.length;r++) {
			console.log("Rfxcom:remoteslist: index=" + r + " val=" + message[r]);
			console.log(" remoteNumber=" + message[r].remoteNumber + " " +
							" remoteType=" + message[r].remoteType + " " +
							" deviceId=" + message[r].deviceId + " " +
							" idBytes=" + message[r].idBytes + " " +
							" unitCode=" + message[r].unitCode
				);
			devName = "Blind " + message[r].deviceId + "[" + message[r].unitCode + "]"
			if (devName in this.devices) {
				console.log("RFXAgent:handleDiscoverMsg: already in device list! " + devName);
			} else {
				console.log("RFXAgent:handleDiscoverMsg: Adding device " + devName);
				//this.devices[devName] = new RFXDevice(devName,message[r].deviceId,message[r].unitCode,message[r].remoteType)
				//this.devices[devName] = {addr: message[r].deviceId + "/" + message[r].unitCode, rfxDevice: this.rfy};
				//address,uniqueName,friendlyName,rfxRFY
				//this.devices[devName] = new RFXDevice({address:message[r].deviceId + "/" + message[r].unitCode,
				this.devices[devName] = new RFXDevice({address: message[r].deviceId,
														uniqueName: devName, friendlyName: devName, dev: this.rfy});
				this.handler.onDevFound(this.devices[devName], "RFXDevice", devName, devName, this);
			}
		}	
	}.bind(this);
	this.handleRFXEvents = function(event,message) {
		//console.log("RFXAgent:handleRFXEvents:" + event + " message=" + message);
	}.bind(this);
	this.rfxtrx.on("rfyremoteslist", function(message){that.handleDiscoverMsg(message)});
	this.rfxtrx.on("connecting",function(message){that.handleRFXEvents("connecting",message)});
	this.rfxtrx.on("connectfailed",function(message){that.handleRFXEvents("connectfailed",message)});
	this.rfxtrx.on("ready",function(message){that.handleRFXEvents("ready",message)});
	this.rfxtrx.on("disconnect",function(message){that.handleRFXEvents("disconnect",message)});
	this.rfxtrx.on("response",function(message){that.handleRFXEvents("response",message)});
	this.rfxtrx.on("receiverstarted",function(message){that.handleRFXEvents("receiverstarted",message)});
	this.rfxtrx.on("end",function(message){that.handleRFXEvents("end",message)});
	this.rfxtrx.on("drain",function(message){that.handleRFXEvents("drain",message)});
	this.rfxtrx.on("receive",function(message){that.handleRFXEvents("receive",message)});
	return this;
};


