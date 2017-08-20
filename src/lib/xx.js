var Q = require('q');

module.exports = function () {
  //throw new Error('nnnn');
  var xx = x('xx');
  console.log(JSON.stringify(xx));
  return xx;
};

function x(dir) {
  return Q.fcall(function () {
    console.log('xxxx');
    //events = setupEvents(extEvents);
    //logger.info('234');
    throw new Error('222');
  });
}