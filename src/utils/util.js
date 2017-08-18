var fs = require('fs'),
  shell = require('shelljs'),
  semver = require('semver'),
  Q = require('q'),
  path = require('path');

var global_config_path = process.env['DROIV_HOME'];

if (!global_config_path) {
  var HOME = process.env[(process.platform.slice(0, 3) == 'win') ? 'USERPROFILE' : 'HOME'];
  global_config_path = path.join(HOME, '.droiv');
}

var lib_path = path.join(global_config_path, 'lib');

Object.defineProperty(exports, 'libDirectory', {
  configurable: true,
  get: function () {
    shell.mkdir('-p', lib_path);
    exports.libDirectory = lib_path;
    return lib_path;
  }
});

function existsSync(fileSpec) {
  // Since fs.existsSync() is deprecated
  try {
    fs.statSync(fileSpec);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Returns the latest version of the specified module on npm that matches the specified version or range.
 * @param {string} module_name - npm module name.
 * @param {string} version - semver version or range (loose allowed).
 * @returns {Promise} Promise for version (a valid semver version if one is found, otherwise whatever was provided).
 */
function getLatestMatchingNpmVersion(module_name, version) {
  if (!version) {
    // If no version specified, get the latest
    return getLatestNpmVersion(module_name);
  }

  var validVersion = semver.valid(version, /* loose */ true);
  if (validVersion) {
    // This method is really intended to work with ranges, so if a version rather than a range is specified, we just
    // assume it is available and return it, bypassing the need for the npm call.
    return Q(validVersion);
  }

  var validRange = semver.validRange(version, /* loose */ true);
  if (!validRange) {
    // Just return what we were passed
    return Q(version);
  }

  return getAvailableNpmVersions(module_name).then(function (versions) {
    return semver.maxSatisfying(versions, validRange) || version;
  });
}

/**
 * Returns a promise for an array of versions available for the specified npm module.
 * @param {string} module_name - npm module name.
 * @returns {Promise} Promise for an array of versions.
 */
function getAvailableNpmVersions(module_name) {
  var npm = require('npm');
  return Q.nfcall(npm.load).then(function () {
    return Q.ninvoke(npm.commands, 'view', [module_name, 'versions'], /* silent = */ true).then(function (result) {
      // result is an object in the form:
      //     {'<version>': {versions: ['1.2.3', '1.2.4', ...]}}
      // (where <version> is the latest version)
      return result[Object.keys(result)[0]].versions;
    });
  });
}

/**
 * Returns a promise for the latest version available for the specified npm module.
 * @param {string} module_name - npm module name.
 * @returns {Promise} Promise for an array of versions.
 */
function getLatestNpmVersion(module_name) {
  var npm = require('npm');
  return Q.nfcall(npm.load).then(function () {
    return Q.ninvoke(npm.commands, 'view', [module_name, 'version'], /* silent = */ true).then(function (result) {
      // result is an object in the form:
      //     {'<version>': {version: '<version>'}}
      // (where <version> is the latest version)
      return Object.keys(result)[0];
    });
  });
}

function addModuleProperty(module, symbol, modulePath, opt_wrap, opt_obj) {
  var val = null;
  if (opt_wrap) {
    module.exports[symbol] = function () {
      val = val || module.require(modulePath);
      if (arguments.length && typeof arguments[arguments.length - 1] === 'function') {
        // If args exist and the last one is a function, it's the callback.
        var args = Array.prototype.slice.call(arguments);
        var cb = args.pop();
        val.apply(module.exports, args).done(function (result) {
          cb(undefined, result);
        }, cb);
      } else {
        val.apply(module.exports, arguments).done(null, function (err) {
          throw err;
        });
      }
    };
  } else {
    Object.defineProperty(opt_obj || module.exports, symbol, {
      get: function () {
        val = val || module.require(modulePath);
        return val;
      },
      set: function (v) {
        val = v;
      }
    });
  }

  // Add the module.raw.foo as well.
  if (module.exports.raw) {
    Object.defineProperty(module.exports.raw, symbol, {
      get: function () {
        val = val || module.require(modulePath);
        return val;
      },
      set: function (v) {
        val = v;
      }
    });
  }
}

exports.existsSync = existsSync;
exports.getLatestMatchingNpmVersion = getLatestMatchingNpmVersion;
exports.getAvailableNpmVersions = getAvailableNpmVersions;
exports.addModuleProperty = addModuleProperty;