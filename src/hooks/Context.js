var path = require('path');
var events = require('weexpack-common').events;

/**
 * Creates hook script context
 * @constructor
 * @param {String} hook The hook type
 * @param {Object} opts Hook options
 * @returns {Object} */
function Context(hook, opts) {
  var prop;
  this.hook = hook;

  //create new object, to avoid affecting input opts in other places
  //For example context.opts.plugin = Object is done, then it affects by reference
  this.opts = {};
  for (prop in opts) {
    if (opts.hasOwnProperty(prop)) {
      this.opts[prop] = opts[prop];
    }
  }
  this.cmdLine = process.argv.join(' ');
  //this.cordova = require('../cordova/cordova');
}

// As per CB-9834 we need to maintain backward compatibility and provide a compat layer
// for plugins that still require modules, factored to cordova-common.
var compatMap = {
  '../configparser/ConfigParser': function () {
    return require('weexpack-common').ConfigParser;
  },
  '../util/xml-helpers': function () {
    return require('weexpack-common').xmlHelpers;
  }
};

/**
 * Returns a required module
 * @param {String} modulePath Module path
 * @returns {Object} */
Context.prototype.requireCordovaModule = function (modulePath) {
  // There is a very common mistake, when hook requires some cordova functionality
  // using 'cordova-lib/...' path.
  // This path will be resolved only when running cordova from 'normal' installation
  // (without symlinked modules). If cordova-lib linked to cordova-cli this path is
  // never resolved, so hook fails with 'Error: Cannot find module 'cordova-lib''
  var resolvedPath = path.resolve(__dirname, modulePath.replace(/^cordova-lib/, '../../../cordova-lib'));
  var relativePath = path.relative(__dirname, resolvedPath).replace(/\\/g, '/');
  events.emit('verbose', 'Resolving module name for ' + modulePath + ' => ' + relativePath);

  var compatRequire = compatMap[relativePath];
  if (compatRequire) {
    events.emit('warn', 'The module "' + path.basename(relativePath) + '" has been factored ' +
      'into "cordova-common". Consider update your plugin hooks.');
    return compatRequire();
  }

  return require(relativePath);
};

module.exports = Context;