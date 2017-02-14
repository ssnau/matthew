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
if (!Array.isArray) Array.isArray = isArray;
if (!([].forEach)) Array.prototype.forEach = function (fn) { each(this, fn); }
module.exports = each;
