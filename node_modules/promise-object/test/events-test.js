var vows = require('vows'),
	assert = require('assert'),
	BlueBird = require('bluebird'),
	PromiseObject = require('../index')(BlueBird),
	EventsMixin = require('../mixins/events');

var Class = PromiseObject.create(EventsMixin, {
	initialize: function () {

	},

	ping: function ($self) {
		setTimeout(function () {
			$self.dispatchEvent('pong');
		}, 0);
	}
});

var suite = vows.describe('Events Mixin Tests');

suite.addBatch({
	'Basic Event Test': {
		topic: function () {
			var self = this,
				example = new Class();

			example.addEventListener('pong', function () {
				self.callback(false, true);
			});

			example.ping();
		},

		'did we get pong': function (topic) {
			assert.isTrue(topic);
		}
	}
});

exports.tests = suite;