module.exports = function (Promise) {
	function isFunction (obj) {
		return 'function' == typeof obj || obj instanceof ExtendedMethod;
	}

	function deferPromise (Promise)  {
		var result = {};
		result.promise = new Promise(function(resolve, reject) {
			result.resolve = function(value) {
				resolve(value);
			};
			result.reject = function(value) {
				reject(value);
			};
		});
		return result;
	}

	function ExtendedMethod (name, func, superFunc) {
		this.name = name;
		this.func = func;
		this.superFunc = superFunc;
	}

	function makeMethod (func, scope, name) {
		var superFunc = (scope.prototype || scope)[name];

		if (!isFunction(func) || !isFunction(superFunc)) {
			return func;
		} else {
			return new ExtendedMethod(name, func, superFunc);
		}
	}

	function mapPseudoArgsToMethod (func, scope, name, params, superMethod) {
		function mapArgsArray (args, actualArgsArray) {
			for (var param in params) {
				if (typeof params[param] !== 'string') continue;

				if (params[param] === '$self') {
					args.push(scope);
				} else if (params[param] === '$class') {
						args.push(scope.__class__);
				} else if (params[param] === '$super') {
					if (!superMethod) throw new Error('$super argument for "' + name + '" has no super method');
					args.push(superMethod);
				} else if (params[param].substr(0,1) !== '$') {
					break;
				}
			}

			// ensure that config object is an object
			if (params.indexOf('$config') !== -1) actualArgsArray[0] = actualArgsArray[0] || {};
		}

		return function () {
			var args = [],
				actualArgsArray = Array.prototype.slice.call(arguments);

			if (params.indexOf('$deferred') !== -1) {
				var index = params.indexOf('$deferred');

				if (index !== 0) throw new Error('$deferred argument on the "' + name + '" method has an arguments index of ' + index + ' and needs to be 0');

				var resolver = deferPromise(Promise);

				args.push(resolver);

				mapArgsArray(args, actualArgsArray);

				args = args.concat(actualArgsArray);

				if (func.constructor.name === 'GeneratorFunction') {
					Promise.coroutine(func).apply(scope, args).then(null, function (error) {
						resolver.reject(error);
					});
				} else {
					func.apply(scope, args);
				}

				return resolver.promise;
			} else {
				mapArgsArray(args, actualArgsArray);

				args = args.concat(actualArgsArray);

				return func.apply(scope, args);
			}
		};
	}

	function getPseudoArgs (string) {
		var args = string.match(/^function\*? [^\(]*\(([a-z0-9_$,\s]+)\)/i);
		return (args && /\$(deferred|self|super|config|class)/.test(args[1])) ? args : false;
	}

	function mapMethod (func, scope, name, superMethod) {
		var funcString = func.toString(),
			args = getPseudoArgs(funcString);

		if (args) {
			args = args[1].replace(/\s/g, '').split(',');

			return mapPseudoArgsToMethod(func, scope, name, args, superMethod);
		} else if (func instanceof ExtendedMethod) {
			var superFunc,
				current = func.superFunc,
				chain = [];

			while (current instanceof ExtendedMethod) {
				chain.push(current);
				current = current.superFunc instanceof ExtendedMethod ? current.superFunc : null;
			}

			if (chain.length) {
				chain.reverse().forEach(function (current) {
					var superSuperFunc = mapMethod(current.superFunc, scope, current.name, superFunc);
					superFunc = mapMethod(current.func, scope, current.name, superSuperFunc);
				});
			} else {
				superFunc = func.superFunc;
			}

			if (!getPseudoArgs(String(superFunc))) superFunc = superFunc.bind(scope);

			superFunc = mapMethod(superFunc, scope, name);

			return mapMethod(func.func, scope, name, superFunc);
		} else {
			return func.bind(scope);
		}
	}

	function makeAndMapMethod (func, scope, name) {
		scope[name] = makeMethod(func, scope, name);
		return isFunction(scope[name]) ? mapMethod(scope[name], scope, name) : scope[name];
	}

	function addMixins (args) {
		var mixins = Array.prototype.slice.call(args, 0, -1),
			proto = args[args.length-1];

		mixins.forEach(function (mixin) {
			for (var method in mixin) {
				if (method === 'initialize') {
					if (!proto.___mixin_initializers___) proto.___mixin_initializers___ = [];
					proto.___mixin_initializers___.push(mixin[method]);
					continue;
				}

				if (typeof proto[method] !== 'undefined') throw new Error('Mixin: "' + method + '" collision, cannot override class methods');
				proto[method] = mixin[method];
			}
		});

		return proto;
	}

	var Class = function () {};
	Class.create = function () {
		var Self = this,
			instance = function (_Class) {
				var self = this;

				self.reopen = function (methods) {
					for (var method in methods) {
						self[method] = makeAndMapMethod(methods[method], self, method);
					}
				};

				if (_Class !== Class && isFunction(this.initialize)) {
					for (var method in this) {
						if (method.substr(0, 1) !== '$' && method !== '__class__' && isFunction(this[method])) {
							this[method] = mapMethod(this[method], this, method);
						}
					}

					if (this.___mixin_initializers___) {
						this.___mixin_initializers___.forEach(function (initializer) {
							initializer.apply(self);
						});
						delete this.___mixin_initializers___;
					}

					this.initialize.apply(this, arguments);
				}
			};

		// when Class is passed in the initialize method will not be run
		instance.prototype = new Self(Class);

		var proto = arguments.length > 1 ? addMixins(arguments) : arguments[0];

		for (var method in proto) {
			instance.prototype[method] = makeMethod(proto[method], instance, method);
		}

		for (method in instance.prototype) {
			if (method.substr(0, 1) === '$') {
				instance[method.substr(1)] = makeAndMapMethod(instance.prototype[method], instance.prototype, method);
			}
		}

		instance.prototype.constructor = instance.prototype.__class__ = instance;
		instance.extend = this.extend || this.create;
		instance.reopen = function (methods) {
			for (var method in methods) {
				if (method === 'initialize') {
					instance.prototype[method] = makeMethod(methods[method], instance.prototype, method);
				} else {
					instance[method] = makeAndMapMethod(methods[method], instance.prototype, '$' + method);
				}
			}
		};

		return instance;
	};

	return Class;
};