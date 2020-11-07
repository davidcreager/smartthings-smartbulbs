const { version } = require("../package.json");
const EventEmitter = require("events");
const noble = require("@abandonware/noble");
const { Parser, EventTypes, SERVICE_DATA_UUID } = require("./parser");

const defaultTimeout = 15;
/* const scanner = new Scanner(this.config.address, {
      log: this.log,forceDiscovering: this.config.forceDiscovering !== false,
      restartDelay: this.config.forceDiscoveringDelay, bindKey: this.config.bindKey
    });
	*/
//	AgentOptions = {type: "adverts|connected", log: null, 
//					address: "uuid",
//					bindKey: "",
//					handler:null, 
//					options:{}}
class Scanner extends EventEmitter {
  constructor(agentOptions) {
	var that = this;
    super();
    agentOptions = agentOptions || {};
	this.devices = {}; // Agent stuff
	this.handler = agentOptions.handler || null;
    this.log = agentOptions.log || console;
    this.address = agentOptions.address;
    this.bindKey = agentOptions.bindKey;
	const {forceDiscovering = true, restartDelay = 2500} = agentOptions.options;
    this.forceDiscovering = forceDiscovering;
    this.restartDelay = restartDelay;
	
    this.scanning = false;
    this.configure();
  }
  configure() {
    noble.on("discover", this.onDiscover.bind(this));
    noble.on("scanStart", this.onScanStart.bind(this));
    noble.on("scanStop", this.onScanStop.bind(this));
    noble.on("warning", this.onWarning.bind(this));
    noble.on("stateChange", this.onStateChange.bind(this));
  }

  start() {
    this.log.info("Start scanning.");
    try {
      noble.startScanning([], true);
      this.scanning = true;
    } catch (e) {
      this.scanning = false;
      this.log.error(e);
    }
  }

  stop() {
    this.scanning = false;
    noble.stopScanning();
  }

  onStateChange(state) {
    if (state === "poweredOn") {
      this.start();
    } else {
      this.log.info(`Stop scanning. (${state})`);
      this.stop();
    }
  }

  onWarning(message) {
    this.log.info("Warning: ", message);
  }

  onScanStart() {
    this.log.debug("Started scanning.");
  }

  onScanStop() {
    this.log.info("Stopped scanning.");
    // We are scanning but something stopped it. Restart scan.
    if (this.scanning && this.forceDiscovering) {
      setTimeout(() => {
        this.log.debug("Restarting scan.");
        this.start();
      }, this.restartDelay);
    }
  }

  onDiscover(peripheral) {
    const { advertisement: { serviceData } = {}, id, address } =
      peripheral || {};
    if (!this.isValidAddress(address) && !this.isValidAddress(id)) {
		if ( (!ignoredDevices[address]) && (address) ) {
			this.log.info("Ignoring address " + address);
			ignoredDevices[address] = [peripheral];
		}
		return;
    }
    const miServiceData = this.getValidServiceData(serviceData);
    if (!miServiceData) {
      return;
    }
    // ** DEBUG** this.logPeripheral({ peripheral, serviceData: miServiceData });
    const result = this.parseServiceData(miServiceData.data);
    if (result == null) {
      return;
    }
	if  (!devices[address]) {
		device[address] = new xiaomiDevice(log,null,this);
		this.log.info("Creating new device " + address);
	}
    if (!result.frameControl.hasEvent) {
      // ** DEBUG** this.log.debug("No event");
      return;
    }
    const { eventType, event } = result;
    switch (eventType) {
      case EventTypes.temperature: {
        const { temperature } = event;
        this.emit("temperatureChange", temperature, { id, address });
        break;
      }
      case EventTypes.humidity: {
        const { humidity } = event;
        this.emit("humidityChange", humidity, { id, address });
        break;
      }
      case EventTypes.battery: {
        const { battery } = event;
        this.emit("batteryChange", battery, { id, address });
        break;
      }
      case EventTypes.temperatureAndHumidity: {
        const { temperature, humidity } = event;
        this.emit("temperatureChange", temperature, { id, address });
        this.emit("humidityChange", humidity, { id, address });
        break;
      }
      case EventTypes.illuminance: {
        const { illuminance } = event;
        this.emit("illuminanceChange", illuminance, { id, address });
        break;
      }
      case EventTypes.moisture: {
        const { moisture } = event;
        this.emit("moistureChange", moisture, { id, address });
        break;
      }
      case EventTypes.fertility: {
        const { fertility } = event;
        this.emit("fertilityChange", fertility, { id, address });
        break;
      }
      default: {
        this.emit("error", new Error(`Unknown event type ${eventType}`));
        return;
      }
    }
    this.emit("change", event, { id, address });
  }

