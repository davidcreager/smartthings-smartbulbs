const mqtt = require("mqtt");
const { Scanner } = require("./scanner");
const { version } = require("../package.json");


const defaultTimeout = 15;

class xiaomiDevice {
  constructor(log, config) {
    this.log = log;
    this.config = config || {};
    this.displayName = this.config.name;

    this.latestTemperature = undefined;
    this.latestHumidity = undefined;
    this.latestBatteryLevel = undefined;
	
    this.lastUpdatedAt = undefined;
    this.lastBatchUpdatedAt = undefined;
	
    this.temperatureMQTTTopic = undefined;
    this.humidityMQTTTopic = undefined;
    this.batteryMQTTTopic = undefined;
    this.mqttClient = this.setupMQTTClient();

    this.scanner = this.setupScanner();

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
    this.publishValueToMQTT(this.temperatureMQTTTopic, this.temperature);
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
    this.publishValueToMQTT(this.humidityMQTTTopic, this.humidity);
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
    this.publishValueToMQTT(this.batteryMQTTTopic, this.batteryLevel);
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

  setupScanner() {
    const address = this.config.address;
    if (address == null) {
      this.log.warn(
        "address option is not set. " +
          "When running multiple sensors this will cause interference. " +
          "See README for instructions."
      );
    }
    const scanner = new Scanner(this.config.address, {
      log: this.log,
      forceDiscovering: this.config.forceDiscovering !== false,
      restartDelay: this.config.forceDiscoveringDelay,
      bindKey: this.config.bindKey
    });
	this.log.info("Name =" + this.config.name);
	this.log.info("Address =" + this.config.address);
	this.log.info("bindkey =" + this.config.bindKey);
    scanner.on("temperatureChange", (temperature, peripheral) => {
      const { address, id } = peripheral;
      this.log.debug(`[${address || id}] Temperature: ${temperature}C`);
      this.setTemperature(temperature);
    });
    scanner.on("humidityChange", (humidity, peripheral) => {
      const { address, id } = peripheral;
      this.log.debug(`[${address || id}] Humidity: ${humidity}%`);
      this.setHumidity(humidity);
    });
    scanner.on("batteryChange", (batteryLevel, peripheral) => {
      const { address, id } = peripheral;
      this.log.debug(`[${address || id}] Battery level: ${batteryLevel}%`);
      this.setBatteryLevel(batteryLevel);
    });
    scanner.on("change", () => {
      if (this.isReadyForBatchUpdate() === false) {
        return;
      }
      this.log.debug("Batch updating values");
      this.lastBatchUpdatedAt = Date.now();
      this.setTemperature(this.temperature, true);
      this.setHumidity(this.humidity, true);
      this.setBatteryLevel(this.batteryLevel, true);
    });
    scanner.on("error", error => {
      this.log.error(error);
    });

    return scanner;
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

  setupMQTTClient() {
    const config = this.config.mqtt;
    if (config == null || config.url == null) {
      return;
    }
    const {
      temperatureTopic,
      humidityTopic,
      batteryTopic,
      url,
      ...mqttOptions
    } = config;

    this.temperatureMQTTTopic = temperatureTopic;
    this.humidityMQTTTopic = humidityTopic;
    this.batteryMQTTTopic = batteryTopic;

    const client = mqtt.connect(url, mqttOptions);
    client.on("connect", () => {
      this.log.info("MQTT Client connected.");
    });
    client.on("reconnect", () => {
      this.log.debug("MQTT Client reconnecting.");
    });
    client.on("close", () => {
      this.log.debug("MQTT Client disconnected");
    });
    client.on("error", error => {
      this.log.error(error);
      client.end();
    });
    return client;
  }

  publishValueToMQTT(topic, value) {
    if (
      this.mqttClient == null ||
      this.mqttClient.connected === false ||
      topic == null ||
      value == null
    ) {
      return;
    }
    this.mqttClient.publish(topic, String(value), {
      qos: this.config.mqtt.qos || 0,
      retain: this.config.mqtt.retain || false
    });
  }
};
module.exports = xiaomiDevice;
