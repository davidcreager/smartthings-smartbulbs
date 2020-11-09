console.log("Trying to get ssdps")
const SSDPClient = require('node-ssdp').Client;
const client = new SSDPClient({ allowWildcards:false});
const defaultSearchString = 'urn:schemas-upnp-org:device*';
module.exports.ssdpScan = function(searchString = defaultSearchString) {
    client.on('response', function (response) {
		if (response.ST == searchString) console.log("response st=" + 
								response.ST + " location=" + response.LOCATION +"\t usn=" + response.USN )
		});
	client.on('notify', function () {
		console.log('Got a notification.')
		})
	client.search(searchString);
    // search for a service type
    //client.search('urn:schemas-upnp-org:device:SmartBridge*');
	//"urn:schemas-upnp-org:device:SmartBridge:1"
	//client.search("schemas-upnp-org:device:SmartBridge:1");
	//client.search('schemas-upnp-org:device:Smart*');
	//client.search('urn:schemas-upnp-org:device:RFXDevice:1')
	//urn:schemas-upnp-org:device
	
	//client.search('urn:');
}