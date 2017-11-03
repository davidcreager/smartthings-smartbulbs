'use strict';
var ICloud = require('./icloud');
ICloud.apple_id = require("../pws.json").apple_id
ICloud.password = require("../pws.json").password
var phones = require("./properties.json").iPhone.Phones
var iphoneDevice = function(inpData) {
	this.address = inpData.address;
	this.uniqueName = inpData.uniqueName;
	this.device = inpData.dev;
	this.smartType = "iPhone";
	this.type = "Apple Iphone";
	this.friendlyName = inpData.friendlyName;
	this.deviceHandler = "Find Iphone";
	this.trigger = function(){
		var that = this;
		console.log("FindIphone:trigger: Trying to alert " + this.friendlyName + " " + this.uniqueName + " " + this.address);
		this.device.alertDevice(this.address,"Alexa is looking for you",function(err,data) {
			if (err) {
				console.log("FindIphone:trigger: Alert Error " + that.friendlyName + " " + that.uniqueName + " - " + err)
			} else {
				console.log("FindIphone:trigger: Iphone alerted " + that.friendlyName + " " + that.uniqueName + " - " + data)
			}
		});
	}.bind(this);
return this;
}
exports.FindIphone = function(handler){

    this.devices = {};
    this.handler = handler;
    this.handleDiscoverMsg = function(device) {
		var uniqueName = device.deviceDisplayName + " - " + device.name
		var friendlyName = "Find " + device.name
		if (uniqueName in this.devices) {
			console.log("FindIphone:handleDiscoverMsg: already in device list! " + uniqueName +
						" friendlyName=" + friendlyName
						);
		} else {
			console.log("FindIphone:handleDiscoverMsg: adding device " + uniqueName +
						" friendlyName=" + friendlyName
						);
			this.devices[uniqueName] = new iphoneDevice({address: device.id, uniqueName: uniqueName,
												friendlyName: friendlyName, dev: ICloud});
			this.handler.onDevFound(this.devices[uniqueName], "iPhone", friendlyName, uniqueName, this);
			//address,uniqueName,friendlyName,rfxRFY
		}
		//handleAgentEvents.onDevFound = function(device, type, name, uniqueName, agent) {
	}.bind(this);
	this.discoverDevices = function() {
		var that = this;
		console.log("FindIphone:discoverDevices:Starting Iphone discovery")
		ICloud.getDevices(function(err, devices) {
		  if (err) return console.error('FindIphone:discoverDevices:ERROR:',err);
		  if (devices.length === 0) {
			  return console.log("FindIphone:discoverDevices:No devices found!");
		  } else {
			var devInd=0;
			console.log("FindIphone:discoverDevices:Found " + devices.length.toString() + " devices");
			for (devInd=0;devInd < devices.length;devInd++){
				console.log("FindIphone:discoverDevices: " + devInd.toString() + ": name="  + devices[devInd].name
							+ " modelDisplayName=" + devices[devInd].modelDisplayName
							+ " deviceDisplayName=" + devices[devInd].deviceDisplayName
							+ " batteryLevel=" + devices[devInd].batteryLevel
							);
				var propInd;
				for (propInd=0;propInd<phones.length;propInd++){
					if (phones[propInd].name == devices[devInd].name && phones[propInd].deviceDisplayName == devices[devInd].deviceDisplayName ) {
						console.log("FindIphone:discoverDevices: Found a match " + devices[devInd].name + " " + 
											devices[devInd].modelDisplayName + " " + devices[devInd].deviceDisplayName);
						that.handleDiscoverMsg(devices[devInd]);
					}
				}
			}  
		  }
		  
		});
      }.bind(this);
	  return this;
};