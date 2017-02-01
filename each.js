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
