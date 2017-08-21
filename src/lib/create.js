var path = require('path'),
  Q = require('q'),
  fs = require('fs'),
  shell = require('shelljs'),
  lazy_load = require('./lazy_load'),
  platform = require('./platform'),
  events = require('weexpack-common').events,
  CordovaError = require('weexpack-common').CordovaError,
  logger = require('weexpack-common').CordovaLogger.get();

function setupEvents(externalEventEmitter) {
  if (externalEventEmitter) {
    events.forwardEventsTo(externalEventEmitter);
  } else {
    logger.subscribe(events);
  }
  return events;
}

module.exports = function (dir, optionalId, optionalName, cfg, extEvents) {
  if (extEvents) {
    return initT(dir, optionalId, optionalName, cfg, extEvents);
  } else {
    return initT(dir, optionalId, optionalName, cfg, events);
  }
};

function initT(dir, optionalId, optionalName, cfg, extEvents) {
  var target = 'vue';
  return Q.fcall(
      function () {
        events = setupEvents(extEvents);
        if (!dir) {
          throw new CordovaError('Directory not specified. See `droiv --help`.');
        }
        var finalConfig = {};
        cfg = finalConfig;
        if (!cfg) {
          throw new CordovaError('Must provide a project configuration.');
        } else if (typeof cfg == 'string') {
          cfg = JSON.parse(cfg);
        }

        if (optionalId) cfg.id = optionalId;
        if (optionalName) cfg.name = optionalName;

        // Make absolute.
        dir = path.resolve(dir);

        var sanedircontents = function (d) {
          var contents = fs.readdirSync(d);
          if (contents.length === 0) {
            return true;
          } else if (contents.length == 1) {
            if (contents[0] == '.cordova') {
              return true;
            }
          }
          return false;
        };

        if (fs.existsSync(dir) && !sanedircontents(dir)) {
          throw new CordovaError('Path already exists and is not empty: ' + dir);
        }

        // if (cfg.id && !validateIdentifier(cfg.id)) {
        //   throw new CordovaError('App id contains a reserved word, or is not a valid identifier.');
        // }

        // This was changed from "uri" to "url", but checking uri for backwards compatibility.
        cfg.lib = cfg.lib || {};
        cfg.lib.www = cfg.lib.www || {};
        cfg.lib.www.url = cfg.lib.www.url || cfg.lib.www.uri;

        if (!cfg.lib.www.url) {
          cfg.lib.www.url = path.join(__dirname, 'templates');
        }
        cfg.lib.www.version = cfg.lib.www.version || 'not_versioned';
        cfg.lib.www.id = cfg.lib.www.id || 'dummy_id';
        var rel_path = path.relative(cfg.lib.www.url, dir);
        var goes_up = rel_path.split(path.sep)[0] == '..';

        if (!(goes_up || rel_path[1] == ':')) {
          throw new CordovaError(
            'Project dir "' + dir +
            '" must not be created at/inside the template used to create the project "' +
            cfg.lib.www.url + '".'
          );
        }
      })
    .then(function () {
      events.emit('log', 'Creating a new droiv project.');
      var cfgToPersistToDisk = JSON.parse(JSON.stringify(cfg));
      delete cfgToPersistToDisk.lib.www;
      if (Object.keys(cfgToPersistToDisk.lib).length === 0) {
        delete cfgToPersistToDisk.lib;
      }
      cfg.lib.www.url = path.resolve(cfg.lib.www.url);
      return Q(cfg.lib.www.url);
    }).then(function () {
      var projectRoot = dir;
      var opts = opts || {};
      opts.platforms = target;
      //process.chdir(projectRoot);
      return downloadVueTemplate(projectRoot, target, opts);
    });
}

function downloadVueTemplate(projectRoot, target, opts) {
  return Q().then(function () {
    return lazy_load.based_on_config(projectRoot, target, opts);
  }).then(function (libDir) {
    return platform.getPlatformDetailsFromDir(libDir, target);
  }).then(function (platDetails) {
    platform = platDetails.platform;
    var destination = path.resolve(projectRoot);
    var templatePath = path.join(platDetails.libDir, 'bin', 'templates');
    return Q().then(function () {
      copyTemplateFiles(templatePath, destination);
    });
  });
}

function copyTemplateFiles(templateDir, projectDir) {
  var templateFiles; // Current file
  templateFiles = fs.readdirSync(templateDir);
  // Remove directories, and files that are unwanted

  // Copy each template file after filter
  for (var i = 0; i < templateFiles.length; i++) {
    var p = path.resolve(templateDir, templateFiles[i]);
    shell.cp('-R', p, projectDir);
  }

  if (!fs.existsSync(path.join(projectDir, 'platforms')))
    shell.mkdir(path.join(projectDir, 'platforms'));

  if (!fs.existsSync(path.join(projectDir, 'plugins')))
    shell.mkdir(path.join(projectDir, 'plugins'));
}