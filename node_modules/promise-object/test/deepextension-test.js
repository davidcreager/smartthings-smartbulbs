var vows = require('vows'),
	assert = require('assert'),
	BlueBird = require('bluebird'),
	PromiseObject = require('../index')(BlueBird);

var Class1 = PromiseObject.create({
	initialize: function ($config) {
		this._name = $config.name;
		this._count = 0;
		this.log('Class1:initialize');
	},

	getName: function () {
		return this._name;
	},

	getCount: function () {
		return this._count;
	},

	updateCount: function updateCount ($deferred, $self, value) {
		setTimeout(function () {
			$self._count += 1;
			$self.log('Class1:updateCount', $self._count);
			$deferred.resolve(value + 1);
		}, 0);
	},

	log: function (message) {
		//console.log.apply(console, arguments);
	}
});

var Class2 = Class1.extend({
	initialize: function ($super, $config) {
		$super($config);
		this.log('Class2:initialize');
	},

	updateCount: function ($deferred, $super, $self, value) {
		$super(value).then(function (value) {
			setTimeout(function () {
				$self._count += 2;
				$self.log('Class2:updateCount', $self._count);
				$deferred.resolve(value + 1);
			}, 0);
		}, $deferred.reject);
	}
});

var Class3 = Class2.extend({
	initialize: function ($super, $config) {
		$super($config);
		this.log('Class3:initialize');
	},

	updateCount: function ($deferred, $super, $self, value) {
		$super(value).then(function (value) {
			setTimeout(function () {
				$self._count += 4;
				$self.log('Class3:updateCount', $self._count);
				$deferred.resolve(value + 1);
			}, 0);
		}, $deferred.reject);
	},

	getRandomNumber: function () {
		// overwritten
	},

	getRandomNumberDeferred: function ($deferred) {
		// overwritten
	}
});

var Class4 = Class3.extend({
	initialize: function ($super, $config) {
		$super($config);
		this.log('Class4:initialize');
	},

	updateCount: function ($deferred, $super, $self, value) {
		$super(value).then(function (value) {
			setTimeout(function () {
				$self._count += 8;
				$self.log('Class4:updateCount', $self._count);
				$deferred.resolve(value + 1);
			}, 0);
		}, $deferred.reject);
	},

	getRandomNumber: function () {
		return Math.random();
	},

	getRandomNumberDeferred: function ($deferred) {
		$deferred.resolve(Math.random());
	}
});

var Class5 = Class4.extend({
	initialize: function ($super, $config) {
		$super($config);
		this.log('Class5:initialize');
	},

	updateCount: function ($deferred, $super, $self, value) {
		$super(value).then(function (value) {
			setTimeout(function () {
				$self._count += 16;
				$self.log('Class5:updateCount', $self._count);
				$deferred.resolve(value + 1);
			}, 0);
		}, $deferred.reject);
	}
});

var Class6 = Class5.extend({
	initialize: function ($super, $config) {
		$super($config);
		this.log('Class6:initialize');
	},

	updateCount: function ($deferred, $super, $self, value) {
		$super(value).then(function (value) {
			setTimeout(function () {
				$self._count += 32;
				$self.log('Class6:updateCount', $self._count);
				$deferred.resolve(value + 1);
			}, 0);
		}, $deferred.reject);
	}
});

var Class7 = Class6.extend({
	initialize: function ($super, $config) {
		$super($config);
		this.log('Class7:initialize');
	},

	updateCount: function ($deferred, $super, $self, value) {
		$super(value).then(function (value) {
			setTimeout(function () {
				$self._count += 64;
				$self.log('Class7:updateCount', $self._count);
				$deferred.resolve(value + 1);
			}, 0);
		}, $deferred.reject);
	}
});

var Class8 = Class7.extend({
	initialize: function ($super, $config) {
		$super($config);
		this.log('Class8:initialize');
	},

	updateCount: function ($deferred, $super, $self, value) {
		$super(value).then(function (value) {
			setTimeout(function () {
				$self._count += 128;
				$self.log('Class8:updateCount', $self._count);
				$deferred.resolve(value + 1);
			}, 0);
		}, $deferred.reject);
	}
});

var suite = vows.describe('Deep Extension');
suite.addBatch({
	'Extending 1 Deferred Methods': {
		topic: function () {
			var self = this;
			var example = new Class1({name: '1 classes'});
			example.updateCount(0).then(function (value) {
				self.callback(null, {object: example, value: value});
			});
		},

		'value results': function (topic) {
			assert.equal(topic.value, 1);
		},

		'name': function (topic) {
			assert.equal(topic.object.getName(), '1 classes');
		},

		'bitwise count': function (topic) {
			assert.equal(topic.object.getCount(), 1);
		}
	},

	'Extending 2 Deferred Methods': {
		topic: function () {
			var self = this;
			var example = new Class2({name: '2 classes'});
			example.updateCount(0).then(function (value) {
				self.callback(null, {object: example, value: value});
			});
		},

		'value results': function (topic) {
			assert.equal(topic.value, 2);
		},

		'name': function (topic) {
			assert.equal(topic.object.getName(), '2 classes');
		},

		'bitwise count': function (topic) {
			assert.equal(topic.object.getCount(), 3);
		}
	},

	'Extending 3 Deferred Methods': {
		topic: function () {
			var self = this;
			var example = new Class3({name: '3 classes'});
			example.updateCount(0).then(function (value) {
				self.callback(null, {object: example, value: value});
			});
		},

		'value results': function (topic) {
			assert.equal(topic.value, 3);
		},

		'name': function (topic) {
			assert.equal(topic.object.getName(), '3 classes');
		},

		'bitwise count': function (topic) {
			assert.equal(topic.object.getCount(), 7);
		}
	},

	'Extending 8 Deferred Methods': {
		topic: function () {
			var self = this;
			var example = new Class8({name: '8 classes'});
			example.updateCount(0).then(function (value) {
				self.callback(null, {object: example, value: value});
			});
		},

		'value results': function (topic) {
			assert.equal(topic.value, 8);
		},

		'name': function (topic) {
			assert.equal(topic.object.getName(), '8 classes');
		},

		'bitwise count': function (topic) {
			assert.equal(topic.object.getCount(), 255);
		},

		'middle method check': function (topic) {
			assert.isNumber(topic.object.getRandomNumber());
		}
	}
});
exports.suite = suite;