var _ = require('underscore'),
  platforms = require('../platforms/platforms'),
  Q = require('q'),
  npmhelper = require('../utils/npm-helper'),
  util = require('../utils/util');

exports.droiv_npm = droiv_npm;
exports.based_on_config = based_on_config;

function Platform(platformString) {
  var name,
    platform,
    parts,
    version;
  if (platformString.indexOf('@') != -1) {
    parts = platformString.split('@');
    name = parts[0];
    version = parts[1];
  } else {
    name = platformString;
  }
  platform = _.extend({}, platforms[name]);
  this.name = name;
  this.version = version || platform.version;
  this.packageName = 'droiv-' + name;
}

function based_on_config(project_root, platform) {
  platform = new Platform(platform);
  return module.exports.droiv_npm(platform);
}

function droiv_npm(platform) {
  if (!(platform.name in platforms)) {
    return Q.reject(new Error('droiv library "' + platform.name + '" not recognized.'));
  }
  return util.getLatestMatchingNpmVersion(platform.packageName, platform.version).then(function (version) {
    return npmhelper.cachePackage(platform.packageName, version);
  });
}