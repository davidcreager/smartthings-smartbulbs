var vows = require('vows'),
	assert = require('assert'),
	BlueBird = require('bluebird'),
	PromiseObject = require('../index')(BlueBird);

// shim in delay
Promise.delay = function (interval) {
	return new Promise(function (resolve) {
		setTimeout(function () {
			resolve();
		}, interval);
	});
};

var supportsGenerators = true;
try {
	eval('(function *(){})()');
} catch(err) {
	supportsGenerators = false;
}

var DeferredTest = PromiseObject.create({
	initialize: function ($config) {

	},

	doSomething: function ($deferred, $self, _count) {
		_count = _count || 0;

		setTimeout(function () {
			_count++;

			if (_count === 5) {
				$deferred.reject(new Error('errored'));
			} else {
				$self.doSomething(_count).then(function () {
					$deferred.resolve();
				}, function (error) {
					$deferred.reject(error);	
				});
			}
		}, 0);
	}
});

var DeferredGeneratorTest;
if (supportsGenerators) {
	eval(
		'DeferredGeneratorTest = PromiseObject.create({ '+
		'	initialize: function ($config) { '+
		' '+
		'	}, '+
		' '+
		'	doSomething: function *($deferred, $self, _count) { '+
		'		_count = _count || 0; '+
		' '+
		'		yield Promise.delay(1); '+
		' '+
		'		_count++; '+
		' '+
		'		if (_count === 5) { '+
		'			$deferred.reject(new Error(\'errored\')); '+
		'		} else { '+
		'			yield $self.doSomething(_count); '+
		'			$deferred.resolve(); '+
		'		} '+
		'	} '+
		'}); '
	);
}

var suite = vows.describe('Errors Extension');
suite.addBatch({
	'Test Deferred Errors': {
		topic: function () {
			var self = this;

			var example = new DeferredTest();

			example.doSomething().then(function () {
				self.callback(null, {object: example, value: value});
			}, function (error) {
				self.callback(null, error);
			});
		},

		'did error fire': function (topic) {
			assert.equal(topic instanceof Error, true);
		}
	}
});

if (supportsGenerators) {
	suite.addBatch({
		'Test Deferred Generator Errors': {
			topic: function () {
				var self = this;

				var example = new DeferredGeneratorTest();

				example.doSomething().then(function () {
					self.callback(null, {object: example, value: value});
				}, function (error) {
					self.callback(null, error);
				});
			},

			'did error fire': function (topic) {
				assert.equal(topic instanceof Error, true);
				assert.equal(topic.message, 'errored');
			}
		}
	});
}
exports.suite = suite;