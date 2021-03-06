var npm = require('npm'),
  path = require('path'),
  Q = require('q'),
  unpack = require('./unpack'),
  util = require('./util'),
  cachedSettings = null,
  cachedSettingsValues = null;

/**
 * @description Calls npm.load, then initializes npm.config with the specified settings. Then executes a chain of
 * promises that rely on those npm settings, then restores npm settings back to their previous value. Use this rather
 * than passing settings to npm.load, since that only works the first time you try to load npm.
 * @param {Object} settings
 * @param {Function} promiseChain
 */
function loadWithSettingsThenRestore(settings, promiseChain) {
  return loadWithSettings(settings).then(promiseChain).finally(restoreSettings);
}

function loadWithSettings(settings) {
  if (cachedSettings) {
    throw new Error('Trying to initialize npm when settings have not been restored from a previous initialization.');
  }

  return Q.nfcall(npm.load, settings).then(function () {
    for (var prop in settings) {
      var currentValue = npm.config.get(prop);
      var newValue = settings[prop];
      if (currentValue !== newValue) {
        cachedSettingsValues = cachedSettingsValues || {};
        cachedSettings = cachedSettings || [];
        cachedSettings.push(prop);
        if (typeof currentValue !== 'undefined') {
          cachedSettingsValues[prop] = currentValue;
        }
        npm.config.set(prop, newValue);
      }
    }
  });
}

function restoreSettings() {
  if (cachedSettings) {
    cachedSettings.forEach(function (prop) {
      if (prop in cachedSettingsValues) {
        npm.config.set(prop, cachedSettingsValues[prop]);
      } else {
        npm.config.del(prop);
      }
    });
    cachedSettings = null;
    cachedSettingsValues = null;
  }
}

/**
 * Fetches the latest version of a package from NPM that matches the specified version. Returns a promise that
 * resolves to the directory the NPM package is located in.
 * @param packageName - name of an npm package
 * @param packageVersion - requested version or version range
 */
function fetchPackage(packageName, packageVersion) {
  // Get the latest matching version from NPM if a version range is specified
  return DroiMarket.info(packageName).then(function (data) {
    //todo Market-Injection
    return util.getLatestMatchingNpmVersion(data.fullname, packageVersion).then(
      function (latestVersion) {
        return cachePackage(packageName, latestVersion);
      }
    );
  });
}

/**
 * Invokes "npm cache add," and then returns a promise that resolves to a directory containing the downloaded,
 * or cached package.
 * @param packageName - name of an npm package
 * @param packageVersion - requested version (not a version range)
 */
function cachePackage(packageName, packageVersion) {
  //todo Market-Injection
  var prefix = 'droiv-';
  if (packageName !== prefix + 'android' && packageName !== prefix + 'ios' && packageName !== prefix + 'vue') {
    packageName = DroiMarket.info(packageName);
  } else {
    packageName = {
      fullname: packageName
    };
  }

  return Q(packageName).then(function (data) {
    packageName = data.fullname;
    var registry = 'http://registry.npm.taobao.org/';
    var cacheDir = path.join(util.libDirectory, 'npm_cache');

    // If already cached, use that rather than calling 'npm cache add' again.
    var packageCacheDir = path.resolve(cacheDir, packageName, packageVersion);
    var packageTGZ = path.resolve(packageCacheDir, 'package.tgz');
    if (util.existsSync(packageTGZ)) {
      return unpack.unpackTgz(packageTGZ, path.resolve(packageCacheDir, 'package'));
    }
    var settings = {
      'cache': cacheDir,
      'registry': registry
    };
    // Load with NPM configuration
    return loadWithSettingsThenRestore(settings,
      function () {
        // Invoke NPM Cache Add
        return Q.ninvoke(npm.commands, 'cache', ['add', (packageName + '@' + packageVersion)]).then(
          function (info) {
            var packageDir = path.resolve(npm.cache, info.name, info.version, 'package');
            var packageTGZ = path.resolve(npm.cache, info.name, info.version, 'package.tgz');
            return unpack.unpackTgz(packageTGZ, packageDir);
          }
        );
      }
    );
  });
}

module.exports.loadWithSettingsThenRestore = loadWithSettingsThenRestore;
module.exports.fetchPackage = fetchPackage;
module.exports.cachePackage = cachePackage;