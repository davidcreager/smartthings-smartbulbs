'use strict';
class httpSite {
	constructor(site,port){
	}
	httpRequest{
		req.on("error",function(err){
			console.error("smartserver:httpRequestHandler: request onerror:"+err);
			resp.statusCode = 400;
			resp.end();
			})
		resp.on('finish', function(err) {
			console.error("smartserver:httpRequestHandler: Debug Finish event "+ retProps(err,true) );
			});
		function writeDiscoveryResp(resp, TypeOrBridgeName, uniqueName, friendlyName,
						ipAddress, port, othTags, sDevices, managedDevices  ) {
				resp.writeHead(200, {"Content-Type": "text/xml"});
				resp.write("<?xml version=\"1.0\"?> ");
				resp.write("<root xmlns=\"urn:schemas-upnp-org:device:" + TypeOrBridgeName + ":1\">");
				resp.write("<device>");
				resp.write("<deviceType>urn:schemas-upnp-org:device:" + TypeOrBridgeName + ":1</deviceType>");
				resp.write("<friendlyName>" + friendlyName + "</friendlyName>");
				resp.write("<uniqueName>" + uniqueName + "</uniqueName>");
				resp.write("<UDN>" + uniqueName + "</UDN>");
				resp.write("<IP>" + ipAddress + "</IP>");
				resp.write("<port>" + port + "</port>");										
				for (const prop in othTags) {
						resp.write("<" + prop + ">" + othTags[prop] + "</" + prop + ">")
				}
				if (sDevices) {
					resp.write("<supportedDevices>");
					resp.write(JSON.stringify(sDevices))
					resp.write("</supportedDevices>")
				}//sSmartDevices
				if (managedDevices) {
					resp.write("<managedDevices>");
					resp.write(JSON.stringify(managedDevices))
					resp.write("</managedDevices>")
				}
				resp.write("</device>");
				resp.write("</root>");
				resp.end();
		}
		let url = URL.parse(req.url, true);
		let query = querystring.parse(url.query);
		let smartDevice;
		console.log("smartserver:httpRequestHandler: Received Request pathname=" + url.pathname  +
					" from:" + req.connection.remoteAddress + 
					" query=" + JSON.stringify(url.query)
			);
	}
}