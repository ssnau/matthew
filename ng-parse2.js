module.exports ={
  parse: function (str) {
    return function (scope) {
      return eval("         \
        (function() {       \
          return (${str})   \
        })();               \
      ");
    }
  }
};
