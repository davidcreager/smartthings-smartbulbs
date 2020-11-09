'use strict';
const logs = require("./logs");
const dev =require("./BTAgent");
var log = new logs.Log("tester",false,true);

//	AgentOptions = {type: "adverts|connected", log: null, 
//					address: "uuid",
//					bindKey: "",
//					handler:null, 
//					options:{}}
let testDevice = new dev({"address": "a4:c1:38:f7:92:27",
							"bindKey": "eed67d3cec84bee92fd3a304978c76a0",
							"log": log,
							"options": {}})


//console.log("enum warn = " + log.LogLevel.WARN);
//console.log("enum info = " + log.LogLevel.INFO);
//console.log("debugEnabled = " + log.debugEnabled);
log.warn("hello");
