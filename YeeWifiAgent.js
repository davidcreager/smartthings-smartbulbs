'use strict';
var dgram = require('dgram');
var YeeWifiLamp = require("./YeeWifiLamp.js")
var PORT = 1982;
var MCAST_ADDR = '239.255.255.250';
var G_discMsg = new Buffer('M-SEARCH * HTTP/1.1\r\nMAN: \"ssdp:discover\"\r\nST: wifi_bulb\r\n');
exports.YeeAgent = function(handler){
	//console.log("DEBUG Creating Yeeagent");
    this.ip = "0.0.0.0";
    this.discSock = dgram.createSocket('udp4');
    this.scanSock = dgram.createSocket('udp4');
    this.devices = {};
    this.handler = handler;
    this.getDevice = function(did) {
		if (did in this.devices)
			return this.devices[did];
		else
			return null;
		}.bind(this);
    this.delDevice = function(did) {
		delete this.devices[did];
		}.bind(this);
    this.discSock.bind(PORT, function() {
		//console.log("add to multicast group");
		this.discSock.setBroadcast(true);
		this.discSock.setMulticastTTL(128);
		this.discSock.addMembership(MCAST_ADDR);
		}.bind(this));
    this.discSock.on('listening', function() {
		var address = this.discSock.address();
		//console.log('discSock.on listening Address= ' + address.address);
		}.bind(this));

    this.handleDiscoverMsg = function(message, from) {
		var that = this;
		var did = "";
		var loc = "";
		var power = "";
		var bright = "";
		var model = "";
		var hue = "";
		var sat = "";
		var name = "";
		var support=[];
		var rgb=""
		var ct=""
		var fw_ver=""
		var msgMan;
		var msgST;
		var headers = message.toString().split("\r\n");
		//console.log("YeeAgent:handleDiscoverMsg: headers=" +headers)
		var i;
		for (i = 0; i < headers.length; i++) {
			//console.log(headers[i])
			if (headers[i].indexOf("id:") >= 0)
				did = headers[i].slice(4);
			if (headers[i].indexOf("MAN:") >= 0)
				msgMan = headers[i].slice(5);
			if (headers[i].indexOf("ST:") >= 0)
				msgST = headers[i].slice(4);
			if (headers[i].indexOf("Location:") >= 0)
				loc = headers[i].slice(10);
			if (headers[i].indexOf("power:") >= 0)
				power = headers[i].slice(7);
			if (headers[i].indexOf("bright:") >= 0)
				bright = headers[i].slice(8);
			if (headers[i].indexOf("model:") >= 0)
				model = headers[i].slice(7);
			if (headers[i].indexOf("hue:") >= 0)
				hue = headers[i].slice(5);
			if (headers[i].indexOf("sat:") >= 0)
				sat = headers[i].slice(5);
			if (headers[i].indexOf("rgb:") >= 0)
				rgb = headers[i].slice(5);
			if (headers[i].indexOf("fw_ver:") >= 0)
				fw_ver = headers[i].slice(7);
			if (headers[i].indexOf("ct:") >= 0)
				ct = headers[i].slice(4);
			if (headers[i].indexOf("support:") >= 0)
				support = headers[i].slice(9).split(" ");
				//console.log("yeeAgent: support="+support)
			if (headers[i].indexOf("name:") >= 0)
				name = new Buffer(headers[i].slice(6), 'base64').toString('utf8');
		}
		//console.log("YeeWifiAgent:handleDiscoverMsg: received message ST=" + msgST + " MAN:=" + msgMan + " from=" + from.address + ":" + from.port)
		if ( (did == "" || loc == "" || model == ""
				|| power == "" || bright == "") ) {
			if (msgMan.indexOf("ssdp:discover") == -1) {
				console.log("YeeWifiAgent:handleDiscoverMsg: error no did or loc! from=" + from.address + ":" + from.port)
				throw "YeeWifiAgent:handleDiscoverMsg: error no did or loc!"
			}
			return;	    
		}
		loc = loc.split("//")[1];
		if (loc == "") {
			console.log("YeeWifiAgent:handleDiscoverMsg: location format error! from=" + from.address + ":" + from.port);
			throw "YeeWifiAgent:handleDiscoverMsg: location format error!";
			return;
		}
		if (did in this.devices) {
			//console.log("YeeWifiAgent:handleDiscoverMsg: already in device list! " + this.devices[did].friendlyName + " " + from.address + ":" + from.port);
			this.devices[did].update(
				loc,power,bright,hue,
				sat,name,rgb,fw_ver,ct,support, model);
		} else {
			//console.log("YeeWifiAgent:handleDiscoverMsg: Creating yeeDevice loc=" + loc+" name=" + name + " did=" + did);
			this.devices[did] = new YeeWifiLamp.YeeDevice(did,
							  loc,
							  model,
							  power,
							  bright,
							  hue,
							  sat, name, rgb,fw_ver,ct,support,
							  this.devPropChange , this
							 );
							 //pbBulb, type, name, uniqueName, pb
			//console.log("YeeWifiAgent:handleDiscoverMsg: did=" + did + " type=" + "YeeWifiLamp" + " name=" + name + " devices.did.did=" + this.devices[did].did);
			this.handler.onDevFound(this.devices[did], "YeeWifiLamp", this.devices[did].friendlyName, did, this);
		}


		if (this.devices[did].connected == false &&
				this.devices[did].sock == null) {
			var dev = this.devices[did];
			dev.connect(function(ret){
					if (ret < 0) {
						console.log("YeeWifiAgent:handleDiscoverMsg: " + dev.friendlyName + "failed to connect!");
						that.handler.onDevDisconnected(dev);		    
					} else 
					{
						//console.log("YeeWifiAgent:handleDiscoverMsg: " + dev.friendlyName + " connected ok!");
						that.handler.onDevConnected(dev);		    
					}
				}
			);
		}
	  }.bind(this);
    //this.devPropChange = function (dev, prop, val,ind) {
	this.devPropChange = function (dev, val, ind) {
        //console.log("devPropChange: "+dev.did + " " + prop + " value: " + val);
        //this.handler.onDevPropChange(dev, prop, val,ind);
		this.handler.onDevPropChange(dev, val, ind);
      }.bind(this);
    this.scanSock.on('message', this.handleDiscoverMsg);
    this.discSock.on('message', this.handleDiscoverMsg);
	this.discoverDevices = function() {
		console.log("YeeWifiAgent:discoverDevices:Starting Discovery Port="+PORT+" MCAST_ADDR="+MCAST_ADDR+" leng=" + G_discMsg.length)
		this.scanSock.send(G_discMsg,
			   0,
			   G_discMsg.length,
			   PORT,
			   MCAST_ADDR);
      }.bind(this);
	  return this;
};