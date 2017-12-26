'use strict';
var net = require("net");
var properties = require("./properties.json");
//function RGBToDec(r,g,b){((r&0x0ff)<<16)|((g&0x0ff)<<8)|(b&0x0ff)}
function RGBToDec(r,g,b){return (r*65536)+(g*256)+b}
function DecToRGB(rgb){return {r:((rgb>>16)&0x0ff),b:((rgb>>8)&0x0ff),g:((rgb)&0x0ff)}}
exports.YeeDevice = function (did, loc, model, power, bri,
		      hue, sat, name, rgb, firmware, ct, supp, cb, agent) {
    this.did = did;
	this.uniqueName = did;
    this.host = loc.split(":")[0];
    this.port = parseInt(loc.split(":")[1], 10);
	this.friendlyName = "YeeWifiLamp (" + this.host + ")"
    this.model = model;
	this.agent = agent;
    this.name = name;
	this.smartType = "YeeWifiLamp";
	this.responds = "indexed";
	this.deviceHandler = "Yeelight RGBW Light";
	this.type = "Yeelight";
    if (power == 'on')
		this.power = 1;
    else
		this.power = 0;
    this.bright = parseInt(bri,10);
    this.hue = parseInt(hue,10);
    this.sat = parseInt(sat,10);
    this.connected = false;
    this.sock = null;
    this.ctx = parseInt(ct, 10);
	this.rgb = parseInt(rgb, 10);
    this.retry_tmr = null;
    this.retry_cnt = 0;
	this.fw_ver=firmware;
	this.support=supp;
	this.model = model;
    this.propChangeCb = cb;
    	
    this.update = function(loc, power, bri, hue, sat, name,rgb,firmware,ct,supp,model) {
		this.host = loc.split(":")[0];
		this.port = parseInt(loc.split(":")[1], 10);
		this.friendlyName = "YeeWifiLamp (" + this.host + ")"
		if (power == 'on')
			this.power = 1;
		else
			this.power = 0;
		this.bright = bri;
		this.hue = parseInt(hue, 10);
		this.sat = parseInt(sat, 10);
		this.rgb = parseInt(rgb, 10);
		this.ctx = parseInt(ct, 10);
		this.name = name;
		this.fw_ver=firmware;
		this.support=supp;	
		this.model = model || this.model;
		}.bind(this);

    this.connect = function(callback) {
		var that = this;
		if (this.connected == true) {
			callback(0);
			return;
		}
		this.connCallback = callback;
		this.sock = new net.Socket();
		this.sock.connect(this.port,this.host,function() {
			      that.connected = true;
                  that.retry_cnt = 0;
			      clearTimeout(that.retry_tmr);
			      callback(0);
		});
		this.sock.on("data", function(data) {
            var rsps = data.toString().split("\r\n");
			//console.log("socketon ="+data.toString())
			var retval={};
			var ind;
            rsps.forEach( function (json) {
				ind = "1";
				try {
					if (json) {
						retval = {json: json};
						var jObj = JSON.parse(json);
						if (jObj["id"]) {
							retval.id = jObj.id;
							retval.type = "response";
							retval.result = jObj["result"];
							retval.error = jObj["error"];
						} else {
							retval.type="notification";
							if (jObj["method"] && jObj["method"] == "props" ) {
								var params = jObj["params"];
								var key;
								var value;
								for (key in params) {
									if (key == 'power') {
										value = (params[key] == "on") ? 1 : 0 ;
									} else if ( key == 'name') {
										value = params[key];
									} else if ( key == 'hue' || key == 'sat' || key == 'bright' || key == 'ct' ) {
										value = parseInt(params[key],10)
									} else if ( key == 'rgb') {
										value = Math.max(0, Math.min(+params[key], 0xffffff));	
									} else {
										value = params[key];
									}
									retval[key] = value;
									that[key] = value;
								}
							} else {
								throw new error("YeeWifiLamp:sock.on.data: Invalid Notification from yeelight " + JSON.stringify(json) );
							}
						}
						console.log("YeeWifiLamp:sock.on.data:DEBUG logging retval type=" + retval.type + 
									( retval.type == "response" ? " id= " + retval.id + " result=" + retval.result + " error=" + retval.error : 
									" method =" + jObj.method + " params=" + JSON.stringify(jObj.params) )
									);
						that.propChangeCb(that, retval);
					}
				}
				catch(e) {
					console.log("yeelight.sock.ondata:ERROR CAUGHT " + e);
				}
			});
	});

	this.sock.on("end", function() {
	    console.log("peer closed the socket");
	    that.connected = false;
	    that.sock = null;
	    that.connCallback(-1);
	    that.retry_tmr = setTimeout(that.handleDiscon, 3000);	 	
	});
		 
	this.sock.on("error", function() {
	    console.log("socket error");
	    that.connected = false;
	    that.sock = null;
	    that.connCallback(-1);
	    that.retry_tmr = setTimeout(that.handleDiscon, 3000);	    
	});
	
    }.bind(this);

    this.handleDiscon = function () {
		console.log("retry connect (" + this.retry_cnt + ") ...: " + this.did);	
        this.retry_cnt = this.retry_cnt + 1;
        if (this.retry_cnt > 9) return;
		this.connect(this.connCallback);
    }.bind(this);
    
    this.setPower = function(is_on,effect,duration,idn) {
		var durationVal = parseInt(duration,10)
        this.power = is_on;
		var req = {id:(idn)?idn:1, method:'set_power', params:[(!is_on) ? "off" : "on",
							(effect=="smooth"||effect=="sudden")?effect:"sudden",(durationVal && durationVal>30 && durationVal<2000) ? durationVal:500]};
		this.sendCmd(req);
    }.bind(this);

    this.setBright = function(val,effect,duration,idn) {
		//this.set_bright = function (level,effect,duration,idn) {
		this.set_bright(val, effect, duration, idn)
    }.bind(this);

    this.setColor = function (hue, sat,effect,duration,idn) {
		var durationVal = parseInt(duration,10)
        this.hue = hue;
        this.sat = sat;
		var req = {id:(idn)?idn:1,  method:'set_hsv',
		   params:[hue, sat, (effect=="smooth"||effect=="sudden")?effect:"sudden",(durationVal && durationVal>30 && durationVal<2000) ? durationVal:500]};
		this.sendCmd(req);
    }.bind(this);

    this.setBlink = function (idn) {
	var req = {id:(idn)?idn:1, method:'start_cf',
		   params:[6,0,'500,2,4000,1,500,2,4000,50']};
    }.bind(this);

    this.setName = function (name,idn) {
		this.name = name;
		var req = {id:(idn)?idn:1, method:'set_name',
		   params:[new Buffer(name).toString('base64')]};
		this.sendCmd(req);
    }.bind(this);
    this.setRGB = function (r,g,b,effect,duration,idn) {
		var durationVal = parseInt(duration,10)
		this.rgb = RGBToDec(r,g,b)
		//console.log("setRGB r="+r+" g="+g+" b="+b+" rgb func="+RGBToDec(r,g,b)+" this.rgb="+this.rgb)
		var req = {id:(idn)?idn:1, method:'set_rgb',
			params:[this.rgb,(effect=="smooth"||effect=="sudden")?effect:"sudden",(durationVal && durationVal>30 && durationVal<2000)?durationVal:500]}
		this.sendCmd(req);
    }.bind(this);	
    this.set_bright = function (level,effect,duration,idn) {
		var durationVal = parseInt(duration,10)
		this.bright = parseInt(level,10)
		console.log("setBright bright="+level)
		var req = {id:(idn)?idn:1, method:'set_bright',
			params:[this.bright,(effect=="smooth"||effect=="sudden")?effect:"sudden",(durationVal && durationVal>30 && durationVal<2000)?durationVal:500]}
		this.sendCmd(req);
    }.bind(this);
    this.setCTX = function (level,effect,duration,idn) {
		var durationVal = parseInt(duration,10)
		this.ctx = parseInt(level,10)
		console.log("setCTX ctx="+level)
		var req = {id:(idn)?idn:1, method:'set_ct_abx',
			params:[this.ctx,(effect=="smooth"||effect=="sudden")?effect:"sudden",(durationVal && durationVal>30 && durationVal<2000)?durationVal:500]}
		this.sendCmd(req);
    }.bind(this);
    this.get_props = function (idn) {
		var req = {id:(idn)?idn:1, method:'get_prop',
				params: properties["YeeWifiLamp"]["getProps"] }
		this.sendCmd(req);
    }.bind(this);  	
    this.sendCmd = function(cmd) {
		if (this.sock == null || this.connected == false) {
			console.log("connection broken" + this.connected + "\n" + this.sock);
			return;
		}
		var msg = JSON.stringify(cmd);
		//console.log("Yee:sendCmd: "+msg);
		this.sock.write(msg + "\r\n");
    }.bind(this);
};

