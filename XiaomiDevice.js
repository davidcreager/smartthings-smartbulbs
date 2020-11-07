const EventEmitter = require("events");
//exports.YeeBTLamp = function ( YeeBTLampName, pbType, peripheral,handler,agent, bri)
//exports.Playbulb = function ( playbulbName, pbType, peripheral, handler, agent, bri)
class XiaomiDevice {
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
    this.setupScanner();
    this.log.debug("Initialized accessory");
  }

  setTemperature(newValue, force = false) {
    if (newValue == null) {
      return;
    }
    this.latestTemperature = newValue;
    this.lastUpdatedAt = Date.now();
	this.log.info("setTemperature - updating - new value =" + newValue);
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
	this.log.info("setHumidity - updating - new value =" + newValue);
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
	this.log.info("setBatteryLevel - updating - new value =" + newValue);
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
  setupScanner() {
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
  }
};
module.exports = xiaomiDevice;
