'use strict';
var Milight = require('node-milight-promise')
var MiDevice = function(inpData) {
	//address,uniqueName,friendlyName,dev,zone
	//devType.managerType, peripheral.advertisement.localName, devType.pbType, peripheral, that.cbHandler, that);
	this.address = inpData.address;
	this.device = inpData.dev;
	this.uniqueName = inpData.uniqueName;
	this.smartType = "MiLight";
	this.responds = "none";
	this.type = "Milight GU10s";
	this.friendlyName = inpData.friendlyName;
	this.deviceHandler = "Playbulb RGBW Light";
	this.zone = inpData.zone;
	this.setRGB = function(r,g,b,effect,duration,seq){
		//console.log("MiAgent:MiDevice:" + this.uniqueName + "setRGB command received rgb=" + r + "," + "g" + "," + b);
		this.device.sendCommands(Milight.commandsV6.rgbw.rgb(this.zone,r,g,b));
	};
	this.setBright = function(value,effect,duration,seq){
		//console.log("MiAgent:MiDevice:" + this.uniqueName + "setBright command received value=" + value);
		this.device.sendCommands(Milight.commandsV6.rgbw.brightness(this.zone,value));
	};
	this.setPower = function(value,effect,duration,seq){
		//console.log("MiAgent:MiDevice:" + this.uniqueName + "setPower command received value=" + value + " zone =" + this.zone);
		if (value==1) {
			//console.log("MiAgent:MiDevice: Sending On " + Milight.commandsV6.rgbw.on(this.zone) + " device=" + this.device + " mac=" + this.device.mac);
			this.device.sendCommands(Milight.commandsV6.rgbw.on(this.zone))
		} else {
			//console.log("MiAgent:MiDevice: Sending On " + Milight.commandsV6.rgbw.off(this.zone) + " device=" + this.device + " mac=" + this.device.mac);
			this.device.sendCommands(Milight.commandsV6.rgbw.off(this.zone))
		}
		//(value) ? this.device.sendCommands(Milight.commandsV6.rgbw.on(this.zone)) : this.device.sendCommands(Milight.commandsV6.rgbw.off(this.zone));
	};
	this.setCTX = function(value,effect,duration,seq){
		console.log("MiAgent:MiDevice:" + this.uniqueName + "setCTX command received value=" + value);
	};
	this.getAttribute = function(property,callback){
		console.log("MiAgent:MiDevice:" + this.uniqueName + "getAttribute command received property=" + property);
	};
	this.get_props = function(seq){
		console.log("MiAgent:MiDevice:" + this.uniqueName + "get_props command received seq=" + seq);
	};
	return this;
};

exports.MiAgent = function(handler){
	this.handler = handler;
	this.devices = {};
	this.bridges = {};
	this.handleDiscoverMsg = function(results) {
		console.log("MiAgent:handleDiscoverMsg: Found hub! " + results.mac +
					" ip=" + results.ip +
					" Name=" + results.name +
					" Type=" + results.type);
		var zones = [0];
		var z;
		var devName;
		var macZones = require("./properties.json").MiLight.macZones
		for (z=0;z<macZones.length;z++) {
			if (macZones[z].mac==results.mac) {
				zones = macZones[z].zones;
				console.log("MiAgent:handleDiscoverMsg: Zones set in properties for " + results.mac + " zones =" + macZones[z].zones)
			}
		}
		for (z=0;z<zones.length;z++) {
			devName = "Milight" + "(" + results.mac + "[" + zones[z] + "]" + ")";
			if (results.mac in this.bridges){
				if (results.ip != this.bridges[results.mac].ip) {
					console.log("MiAgent:handleDiscoverMsg: already in bridges with different IP " + results.mac +
						" old IP=" + this.bridges[results.mac] +
						" New IP=" + results.ip )
					this.bridges[results.mac] = new Milight.MilightController(
					//					{ip: results.ip, delayBetweenCommands: 80, commandRepeat: 2}
										{ip: results.ip, type: 'v6'}
											);
				}
			} else {
				this.bridges[results.mac] = new Milight.MilightController(
								//{ip: results.ip, delayBetweenCommands: 80, commandRepeat: 2}
								{ip: results.ip, type: 'v6'}
									);
			}
			if (devName in this.devices) {
				console.log("MiAgent:handleDiscoverMsg: already in device list! " + results.mac +
							" devName=" + devName +
							" ip=" + devices[devName].ip +
							" Name=" + devices[devName].name +
							" Type=" + devices[devName].type +
							" Zone=" + zones[z]
							);
			} else {
				console.log("MiAgent:handleDiscoverMsg: Adding Device " + results.mac +
							" devName=" + devName +
							" ip=" + results.ip +
							" Name=" + results.name +
							" Type=" + results.type +
							" Zone=" + zones[z]
							);
				//this.devices[devName] = {zone: zones[z], light: this.bridges[results.mac]}
				this.devices[devName] = new MiDevice({address: zones[z], uniqueName: devName,
													friendlyName: devName, dev: this.bridges[results.mac], zone: zones[z]});
				this.handler.onDevFound(this.devices[devName], "MiLight", devName, devName, this);
				//address,uniqueName,friendlyName,rfxRFY
			}
		}
	}.bind(this);
	this.discoverDevices = function() {
		console.log("MiAgent:discoverDevices:Starting Bridge discovery")
	//	type - all for both legacy and v6, null for lgeacy, v6 for v6 only
		var that = this;
		Milight.discoverBridges({
		  type: 'v6'
			}).then(function (results) {
					console.log(results);
					var r;
					for (r=0;r<results.length;r++){
						that.handleDiscoverMsg(results[r]);
					}
				}
			);
	}.bind(this);
	return this;
};

