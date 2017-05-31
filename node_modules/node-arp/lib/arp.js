var util = require('util');
var spawn = require('child_process').spawn;

/**
 * Read the MAC address from the ARP table.
 * 
 * 3 methods for lin/win/mac  Linux reads /proc/net/arp
 * mac and win read the output of the arp command.
 * 
 * all 3 ping the IP first without checking the response to encourage the
 * OS to update the arp table.
 * 
 * 31/12/2014 -- Changelog by Leandre Gohy (leandre.gohy@hexeo.be)
 * - FIX : ping command for windows (-n not -c)
 *
 * 26/08/2013 -- Changelog by Leandre Gohy (leandre.gohy@hexeo.be)
 * - FIX : arp command for OSX (-n not -an)
 * - MODIFY : rewrite Linux lookup function to avoid looping over all entries and returned lines (arp -n IPADDRESS)
 * - MODIFY : rewrite OSX lookup function to avoid looping over all returned lines
 * - FIX : OSX formates double zero as a single one (i.e : 0:19:99:50:3a:3 instead of 00:19:99:50:3a:3)
 * - FIX : lookup functions did not returns the function on error causing callback to be called twice
 * - FIX : Windows lookup function returns wrong mac address due to indexOf usage (192.168.1.1 -> 192.168.1.10)
 * 
 */
module.exports.getMAC = function(ipaddress, cb) {
	if(process.platform.indexOf('linux') == 0) {
		exports.readMACLinux(ipaddress, cb);
	}
	else if (process.platform.indexOf('win') == 0) {
		exports.readMACWindows(ipaddress, cb);
	}
	else if (process.platform.indexOf('darwin') == 0) {
		exports.readMACMac(ipaddress, cb);
	}
};

/**
 * read from arp -n IPADDRESS
 */
module.exports.readMACLinux = function(ipaddress, cb) {
	
	// ping the ip address to encourage the kernel to populate the arp tables
	var ping = spawn("ping", [ "-c", "1", ipaddress ]);
	
	ping.on('close', function (code) {
		// not bothered if ping did not work
		
		var arp = spawn("arp", [ "-n", ipaddress ]);
		var buffer = '';
		var errstream = '';
		arp.stdout.on('data', function (data) {
			buffer += data;
		});
		arp.stderr.on('data', function (data) {
			errstream += data;
		});
		
		arp.on('close', function (code) {
			if (code !== 0) {
				console.log("Error running arp " + code + " " + errstream);
				cb(true, code);
				return;
			}
			
			//Parse this format
			//Lookup succeeded : Address                  HWtype  HWaddress           Flags Mask            Iface
			//					IPADDRESS	              ether   MACADDRESS   C                     IFACE
			//Lookup failed : HOST (IPADDRESS) -- no entry
			//There is minimum two lines when lookup is successful
			var table = buffer.split('\n');
			if (table.length >= 2) {
				var parts = table[1].split(' ').filter(String);
				cb(false, parts[2]);
				return;
			}
			cb(true, "Could not find ip in arp table: " + ipaddress);
		});
	});	
	
};

/**
 * read from arp -a IPADDRESS
 */
module.exports.readMACWindows = function(ipaddress, cb) {
	
	// ping the ip address to encourage the kernel to populate the arp tables
	var ping = spawn("ping", ["-n", "1", ipaddress ]);
	
	ping.on('close', function (code) {
		// not bothered if ping did not work
		
		var arp = spawn("arp", ["-a", ipaddress] );
		var buffer = '';
		var errstream = '';
		var lineIndex;
		
		arp.stdout.on('data', function (data) {
			buffer += data;
		});
		arp.stderr.on('data', function (data) {
			errstream += data;
		});
		
		arp.on('close', function (code) {
			if (code !== 0) {
				console.log("Error running arp " + code + " " + errstream);
				cb(true, code);
				return;
			}
			
			var table = buffer.split('\r\n');
			for (lineIndex = 3; lineIndex < table.length; lineIndex++) {
				//parse this format
				//[blankline]
				//Interface: 192.º68.1.54
				//  Internet Address      Physical Address     Type
				//  192.168.1.1           50-67-f0-8c-7a-3f    dynamic
				
				var parts = table[lineIndex].split(' ').filter(String);
				if (parts[0] === ipaddress) {
					var mac = parts[1].replace(/-/g, ':');
					cb(false, mac);
					return;
				}
			}
			cb(true, "Count not find ip in arp table: " + ipaddress); 
		});
	});	
	
};
/**
 * read from arp -n IPADDRESS
 */
module.exports.readMACMac = function(ipaddress, cb) {
	
	// ping the ip address to encourage the kernel to populate the arp tables
	var ping = spawn("ping", ["-c", "1", ipaddress ]);
	
	ping.on('close', function (code) {
		// not bothered if ping did not work
		
		var arp = spawn("arp", ["-n", ipaddress] );
		var buffer = '';
		var errstream = '';
		arp.stdout.on('data', function (data) {
			buffer += data;
		});
		arp.stderr.on('data', function (data) {
			errstream += data;
		});
		
		arp.on('close', function (code) {
			// On lookup failed OSX returns code 1
			// but errstream will be empty
			if (code !== 0 && errstream !== '') {
				console.log("Error running arp " + code + " " + errstream);
				cb(true, code);
				return;
			}
			 
			//parse this format
			//Lookup succeeded : HOST (IPADDRESS) at MACADDRESS on IFACE ifscope [ethernet]
			//Lookup failed : HOST (IPADDRESS) -- no entry
			var parts = buffer.split(' ').filter(String);
			if (parts[3] !== 'no') {
				var mac = parts[3].replace(/^0:/g, '00:').replace(/:0:/g, ':00:').replace(/:0$/g, ':00');
				cb(false, mac);
				return;
			}
				
			cb(true, "Count not find ip in arp table: " + ipaddress);
		});
	});	
	
};
