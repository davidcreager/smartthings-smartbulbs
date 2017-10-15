## promise-object [![Build Status](https://travis-ci.org/icodeforlove/node-promise-object.png?branch=master)](https://travis-ci.org/icodeforlove/node-promise-object)
provides a base object that gives you the ability to create promise methods just by setting the first parameter to $deferred and also binds those methods to the instance. It also allows you to extend any method and use mixins.

promise-object is very tiny - 1.3KB gzipped (3.1KB not gzipped)

## installation
	npm install promise-object

## pseudo params
there are a few rules with these params
* if you want to use **$deferred** it MUST be the first param
* any other pseudo param must be before any real params

these pseudo params are supported
* **$deferred** converts the method into a deferred method
* **$super** returns the parent method
* **$class** returns the class
* **$self** alternative to var self = this;
* **$config** ensures that the first argument is an object

## $config
helper that makes working with $config objects a little easier

```javascript
var Promise = require('bluebird'),
	PromiseObject = require('promise-object')(Promise);

var User = PromiseObject.create({
	initialize: function ($config) {
		this._name = $config.name;
	}
});

new User({name: 'joe'});
new User(); // this does not error out because $config was replaced with an empty object
```

## class / instance methods
you can specify class methods by placing a $ in front of the method like this

```javascript
var Class = PromiseObject.create({
	initialize: function ($class) {
		$class.method(); // returns 'class method'

		this.method(); // returns 'instance method'
	},

	$method: function () {
		return 'class method';
	},

	method: function () {
		return 'instance method';
	}
});
```

this would allow you to call the class method via `Class.method`

## $deferred / promises
promoise-object is promise library agnostic, you initialize the wrapper by passing in the promise library you are using.

below is an example of using promises and showing errors

```javascript
var Promise = require('bluebird'),
	PromiseObject = require('promise-object')(Promise);

var User = PromiseObject.create({
	initialize: function (name) {
		this._name = name;
	},

	getInfo: function ($deferred, error) {
		setTimeout(function () {
			if (error) {
				$deferred.reject(new Error('Something went wrong'));
			} else {
				$deferred.resolve({age: 12});
			}
		}, 1000);
	}
});

var joe = new User('joe');
joe.getInfo(false).then(
	function (info) {
		console.log(info);
	},
	function (error) {
		console.log(error);
	}
);
```

## deferred generators

if you are using a promise library that has `coroutine` support (like bluebird) you can do the following

```javascript
getInfo: function *($deferred) {
	var one = yield this.getSomething();
	$deferred.resolve(one);
}
```

## extending
any method can be extended upon, **$super** is used to request the parent method
```javascript
var Promise = require('bluebird'),
	PromiseObject = require('promise-object')(Promise);

var User = PromiseObject.create({
	initialize: function (name) {
		this._name = name;
	},

	getInfo: function ($deferred) {
		setTimeout(function () {
			$deferred.resolve({age: 12});
		}, 0);
	}
});

var Admin = User.extend({
	initialize: function ($super, name) {
		$super(name);
	},

	getInfo: function ($deferred, $super) {
		$super().then(function (info) {
			info.moreStuff = 123;

			$deferred.resolve(info);

		}, $deferred.reject);
	}
});

var joe = new Admin('joe');
joe.getInfo().then(function (info) {
	console.log(info);
});
```

## reopen
you can add methods to an instance by passing them via `.reopen` like this

```javascript
var user = new User();
user.reopen({
	getName: function ($deferred, $self) {
		setTimeout(function () {
			$deferred.resolve($self._name);
		}, 1000);
	}
});
```

and you can add methods to a class like this

```javascript
User.reopen({
	getName: function ($deferred, $self) {
		setTimeout(function () {
			$deferred.resolve($self._name);
		}, 1000);
	}
});
```

when you reopen a method that already exists you gain access to `$super`

## mixins
```javascript
var Promise = require('bluebird'),
	PromiseObject = require('promise-object')(Promise);

var Mixin =  {
	getRandomNumber: function () {
		return Math.random();
	}
};

var Mixin2 = {
	getRandomNumberDeferred: function ($deferred) {
		$deferred.resolve(Math.random());
	}
};

var Class = PromiseObject.create(Mixin, Mixin2, {
	initialize: function () {
	}
});

// examples
var example = new Class();

console.log(example.getRandomNumber());

example.getRandomNumberDeferred().then(function (number) {
	console.log(number);
});
```

mixins should only use initialize to store instance vars

```javascript
var Mixin =  {
	initialize: function () {
		this._tags = [];
	},

	hasTag: function (tag) {
		return this._tags.indexOf(tag) !== -1;
	},

	addTag: function (tag) {
		if (this.hasTag(tag)) return;

		this._tags.push(tag);
	}
};
```
