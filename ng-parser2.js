module.exports = function (str) {
  return function (scope) {
    return eval(`
      (function() {
        return (${str})
      })();
    `);
  }
};
