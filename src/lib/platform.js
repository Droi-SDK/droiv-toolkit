var util = require('../utils/util'),
  ConfigParser = require('weexpack-common').ConfigParser,
  fs = require('fs'),
  path = require('path'),
  HooksRunner = require('../hooks/HooksRunner'),
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

function update(hooksRunner, projectRoot, targets, opts) {
  return addHelper('update', hooksRunner, projectRoot, targets, opts);
}

function add(hooksRunner, projectRoot, targets, opts) {
  return addHelper('add', hooksRunner, projectRoot, targets, opts);
}

function addHelper(cmd, hooksRunner, projectRoot, targets, opts) {
  var msg;
  if (!targets || !targets.length) {
    msg = 'No platform specified. Please specify a platform to ' + cmd + '. ' +
      'See `' + util.binname + ' platform list`.';
    return Q.reject(new CordovaError(msg));
  }

  for (var i = 0; i < targets.length; i++) {
    if (!hostSupports(targets[i])) {
      msg = 'WARNING: Applications for platform ' + targets[i] +
        ' can not be built on this OS - ' + process.platform + '.';
      events.emit('log', msg);
    }
  }

  var xml = util.projectConfig(projectRoot);
  var cfg = new ConfigParser(xml);
  opts = opts || {};

  // The "platforms" dir is safe to delete, it's almost equivalent to
  // cordova platform rm <list of all platforms>
  var platformsDir = path.join(projectRoot, 'platforms');
  shell.mkdir('-p', platformsDir);

  return hooksRunner.fire('before_platform_' + cmd, opts)
    .then(function () {
      return promiseutil.Q_chainmap(targets, function (target) {
        // For each platform, download it and call its helper script.
        var parts = target.split('@');
        var platform = parts[0];
        var spec = parts[1];

        return Q.when().then(function () {
          if (!(platform in platforms)) {
            spec = platform;
            platform = null;
          }
          if (platform && !spec && cmd == 'add') {
            events.emit('verbose', 'No version supplied. Retrieving version from config.xml...');
            spec = getVersionFromConfigFile(platform, cfg);
          }
          if (spec) {
            var maybeDir = util.fixRelativePath(spec);
            if (util.isDirectory(maybeDir)) {
              return getPlatformDetailsFromDir(maybeDir, platform);
            }
          }
          return downloadPlatform(projectRoot, platform, spec, opts);
        }).then(function (platDetails) {
          platform = platDetails.platform;
          var platformPath = path.join(projectRoot, 'platforms', platform);
          var platformAlreadyAdded = fs.existsSync(platformPath);
          if (cmd == 'add') {
            if (platformAlreadyAdded) {
              throw new CordovaError('Platform ' + platform + ' already added.');
            }
            // Remove the <platform>.json file from the plugins directory, so we start clean (otherwise we
            // can get into trouble not installing plugins if someone deletes the platform folder but
            // <platform>.json still exists).
            //WEEX_HOOK
            //removePlatformPluginsJson(projectRoot, target);
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
            // We need to pass a platformDetails into update/create
            // since PlatformApiPoly needs to know something about
            // platform, it is going to create.
            platformDetails: platDetails,
            link: opts.link,
            ali: opts.ali
          };

          events.emit('log', (cmd === 'add' ? 'Adding ' : 'Updating ') + platform + ' project@' + platDetails.version + '...');

          var PlatformApi = require('../platforms/PlatformApiPoly');

          var destination = path.resolve(projectRoot, 'platforms', platform);
          var promise;
          if (cmd === 'add') {
            promise = PlatformApi.createPlatform(destination, cfg, options, events);
          } else {
            promise = PlatformApi.updatePlatform(destination, options, events);
          }
          return promise;
        });
      });
    }).then(function () {
      return hooksRunner.fire('after_platform_' + cmd, opts);
    });
}

// Downloads via npm or via git clone (tries both)
// Returns a Promise
function downloadPlatform(projectRoot, platform, version, opts) {
  var target = version ? (platform + '@' + version) : platform;
  return Q().then(function () {
    return lazy_load.based_on_config(projectRoot, target, opts);
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

// Returns a Promise
// Gets platform details from a directory
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

function getVersionFromConfigFile(platform, cfg) {
  if (!platform || (!(platform in platforms))) {
    throw new CordovaError('Invalid platform: ' + platform);
  }

  // Get appropriate version from config.xml
  var engine = _.find(cfg.getEngines(), function (eng) {
    return eng.name.toLowerCase() === platform.toLowerCase();
  });

  return engine && engine.spec;
}

function remove(hooksRunner, projectRoot, targets, opts) {
  if (!targets || !targets.length) {
    return Q.reject(new CordovaError('No platform(s) specified. Please specify platform(s) to remove. See `' + util.binname + ' platform list`.'));
  }
  return hooksRunner.fire('before_platform_rm', opts)
    .then(function () {
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
      return hooksRunner.fire('after_platform_rm', opts);

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

function list(hooksRunner, projectRoot, opts) {
  return hooksRunner.fire('before_platform_ls', opts)
    .then(function () {
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
    }).then(function () {
      return hooksRunner.fire('after_platform_ls', opts);
    });
}

// Returns a promise.
module.exports = platform;

function platform(command, targets, opts) {
  // CB-10519 wrap function code into promise so throwing error
  // would result in promise rejection instead of uncaught exception
  return Q().then(function () {
    var msg;
    //for test
    var projectRoot = util.cdProjectRoot();
    var hooksRunner = new HooksRunner(projectRoot);

    if (arguments.length === 0) command = 'ls';

    // Verify that targets look like platforms. Examples:
    // - android
    // - android@3.5.0
    // - ../path/to/dir/with/platform/files
    // - https://github.com/apache/cordova-android.git
    if (targets) {
      if (!(targets instanceof Array)) targets = [targets];
      targets.forEach(function (t) {
        // Trim the @version part if it's there.
        var p = t.split('@')[0];
        // OK if it's one of known platform names.
        if (p in platforms) return;
        // Not a known platform name, check if its a real path.
        var pPath = path.resolve(t);
        if (fs.existsSync(pPath)) return;

        var msg;
        // If target looks like a url, we will try cloning it with git
        if (/[~:/\\.]/.test(t)) {
          return;
        } else {
          // Neither path, git-url nor platform name - throw.
          msg = 'Platform "' + t +
            '" not recognized as a core weexpack platform. See `' +
            util.binname + ' platform list`.';
        }
        throw new CordovaError(msg);
      });
    } else if (command == 'add' || command == 'rm') {
      msg = 'You need to qualify `add` or `remove` with one or more platforms!';
      return Q.reject(new CordovaError(msg));
    }

    opts = opts || {};
    opts.platforms = targets;

    switch (command) {
    case 'add':
      return add(hooksRunner, projectRoot, targets, opts);
    case 'rm':
    case 'remove':
      return remove(hooksRunner, projectRoot, targets, opts);
    case 'update':
    case 'up':
      return update(hooksRunner, projectRoot, targets, opts);
    default:
      return list(hooksRunner, projectRoot, opts);
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