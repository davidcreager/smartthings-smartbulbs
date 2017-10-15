var vows = require('vows'),
	assert = require('assert'),
	BlueBird = require('bluebird'),
	PromiseObject = require('../index')(BlueBird);

var Class = PromiseObject.create({
	initialize: function () {
		this.reopen({
			stringProperty: 'instance string',

			intProperty: 1,

			objectProperty: {value: 1},

			method: function () {
				return 'instance method';
			},

			deferredMethod: function ($deferred) {
				$deferred.resolve('instance method');
			}
		});
	}
});

Class.reopen({
	stringProperty: 'class string',

	intProperty: 2,

	objectProperty: {value: 2},

	method: function () {
		return 'class method';
	},

	deferredMethod: function ($deferred) {
		$deferred.resolve('class method');
	}
});

var Class2 = Class.extend({
	initialize: function ($super) {
		$super();

		this.reopen({
			deferredMethod: function ($deferred, $super) {
				$super().then(function (result) {
					$deferred.resolve(result + ' two');
				});
			}
		});
	}
});

Class2.reopen({
	deferredMethod: function ($deferred, $super) {
		$super().then(function (result) {
			$deferred.resolve(result + ' two');
		});
	}
});

Class2.reopen({
	deferredMethod: function ($deferred, $super) {
		$super().then(function (result) {
			$deferred.resolve(result + ' three');
		});
	}
});

var suite = vows.describe('Reopen Tests');

suite.addBatch({
	'instance with deferred': {
		topic: function () {
			var self = this;

			var instance = new Class();
			instance.deferredMethod().then(function (result) {
				self.callback(null, result);
			});
		},

		'expected instance method': function (result) {
			assert.equal(result, 'instance method');
		}
	},

	'class with deferred': {
		topic: function () {
			var self = this;

			Class.deferredMethod().then(function (result) {
				self.callback(null, result);
			});
		},

		'expected instance method': function (result) {
			assert.equal(result, 'class method');
		}
	},

	'class with extended reopens': {
		topic: function () {
			var self = this;

			Class2.deferredMethod().then(function (result) {
				self.callback(null, result);
			});
		},

		'expected extended class method': function (result) {
			assert.equal(result, 'class method two three');
		}
	},

	'instance with extended reopens': {
		topic: function () {
			var self = this;

			var instance = new Class2();
			instance.deferredMethod().then(function (result) {
				self.callback(null, result);
			});
		},

		'expected extended class method': function (result) {
			assert.equal(result, 'instance method two');
		}
	},

	'instance reopen': {
		topic: new Class(),

		'expected method': function (topic) {
			assert.equal(topic.method(), 'instance method');
		},

		'expected string property': function (topic) {
			assert.equal(topic.stringProperty, 'instance string');
		},

		'expected number property': function (topic) {
			assert.equal(topic.intProperty, 1);
		},

		'expected object property': function (topic) {
			assert.equal(topic.objectProperty.value, 1);
		}
	},

	'class reopen': {
		topic: new Class(),

		'expected method': function () {
			assert.equal(Class.method(), 'class method');
		},

		'expected string property': function () {
			assert.equal(Class.stringProperty, 'class string');
		},

		'expected number property': function () {
			assert.equal(Class.intProperty, 2);
		},

		'expected object property': function () {
			assert.equal(Class.objectProperty.value, 2);
		}
	}
});
exports.suite = suite;