var util = require('../utils/util'),
  fs = require('fs'),
  path = require('path'),
  events = require('weexpack-common').events,
  lazy_load = require('./lazy_load'),
  CordovaError = require('weexpack-common').CordovaError,
  Q = require('q'),
  platforms = require('../platforms/platforms'),
  promiseutil = require('../utils/promise-util'),
  shell = require('shelljs'),
  _ = require('underscore'),
  platformMetadata = require('./platform_metadata');

// Expose the platform parsers on top of this command
for (var p in platforms) {
  module.exports[p] = platforms[p];
}

function update(projectRoot, targets) {
  return addHelper('update', projectRoot, targets);
}

function add(projectRoot, targets) {
  return addHelper('add', projectRoot, targets);
}

function addHelper(cmd, projectRoot, targets) {
  var msg;
  if (!targets || !targets.length) {
    msg = 'No platform specified. Please specify a platform to ' + cmd + '. ' +
      'See `' + 'droiv' + ' platform list`.';
    return Q.reject(new CordovaError(msg));
  }

  for (var i = 0; i < targets.length; i++) {
    if (!hostSupports(targets[i])) {
      msg = 'WARNING: Applications for platform ' + targets[i] +
        ' can not be built on this OS - ' + process.platform + '.';
      events.emit('log', msg);
    }
  }

  var platformsDir = path.join(projectRoot, 'platforms');
  shell.mkdir('-p', platformsDir);

  return Q().then(function () {
    return promiseutil.Q_chainmap(targets, function (target) {
      // For each platform, download it and call its helper script.
      var parts = target.split('@');
      var platform = parts[0];
      var spec = parts[1];

      return Q.when().then(function () {
        return downloadPlatform(projectRoot, platform, spec);
      }).then(function (platDetails) {
        platform = platDetails.platform;
        var platformPath = path.join(projectRoot, 'platforms', platform);
        var platformAlreadyAdded = fs.existsSync(platformPath);
        if (cmd == 'add') {
          if (platformAlreadyAdded) {
            throw new CordovaError('Platform ' + platform + ' already added.');
          }
        } else if (cmd == 'update') {
          if (!platformAlreadyAdded) {
            throw new CordovaError('Platform "' + platform + '" is not yet added. See `' +
              util.binname + ' platform list`.');
          }
        }

        if (/-nightly|-dev$/.exec(platDetails.version)) {
          msg = 'Warning: using prerelease platform ' + platform +
            '@' + platDetails.version +
            '.\nUse \'weexpack platform add ' +
            platform + '@latest\' to add the latest published version instead.';
          events.emit('warn', msg);
        }

        var options = {
          platformDetails: platDetails,
        };

        events.emit('log', (cmd === 'add' ? 'Adding ' : 'Updating ') + platform + ' project@' + platDetails.version + '...');

        var destination = path.resolve(projectRoot, 'platforms', platform);
        var promise;
        if (cmd === 'add') {
          promise = createPlatform(destination, options);
        } else {
          //promise = updatePlatform(destination, options);
        }
        return promise;
      });
    });
  });
}

function createPlatform(destinationDir, options) {
  if (!options || !options.platformDetails)
    return Q.reject(new CordovaError('Failed to find platform\'s \'create\' script. ' +
      'Either \'options\' parameter or \'platformDetails\' option is missing'));

  var templatePath = path.join(options.platformDetails.libDir, 'bin', 'templates');
  return Q().then(function () {
    copyPlatform(templatePath, destinationDir);
  });
}

function copyPlatform(templateDir, projectDir) {
  var templateFiles;
  templateFiles = fs.readdirSync(templateDir);
  // Copy each template file after filter
  for (var i = 0; i < templateFiles.length; i++) {
    var p = path.resolve(templateDir, templateFiles[i]);
    shell.cp('-R', p, projectDir);
  }
}

// Downloads via npm, Returns a Promise
function downloadPlatform(projectRoot, platform, version) {
  var target = version ? (platform + '@' + version) : platform;
  return Q().then(function () {
    return lazy_load.based_on_config(projectRoot, target);
  }).fail(function (error) {
    var message = 'Failed to fetch platform ' + target +
      '\nProbably this is either a connection problem, or platform spec is incorrect.' +
      '\nCheck your connection and platform name/version/URL.' +
      '\n' + error;
    return Q.reject(new CordovaError(message));
  }).then(function (libDir) {
    return getPlatformDetailsFromDir(libDir, platform);
  });
}

function platformFromName(name) {
  var platMatch = /^weexpack-([a-z0-9-]+)$/.exec(name);
  return platMatch && platMatch[1];
}

