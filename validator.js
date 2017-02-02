function Validator() {
	this._validations = [];
	this._status = {};
}

Validator.prototype = {
	constructor: Validator,
	/**
	 *
	 * @param {Object|String} group
	 * @param {Function} fn
	 * @return {Function} 
	 */
	register: function (group, fn) {
		if (typeof group === "function") {
			fn = group;
		}

		this._validations.push({
			group: group,
			validateFn: fn
		});

		var me = this;
		return function() {
			me.unregister(group, fn);
		};
	},
	/**
	 * @param group
	 * @param fn
	 */
	unregister: function (group, fn) {
		this._validations = this._validations.filter(function(tuple) {
		 return !(tuple.group === group &&  tuple.validateFn === fn);
		});
	},
	validate: function (fn) {
		var me = this;
		return this._validations.filter(fn || Boolean).every(function(tuple) {
			var res = tuple.validateFn();
			res = (typeof res === 'object') ? res : {value: res};
			me._status = {
				group: tuple.group,
				value: res.value,
				msg: res.msg
			};
			return me._status.value;
		});
	},
	getStatus: function () {
		return this._status;
	}
};

/**
* ArrayOf({
*   node: HTMLElement|String,
*   instance: instanceOf(Validator)
* })
* @type {Array}
*/
var instances = [];

Validator.getInstance = function(form) {
	var node = form._node || form.element || form;

	if (!node) {
		throw new Error("please pass a [form instance] or [string] to validator.getInstance..");
	}

	// find if exist
	var filtered = instances.filter(function(tuple) {
		return tuple.node === node;
	});

	if (filtered[0]) return filtered[0].instance;

	var instance = new Validator();
	instances.push({
		node: node,
		instance: instance
	});

	return instance;
};

Validator._instances = instances;

module.exports = Validator;
