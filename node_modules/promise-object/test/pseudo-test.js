var vows = require('vows'),
	assert = require('assert'),
	BlueBird = require('bluebird'),
	PromiseObject = require('../index')(BlueBird);

var ClassWithPseudoInit = PromiseObject.create({
	initialize: function ($self, name) {
		this._name = name;
	},

	getName: function () {
		return this._name;
	}
});

var ExtendedClassWithPseudoInit = ClassWithPseudoInit.extend({
	initialize: function ($super, name) {
		$super(name);
	}
});

var ClassWithNoPseudoParams = PromiseObject.create({
	initialize: function (name) {
		this._name = name;
	},

	getName: function () {
		return this._name;
	}
});

var ExtendedClassWithNoPseudoParams = ClassWithNoPseudoParams.extend({
	initialize: function ($super, name) {
		$super(name);
	}
});

var BadPseudoSuperParam = PromiseObject.create({
	initialize: function ($super, name) {
		$super(name);
	}
});

var suite = vows.describe('Pseudo Param Tests');

suite.addBatch({
	'Init Class With Pseudo Params': {
		topic: new ClassWithPseudoInit('james'),

		'is the name set': function (topic) {
			assert.equal(topic.getName(), 'james');
		}
	},

	'Init Class Without Pseudo Params': {
		topic: new ClassWithNoPseudoParams('bob'),

		'is the name set': function (topic) {
			assert.equal(topic.getName(), 'bob');
		}
	},

	'Init Extended Class With Pseudo Params': {
		topic: new ExtendedClassWithPseudoInit('joe'),

		'is the name set': function (topic) {
			assert.equal(topic.getName(), 'joe');
		}
	},

	'Init Extended Class Without Pseudo Params': {
		topic: new ExtendedClassWithNoPseudoParams('sally'),

		'is the name set': function (topic) {
			assert.equal(topic.getName(), 'sally');
		}
	},

	'Bad $super usage': {
		topic: function () {
			try {
				new BadPseudoSuperParam();
			} catch(error) {
				this.callback(error);
			}
		},

		'is the name set': function (error, topic) {
			assert.equal(error.message, '$super argument for "initialize" has no super method');
		}
	}
});

exports.tests = suite;