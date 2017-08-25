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

module.exports = create;

function create(dir, extEvents) {
  if (extEvents) {
    return setupAndCheck(dir, extEvents);
  } else {
    return setupAndCheck(dir, events);
  }
}

function setupAndCheck(dir, extEvents) {
  var target = 'vue';
  return Q.fcall(
    function () {
      events = setupEvents(extEvents);
      if (!dir) {
        throw new CordovaError('Directory not specified. See `droiv --help`.');
      }
      dir = path.resolve(dir);
      var sanedircontents = function (dir) {
        var contents = fs.readdirSync(dir);
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
      events.emit('log', 'Download template.');
      return downloadVueTemplate(dir, target);
    });
}

function downloadVueTemplate(projectRoot, target) {
  return Q().then(function () {
    return lazy_load.based_on_config(projectRoot, target);
  }).then(function (libDir) {
    return platform.getPlatformDetailsFromDir(libDir, target);
  }).then(function (platDetails) {
    events.emit('log', 'Creating a new droiv project.');
    var destination = path.resolve(projectRoot);
    if (!fs.existsSync(destination))
      shell.mkdir(destination);
    var templatePath = path.join(platDetails.libDir, 'bin', 'templates');
    return Q().then(function () {
      copyTemplateFiles(templatePath, destination);
    });
  });
}

function copyTemplateFiles(templateDir, projectDir) {
  var templateFiles;
  templateFiles = fs.readdirSync(templateDir);
  for (var i = 0; i < templateFiles.length; i++) {
    var p = path.resolve(templateDir, templateFiles[i]);
    shell.cp('-R', p, projectDir);
  }

  if (!fs.existsSync(path.join(projectDir, 'platforms')))
    shell.mkdir(path.join(projectDir, 'platforms'));

  if (!fs.existsSync(path.join(projectDir, 'plugins')))
    shell.mkdir(path.join(projectDir, 'plugins'));
}