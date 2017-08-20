//var create = require('./create');
var events = require('weexpack-common').events;

var off = function () {
  events.removeListener.apply(events, arguments);
};

var emit = function () {
  events.emit.apply(events, arguments);
};

exports = module.exports = {
  on: function () {
    events.on.apply(events, arguments);
  },
  off: off,
  removeListener: off,
  removeAllListeners: function () {
    events.removeAllListeners.apply(events, arguments);
  },
  emit: emit,
  trigger: emit,
  raw: {}
};

var addModuleProperty = require('../utils/util').addModuleProperty;

addModuleProperty(module, 'create', './create', true);
addModuleProperty(module, 'xx', './xx', true);