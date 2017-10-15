var Milight = require('node-milight-promise').MilightController;
var commands = require('node-milight-promise').commandsV6;
var light = new Milight({
    ip: "255.255.255.255",
    type: 'v6'
  }),
  zone = 2;

//light.sendCommands(commands.rgbw.on(zone), commands.rgbw.whiteMode(zone), commands.rgbw.brightness(zone, 100));
if (process.argv[2] == "on") {
	light.sendCommands(commands.rgbw.on(zone));
} else {
	light.sendCommands(commands.rgbw.off(zone));
}
