var net = require("net");
var dgram = require('dgram');

var PORT = 1982;
var MCAST_ADDR = '239.255.255.250';
var discMsg = new Buffer('M-SEARCH * HTTP/1.1\r\nMAN: \"ssdp:discover\"\r\nST: wifi_bulb\r\n');
//function RGBToDec(r,g,b){((r&0x0ff)<<16)|((g&0x0ff)<<8)|(b&0x0ff)}
function RGBToDec(r,g,b){return (r*65536)+(g*256)+b}
function DecToRGB(rgb){return {r:((rgb>>16)&0x0ff),b:((rgb>>8)&0x0ff),g:((rgb)&0x0ff)}}
YeeDevice = function (did, loc, model, power, bri,
		      hue, sat, name, rgb,firmware,ct,supp, cb) {
    this.did = did;
    this.host = loc.split(":")[0];
    this.port = parseInt(loc.split(":")[1], 10);
    this.model = model;
    this.name = name;

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
	this.fw_ver=firmware
	this.support=supp
    this.propChangeCb = cb;
    	
    this.update = function(loc, power, bri, hue, sat, name,rgb,firmware,ct,supp) {
		this.host = loc.split(":")[0];
		this.port = parseInt(loc.split(":")[1], 10);
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
		this.fw_ver=firmware
		this.support=supp		
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
            rsps.forEach(
				function (json, idex, array) {
					var stuff=""
					var retval={}
					var ind="1"
					try {
						if (json) {
							JSON.parse(json,
								function(k,v) {
								   if (stuff==""){stuff=k+":"+v} else {stuff=stuff+","+k+":"+v}
								   if (k=="id") {ind=v}
								   if (k == 'power') {
									   that.power = (v=="on")?1:0
										that.propChangeCb(that, 'power', that.power,ind);
								   } else if (k == 'bright') {
									   that.bright = parseInt(v, 10);			     
												   that.propChangeCb(that, 'bright', that.bright,ind);
								   } else if (k == 'ct') {
									   that.ctx = parseInt(v, 10);			     
												   that.propChangeCb(that, 'ctx', that.ctx,ind);												   
								   } else if (k == 'hue') {
									   that.hue = parseInt(v, 10);
												   that.propChangeCb(that, 'hue', that.hue,ind);
								   } else if (k == 'sat') {
									   that.sat = parseInt(v, 10);	
												   that.propChangeCb(that, 'sat', that.sat,ind);
								   } else if (k == 'rgb') {
									   that.rgb = Math.max(0, Math.min(+v, 0xffffff));	
												   that.propChangeCb(that, 'rgb', that.rgb,ind);									   
								   } else if (k == 'name') {
									   that.name = v
												   that.propChangeCb(that, 'name', that.name,ind);									   
								   }
								}
							)
							//console.log("yeelight.sock.ondata:json is "+stuff)
							that.propChangeCb(that,"all",json,ind)
						}
					}
					catch(e) {
						console.log("yeelight.sock.ondata:ERROR CAUGHT " + e);
					}
				}
			);
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
    
    this.setPower = function(is_on,idn) {
        this.power = is_on;
		var req = {id:(idn)?idn:1, method:'set_power', params:[(!is_on) ? "off" : "on", "smooth", 500]};
		this.sendCmd(req);
    }.bind(this);

    this.setBright = function(val,idn) {
        this.bright = val;
		var req = {id:(idn)?idn:1, method:'set_bright',
		   params:[val, 'smooth', 500]};
		this.sendCmd(req);
    }.bind(this);

    this.setColor = function (hue, sat,idn) {
        this.hue = hue;
        this.sat = sat;
		var req = {id:(idn)?idn:1,  method:'set_hsv',
		   params:[hue, sat, 'smooth', 500]};
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
    this.setRGB = function (r,g,b,idn) {
		this.rgb = RGBToDec(r,g,b)
		console.log("setRGB r="+r+" g="+g+" b="+b+" rgb func="+RGBToDec(r,g,b)+" this.rgb="+this.rgb)
		var req = {id:(idn)?idn:1, method:'set_rgb',
			params:[this.rgb,"smooth",500]}
		this.sendCmd(req);
    }.bind(this);	
    this.set_bright = function (level,idn) {
		this.bright = parseInt(level,10)
		console.log("setBright bright="+level)
		var req = {id:(idn)?idn:1, method:'set_bright',
			params:[this.bright,"smooth",500]}
		this.sendCmd(req);
    }.bind(this);
    this.set_ctx = function (level,idn) {
		this.ctx = parseInt(level,10)
		console.log("setCTX ctx="+level)
		var req = {id:(idn)?idn:1, method:'set_ct_abx',
			params:[this.ctx,"smooth",500]}
		this.sendCmd(req);
    }.bind(this);
    this.get_props = function (idn) {
		var req = {id:(idn)?idn:1, method:'get_prop',
				params:["power","name","bright","ct","rgb","hue","sat","color_mode","delayoff","flowing","flow_params","music_on"]}
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

exports.YeeAgent = function(ip, handler){
    this.ip = ip;
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
		console.log("add to multicast group");
		this.discSock.setBroadcast(true);
		this.discSock.setMulticastTTL(128);
		this.discSock.addMembership(MCAST_ADDR);
		}.bind(this));
    this.discSock.on('listening', function() {
		var address = this.discSock.address();
		console.log('discSock.on listening Address= ' + address.address);
		}.bind(this));

    this.handleDiscoverMsg = function(message, from) {
/*
		console.log("handleDiscoverMsg: from IP=" + from.address + ":" + from.port + " message=" + message.toString())
		console.log("handleDiscoverMsg from="+from)
		Object.keys(from).forEach(function(key) {
		console.log(from, from[key]);
		});
*/
		var that = this;
		did = "";
		loc = "";
		power = "";
		bright = "";
		model = "";
		hue = "";
		sat = "";
		name = "";
		support=[];
		rgb=""
		ct=""
		fw_ver=""
		headers = message.toString().split("\r\n");
		//console.log("YeeAgent:handleDiscoverMsg: headers=" +headers)
		for (i = 0; i < headers.length; i++) {
			//console.log(headers[i])
			if (headers[i].indexOf("id:") >= 0)
				did = headers[i].slice(4);
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
		if (did == "" || loc == "" || model == ""
				|| power == "" || bright == "") {
			console.log("no did or loc found!");
			return;	    
		}
		loc = loc.split("//")[1];
		if (loc == "") {
			console.log("handleDiscoverMsg: location format error!");
			return;
		}
		if (did in this.devices) {
			console.log("handleDiscoverMsg: already in device list!");
			this.devices[did].update(
				loc,power,bright,hue,
				sat,name,rgb,fw_ver,ct,support);
		} else {
			console.log("handleDiscoverMsg: Creating yeeDevice loc="+loc+" name="+name)
			this.devices[did] = new YeeDevice(did,
							  loc,
							  model,
							  power,
							  bright,
							  hue,
							  sat, name, rgb,fw_ver,ct,support,
							  this.devPropChange 
							 );
			this.handler.onDevFound(this.devices[did]);
		}


		if (this.devices[did].connected == false &&
				this.devices[did].sock == null) {
			var dev = this.devices[did];
			dev.connect(function(ret){
					if (ret < 0) {
						console.log("failed to connect!");
						that.handler.onDevDisconnected(dev);		    
					} else 
					{
						console.log("connect ok!");
						that.handler.onDevConnected(dev);		    
					}
				}
			);
		}
	  }.bind(this);
    this.devPropChange = function (dev, prop, val,ind) {
        //console.log("devPropChange: "+dev.did + " " + prop + " value: " + val);
        this.handler.onDevPropChange(dev, prop, val,ind);
      }.bind(this);
    this.scanSock.on('message', this.handleDiscoverMsg);
    this.discSock.on('message', this.handleDiscoverMsg);
	this.startDisc = function() {
		console.log("Starting Discovery Port="+PORT+" MCAST_ADDR="+MCAST_ADDR+" leng="+discMsg.length)
		this.scanSock.send(discMsg,
			   0,
			   discMsg.length,
			   PORT,
			   MCAST_ADDR);
      }.bind(this);
};