  cleanAddress(address) {
    if (address == null) {
      return address;
    }
    return address.toLowerCase().replace(/[:-]/g, "");
  }

  isValidAddress(address) {
    return (
      this.address == null ||
      this.cleanAddress(this.address) === this.cleanAddress(address)
    );
  }

  getValidServiceData(serviceData) {
    return (
      serviceData &&
      serviceData.find(data => data.uuid.toLowerCase() === SERVICE_DATA_UUID)
    );
  }

  parseServiceData(serviceData) {
    try {
      return new Parser(serviceData, this.bindKey).parse();
    } catch (error) {
      this.emit("error", error);
    }
  }

  logPeripheral({peripheral: {address, id, rssi, advertisement: {localName}}, serviceData}){
    this.log.debug(`[${address || id}] Discovered peripheral
      Id: ${id}
      LocalName: ${localName}
      rssi: ${rssi}
      serviceData: ${serviceData.data.toString("hex")}`);
  }
}

//exports.YeeBTLamp = function ( YeeBTLampName, pbType, peripheral,handler,agent, bri)
//exports.Playbulb = function ( playbulbName, pbType, peripheral, handler, agent, bri)
class xiaomiDevice {
  constructor(log, config, scanner) {
    this.log = log;
    this.config = config || {};
    this.displayName = this.config.name;
	this.scanner = scanner;
	
	var that = this;
	this.type = pbType || "Unknown";
	this.agent = agent;
	this.smartType = "XiaomiDevice";
	this.responds = "none";
	this.deviceHandler = "Xiaomi Thermostat";
	this.cbHandler = handler;
	this.playbulbName = playbulbName;
	this.friendlyName = this.playbulbName;
	this.uniqueName=playbulbName + "(" + peripheral.uuid.toUpperCase() + ")"
	this.characteristicsByName = {};
	

    this.latestTemperature = undefined;
    this.latestHumidity = undefined;
    this.latestBatteryLevel = undefined;
	
    this.lastUpdatedAt = undefined;
    this.lastBatchUpdatedAt = undefined;
	
    this.temperatureMQTTTopic = undefined;
    this.humidityMQTTTopic = undefined;
    this.batteryMQTTTopic = undefined;
    //this.scanner = this.setupScanner();
    this.log.debug("Initialized accessory");
  }

  setTemperature(newValue, force = false) {
    if (newValue == null) {
      return;
    }
    this.latestTemperature = newValue;
    this.lastUpdatedAt = Date.now();
    if (this.useBatchUpdating && force === false) {
      return;
    }
    //this.publishValueToMQTT(this.temperatureMQTTTopic, this.temperature);
  }

  get temperature() {
    if (this.hasTimedOut() || this.latestTemperature == null) {
      return;
    }
    return this.latestTemperature + this.temperatureOffset;
  }

  setHumidity(newValue, force = false) {
    if (newValue == null) {
      return;
    }
    this.latestHumidity = newValue;
    this.lastUpdatedAt = Date.now();
    if (this.useBatchUpdating && force === false) {
      return;
    }
    //this.publishValueToMQTT(this.humidityMQTTTopic, this.humidity);
  }

  get humidity() {
    if (this.hasTimedOut() || this.latestHumidity == null) {
      return;
    }
    return this.latestHumidity + this.humidityOffset;
  }

