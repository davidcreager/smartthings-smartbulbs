console.log("Trying to get ssdps")
//response.ST = urn:schemas-upnp-org:device:SmartBridge:1
//response.ST = urn:schemas-upnp-org:device:RFXDevice:1
//
const SSDPClient = require('node-ssdp').Client;
const client = new SSDPClient({ allowWildcards:true});
const defaultSearchString = 'urn:schemas-upnp-org:device*';
let first = true;
module.exports.ssdpScan = function(searchString = defaultSearchString) {
	console.log("ssdpScan - searcgString=" + searchString );
    client.on('response', function (response) {
		if (response.ST == searchString) {
				console.log("response st=" + 
								response.ST + " location=" + response.LOCATION +"\t usn=" + response.USN )
		} else {
			console.log("response.ST = " + response.ST);
		}
		if (first) {
			Object.keys(response).forEach(function (header) {
				console.log(header + ': ' + response[header])
			})
			first = false
		}
	});
	client.on('notify', function () {
		console.log('Got a notification.')
		})
	client.search(searchString);
	console.log("searching for ssdp:all");
	//client.search('ssdp:all')
	/*
	setInterval(function() {
		client.search('ssdp:all')
	}, 5000);
	*/
	setTimeout(function () {
		console.log("Stopping");
		client.stop()
		}, 10000);

    // search for a service type
    //client.search('urn:schemas-upnp-org:device:SmartBridge*');
	//"urn:schemas-upnp-org:device:SmartBridge:1"
	//client.search("schemas-upnp-org:device:SmartBridge:1");
	//client.search('schemas-upnp-org:device:Smart*');
	//client.search('urn:schemas-upnp-org:device:RFXDevice:1')
	//urn:schemas-upnp-org:device
	
	//client.search('urn:');
}