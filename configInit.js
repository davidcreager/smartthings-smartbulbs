"use strict";
console.log("Yeelight Bridge - Manage Yeelight devices")
var NCONF=require('nconf')
var fs    = require('fs')
function retProps(obj){
	var props=""
	for (var property in obj) {
		if (obj.hasOwnProperty(property)) {
			if (props=="") {
				props=property+":"+obj[property]
			} else {
				props=props+","+property+":"+obj[property]
			}
		}
	}
return props
}

NCONF.argv()
	.env()
	.file({ file: './config.json' });
	NCONF.set('bridge:port', 8082);
	NCONF.set('yeelight:transition', 300);
	NCONF.save()
	//console.log('bridge: ' + retProps(NCONF.get('bridge')));
	//console.log('yeelight: ' + retProps(NCONF.get('yeelight')));
 
  // 
  //NCONF.set('bridge:host', '127.0.0.1');
  //NCONF.set('bridge:port', 1234);
  //NCONF.save()
 
  // 
  // Get the entire database object from NCONF. This will output 
  // { host: '127.0.0.1', port: 5984 } 
  // 
  //console.log('cline: ' + NCONF.get('cline'));
  //console.log('envVar: ' + NCONF.get('envVar'));
  //console.log('bridge: ' + retProps(NCONF.get('bridge')));
 
  // 
  // Save the configuration object to disk 
  // 
  /*
  NCONF.save(function (err) {
    fs.readFile('./config.json', function (err, data) {
      console.dir(JSON.parse(data.toString()))
    });
  });
*/