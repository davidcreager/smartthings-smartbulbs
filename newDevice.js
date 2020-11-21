#!/usr/bin/env node
'use strict';
class BTDevice {
	constructor(type){
	}
}
class CandelaBTDevice {
	constructor(type){
		super();
		this.primaryUUID = "0000fe87-0000-1000-8000-00805f9b34fb";
		this.controlCharacteristic = "aa7d3f34-2d4f-41e0-807f-52fbf8cf7443";
		this.notifyCharacteristic = "8f65073d-9f57-4aaa-afea-397d19d5bbeb";
		this.controlHandler = {};
		this.notifyHandler = {};
	}
}
