var request = require("request");
var util = require("util");
var FileCookieStore = require("./fileCookieStore");

var icloud = {
	init: function(callback) {
		if (!icloud.hasOwnProperty("apple_id") || !icloud.hasOwnProperty("password")) {
			return callback("Please define apple_id / password");
		}

		if (icloud.apple_id == null || icloud.password == null) {
			return callback("Please define apple_id / password");
		}

		var fileStore = new FileCookieStore(__dirname + '/cookies.json', {
			encrypt: true,
			algorithm: 'aes-256-ctr'
		});
		icloud.jar = request.jar(fileStore);
		console.log("Logging jar directory" + __dirname);
		icloud.iRequest = request.defaults({
			jar: icloud.jar,
			headers: {
				"Origin": "https://www.icloud.com"
			}
		});

		icloud.checkSession(function(err, res, body) {
			if (err) {
				//session is dead, start new
				icloud.jar = null;
				icloud.jar = request.jar();

				icloud.login(function(err, res, body) {
					fileStore.flush();
					return callback(err, res, body);
				});
			} else {
				console.log("reusing session");
				return callback(err, res, body);
			}
		});
	},

	login: function(callback) {
		var options = {
			url: "https://setup.icloud.com/setup/ws/1/login",
			json: {
				"apple_id": icloud.apple_id,
				"password": icloud.password,
				"extended_login": true
			}
		};

		icloud.iRequest.post(options, function(error, response, body) {
			if (!response || response.statusCode != 200) {
				return callback("Login Error");
			}

			icloud.onLogin(body, function(err, resp, body) {
				return callback(err, resp, body);
			});
		});
	},

	checkSession: function(callback) {
		var options = {
			url: "https://setup.icloud.com/setup/ws/1/validate",
		};

		icloud.iRequest.post(options, function(error, response, body) {

			if (!response || response.statusCode != 200) {
				return callback("Could not refresh session " + response.statusCode);
			}

			icloud.onLogin(JSON.parse(body), function(err, resp, body) {
				return callback(err, resp, body);
			});
		});
	},

	onLogin: function(body, callback) {
		if (body.hasOwnProperty("webservices") && body.webservices.hasOwnProperty("findme")) {
			icloud.base_path = body.webservices.findme.url;

			options = {
				url: icloud.base_path + "/fmipservice/client/web/initClient",
				json: {
					"clientContext": {
						"appName": "iCloud Find (Web)",
						"appVersion": "2.0",
						"timezone": "US/Eastern",
						"inactiveTime": 3571,
						"apiVersion": "3.0",
						"fmly": true
					}
				}
			};

			icloud.iRequest.post(options, callback);
		} else {
			return callback("cannot parse webservice findme url");
		}
	},

	getDevices: function(callback) {
		icloud.init(function(error, response, body) {
			if (!response || response.statusCode != 200) {
				return callback(error);
			}

			var devices = [];

			// Retrieve each device on the account
			body.content.forEach(function(device) {
				devices.push({
					id: device.id,
					name: device.name,
					deviceModel: device.deviceModel,
					modelDisplayName: device.modelDisplayName,
					deviceDisplayName: device.deviceDisplayName,
					batteryLevel: device.batteryLevel,
					isLocating: device.isLocating,
					lostModeCapable: device.lostModeCapable,
					location: device.location
				});
			});

			callback(error, devices);
		});
	},

	alertDevice: function(deviceId, callback) {
		var options = {
			url: icloud.base_path + "/fmipservice/client/web/playSound",
			json: {
				"subject": "Amazon Echo Find My iPhone Alert",
				"device": deviceId
			}
		};
		icloud.iRequest.post(options, callback);
	},

	getLocationOfDevice: function(device, callback) {
		if (!device.location) {
			return callback("No location in device");
		}

		var googleUrl = "http://maps.googleapis.com/maps/api/geocode/json" +
			"?latlng=%d,%d&sensor=true";

		googleUrl =
			util.format(googleUrl,
				device.location.latitude, device.location.longitude);

		var req = {
			url: googleUrl,
			json: true
		};

		request(req, function(err, response, json) {
			if (!err && response.statusCode == 200) {
				if (Array.isArray(json.results) &&
					json.results.length > 0 &&
					json.results[0].hasOwnProperty("formatted_address")) {

					return callback(err, json.results[0].formatted_address);
				}
			}
			return callback(err);
		});
	},

	getDistanceOfDevice: function(device, myLatitude, myLongitude, callback) {
		if (device.location) {
			var googleUrl = "http://maps.googleapis.com/maps/api/distancematrix/json" +
				"?origins=%d,%d&destinations=%d,%d&mode=driving&sensor=false";

			googleUrl =
				util.format(googleUrl, myLatitude, myLongitude,
					device.location.latitude, device.location.longitude);

			var req = {
				url: googleUrl,
				json: true
			};

			request(req, function(err, response, json) {
				if (!err && response.statusCode == 200) {
					if (json && json.rows && json.rows.length > 0) {
						return callback(err, json.rows[0].elements[0]);
					}
					return callback(err);
				}
			});

		} else {
			callback("No location found for this device");
		}
	}
};

module.exports = icloud;
