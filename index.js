var Scope = require('./scope');
var parser = require('./ng-parse');
var each = require('./each');
var SCOPE_ATTR = "m-scope";
var NODE_INSTANCE = '__M_NODE_INSTANCE';
var eachId = 0;
var mCache = {};

function Node(element) {
  this.element = element;
}
Node.addMethod = function (name, method) {
  Node.prototype[name] = method;
}
Node.create = function (str) {
  var div = document.createElement('div');
  div.innerHTML = str;
  return new Node(div.firstChild);
}

each({
  set: function (name, val) {
    this.setAttribute(name, val);
  },
  get: function (name) {
    var ret = this.element[name] || this.getAttribute(name); 
    if (name == 'children' && ret) {
      return Y.all(ret);
    }
    return ret;
  },
  next: function () {
    return Y.one(this.element.nextElementSibling || this.element.nextSibling);
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
    if (element.element && element.getDOMNode) return element; // already a Node instance
    if (!element) return;
    if (element[NODE_INSTANCE]) return element[NODE_INSTANCE];
    element[NODE_INSTANCE] = new Node(element);
    return element[NODE_INSTANCE];
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
    var undef,
        v = 3,
        div = document.createElement('div'),
        all = div.getElementsByTagName('i');
    while (
        div.innerHTML = '<!--[if gt IE ' + (++v) + ']><i></i><![endif]-->',
        all[0]
    );
    return v > 4 ? v : undef;
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
                    toBeDeleteIds[key] = true;
                }
            });
            each(toBeDeleteIds, function(val, key){
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
     *     // 遵循mt-validator规范
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
            node.removeClass('mt-validate-valid');
            node.removeClass('mt-validate-invalid');
            node.addClass((valid === true || (valid && valid.value === true)) ? "mt-validate-valid" : "mt-validate-invalid");
            scope.$apply();
            return valid;
        };

        scope.$watch(getOwn(config, 'watch'), validate, true);

        // bind to validator
        var ndForm = node.ancestor('form');
        if (ndForm) {
            var validator = Y.mt.validator.getInstance(ndForm);
            validator.register(config.group, validate);
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

// use m- as shortcut..
each(binders, function (val, key) {
    binders[key.replace('m-', 'm-')] = val;
});

var priorites = {
    'm-repeat': 999,
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
    }
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
Node.addMethod('scopeEval', function (element, expr) {
    var node = Y.one(element);
    var scope = node.getScope();
    return scope.$eval(wrapExpr(expr, node));
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

