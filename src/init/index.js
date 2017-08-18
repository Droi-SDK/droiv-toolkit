var init = require('./init');
var events = require('weexpack-common').events;

exports = module.exports = {
  raw: {}
};

var addModuleProperty = require('../utils/util').addModuleProperty;

addModuleProperty(module, 'init', './init', true);