var path = require('path');
var util = require('../utils/util');
var platforms = require('./platformsConfig.json');
var events = require('weexpack-common').events;

// Avoid loading the same platform projects more than once (identified by path)
var cachedApis = {};

// getPlatformApi() should be the only method of instantiating the
// PlatformProject classes for now.
function getPlatformApi(platform, platformRootDir) {

  // if platformRootDir is not specified, try to detect it first
  if (!platformRootDir) {
    var projectRootDir = util.isDroiv();
    platformRootDir = projectRootDir && path.join(projectRootDir, 'platforms', platform);
  }

  if (!platformRootDir) {
    // If platformRootDir is still undefined, then we're probably is not inside of cordova project
    throw new Error('Current location is not a droiv project');
  }

  // CB-11174 Resolve symlinks first before working with root directory
  platformRootDir = util.convertToRealPathSafe(platformRootDir);

  var cached = cachedApis[platformRootDir];
  if (cached && cached.platform == platform) return cached;

  if (!platforms[platform]) throw new Error('Unknown platform ' + platform);

  var PlatformApi;

  var platformPath = platform + '_' + 'pack';
  var platformApiPath = path.join(__dirname, platformPath, 'Api.js');
  PlatformApi = require(platformApiPath);

  var platformApi = new PlatformApi(platform, platformRootDir, events);
  cachedApis[platformRootDir] = platformApi;
  return platformApi;
}

function getRealPlatformApi(platform, platformRootDir) {

  var cached; //= cachedApis[__dirname];
  if (cached && cached.platform == platform) return cached;

  if (!platforms[platform]) throw new Error('Unknown platform ' + platform);

  var PlatformApi;
  try {
    // First we need to find whether platform exposes its' API via js module
    // If it does, then we require and instantiate it.
    var platformPath = platform + '_' + 'pack';
    var platformApiPath = path.join(__dirname, platformPath, 'Api.js');
    PlatformApi = require(platformApiPath);
  } catch (err) {
    // Check if platform already compatible w/ PlatformApi and show deprecation warning
    if (err && err.code === 'MODULE_NOT_FOUND' && platforms[platform].apiCompatibleSince) {
      events.emit('warn', ' Using this version of droiv with older version of droiv-' + platform +
        ' is being deprecated. Consider upgrading to droiv-' + platform + '@' +
        platforms[platform].apiCompatibleSince + ' or newer.');
    } else {
      events.emit('warn', 'Error loading droiv-' + platform);
    }

    PlatformApi = require('./PlatformApiPoly');
  }

  var platformApi = new PlatformApi(platform, platformRootDir, events);
  // cachedApis[__dirname] = platformApi;
  return platformApi;
}

module.exports = platforms;

// We don't want these methods to be enumerable on the platforms object, because we expect enumerable properties of the
// platforms object to be platforms.
Object.defineProperties(module.exports, {
  'getPlatformApi': {
    value: getPlatformApi,
    configurable: true,
    writable: true
  },
  'getRealPlatformApi': {
    value: getRealPlatformApi,
    configurable: true,
    writable: true
  }
});