var fs = require('fs'),
  shell = require('shelljs'),
  semver = require('semver'),
  Q = require('q'),
  path = require('path'),
  CordovaError = require('weexpack-common').CordovaError;

var global_config_path = process.env['DROIV_HOME'];

if (!global_config_path) {
  var HOME = process.env[(process.platform.slice(0, 3) == 'win') ? 'USERPROFILE' : 'HOME'];
  global_config_path = path.join(HOME, '.droiv');
}

var origCwd = null;

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

function isIOSProject(dir) {
  if (exports.existsSync(path.join(dir, 'Weexplugin.xcodeproj'))) {
    return true;
  }
}

function isAndroidProject(dir) {
  if (exports.existsSync(path.join(dir, 'build.gradle'))) {
    return true;
  }
}

function isRootDir(dir) {
  if (exports.existsSync(path.join(dir, 'platforms'))) {
    if (exports.existsSync(path.join(dir, 'web'))) {
      // For sure is.
      if (exports.existsSync(path.join(dir, 'config.xml'))) {
        return 2;
      } else {
        return 1;
      }
    }
  }
  return 0;
}

function isDroiv(dir) {
  if (!dir) {
    // Prefer PWD over cwd so that symlinked dirs within your PWD work correctly (CB-5687).
    var pwd = process.env.PWD;
    var cwd = process.cwd();
    if (pwd && pwd != cwd && pwd != 'undefined') {
      return this.isDroiv(pwd) || this.isDroiv(cwd);
    }
    return this.isDroiv(cwd);
  }
  var bestReturnValueSoFar = false;
  for (var i = 0; i < 1000; ++i) {
    var result = isRootDir(dir);
    if (result === 2) {
      return dir;
    }
    if (result === 1) {
      bestReturnValueSoFar = dir;
    }
    var parentDir = path.normalize(path.join(dir, '..'));
    // Detect fs root.
    if (parentDir == dir) {
      return bestReturnValueSoFar;
    }
    dir = parentDir;
  }
  console.error('Hit an unhandled case in util.isDroiv');
  return false;
}

function cdProjectRoot(dir) {
  var projectRoot = this.isDroiv(dir);
  if (!projectRoot) {
    throw new CordovaError('Current working directory is not a weexpack project.');
  }
  if (!origCwd) {
    origCwd = process.env.PWD || process.cwd();
  }
  process.env.PWD = projectRoot;
  process.chdir(projectRoot);
  return projectRoot;
}

function getOrigWorkingDirectory() {
  return origCwd || process.env.PWD || process.cwd();
}

function _resetOrigCwd() {
  origCwd = null;
}

function projectConfig(projectDir) {
  var rootPath = path.join(projectDir, 'config.xml');
  var wwwPath = path.join(projectDir, 'www', 'config.xml');
  if (exports.existsSync(rootPath)) {
    return rootPath;
  } else if (exports.existsSync(wwwPath)) {
    return wwwPath;
  }
  return false;
}

function findPlugins(pluginPath) {
  var plugins = [],
    stats;
  if (exports.existsSync(pluginPath)) {
    plugins = fs.readdirSync(pluginPath).filter(function (fileName) {
      stats = fs.statSync(path.join(pluginPath, fileName));
      return fileName != '.svn' && fileName != 'CVS' && stats.isDirectory();
    });
  }
  return plugins;
}

function listPlatforms(project_dir) {
  var core_platforms = require('../platforms/platforms');
  var platforms_dir = path.join(project_dir, 'platforms');
  if (!exports.existsSync(platforms_dir)) {
    return [];
  }
  var subdirs = fs.readdirSync(platforms_dir);
  return subdirs.filter(function (p) {
    return Object.keys(core_platforms).indexOf(p) > -1;
  });
}

function getInstalledPlatformsWithVersions(project_dir) {
  var result = {};
  var platforms_on_fs = listPlatforms(project_dir);

  return Q.all(platforms_on_fs.map(function (p) {
    var superspawn = require('weexpack-common').superspawn;
    return superspawn.maybeSpawn(path.join(project_dir, 'platforms', p, 'cordova', 'version'), [], 
      {
        chmod: true
      })
      .then(function (v) {
        result[p] = v || null;
      }, function () {
        result[p] = 'broken';
      });
  })).then(function () {
    return result;
  });
}

exports.isDroiv = isDroiv;
exports.cdProjectRoot = cdProjectRoot;
exports.projectConfig = projectConfig;
exports.findPlugins = findPlugins;
exports.getOrigWorkingDirectory = getOrigWorkingDirectory;
exports._resetOrigCwd = _resetOrigCwd;
exports.existsSync = existsSync;
exports.getLatestMatchingNpmVersion = getLatestMatchingNpmVersion;
exports.getAvailableNpmVersions = getAvailableNpmVersions;
exports.addModuleProperty = addModuleProperty;
exports.isIOSProject = isIOSProject;
exports.isAndroidProject = isAndroidProject;
exports.getInstalledPlatformsWithVersions = getInstalledPlatformsWithVersions;