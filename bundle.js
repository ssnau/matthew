(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
function clone(item) {
    if (!item) { return item; } // null, undefined values check

    var types = [ Number, String, Boolean ], 
        result;

    // normalizing primitives if someone did new String('aaa'), or new Number('444');
    types.forEach(function(type) {
        if (item instanceof type) {
            result = type( item );
        }
    });

    if (typeof result == "undefined") {
        if (Object.prototype.toString.call( item ) === "[object Array]") {
            result = [];
            item.forEach(function(child, index, array) { 
                result[index] = clone( child );
            });
        } else if (typeof item == "object") {
            // testing that this is DOM
            if (item.nodeType && typeof item.cloneNode == "function") {
                var result = item.cloneNode( true );    
            } else if (!item.prototype) { // check that this is a literal
                if (item instanceof Date) {
                    result = new Date(item);
                } else {
                    // it is an object literal
                    result = {};
                    for (var i in item) {
                        result[i] = clone( item[i] );
                    }
                }
            } else {
                // depending what you would like here,
                // just keep the reference, or create new object
                if (false && item.constructor) {
                    // would not advice to do that, reason? Read below
                    result = new item.constructor();
                } else {
                    result = item;
                }
            }
        } else {
            result = item;
        }
    }

    return result;
}

module.exports = clone;

},{}],2:[function(require,module,exports){
function isArray(a) { return !!a && a.indexOf && a.slice && a.splice; }
function each(array, fn) {
  if (isArray(array)) {
    for (var i = 0; i < array.length; i++) fn(array[i], i);
  } else {
    if (typeof array === 'object') {
      Object.keys(array).forEach(function(key) {
        fn(array[key], key);
      });
    }
  }
}
module.exports = each;

},{}],3:[function(require,module,exports){
var Scope = require('./scope');
var Validator = require('./validator');
var parser = require('./ng-parse');
var each = require('./each');
var SCOPE_ATTR = "m-scope";
var NODE_INSTANCE = '__M_NODE_INSTANCE';
var eachId = 0;
var mCache = {};

var isEventSupported = (function(){
  var TAGNAMES = {
    'select':'input','change':'input', 'input': 'input',
    'submit':'form','reset':'form',
    'error':'img','load':'img','abort':'img'
  }
  function isEventSupported(eventName) {
    var el = document.createElement(TAGNAMES[eventName] || 'div');
    eventName = 'on' + eventName;
    var isSupported = (eventName in el);
    if (!isSupported) {
      el.setAttribute(eventName, 'return;');
      isSupported = typeof el[eventName] == 'function';
    }
    el = null;
    return isSupported;
  }
  return isEventSupported;
})();


function Node(element) {
  this.element = element;
  element[NODE_INSTANCE] = this;
}
Node.addMethod = function (name, method) {
  Node.prototype[name] = method;
}
Node.create = function (str) {
  var div = document.createElement('div');
  div.innerHTML = str;
  return new Node(div.firstChild);
}
Node.isNode = function (node) {
  return node instanceof Node;
}

function addEvent(evnt, elem, func) {
  if (elem.addEventListener) {  // W3C DOM
    elem.addEventListener(evnt,func,false);
  } else if (elem.attachEvent) { // IE DOM
    elem.attachEvent("on"+evnt, func);
  } else { // No much to do
    elem[evnt] = func;
  }
}
function removeEvent(event, elem, func) {
  if (elem.removeEventListener) {  // W3C DOM
    elem.addEventListener(evnt,func,false);
  } else if (elem.detachEvent) { // IE DOM
    elem.attachEvent("on"+evnt, func);
  }
}

each({
  set: function (name, val) {
    if (name == 'value' || name == 'checked' || name == 'className') this.element[name] = val;
    this.setAttribute(name, val);
  },
  get: function (name) {
    if (name == 'value' || name == 'checked' || name == 'className') return this.element[name];
    var ret = this.element[name] || this.getAttribute(name); 
    if (name == 'children' && ret) {
      return Y.all(ret);
    }
    return ret;
  },
  on: function (name, callback) {
    var elem = this.element;
    var ie = !!elem.attachEvent;
    var events = [];
    switch (name) {
      case 'valuechange':
       events = isEventSupported('input') ? ['input', 'paste'] : ['keyup', 'paste'];
      break;
      default:
        events = [name];
    }

    each(events, function (event) { addEvent(event, elem, callback); });
    return function () {
      each(events, function (event) { removeEvent(event, elem, callback); })
    }
  },
  next: function () {
    return Y.one(this.element.nextElementSibling || this.element.nextSibling);
  },
  contains: function (node) {
    var elem = Y.one(node).element;
    var target = this.element;
    while (elem) {
      if (elem == target) return true;
      elem = elem.parentNode;
    }
    return false;
  },
  addClass: function (name) {
    var n = this.element;
    var classes = n.className.split(/\s+/).filter(Boolean);
    if (classes.some(function (c) { c == name })) return;
    n.className = classes.concat(name).join(' ');
  },
  removeClass: function (name) {
    var n = this.element;
    var classes = n.className.split(/\s+/);
    n.className = classes.filter(function(x) { x != name; }).join(' ');
  },
  // MAY BE BUGGY
  show: function () {
    this.element.style.display = '';
  },
  hide: function () {
    this.element.style.display = 'none';
  },
  hasAttribute: function (name) {
    return this.element.hasAttribute(name);
  },
  getAttribute: function (name) {
    return this.element.getAttribute(name);
  },
  setAttribute: function (name, val) {
    return this.element.setAttribute(name, val);
  },
  removeAttribute: function (name) {
    return this.element.removeAttribute(name);
  },
  remove: function () {
    return this.element.remove();
  },
  ancestor: function (tagName) {
    var ele = this.element;
    if (!tagName) return Y.one(ele.parentNode);
    while (true) {
      if (!ele) return;
      if (ele.tagName == 'tagName') return Y.one(ele);
      ele = ele.parentNode;
    }
  },
  insert: function (node, pos) {
    var thisEle = this.element;
    var nodeEle = node.element || node;
    if (pos == 'after') return thisEle.parentNode.insertBefore(nodeEle, thisEle.nextSibling);
    return thisEle.insertBefore(node);
  },
  setHTML: function (str) {
    this.element.innerHTML = str;
  },
  getDOMNode: function () {
    return this.element;
  }
}, function (val, key) {
  Node.addMethod(key, val);
});
var Y = {
  one: function (element) {
    if (!element) return;
    if (element.element && element.getDOMNode) return element; // already a Node instance
    if (element[NODE_INSTANCE]) return element[NODE_INSTANCE];
    return new Node(element);
  },
  all: function (array) {
    // should deal with array-like
    var arr = [];
    for (var i = 0; i < array.length; i++) {
      arr.push(new Node(array[i]));
    }
    arr.each = arr.forEach;
    return arr;
  }
};

function htmlEscape(unsafe) {
	return unsafe
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}
var ie = (function(){
  try {
    var undef,
        v = 3,
        div = document.createElement('div'),
        all = div.getElementsByTagName('i');
    while (
        div.innerHTML = '<!--[if gt IE ' + (++v) + ']><i></i><![endif]-->',
        all[0]
    );
    return v > 4 ? v : undef;
  } catch (e) {
    return 0;
  }
}());

/**
 * 自动找出以$$开头的变量
 * @param expr
 * @returns {string[]}
 */
function getMagicVars(expr) {
    if (!expr) return [];
    if (mCache[expr]) return mCache[expr];

    var vars = [];
    (expr + '').replace(/\$\$(\w+)/g, function(match, p1) {
        vars.push(p1);
    });
    return vars;
}

function isArray(a) { return !!a && a.indexOf && a.slice && a.splice; }

/**
 * 取obj上的自有属性，防止查找原型链，向未来兼容。
 * 如obj.watch在其它浏览器下是undefined，但FF下会是一个函数。
 * @param obj
 * @param prop
 * @param defaultVal
 * @returns {*}
 */
function getOwn(obj, prop, defaultVal) {
    if (!obj) return defaultVal;
    if (!obj.hasOwnProperty(prop)) return defaultVal;
    return obj[prop];
}

/**
 * 查找表达式里是否有$${name}，如果有，则自动执行$${name} = node.get({name})
 * 例如：将有 scope.$$value = node.get('value')
 *
 * @param expr
 * @param scope
 * @param node
 */
function handleMagicVars(expr, scope, node) {
    getMagicVars(expr).forEach(function(attName){
        scope['$$' + attName] = node.get(attName);
    });
}

/**
 * Example:
 * 只有在scope.selected == 这个option的value时，才是selected.
 * <option value="1" m-selected="$this.get('value') == selected" />
 * <option value="1" m-selected="$$value == selected" />
 */
function wrapExpr(expr, node) {
    var ret = function () {
        this.$this = node;
        handleMagicVars(expr, this, node);
        var r = this.$eval(expr);
        this.$this = null;
        return r;
    };
    ret.toString = function() {return expr;}; // for debug reason
    return ret;
}

/**
 * 不适合在页面显示出来的变量。
 * undefined, NaN, null
 */
function isBadSymbol(val) {
    return (val === void 0 || val !== val || val === null);
}

var binders = {
    'm-init': function (node, scope, expr) {
        scope.$eval(expr);
    },
    'm-html': function (node, scope, expr) {
        scope.$watch(expr, function (val) {
            var v = isBadSymbol(val) ? "" : val;
            node.setHTML(htmlEscape(v + ''));
        });
    },
    'm-unsafe-html': function (node, scope, expr) {
        scope.$watch(expr, function (val) {
            node.setHTML(val);
        });
    },
    'm-show': function (node, scope, expr) {
        scope.$watch(expr, function (val) {
            node[val ? 'show' : 'hide']();
        });
    },
    'm-disabled': function (node, scope, expr) {
        scope.$watch(expr, function(val){
            node.set('disabled', !!val);
        });
    },
    'm-class': function (node, scope, expr) {
        scope.$watch(expr, function (val) {
            node.set('className',
                Object
                    .keys(val || {})
                    .filter(function (key) {
                        return val[key];
                    })
                    .join(' ')
            );
        });
    },
    /**
     * m-value和m-checked需要特殊关照。
     * 因为用户的输入，点击会改变node.get('value')、
     * node.get('checked')，所以需要在每次$digest
     * 同步value/checked到节点上，保证数据与节点同步。
     */
    'm-value': function (node, scope, expr) {
        scope.$watch(function() {
            var val = scope.$eval(expr);
            if (String(node.get('value')) !== String(val)) {
                node.set('value', isBadSymbol(val) ? '' : val);
            }
            // Special logic for select under IE6,7,8,9,10
            if (ie > 0 && node.get('tagName') === "SELECT") {
                var selectElem = node.getDOMNode();
                var options = selectElem.options;
                for (var i = 0; i < options.length; i++) {
                    if (String(options[i].value) === String(val)) {
                        selectElem.selectedIndex = i;
                    }
                }
            }
        });
    },
    'm-checked': function (node, scope, expr) {
        scope.$watch(function(){
            var val = scope.$eval(expr);
            if (node.get('checked') !== val) {
                node.set('checked', val);
            }
        });
    },
    /**
     * m-defaultvalue
     * 仅仅在初始时赋值。
     */
    'm-defaultvalue': function(node, scope, expr) {
        var unwatch = scope.$watch(expr, function(val){
            if (!isBadSymbol(val)) {
                node.set('value', val);
                unwatch();
            }
        });
    },
    'm-attr': function (node, scope, expr) {
        scope.$watch(expr, function(val) {
            each(val, function(val, key) {
               node.setAttribute(key, val);
            });
        });
    },
    'm-repeat': function (node, scope) {
        function strip(str) {
            return str.trim().replace(/^\(|\)$/, '').trim();
        }
        // parse
        var expression, keyName, valName;
        var origExp = node.getAttribute('m-repeat') || node.getAttribute('m-repeat');
        var match = origExp.match(/(.*) in (.*) (track by (.*))/) || origExp.match(/(.*) in (.*)/);
        var trackExp;
        if (match) {
            var pair = match[1].split(',');
            expression = match[2];
            keyName = strip(pair.length > 1 ? pair[0] : "__");
            valName = strip(pair.length > 1 ? pair[1] : pair[0]);
            trackExp = match[4] || '$index';
        } else {
            throw new Error(origExp + ' is not a valid m-repeat statement. please follow [val in attr]/ [(key, val) in attr] convention.');
        }

        // prepare template
        var id = ++eachId;
        var tmplId = 'data-m-template-' + id;

        node.removeAttribute('m-repeat');
        node.removeAttribute('m-repeat');

        node.setAttribute('data-m-id', id);
        var html = node.get('outerHTML');

        var templateNode = Node.create(
                '<script type="text/x-m-repeat-template" id="$id">/* expression: $expr */\n$html</script>'
                    .replace('$id', tmplId)
                    .replace('$html', html)
                    .replace('$expr', origExp)
        );
        node.insert(templateNode, "after");
        node.remove();

        var idMap = {
            // [trackId] : {scope: Scope, node: Y.Node}
        };
        // track id helper function
        function TempLocal() {}
        TempLocal.prototype = scope;
        var trackFn = parser.parse(trackExp);
        var getId = function(val, index) {
            var local = new TempLocal();
            local[valName] = val;
            local['$index'] = index;
            return trackFn(local);
        };

        // watch changes
        scope.$watch(expression, function(array) {
            // 1. 判断idMap中的元素是否在新的array中存在，如不存在，删除之.
            var toBeDeleteIds = [];
            var newMap = {};
            each(array, function(val, index) {
                newMap[getId(val, index)] = val;
            });
            each(idMap, function(val, key) {
                if (!newMap.hasOwnProperty(key)) {
                    toBeDeleteIds.push(key);
                }
            });
            each(toBeDeleteIds, function(key){
                idMap[key].scope.$destory();
                idMap[key].node.remove(true);
                delete idMap[key];
            });

            // 2. 遍历新的array
            var count = 0;
            var len = Array.isArray(array) ? array.length : Object.keys(array || {}).length;
            var baseNode = templateNode;
            each(array, function(val, key) {
                var trackId = getId(val, key);
                var childScope, node;
                if (idMap[trackId]) {
                    childScope = idMap[trackId].scope;
                    node = idMap[trackId].node;
                } else {
                    childScope = Scope.getInheritInstance(scope);
                    node = Node.create(html);
                }
                idMap[trackId] = {scope: childScope, node: node};
                childScope[valName] = val;
                childScope[keyName] = key;
                // magic vars
                childScope.$set({
                    '$index': key,
                    '$first': count === 0,
                    '$last' : count === len - 1,
                    '$middle': (count > 0 && count < len - 1),
                    '$even' : count % 2 === 0,
                    '$odd'  : count % 2 !== 0
                });
                matthew.init(node, childScope);
                if (baseNode.next() !== node) {
                    baseNode.insert(node, 'after');
                }
                baseNode = node;
                count++;
            });
        });

        return false; // 终止其它helper
    },
    /**
     * Example:
     *
     * <input
     *    m-validate="{
     *               events: 'change|blur',
     *               validation: 'checkLength($this)'
     *               }" />
     *
     *  scope.checkLength = function (node, min, max) {
     *     var value = node.get('value');
     *
     *     var valid = value.length >= min && value.length <= max;
     *     // 设置可设置其它东西
     *     // do something here...
     *
     *     // 遵循m-validator规范
     *     // 1. 返回true/false, true代表通过
     *     // 2. 返回 {value: boolean, msg: string}，value的值代表是否通过,msg为成功|错误信息
     *     return valid;
     *  }
     *
     *
     * @param node
     * @param scope
     * @param expr
     */
    'm-validate': function (node, scope, expr) {
        var config = scope.$eval(expr);
        var validation = config.validation;
        if (!validation) {
            throw new Error("The m-validate config should contain validation field");
        }
        var validate = function () {
            // 如果这个节点不在DOM里，则跳过对其验证
            if (!Y.one(document.body).contains(node)) return true;
            // 如果这个节点为disabled状态，则跳过对其验证
            if (node.get('disabled')) return true;

            scope.$this = node;
            var valid = node.scopeEval(validation);
            scope.$this = null;
            node.removeClass('m-validate-valid');
            node.removeClass('m-validate-invalid');
            node.addClass((valid === true || (valid && valid.value === true)) ? "m-validate-valid" : "m-validate-invalid");
            scope.$apply();
            return valid;
        };

        scope.$watch(getOwn(config, 'watch'), validate, true);

        // bind to validator
        var ndForm = node.ancestor('form');
        if (ndForm) {
            Validator
              .getInstance(ndForm)
              .register(config.group, validate);
        }

        // bind to events
        (getOwn(config, 'event') || getOwn(config, 'events') || '').split('|').map(function(eventName) {
            return eventName.trim().replace(/^on/, '');
        }).forEach(function(eventName) {
            bindEvent(eventName, node, validate);
        });
    },
    'm-model': function (node, scope, modelName) {
        function equal(a, b) {
            return String(a) === String(b);
        }

        function contains(arr, val) {
            return !!arr.filter(function (v) {
                return equal(v, val);
            }).length;
        }

        var strategies = {
            "input#radio": function (node, val) {
                node.set('checked', equal(node.get('value'), val));
            },
            "input#checkbox": function (node, val) {
                node.set(
                    'checked',
                    Array.isArray(val) ? contains(val, node.get('value')) : equal(val, node.get('value'))
                );
            },
            // https://developer.mozilla.org/en-US/docs/Web/API/HTMLSelectElement/type
            "select#select-one": function (node, val) {
                node.set('value', val);
            },
            "select#select-multiple": function (node, val) {
                var options = node.get('options');
                Y.all(options).each(function (ndOption) {
                    ndOption.set(
                        'selected',
                        contains(val, ndOption.get('value'), val)
                    );
                });
            },
            'default': function (node, val) {
                if (!equal(node.get('value'), val)) {
                    node.set('value', val);
                }
            }
        };

        scope.$watch(modelName, function (val) {
            var strategy = strategies[(node.get('tagName') + "#" + node.get('type')).toLowerCase()] || strategies['default'];
            strategy(node, val);
        });
    }
};

var priorites = {
    'm-repeat': 999,
    '*': 100
};


var eventNormalizer = {
    'change': function (node, callback) {
        var eventname = "change";

        // http://blog.csdn.net/huli870715/article/details/7887818
        if (/checkbox|radio/.test(node.get('type')) && (ie > 0 && ie < 9)) {
            node.on('propertychange', function(e) {
                if (e._event.propertyName === 'checked') {
                    callback(e);
                }
            });
            return;
        }
        // http://yuilibrary.com/yui/docs/event/valuechange.html
        if (node.get('type') === 'text' || node.get('type') === 'password' || node.get('tagName') === 'TEXTAREA') {
            eventname = 'valuechange';
        }
        node.on(eventname, callback);
    }
};



/**
 * General event expression bind helper function
 * @param eventName
 * @param node
 * @param expr
 */
function bindEvent(eventName, node, expr) {
    var eventCallback = function (e) {
        var scope = node.getScope();
        scope.$event = e;
        scope.$eval(expr);
        scope.$event = null;
        scope.$apply();
    };

    if (eventNormalizer[eventName]) {
        eventNormalizer[eventName](node, eventCallback);
    } else {
        node.on(eventName, eventCallback);
    }
}

/**
 * attributes是不区分大小写的，还是在这里指明好了，统一强制转成小写。
 * @param name
 * @returns {*}
 */
function getBinder(name) {
    return binders[name.toLowerCase()];
}

var matthew = {
    init: function (ele, scope) {
        var root = Y.one(ele);
        if (!root) return;

        if (scope) {
            root._$scope = scope;
        }

        var PAT_BIND_EVENT_ATTR1 = /^m-on\w+/;

        traverse(root, function (node) {
            if (node.hasAttribute(SCOPE_ATTR)) {
                createScopeOnElement(node);
            }

            // 防止多次绑定
            if (node._$binded) return;
            node._$binded = true;

            var attributes = node.getDOMNode().attributes;
            if (!attributes) return; // 一些情况下attributes为null.

            // 找到需要bind的属性
            var bindAttrs = [];
            for (var i = 0; i < attributes.length; i++) {
              var attr = attributes[i];
              var attrName = attr.name;
              if (getBinder(attrName)) {
                  bindAttrs.push({
                      name: attrName,
                      priority: priorites[attrName] || priorites['*']
                  });
              } else if (PAT_BIND_EVENT_ATTR1.test(attrName)) {
                  bindAttrs.push({
                      name: attrName,
                      priority: priorites['*']
                  });
              }
            }

            // 按优先级排序, 从大到小
            bindAttrs.sort(function(a, b) {
               return b.priority - a.priority;
            });

            // 绑定，如果其中有一个binder返回了false, 则终止所有剩下的binder
            var stop = false;
            bindAttrs.forEach(function(attr) {
                if (stop) return;

                var attrName = attr.name;
                var expr = wrapExpr(node.getAttribute(attrName), node);
                // 普通binder
                if (getBinder(attrName)) {
                    stop = (getBinder(attrName))(node, node.getScope(), expr) === false;
                    return;
                }

                // 事件binder
                var eventName = attrName.slice('m-on'.length);
                bindEvent(eventName, node, expr);
            });
        });
    },
    /**
     * register a custom binder.
     * @param name
     * @param callback
     * @param config
     */
    register: function (name, callback, config) {
        name = name.toLowerCase();
        binders[name] = callback;
        config = config || {};
        priorites[name] = config.priority || priorites['*'];
    },
    getScope: function (element) {
      return Y.one(element || document.body).getScope();
    },
    Y: Y
};

// init root scope for document.body
Y.one(document.body)._$scope = Scope.getRootInstance();

function getScope() {
    var node = this;
    while (node) {
        if (node.hasAttribute(SCOPE_ATTR) && !node._$scope) {
            createScopeOnElement(node);
        }
        if (node._$scope) return node._$scope;
        node = node.ancestor();
    }
    return Scope.getRootInstance();
}

// augment YUI node
Node.addMethod('getScope', getScope);
Node.addMethod('scope', getScope);
// for debug reason
Node.addMethod('scopeEval', function (expr) {
  return this.getScope().$eval(wrapExpr(expr, this));
});

/**
 * <div m-scope></div> ==> 建立一个与父级拥有继承关系的scope
 * <div m-scope="{}"></div> ==> 建立一个与外界完全独立的scope
 * <div m-scope="{name: 'nickname'}"></div> ==> 建立一个scope.name 恒等于 outerScope.name的scope
 *
 * @param ele
 */
function createScopeOnElement(ele) {
    var node = Y.one(ele);
    if (!node || node._$scope) return;
    var isIsolate = node.getAttribute(SCOPE_ATTR) || false;
    var outerScope = node.ancestor() && node.ancestor().getScope();
    node._$scope = isIsolate ?
        Scope.getIsolateInstance() :
        Scope.getInheritInstance(outerScope);
    if (isIsolate) {
        bindScopeAttributes(node, outerScope);
    }
}

/**
 * 内外部单向scope传递数据。
 * 如：
 * <div m-scope='["name=profile.name","age=profile.age"]'> ... </div>
 * 只要outerScope.profile.name变成'abc'，那么scope.name则会立刻变成'abc'.
 *
 * @param ele
 */
function bindScopeAttributes(node, outerScope) {
    var scope = node.getScope();
    var scopeConfig = JSON.parse(node.getAttribute(SCOPE_ATTR));

    if (!outerScope || !Array.isArray(scopeConfig)) return;

    scopeConfig.forEach(function (val) {
        if (!('' + val).trim()) return;

        // "attr1=attr2" 表示父attr2的改变会同步到子的attr1上
        // "attr1" 表示父attr1的改变会同步到子attr1上
        var pair = [val, val];

        if (val.indexOf('=') > 0) {
            pair = val.split('=');
        }

        var attr1 = pair[0];
        var attr2 = pair[1];

        scope[attr1] = outerScope[attr2];
        outerScope.$watch(attr2, function (value) {
            scope.$set(attr1, value);
        });
    });
}

// 遍历节点
function traverse(root, callback) {
  function dfs(node) {
    if (callback(node) === false) return;

    var children = node.get('children');
    if (!children) return;

    children.each(function (ndChild) {
      dfs(ndChild);
    });
  }

  dfs(root);
}

if (typeof window !== 'undefine') window.matthew = matthew;
module.exports = matthew;

},{"./each":2,"./ng-parse":4,"./scope":5,"./validator":6}],4:[function(require,module,exports){
var NODE_TYPE_ELEMENT = 1;
var NODE_TYPE_TEXT = 3;
var NODE_TYPE_COMMENT = 8;
var NODE_TYPE_DOCUMENT = 9;
var NODE_TYPE_DOCUMENT_FRAGMENT = 11;

function noop(){}
var lowercase = function(string) {return isString(string) ? string.toLowerCase() : string;};
var hasOwnProperty = Object.prototype.hasOwnProperty;
var toString = Object.prototype.toString;

/**
 * @ngdoc function
 * @name angular.uppercase
 * @module ng
 * @kind function
 *
 * @description Converts the specified string to uppercase.
 * @param {string} string String to be converted to uppercase.
 * @returns {string} Uppercased string.
 */
var uppercase = function(string) {return isString(string) ? string.toUpperCase() : string;};


var manualLowercase = function(s) {
    /* jshint bitwise: false */
    return isString(s)
        ? s.replace(/[A-Z]/g, function(ch) {return String.fromCharCode(ch.charCodeAt(0) | 32);})
        : s;
};
var manualUppercase = function(s) {
    /* jshint bitwise: false */
    return isString(s)
        ? s.replace(/[a-z]/g, function(ch) {return String.fromCharCode(ch.charCodeAt(0) & ~32);})
        : s;
};
function toJson(obj, pretty) {
    if (typeof obj === 'undefined') return undefined;
    return JSON.stringify(obj, toJsonReplacer, pretty ? '  ' : null);
}

function toJsonReplacer(key, value) {
    var val = value;

    if (typeof key === 'string' && key.charAt(0) === '$' && key.charAt(1) === '$') {
        val = undefined;
    } else if (isWindow(value)) {
        val = '$WINDOW';
    } else if (value &&  document === value) {
        val = '$DOCUMENT';
    } else if (isScope(value)) {
        val = '$SCOPE';
    }

    return val;
}


// String#toLowerCase and String#toUpperCase don't produce correct results in browsers with Turkish
// locale, for this reason we need to detect this case and redefine lowercase/uppercase methods
// with correct but slower alternatives.
if ('i' !== 'I'.toLowerCase()) {
    lowercase = manualLowercase;
    uppercase = manualUppercase;
}

function minErr(module, ErrorConstructor) {
    ErrorConstructor = ErrorConstructor || Error;
    return function() {
        var code = arguments[0],
            prefix = '[' + (module ? module + ':' : '') + code + '] ',
            template = arguments[1],
            templateArgs = arguments,
            message, i;

        message = prefix + template.replace(/\{\d+\}/g, function(match) {
            var index = +match.slice(1, -1), arg;

            if (index + 2 < templateArgs.length) {
                arg = templateArgs[index + 2];
                if (typeof arg === 'function') {
                    return arg.toString().replace(/ ?\{[\s\S]*$/, '');
                } else if (typeof arg === 'undefined') {
                    return 'undefined';
                } else if (typeof arg !== 'string') {
                    return toJson(arg);
                }
                return arg;
            }
            return match;
        });

        return new ErrorConstructor(message);
    };
}
var $parseMinErr = minErr('$parse');

function extend(dst) {
    //var h = dst.$$hashKey;

    for (var i = 1, ii = arguments.length; i < ii; i++) {
        var obj = arguments[i];
        if (obj) {
            var keys = Object.keys(obj);
            for (var j = 0, jj = keys.length; j < jj; j++) {
                var key = keys[j];
                dst[key] = obj[key];
            }
        }
    }

    //setHashKey(dst, h);
    return dst;
}

/**
 * @ngdoc function
 * @name angular.forEach
 * @module ng
 * @kind function
 *
 * @description
 * Invokes the `iterator` function once for each item in `obj` collection, which can be either an
 * object or an array. The `iterator` function is invoked with `iterator(value, key, obj)`, where `value`
 * is the value of an object property or an array element, `key` is the object property key or
 * array element index and obj is the `obj` itself. Specifying a `context` for the function is optional.
 *
 * It is worth noting that `.forEach` does not iterate over inherited properties because it filters
 * using the `hasOwnProperty` method.
 *
 * Unlike ES262's
 * [Array.prototype.forEach](http://www.ecma-international.org/ecma-262/5.1/#sec-15.4.4.18),
 * Providing 'undefined' or 'null' values for `obj` will not throw a TypeError, but rather just
 * return the value provided.
 *
 ```js
 var values = {name: 'misko', gender: 'male'};
 var log = [];
 angular.forEach(values, function(value, key) {
   this.push(key + ': ' + value);
 }, log);
 expect(log).toEqual(['name: misko', 'gender: male']);
 ```
 *
 * @param {Object|Array} obj Object to iterate over.
 * @param {Function} iterator Iterator function.
 * @param {Object=} context Object to become context (`this`) for the iterator function.
 * @returns {Object|Array} Reference to `obj`.
 */

function forEach(obj, iterator, context) {
    var key, length;
    if (obj) {
        if (isFunction(obj)) {
            for (key in obj) {
                // Need to check if hasOwnProperty exists,
                // as on IE8 the result of querySelectorAll is an object without a hasOwnProperty function
                if (key != 'prototype' && key != 'length' && key != 'name' && (!obj.hasOwnProperty || obj.hasOwnProperty(key))) {
                    iterator.call(context, obj[key], key, obj);
                }
            }
        } else if (isArray(obj) || isArrayLike(obj)) {
            var isPrimitive = typeof obj !== 'object';
            for (key = 0, length = obj.length; key < length; key++) {
                if (isPrimitive || key in obj) {
                    iterator.call(context, obj[key], key, obj);
                }
            }
        } else if (obj.forEach && obj.forEach !== forEach) {
            obj.forEach(iterator, context, obj);
        } else {
            for (key in obj) {
                if (obj.hasOwnProperty(key)) {
                    iterator.call(context, obj[key], key, obj);
                }
            }
        }
    }
    return obj;
}

/** Type utitlity **/
function valueFn(value) {return function() {return value;};}

/**
 * @ngdoc function
 * @name angular.isUndefined
 * @module ng
 * @kind function
 *
 * @description
 * Determines if a reference is undefined.
 *
 * @param {*} value Reference to check.
 * @returns {boolean} True if `value` is undefined.
 */
function isUndefined(value) {return typeof value === 'undefined';}


/**
 * @ngdoc function
 * @name angular.isDefined
 * @module ng
 * @kind function
 *
 * @description
 * Determines if a reference is defined.
 *
 * @param {*} value Reference to check.
 * @returns {boolean} True if `value` is defined.
 */
function isDefined(value) {return typeof value !== 'undefined';}


/**
 * @ngdoc function
 * @name angular.isObject
 * @module ng
 * @kind function
 *
 * @description
 * Determines if a reference is an `Object`. Unlike `typeof` in JavaScript, `null`s are not
 * considered to be objects. Note that JavaScript arrays are objects.
 *
 * @param {*} value Reference to check.
 * @returns {boolean} True if `value` is an `Object` but not `null`.
 */
function isObject(value) {
    // http://jsperf.com/isobject4
    return value !== null && typeof value === 'object';
}


/**
 * @ngdoc function
 * @name angular.isString
 * @module ng
 * @kind function
 *
 * @description
 * Determines if a reference is a `String`.
 *
 * @param {*} value Reference to check.
 * @returns {boolean} True if `value` is a `String`.
 */
function isString(value) {return typeof value === 'string';}


/**
 * @ngdoc function
 * @name angular.isNumber
 * @module ng
 * @kind function
 *
 * @description
 * Determines if a reference is a `Number`.
 *
 * @param {*} value Reference to check.
 * @returns {boolean} True if `value` is a `Number`.
 */
function isNumber(value) {return typeof value === 'number';}


/**
 * @ngdoc function
 * @name angular.isDate
 * @module ng
 * @kind function
 *
 * @description
 * Determines if a value is a date.
 *
 * @param {*} value Reference to check.
 * @returns {boolean} True if `value` is a `Date`.
 */
function isDate(value) {
    return toString.call(value) === '[object Date]';
}


/**
 * @ngdoc function
 * @name angular.isArray
 * @module ng
 * @kind function
 *
 * @description
 * Determines if a reference is an `Array`.
 *
 * @param {*} value Reference to check.
 * @returns {boolean} True if `value` is an `Array`.
 */
var isArray = Array.isArray;

/**
 * @ngdoc function
 * @name angular.isFunction
 * @module ng
 * @kind function
 *
 * @description
 * Determines if a reference is a `Function`.
 *
 * @param {*} value Reference to check.
 * @returns {boolean} True if `value` is a `Function`.
 */
function isFunction(value) {return typeof value === 'function';}


/**
 * Determines if a value is a regular expression object.
 *
 * @private
 * @param {*} value Reference to check.
 * @returns {boolean} True if `value` is a `RegExp`.
 */
function isRegExp(value) {
    return toString.call(value) === '[object RegExp]';
}


/**
 * Checks if `obj` is a window object.
 *
 * @private
 * @param {*} obj Object to check
 * @returns {boolean} True if `obj` is a window obj.
 */
function isWindow(obj) {
    return obj && obj.window === obj;
}


function isScope(obj) {
    return obj && obj.$evalAsync && obj.$watch;
}


function isFile(obj) {
    return toString.call(obj) === '[object File]';
}


function isBlob(obj) {
    return toString.call(obj) === '[object Blob]';
}


function isBoolean(value) {
    return typeof value === 'boolean';
}


function isPromiseLike(obj) {
    return obj && isFunction(obj.then);
}
/**
 * @private
 * @param {*} obj
 * @return {boolean} Returns true if `obj` is an array or array-like object (NodeList, Arguments,
 *                   String ...)
 */
function isArrayLike(obj) {
    if (obj == null || isWindow(obj)) {
        return false;
    }

    var length = obj.length;

    if (obj.nodeType === NODE_TYPE_ELEMENT && length) {
        return true;
    }

    return isString(obj) || isArray(obj) || length === 0 ||
        typeof length === 'number' && length > 0 && (length - 1) in obj;
}


/**
 * Creates a new object without a prototype. This object is useful for lookup without having to
 * guard against prototypically inherited properties via hasOwnProperty.
 *
 * Related micro-benchmarks:
 * - http://jsperf.com/object-create2
 * - http://jsperf.com/proto-map-lookup/2
 * - http://jsperf.com/for-in-vs-object-keys2
 *
 * @returns {Object}
 */
function createMap() {
    return {}; //Object.create(null);
}
// Sandboxing Angular Expressions
// ------------------------------
// Angular expressions are generally considered safe because these expressions only have direct
// access to $scope and locals. However, one can obtain the ability to execute arbitrary JS code by
// obtaining a reference to native JS functions such as the Function constructor.
//
// As an example, consider the following Angular expression:
//
//   {}.toString.constructor('alert("evil JS code")')
//
// This sandboxing technique is not perfect and doesn't aim to be. The goal is to prevent exploits
// against the expression language, but not to prevent exploits that were enabled by exposing
// sensitive JavaScript or browser apis on Scope. Exposing such objects on a Scope is never a good
// practice and therefore we are not even trying to protect against interaction with an object
// explicitly exposed in this way.
//
// In general, it is not possible to access a Window object from an angular expression unless a
// window or some DOM object that has a reference to window is published onto a Scope.
// Similarly we prevent invocations of function known to be dangerous, as well as assignments to
// native objects.


function ensureSafeMemberName(name, fullExpression) {
    if (name === "__defineGetter__" || name === "__defineSetter__"
        || name === "__lookupGetter__" || name === "__lookupSetter__"
        || name === "__proto__") {
        throw $parseMinErr('isecfld',
                'Attempting to access a disallowed field in Angular expressions! '
                +'Expression: {0}', fullExpression);
    }
    return name;
}

function ensureSafeObject(obj, fullExpression) {
    // nifty check if obj is Function that is fast and works across iframes and other contexts
    if (obj) {
        if (obj.constructor === obj) {
            throw $parseMinErr('isecfn',
                'Referencing Function in Angular expressions is disallowed! Expression: {0}',
                fullExpression);
        } else if (// isWindow(obj)
            obj.window === obj) {
            throw $parseMinErr('isecwindow',
                'Referencing the Window in Angular expressions is disallowed! Expression: {0}',
                fullExpression);
        } else if (// isElement(obj)
            obj.children && (obj.nodeName || (obj.prop && obj.attr && obj.find))) {
            throw $parseMinErr('isecdom',
                'Referencing DOM nodes in Angular expressions is disallowed! Expression: {0}',
                fullExpression);
        } else if (// block Object so that we can't get hold of dangerous Object.* methods
            obj === Object) {
            throw $parseMinErr('isecobj',
                'Referencing Object in Angular expressions is disallowed! Expression: {0}',
                fullExpression);
        }
    }
    return obj;
}

var CALL = Function.prototype.call;
var APPLY = Function.prototype.apply;
var BIND = Function.prototype.bind;

function ensureSafeFunction(obj, fullExpression) {
    if (obj) {
        if (obj.constructor === obj) {
            throw $parseMinErr('isecfn',
                'Referencing Function in Angular expressions is disallowed! Expression: {0}',
                fullExpression);
        } else if (obj === CALL || obj === APPLY || obj === BIND) {
            throw $parseMinErr('isecff',
                'Referencing call, apply or bind in Angular expressions is disallowed! Expression: {0}',
                fullExpression);
        }
    }
}

//Keyword constants
var CONSTANTS = createMap();
forEach({
    'null': function() { return null; },
    'true': function() { return true; },
    'false': function() { return false; },
    'undefined': function() {}
}, function(constantGetter, name) {
    constantGetter.constant = constantGetter.literal = constantGetter.sharedGetter = true;
    CONSTANTS[name] = constantGetter;
});

//Not quite a constant, but can be lex/parsed the same
CONSTANTS['this'] = function(self) { return self; };
CONSTANTS['this'].sharedGetter = true;


//Operators - will be wrapped by binaryFn/unaryFn/assignment/filter
var OPERATORS = extend(createMap(), {
    '+':function(self, locals, a, b) {
        a=a(self, locals); b=b(self, locals);
        if (isDefined(a)) {
            if (isDefined(b)) {
                return a + b;
            }
            return a;
        }
        return isDefined(b)?b:undefined;},
    '-':function(self, locals, a, b) {
        a=a(self, locals); b=b(self, locals);
        return (isDefined(a)?a:0)-(isDefined(b)?b:0);
    },
    '*':function(self, locals, a, b) {return a(self, locals)*b(self, locals);},
    '/':function(self, locals, a, b) {return a(self, locals)/b(self, locals);},
    '%':function(self, locals, a, b) {return a(self, locals)%b(self, locals);},
    '===':function(self, locals, a, b) {return a(self, locals)===b(self, locals);},
    '!==':function(self, locals, a, b) {return a(self, locals)!==b(self, locals);},
    '==':function(self, locals, a, b) {return a(self, locals)==b(self, locals);},
    '!=':function(self, locals, a, b) {return a(self, locals)!=b(self, locals);},
    '<':function(self, locals, a, b) {return a(self, locals)<b(self, locals);},
    '>':function(self, locals, a, b) {return a(self, locals)>b(self, locals);},
    '<=':function(self, locals, a, b) {return a(self, locals)<=b(self, locals);},
    '>=':function(self, locals, a, b) {return a(self, locals)>=b(self, locals);},
    '&&':function(self, locals, a, b) {return a(self, locals)&&b(self, locals);},
    '||':function(self, locals, a, b) {return a(self, locals)||b(self, locals);},
    '!':function(self, locals, a) {return !a(self, locals);},

    //Tokenized as operators but parsed as assignment/filters
    '=':true,
    '|':true
});
var ESCAPE = {"n":"\n", "f":"\f", "r":"\r", "t":"\t", "v":"\v", "'":"'", '"':'"'};


/////////////////////////////////////////

/**
 * @constructor
 */
var Lexer = function(options) {
    this.options = options;
};

Lexer.prototype = {
    constructor: Lexer,

    lex: function(text) {
        this.text = text;
        this.index = 0;
        this.ch = undefined;
        this.tokens = [];

        while (this.index < this.text.length) {
            this.ch = this.text.charAt(this.index);
            if (this.is('"\'')) {
                this.readString(this.ch);
            } else if (this.isNumber(this.ch) || this.is('.') && this.isNumber(this.peek())) {
                this.readNumber();
            } else if (this.isIdent(this.ch)) {
                this.readIdent();
            } else if (this.is('(){}[].,;:?')) {
                this.tokens.push({
                    index: this.index,
                    text: this.ch
                });
                this.index++;
            } else if (this.isWhitespace(this.ch)) {
                this.index++;
            } else {
                var ch2 = this.ch + this.peek();
                var ch3 = ch2 + this.peek(2);
                var fn = OPERATORS[this.ch];
                var fn2 = OPERATORS[ch2];
                var fn3 = OPERATORS[ch3];
                if (fn3) {
                    this.tokens.push({index: this.index, text: ch3, fn: fn3});
                    this.index += 3;
                } else if (fn2) {
                    this.tokens.push({index: this.index, text: ch2, fn: fn2});
                    this.index += 2;
                } else if (fn) {
                    this.tokens.push({
                        index: this.index,
                        text: this.ch,
                        fn: fn
                    });
                    this.index += 1;
                } else {
                    this.throwError('Unexpected next character ', this.index, this.index + 1);
                }
            }
        }
        return this.tokens;
    },

    is: function(chars) {
        return chars.indexOf(this.ch) !== -1;
    },

    peek: function(i) {
        var num = i || 1;
        return (this.index + num < this.text.length) ? this.text.charAt(this.index + num) : false;
    },

    isNumber: function(ch) {
        return ('0' <= ch && ch <= '9');
    },

    isWhitespace: function(ch) {
        // IE treats non-breaking space as \u00A0
        return (ch === ' ' || ch === '\r' || ch === '\t' ||
            ch === '\n' || ch === '\v' || ch === '\u00A0');
    },

    isIdent: function(ch) {
        return ('a' <= ch && ch <= 'z' ||
            'A' <= ch && ch <= 'Z' ||
            '_' === ch || ch === '$');
    },

    isExpOperator: function(ch) {
        return (ch === '-' || ch === '+' || this.isNumber(ch));
    },

    throwError: function(error, start, end) {
        end = end || this.index;
        var colStr = (isDefined(start)
            ? 's ' + start +  '-' + this.index + ' [' + this.text.substring(start, end) + ']'
            : ' ' + end);
        throw $parseMinErr('lexerr', 'Lexer Error: {0} at column{1} in expression [{2}].',
            error, colStr, this.text);
    },

    readNumber: function() {
        var number = '';
        var start = this.index;
        while (this.index < this.text.length) {
            var ch = lowercase(this.text.charAt(this.index));
            if (ch == '.' || this.isNumber(ch)) {
                number += ch;
            } else {
                var peekCh = this.peek();
                if (ch == 'e' && this.isExpOperator(peekCh)) {
                    number += ch;
                } else if (this.isExpOperator(ch) &&
                    peekCh && this.isNumber(peekCh) &&
                    number.charAt(number.length - 1) == 'e') {
                    number += ch;
                } else if (this.isExpOperator(ch) &&
                    (!peekCh || !this.isNumber(peekCh)) &&
                    number.charAt(number.length - 1) == 'e') {
                    this.throwError('Invalid exponent');
                } else {
                    break;
                }
            }
            this.index++;
        }
        number = 1 * number;
        this.tokens.push({
            index: start,
            text: number,
            constant: true,
            fn: function() { return number; }
        });
    },

    readIdent: function() {
        var expression = this.text;

        var ident = '';
        var start = this.index;

        var lastDot, peekIndex, methodName, ch;

        while (this.index < this.text.length) {
            ch = this.text.charAt(this.index);
            if (ch === '.' || this.isIdent(ch) || this.isNumber(ch)) {
                if (ch === '.') lastDot = this.index;
                ident += ch;
            } else {
                break;
            }
            this.index++;
        }

        //check if the identifier ends with . and if so move back one char
        if (lastDot && ident[ident.length - 1] === '.') {
            this.index--;
            ident = ident.slice(0, -1);
            lastDot = ident.lastIndexOf('.');
            if (lastDot === -1) {
                lastDot = undefined;
            }
        }

        //check if this is not a method invocation and if it is back out to last dot
        if (lastDot) {
            peekIndex = this.index;
            while (peekIndex < this.text.length) {
                ch = this.text.charAt(peekIndex);
                if (ch === '(') {
                    methodName = ident.substr(lastDot - start + 1);
                    ident = ident.substr(0, lastDot - start);
                    this.index = peekIndex;
                    break;
                }
                if (this.isWhitespace(ch)) {
                    peekIndex++;
                } else {
                    break;
                }
            }
        }

        this.tokens.push({
            index: start,
            text: ident,
            fn: CONSTANTS[ident] || getterFn(ident, this.options, expression)
        });

        if (methodName) {
            this.tokens.push({
                index: lastDot,
                text: '.'
            });
            this.tokens.push({
                index: lastDot + 1,
                text: methodName
            });
        }
    },

    readString: function(quote) {
        var start = this.index;
        this.index++;
        var string = '';
        var rawString = quote;
        var escape = false;
        while (this.index < this.text.length) {
            var ch = this.text.charAt(this.index);
            rawString += ch;
            if (escape) {
                if (ch === 'u') {
                    var hex = this.text.substring(this.index + 1, this.index + 5);
                    if (!hex.match(/[\da-f]{4}/i))
                        this.throwError('Invalid unicode escape [\\u' + hex + ']');
                    this.index += 4;
                    string += String.fromCharCode(parseInt(hex, 16));
                } else {
                    var rep = ESCAPE[ch];
                    string = string + (rep || ch);
                }
                escape = false;
            } else if (ch === '\\') {
                escape = true;
            } else if (ch === quote) {
                this.index++;
                this.tokens.push({
                    index: start,
                    text: rawString,
                    string: string,
                    constant: true,
                    fn: function() { return string; }
                });
                return;
            } else {
                string += ch;
            }
            this.index++;
        }
        this.throwError('Unterminated quote', start);
    }
};


function isConstant(exp) {
    return exp.constant;
}

/*----------------------------------*/
/**
 * @constructor
 */
var Parser = function(lexer, $filter, options) {
    this.lexer = lexer;
    this.$filter = $filter;
    this.options = options;
};

Parser.ZERO = extend(function() {
    return 0;
}, {
    sharedGetter: true,
    constant: true
});

Parser.prototype = {
    constructor: Parser,

    parse: function(text) {
        this.text = text;
        this.tokens = this.lexer.lex(text);

        var value = this.statements();

        if (this.tokens.length !== 0) {
            this.throwError('is an unexpected token', this.tokens[0]);
        }

        value.literal = !!value.literal;
        value.constant = !!value.constant;

        return value;
    },

    primary: function() {
        var primary;
        if (this.expect('(')) {
            primary = this.filterChain();
            this.consume(')');
        } else if (this.expect('[')) {
            primary = this.arrayDeclaration();
        } else if (this.expect('{')) {
            primary = this.object();
        } else {
            var token = this.expect();
            primary = token.fn;
            if (!primary) {
                this.throwError('not a primary expression', token);
            }
            if (token.constant) {
                primary.constant = true;
                primary.literal = true;
            }
        }

        var next, context;
        while ((next = this.expect('(', '[', '.'))) {
            if (next.text === '(') {
                primary = this.functionCall(primary, context);
                context = null;
            } else if (next.text === '[') {
                context = primary;
                primary = this.objectIndex(primary);
            } else if (next.text === '.') {
                context = primary;
                primary = this.fieldAccess(primary);
            } else {
                this.throwError('IMPOSSIBLE');
            }
        }
        return primary;
    },

    throwError: function(msg, token) {
        throw $parseMinErr('syntax',
            'Syntax Error: Token \'{0}\' {1} at column {2} of the expression [{3}] starting at [{4}].',
            token.text, msg, (token.index + 1), this.text, this.text.substring(token.index));
    },

    peekToken: function() {
        if (this.tokens.length === 0)
            throw $parseMinErr('ueoe', 'Unexpected end of expression: {0}', this.text);
        return this.tokens[0];
    },

    peek: function(e1, e2, e3, e4) {
        if (this.tokens.length > 0) {
            var token = this.tokens[0];
            var t = token.text;
            if (t === e1 || t === e2 || t === e3 || t === e4 ||
                (!e1 && !e2 && !e3 && !e4)) {
                return token;
            }
        }
        return false;
    },

    expect: function(e1, e2, e3, e4) {
        var token = this.peek(e1, e2, e3, e4);
        if (token) {
            this.tokens.shift();
            return token;
        }
        return false;
    },

    consume: function(e1) {
        if (!this.expect(e1)) {
            this.throwError('is unexpected, expecting [' + e1 + ']', this.peek());
        }
    },

    unaryFn: function(fn, right) {
        return extend(function $parseUnaryFn(self, locals) {
            return fn(self, locals, right);
        }, {
            constant:right.constant,
            inputs: [right]
        });
    },

    binaryFn: function(left, fn, right, isBranching) {
        return extend(function $parseBinaryFn(self, locals) {
            return fn(self, locals, left, right);
        }, {
            constant: left.constant && right.constant,
            inputs: !isBranching && [left, right]
        });
    },

    statements: function() {
        var statements = [];
        while (true) {
            if (this.tokens.length > 0 && !this.peek('}', ')', ';', ']'))
                statements.push(this.filterChain());
            if (!this.expect(';')) {
                // optimize for the common case where there is only one statement.
                // TODO(size): maybe we should not support multiple statements?
                return (statements.length === 1)
                    ? statements[0]
                    : function $parseStatements(self, locals) {
                    var value;
                    for (var i = 0, ii = statements.length; i < ii; i++) {
                        value = statements[i](self, locals);
                    }
                    return value;
                };
            }
        }
    },

    filterChain: function() {
        var left = this.expression();
        var token;
        while ((token = this.expect('|'))) {
            left = this.filter(left);
        }
        return left;
    },

    filter: function(inputFn) {
        var token = this.expect();
        var fn = this.$filter(token.text);
        var argsFn;
        var args;

        if (this.peek(':')) {
            argsFn = [];
            args = []; // we can safely reuse the array
            while (this.expect(':')) {
                argsFn.push(this.expression());
            }
        }

        var inputs = [inputFn].concat(argsFn || []);

        return extend(function $parseFilter(self, locals) {
            var input = inputFn(self, locals);
            if (args) {
                args[0] = input;

                var i = argsFn.length;
                while (i--) {
                    args[i + 1] = argsFn[i](self, locals);
                }

                return fn.apply(undefined, args);
            }

            return fn(input);
        }, {
            constant: !fn.$stateful && inputs.every(isConstant),
            inputs: !fn.$stateful && inputs
        });
    },

    expression: function() {
        return this.assignment();
    },

    assignment: function() {
        var left = this.ternary();
        var right;
        var token;
        if ((token = this.expect('='))) {
            if (!left.assign) {
                this.throwError('implies assignment but [' +
                    this.text.substring(0, token.index) + '] can not be assigned to', token);
            }
            right = this.ternary();
            return extend(function $parseAssignment(scope, locals) {
                return left.assign(scope, right(scope, locals), locals);
            }, {
                inputs: [left, right]
            });
        }
        return left;
    },

    ternary: function() {
        var left = this.logicalOR();
        var middle;
        var token;
        if ((token = this.expect('?'))) {
            middle = this.assignment();
            if ((token = this.expect(':'))) {
                var right = this.assignment();

                return extend(function $parseTernary(self, locals) {
                    return left(self, locals) ? middle(self, locals) : right(self, locals);
                }, {
                    constant: left.constant && middle.constant && right.constant
                });

            } else {
                this.throwError('expected :', token);
            }
        }

        return left;
    },

    logicalOR: function() {
        var left = this.logicalAND();
        var token;
        while ((token = this.expect('||'))) {
            left = this.binaryFn(left, token.fn, this.logicalAND(), true);
        }
        return left;
    },

    logicalAND: function() {
        var left = this.equality();
        var token;
        if ((token = this.expect('&&'))) {
            left = this.binaryFn(left, token.fn, this.logicalAND(), true);
        }
        return left;
    },

    equality: function() {
        var left = this.relational();
        var token;
        if ((token = this.expect('==','!=','===','!=='))) {
            left = this.binaryFn(left, token.fn, this.equality());
        }
        return left;
    },

    relational: function() {
        var left = this.additive();
        var token;
        if ((token = this.expect('<', '>', '<=', '>='))) {
            left = this.binaryFn(left, token.fn, this.relational());
        }
        return left;
    },

    additive: function() {
        var left = this.multiplicative();
        var token;
        while ((token = this.expect('+','-'))) {
            left = this.binaryFn(left, token.fn, this.multiplicative());
        }
        return left;
    },

    multiplicative: function() {
        var left = this.unary();
        var token;
        while ((token = this.expect('*','/','%'))) {
            left = this.binaryFn(left, token.fn, this.unary());
        }
        return left;
    },

    unary: function() {
        var token;
        if (this.expect('+')) {
            return this.primary();
        } else if ((token = this.expect('-'))) {
            return this.binaryFn(Parser.ZERO, token.fn, this.unary());
        } else if ((token = this.expect('!'))) {
            return this.unaryFn(token.fn, this.unary());
        } else {
            return this.primary();
        }
    },

    fieldAccess: function(object) {
        var expression = this.text;
        var field = this.expect().text;
        var getter = getterFn(field, this.options, expression);

        return extend(function $parseFieldAccess(scope, locals, self) {
            return getter(self || object(scope, locals));
        }, {
            assign: function(scope, value, locals) {
                var o = object(scope, locals);
                if (!o) object.assign(scope, o = {});
                return setter(o, field, value, expression);
            }
        });
    },

    objectIndex: function(obj) {
        var expression = this.text;

        var indexFn = this.expression();
        this.consume(']');

        return extend(function $parseObjectIndex(self, locals) {
            var o = obj(self, locals),
                i = indexFn(self, locals),
                v;

            ensureSafeMemberName(i, expression);
            if (!o) return undefined;
            v = ensureSafeObject(o[i], expression);
            return v;
        }, {
            assign: function(self, value, locals) {
                var key = ensureSafeMemberName(indexFn(self, locals), expression);
                // prevent overwriting of Function.constructor which would break ensureSafeObject check
                var o = ensureSafeObject(obj(self, locals), expression);
                if (!o) obj.assign(self, o = {});
                /* jshint ignore:start */
                return o[key] = value;
                /* jshint ignore:end */
            }
        });
    },

    functionCall: function(fnGetter, contextGetter) {
        var argsFn = [];
        if (this.peekToken().text !== ')') {
            do {
                argsFn.push(this.expression());
            } while (this.expect(','));
        }
        this.consume(')');

        var expressionText = this.text;
        // we can safely reuse the array across invocations
        // #b. IE的apply不能接受null
        var args = []; //argsFn.length ? [] : null;

        return function $parseFunctionCall(scope, locals) {
            var context = contextGetter ? contextGetter(scope, locals) : scope;
            var fn = fnGetter(scope, locals, context) || noop;

            if (args) {
                var i = argsFn.length;
                while (i--) {
                    args[i] = ensureSafeObject(argsFn[i](scope, locals), expressionText);
                }
            }

            ensureSafeObject(context, expressionText);
            ensureSafeFunction(fn, expressionText);

            // IE stupidity! (IE doesn't have apply for some native functions)
            var v = fn.apply
                ? fn.apply(context, args)
                : fn(args[0], args[1], args[2], args[3], args[4]);

            return ensureSafeObject(v, expressionText);
        };
    },

    // This is used with json array declaration
    arrayDeclaration: function() {
        var elementFns = [];
        if (this.peekToken().text !== ']') {
            do {
                if (this.peek(']')) {
                    // Support trailing commas per ES5.1.
                    break;
                }
                var elementFn = this.expression();
                elementFns.push(elementFn);
            } while (this.expect(','));
        }
        this.consume(']');

        return extend(function $parseArrayLiteral(self, locals) {
            var array = [];
            for (var i = 0, ii = elementFns.length; i < ii; i++) {
                array.push(elementFns[i](self, locals));
            }
            return array;
        }, {
            literal: true,
            constant: elementFns.every(isConstant),
            inputs: elementFns
        });
    },

    object: function() {
        var keys = [], valueFns = [];
        if (this.peekToken().text !== '}') {
            do {
                if (this.peek('}')) {
                    // Support trailing commas per ES5.1.
                    break;
                }
                var token = this.expect();
                keys.push(token.string || token.text);
                this.consume(':');
                var value = this.expression();
                valueFns.push(value);
            } while (this.expect(','));
        }
        this.consume('}');

        return extend(function $parseObjectLiteral(self, locals) {
            var object = {};
            for (var i = 0, ii = valueFns.length; i < ii; i++) {
                object[keys[i]] = valueFns[i](self, locals);
            }
            return object;
        }, {
            literal: true,
            constant: valueFns.every(isConstant),
            inputs: valueFns
        });
    }
};

//////////////////////////////////////////////////
// Parser helper functions
//////////////////////////////////////////////////

function setter(obj, path, setValue, fullExp) {
    ensureSafeObject(obj, fullExp);

    var element = path.split('.'), key;
    for (var i = 0; element.length > 1; i++) {
        key = ensureSafeMemberName(element.shift(), fullExp);
        var propertyObj = ensureSafeObject(obj[key], fullExp);
        if (!propertyObj) {
            propertyObj = {};
            obj[key] = propertyObj;
        }
        obj = propertyObj;
    }
    key = ensureSafeMemberName(element.shift(), fullExp);
    ensureSafeObject(obj[key], fullExp);
    obj[key] = setValue;
    return setValue;
}

var getterFnCacheDefault = createMap();
var getterFnCacheExpensive = createMap();

function isPossiblyDangerousMemberName(name) {
    return name == 'constructor';
}
function identity($) {return $;}

/**
 * Implementation of the "Black Hole" variant from:
 * - http://jsperf.com/angularjs-parse-getter/4
 * - http://jsperf.com/path-evaluation-simplified/7
 */
function cspSafeGetterFn(key0, key1, key2, key3, key4, fullExp, expensiveChecks) {
    ensureSafeMemberName(key0, fullExp);
    ensureSafeMemberName(key1, fullExp);
    ensureSafeMemberName(key2, fullExp);
    ensureSafeMemberName(key3, fullExp);
    ensureSafeMemberName(key4, fullExp);
    var eso = function(o) {
        return ensureSafeObject(o, fullExp);
    };
    var eso0 = (expensiveChecks || isPossiblyDangerousMemberName(key0)) ? eso : identity;
    var eso1 = (expensiveChecks || isPossiblyDangerousMemberName(key1)) ? eso : identity;
    var eso2 = (expensiveChecks || isPossiblyDangerousMemberName(key2)) ? eso : identity;
    var eso3 = (expensiveChecks || isPossiblyDangerousMemberName(key3)) ? eso : identity;
    var eso4 = (expensiveChecks || isPossiblyDangerousMemberName(key4)) ? eso : identity;

    return function cspSafeGetter(scope, locals) {
        var pathVal = (locals && locals.hasOwnProperty(key0)) ? locals : scope;

        if (pathVal == null) return pathVal;
        pathVal = eso0(pathVal[key0]);

        if (!key1) return pathVal;
        if (pathVal == null) return undefined;
        pathVal = eso1(pathVal[key1]);

        if (!key2) return pathVal;
        if (pathVal == null) return undefined;
        pathVal = eso2(pathVal[key2]);

        if (!key3) return pathVal;
        if (pathVal == null) return undefined;
        pathVal = eso3(pathVal[key3]);

        if (!key4) return pathVal;
        if (pathVal == null) return undefined;
        pathVal = eso4(pathVal[key4]);

        return pathVal;
    };
}

function getterFnWithEnsureSafeObject(fn, fullExpression) {
    return function(s, l) {
        return fn(s, l, ensureSafeObject, fullExpression);
    };
}

function getterFn(path, options, fullExp) {
    var expensiveChecks = options.expensiveChecks;
    var getterFnCache = (expensiveChecks ? getterFnCacheExpensive : getterFnCacheDefault);
    var fn = getterFnCache[path];
    if (fn) return fn;


    var pathKeys = path.split('.'),
        pathKeysLength = pathKeys.length;

    // http://jsperf.com/angularjs-parse-getter/6
    if (options.csp) {
        if (pathKeysLength < 6) {
            fn = cspSafeGetterFn(pathKeys[0], pathKeys[1], pathKeys[2], pathKeys[3], pathKeys[4], fullExp, expensiveChecks);
        } else {
            fn = function cspSafeGetter(scope, locals) {
                var i = 0, val;
                do {
                    val = cspSafeGetterFn(pathKeys[i++], pathKeys[i++], pathKeys[i++], pathKeys[i++],
                        pathKeys[i++], fullExp, expensiveChecks)(scope, locals);

                    locals = undefined; // clear after first iteration
                    scope = val;
                } while (i < pathKeysLength);
                return val;
            };
        }
    } else {
        var code = '';
        if (expensiveChecks) {
            code += 's = eso(s, fe);\nl = eso(l, fe);\n';
        }
        var needsEnsureSafeObject = expensiveChecks;
        forEach(pathKeys, function(key, index) {
            ensureSafeMemberName(key, fullExp);
            var lookupJs = (index
                // we simply dereference 's' on any .dot notation
                ? 's'
                // but if we are first then we check locals first, and if so read it first
                // #a. IE不接受”点号保留字“,故取一切为['$key']
                : '((l&&l.hasOwnProperty("' + key + '"))?l:s)') + ('["' + key +'"]');
            if (expensiveChecks || isPossiblyDangerousMemberName(key)) {
                lookupJs = 'eso(' + lookupJs + ', fe)';
                needsEnsureSafeObject = true;
            }
            code += 'if(s == null) return undefined;\n' +
                's=' + lookupJs + ';\n';
        });
        code += 'return s;';

        /* jshint -W054 */
        var evaledFnGetter = new Function('s', 'l', 'eso', 'fe', code); // s=scope, l=locals, eso=ensureSafeObject
        /* jshint +W054 */
        evaledFnGetter.toString = valueFn(code);
        if (needsEnsureSafeObject) {
            evaledFnGetter = getterFnWithEnsureSafeObject(evaledFnGetter, fullExp);
        }
        fn = evaledFnGetter;
    }

    fn.sharedGetter = true;
    fn.assign = function(self, value) {
        return setter(self, path, value, path);
    };
    getterFnCache[path] = fn;
    return fn;
}

var objectValueOf = Object.prototype.valueOf;

function getValueOf(value) {
    return isFunction(value.valueOf) ? value.valueOf() : objectValueOf.call(value);
}

///////////////////////////////////

module.exports = new Parser(new Lexer({}), {}, {});

},{}],5:[function(require,module,exports){
var win = typeof window !== 'undefined' ? window : {};
var console = win.console || {};
var parser = require('./ng-parse');
var clone = require('./clone');
var each = require('./each');
var noop = function () {};

var isArray = function (a) { return !!a && a.indexOf && a.slice && a.splice; }
var isDate = function (a) { return a && typeof a.getTime == 'function' && typeof a.getDate == 'function'; }
var isRegExp = function (a) { return a instanceof RegExp; }
var isFunction = function (a) { return typeof a === 'function'; }

var ENABLE_LOG = false;
var instanceCount = 0;
var watchId = 1;

var parserCache = {};
function parse(string) {
  if (!parserCache[string]) {
      parserCache[string] = parser.parse(string);
  }
  return parserCache[string];
}

function checkLog() {
    if (ENABLE_LOG || win.ENABLE_SCOPE_LOG) {
        return true;
    }
    return false;
}

function log() {
    if (checkLog() && console.log) {
        console.log.apply(console, arguments);
    }
}

function dir() {
    if (checkLog() && console.dir) {
        console.dir.apply(console, arguments);
    }
}

function isWindow (obj) {
    return obj && obj.document && obj.location && obj.alert && obj.setInterval;
}

// deep equal, copied from: https://github.com/angular/angular.js/blob/8d4e3fdd31eabadd87db38aa0590253e14791956/src/Angular.js#L812
function equals(o1, o2) {
    /* jshint ignore:start */
    if (o1 === o2) return true;
    if (o1 === null || o2 === null) return false;
    if (o1 !== o1 && o2 !== o2) return true; // NaN === NaN
    var t1 = typeof o1, t2 = typeof o2, length, key, keySet;
    if (t1 == t2) {
        if (t1 == 'object') {
            if (isArray(o1)) {
                if (!isArray(o2)) return false;
                if ((length = o1.length) == o2.length) {
                    for(key=0; key<length; key++) {
                        if (!equals(o1[key], o2[key])) return false;
                    }
                    return true;
                }
            } else if (isDate(o1)) {
                return isDate(o2) && o1.getTime() == o2.getTime();
            } else if (isRegExp(o1) && isRegExp(o2)) {
                return o1.toString() == o2.toString();
            } else {
                if (/*isScope(o1) || isScope(o2) ||*/ isWindow(o1) || isWindow(o2) || isArray(o2)) return false;
                keySet = {};
                for(key in o1) {
                    if (key.charAt(0) === '$' || isFunction(o1[key])) continue;
                    if (!equals(o1[key], o2[key])) return false;
                    keySet[key] = true;
                }
                for(key in o2) {
                    if (!keySet.hasOwnProperty(key) &&
                        key.charAt(0) !== '$' &&
                        o2[key] !== undefined &&
                        !isFunction(o2[key])) return false;
                }
                return true;
            }
        }
    }
    /* jshint ignore:end */
    return false;
}

function Scope() {
    this._$$watched = [];
    this._$$children = [];
    this._$id = ++instanceCount;
    Scope._instances[this._$id] = this;
}

Scope.TTL = 10;
Scope.DELAY = 10;
Scope._instances = {};

var rootScope;
Scope.getRootInstance  = function() {
    if (rootScope && !rootScope._$destoried) {
        return rootScope;
    }
    rootScope = new Scope();
    return rootScope;
};

Scope.getIsolateInstance = function () {
    return new Scope();
};

Scope.getInheritInstance = function (parent) {
    function ChildScope() {}
    ChildScope.prototype = parent;
    var scope = new ChildScope();
    Scope.apply(scope);
    parent._$$children.push(scope);
    scope.$parent = parent;
    return scope;
};

Scope.getInstance = function () {
    return this.getRootInstance(); // 暂时兼容线上
    //return parent ? this.getInheritInstance(parent) : this.getIsolateInstance();
};

Scope.digest = function (force) {
    Scope.getRootInstance()[force ? '$digest' : '$digestIfPending']();
};

Scope.prototype = {
    constructor: Scope,
    _$digestAsync: function () {
        var me = this;
        if (Scope._handler) return;
        Scope._handler = setTimeout(function () {
          me.$digest();
        }, Scope.DELAY);
    },
    _clearHanlder: function () {
        clearTimeout(Scope._handler);
        Scope._handler = null;
    },
    /**
     * 收集所有scope的watchers
     * @returns {Array}
     * @private
     */
    _$collectWatchers: function () {
        var watchers = [];
        each(Scope._instances, function(instance){
            watchers = watchers.concat(instance._$$watched);
        });
        return watchers;
    },
    /**
     * 为避免数据死循环，一次性消化所有的scope。
     */
    $digest: function () {
        log("-----[digesting]------");
        var count = 0;

        while (true) {
            // clear handler on every round
            this._clearHanlder();
            var watchers = this._$collectWatchers(); // 可能在watchers中会生成新的scope,故每次loop都要重新收集一遍

            count++;
            if (count > Scope.TTL) {
                log('[digesting] digest max loop [' + Scope.TTL + ']reached, give up');
                break;
            }

            var invokeList = [];
            var dirty = false;

            log("[digesting] round #" + count);
            each(watchers, function (watcher) {
                var oldValue = watcher.value;
                var newValue = watcher.func();
                if (!equals(oldValue, newValue)) {
                    watcher.value = clone(newValue, true);
                    dirty = true;
                    invokeList.push({
                        func: watcher.callback,
                        args: [watcher.value, oldValue]
                    });
                }
            });

            log('[digesting] ' + invokeList.length + " callbacks in queue.");
            if (invokeList.length) {
                log('they are:');
            }

            each(invokeList, function (invoker) {
                dir(invoker);
                try {
                    invoker.func.apply(null, invoker.args || []);
                } catch (e) {
                    log('error when invoke:');
                    dir(invoker);
                }
            });

            if (dirty) {
                log('[digesting] data is dirty, start next digest');
            } else {
                log('[digesting] data is stable, stop digesting');
                // clear handler before exit!
                this._clearHanlder();
                break;
            }
        }
    },
    /**
     * 测试专用函数。
     * 用于同步消化数据。
     */
    $digestIfPending: function() {
        if (Scope._handler) {
            this.$digest();
        }
    },
    $destory: function () {
        delete Scope._instances[this._$id];
        this._$$watched = [];
        this._$destoried = true;
    },
    $set: function (name, value) {
        var me = this;
        if (name instanceof Object) {
            return each(name, function (val, key) {
                me[key] = val;
            });
        }

        if (!name) {
            return;
        }

        me[name] = value;
        this._$digestAsync();
    },
    $apply: function () {
        this._$digestAsync();
    },
    $eval: function (expression) {
        if (isFunction(expression)) {
            return expression.call(this);
        }
        return parse(expression)(this);
    },
    $default: function (hash) {
        var scope = this;
        Object.keys(hash).forEach(function(key){
            scope[key] = scope.hasOwnProperty(key) ? scope[key] : hash[key];
        });
    },
    /**
     * 监控一个表达式，如果表达式得到的值有变化，则会响应回调函数。
     * sync为true，则同步表达式的初始值
     * 返回一个函数，用于解除监控。
     * @param expression
     * @param callback
     * @param sync
     * @returns {Function}
     */
    $watch: function (expression, callback, sync) {
        var func = expression;
        var me = this;

        // fast return
        if (!expression) {
            return;
        }

        if (Array.isArray(expression)) {
            return function(cb){
                expression.forEach(function(expr) {me.$watch(expr, cb);});
            }(callback);
        }

        if (typeof expression === 'string') {
            func = function () {
               return this.$eval(expression);
            };
        }

        var wid = ++watchId;
        this._$$watched.push({
            watchId: wid,
            scopeId: this._$id,
            value: sync ? this.$eval(expression) : null,
            expression: expression + '', // convert into string
            func: function () {
                return func.call(me);
            },
            callback: callback || noop
        });
        this._$digestAsync();

        return function() {
            me._$$watched = me._$$watched.filter(function(w) {
                return w.watchId !== wid;
            });
        };
    }
};

module.exports = Scope;

},{"./clone":1,"./each":2,"./ng-parse":4}],6:[function(require,module,exports){
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

},{}]},{},[3]);