// Returns a Promise, Gets platform details from a directory
function getPlatformDetailsFromDir(dir, platformIfKnown) {
  var libDir = path.resolve(dir);
  var platform;
  var version;

  try {
    var pkg = require(path.join(libDir, 'package'));
    platform = platformFromName(pkg.name);
    version = pkg.version;
  } catch (e) {
    // Older platforms didn't have package.json.
    platform = platformIfKnown || platformFromName(path.basename(dir));
    var verFile = fs.existsSync(path.join(libDir, 'VERSION')) ? path.join(libDir, 'VERSION') :
      fs.existsSync(path.join(libDir, 'CordovaLib', 'VERSION')) ? path.join(libDir, 'CordovaLib', 'VERSION') : null;
    if (verFile) {
      version = fs.readFileSync(verFile, 'UTF-8').trim();
    }
  }

  return Q({
    libDir: libDir,
    platform: platform || platformIfKnown,
    version: version || '0.0.1'
  });
}

function remove(projectRoot, targets) {
  if (!targets || !targets.length) {
    return Q.reject(new CordovaError('No platform(s) specified. Please specify platform(s) to remove. See `' + util.binname + ' platform list`.'));
  }
  Q().then(function () {
    targets.forEach(function (target) {
      shell.rm('-rf', path.join(projectRoot, 'platforms', target));
      removePlatformPluginsJson(projectRoot, target);
    });
  }).then(function () {
    // Remove targets from platforms.json
    targets.forEach(function (target) {
      events.emit('verbose', 'Removing platform ' + target + ' from platforms.json file...');
      platformMetadata.remove(projectRoot, target);
    });
  }).then(function () {
    events.emit('log', 'Remove platform ' + targets + ' success');
  });
}

function addDeprecatedInformationToPlatforms(platformsList) {
  platformsList = platformsList.map(function (p) {
    var platformKey = p.split(' ')[0]; //Remove Version Information
    if (platforms[platformKey].deprecated) {
      p = p.concat(' ', '(deprecated)');
    }
    return p;
  });
  return platformsList;
}

function list(projectRoot) {
  Q().then(function () {
    return util.getInstalledPlatformsWithVersions(projectRoot);
  }).then(function (platformMap) {
    var platformsText = [];
    for (var plat in platformMap) {
      platformsText.push(platformMap[plat] ? plat + ' ' + platformMap[plat] : plat);
    }

    platformsText = addDeprecatedInformationToPlatforms(platformsText);
    var results = 'Installed platforms:\n  ' + platformsText.sort().join('\n  ') + '\n';
    var available = Object.keys(platforms).filter(hostSupports);

    available = available.filter(function (p) {
      return !platformMap[p]; // Only those not already installed.
    });

    available = available.map(function (p) {
      return p.concat(' ', platforms[p].version);
    });

    available = addDeprecatedInformationToPlatforms(available);
    results += 'Available platforms: \n  ' + available.sort().join('\n  ');

    events.emit('results', results);
  });
}

// Returns a promise.
module.exports = platform;

function platform(command, targets) {
  return Q().then(function () {
    var msg;
    var projectRoot = util.cdProjectRoot();

    if (arguments.length === 0) command = 'list';

    if (targets) {
      if (!(targets instanceof Array)) targets = [targets];
      targets.forEach(function (target) {
        var p = target.split('@')[0];
        if (p in platforms) return;
        var pPath = path.resolve(target);
        if (fs.existsSync(pPath)) return;

        var msg;
        if (/[~:/\\.]/.test(target)) {
          return;
        } else {
          msg = 'Platform "' + target +
            '" not recognized as a core weexpack platform. See `' +
            'droiv' + ' platform list`.';
        }
        throw new CordovaError(msg);
      });
    } else if (command == 'add' || command == 'rm') {
      msg = 'You need to qualify `add` or `remove` with one or more platforms!';
      return Q.reject(new CordovaError(msg));
    }

    switch (command) {
    case 'add':
      return add(projectRoot, targets);
    case 'rm':
    case 'remove':
      return remove(projectRoot, targets);
    case 'update':
    case 'up':
      return update(projectRoot, targets);
    default:
      return list(projectRoot);
    }
  });
}

// Used to prevent attempts of installing platforms that are not supported on
// the host OS. E.g. ios on linux.
function hostSupports(platform) {
  var p = platforms[platform] || {},
    hostos = p.hostos || null;
  if (!hostos)
    return true;
  if (hostos.indexOf('*') >= 0)
    return true;
  if (hostos.indexOf(process.platform) >= 0)
    return true;
  return false;
}

// Remove <platform>.json file from plugins directory.
function removePlatformPluginsJson(projectRoot, target) {
  var plugins_json = path.join(projectRoot, 'plugins', target + '.json');
  shell.rm('-f', plugins_json);
}

module.exports.add = add;
module.exports.remove = remove;
module.exports.update = update;
module.exports.list = list;
module.exports.getPlatformDetailsFromDir = getPlatformDetailsFromDir;