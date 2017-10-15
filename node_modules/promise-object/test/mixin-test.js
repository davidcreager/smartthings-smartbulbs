var vows = require('vows'),
	assert = require('assert'),
	BlueBird = require('bluebird'),
	PromiseObject = require('../index')(BlueBird),
	EventsMixin = require('../mixins/events');

var MixinWithoutPseudoParams = {
	getName: function () {
		return this._name;
	}
};

var MixinWithPseudoParams = {
	getNameDeferred: function ($deferred, $self) {
		$deferred.resolve($self._name);
	}
};

var MixinWithInitializer = {
	initialize: function () {
		this._items = [];
	},

	getItems: function () {
		return this._items;
	}
};

var ClassWithMixinWithoutPseudoParams = PromiseObject.create(MixinWithoutPseudoParams, {
	initialize: function ($self, name) {
		this._name = name;
	}
});

var ClassWithMultipleMixins = PromiseObject.create(MixinWithoutPseudoParams, MixinWithPseudoParams, {
	initialize: function ($self, name) {
		this._name = name;
	}
});


var suite = vows.describe('Mixin Tests');

suite.addBatch({
	'Mixin Without Pseudo Params': {
		topic: new ClassWithMixinWithoutPseudoParams('james'),

		'is the name set': function (topic) {
			assert.equal(topic.getName(), 'james');
		}
	},

	'Multiple Mixins': {
		topic: new ClassWithMultipleMixins('james'),

		'is the name set': function (topic) {
			assert.equal(topic.getName(), 'james');
		}
	},

	'Multiple Mixins With Deferred Method': {
		topic: function () {
			var self = this,
				example = new ClassWithMultipleMixins('james');
			example.getNameDeferred().then(function (name) {
				self.callback(null, name);
			});
		},

		'is the name set': function (topic) {
			assert.equal(topic, 'james');
		}
	},

	'Mixin Using Initialize': {
		topic: function () {
			var Example = PromiseObject.create(MixinWithoutPseudoParams, MixinWithInitializer, {
				initialize: function ($self, name) {
					this._name = name;
				}
			});

			this.callback(null, new Example('james'));
		},

		'does error exist': function (topic) {
			assert.isArray(topic.getItems());
			assert.equal(topic.getName(), 'james');
		}
	},

	'Mixin Collision Initialize Error': {
		topic: function () {
			try {
				PromiseObject.create(MixinWithoutPseudoParams, {
					initialize: function ($self, name) {
						this._name = name;
					},
					getName: function () {
						return this._name;
					}
				});
			} catch (error) {
				this.callback(error);
			}
		},

		'does error exist': function (error, topic) {
			assert.instanceOf (error, Error);
			assert.equal(error.message, 'Mixin: "getName" collision, cannot override class methods');
		}
	}
});

exports.tests = suite;