  setBatteryLevel(newValue, force = false) {
    if (newValue == null) {
      return;
    }
    this.latestBatteryLevel = newValue;
    this.lastUpdatedAt = Date.now();
    if (this.useBatchUpdating && force === false) {
      return;
    }
    //this.publishValueToMQTT(this.batteryMQTTTopic, this.batteryLevel);
  }

  get batteryLevel() {
    if (this.hasTimedOut()) {
      return;
    }
    return this.latestBatteryLevel;
  }

  get batteryStatus() {
    let batteryStatus;
    if (this.batteryLevel == null) {
      batteryStatus = undefined;
    } else if (this.batteryLevel > this.batteryLevelThreshold) {
      batteryStatus = "BATTERY_LEVEL_NORMAL";
    } else {
      batteryStatus = "BATTERY_LEVEL_LOW";
    }
    return batteryStatus;
  }

  get batteryLevelThreshold() {
    return this.config.lowBattery || 10;
  }

  get temperatureName() {
    return this.config.temperatureName || "Temperature";
  }

  get humidityName() {
    return this.config.humidityName || "Humidity";
  }

  get serialNumber() {
    return this.config.address != null
      ? this.config.address.replace(/:/g, "")
      : undefined;
  }

  get lastUpdatedISO8601() {
    return new Date(this.lastUpdatedAt).toISOString();
  }

  get timeout() {
    return this.config.timeout == null ? defaultTimeout : this.config.timeout;
  }

  get useBatchUpdating() {
    return this.config.updateInterval != null;
  }

  get temperatureOffset() {
    return this.config.temperatureOffset || 0;
  }

  get humidityOffset() {
    return this.config.humidityOffset || 0;
  }

  get isBatteryLevelDisabled() {
    return this.config.disableBatteryLevel || false;
  }

  isReadyForBatchUpdate() {
    if (this.useBatchUpdating === false) {
      return false;
    }
    if (this.lastBatchUpdatedAt == null) {
      return true;
    }
    const timeoutMilliseconds = 1000 * this.config.updateInterval;
    return this.lastBatchUpdatedAt + timeoutMilliseconds <= Date.now();
  }



  hasTimedOut() {
    if (this.timeout === 0) {
      return false;
    }
    if (this.lastUpdatedAt == null) {
      return false;
    }
    const timeoutMilliseconds = 1000 * 60 * this.timeout;
    const timedOut = this.lastUpdatedAt <= Date.now() - timeoutMilliseconds;
    if (timedOut) {
      this.log.warn(
        `[${this.config.address}] Timed out, last update: ${this.lastUpdatedISO8601}`
      );
    }
    return timedOut;
  }
  discoverDevices() {
		this.scanner.on("temperatureChange", (temperature, peripheral) => {
			const { address, id } = peripheral;
			this.log.debug(`[${that.uniqueName}] Temperature: ${temperature}C`);
			this.setTemperature(temperature);
			});
		this.scanner.on("humidityChange", (humidity, peripheral) => {
			const { address, id } = peripheral;
			this.log.debug(`[${that.uniqueName}] Humidity: ${humidity}%`);
			this.setHumidity(humidity);
		});
		this.scanner.on("batteryChange", (batteryLevel, peripheral) => {
			const { address, id } = peripheral;
			this.log.debug(`[${that.uniqueName}] Battery level: ${batteryLevel}%`);
			this.setBatteryLevel(batteryLevel);
		});	
		this.scanner.on("change", () => {
			if (this.isReadyForBatchUpdate() === false) {
				return;
			}
			this.log.debug(`[${that.uniqueName}]` + " Batch updating values");
			this.lastBatchUpdatedAt = Date.now();
			this.setTemperature(this.temperature, true);
			this.setHumidity(this.humidity, true);
			this.setBatteryLevel(this.batteryLevel, true);
		});
		this.scanner.on("error", error => {
			this.log.error(`[${that.uniqueName}]` + " " + error);
		});
		//return scanner;
  }
};
module.exports = xiaomiDevice;
