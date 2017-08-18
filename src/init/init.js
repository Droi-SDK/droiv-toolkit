var path = require('path'),
  Q = require('q'),
  fs = require('fs'),
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

function initT (dir, optionalId, optionalName, cfg, extEvents) {
  var argumentCount = arguments.length;
  return Q.fcall(function () {
    events = setupEvents(extEvents);
    logger.info('234');
    throw new Error('222');
    if (!dir) {
      throw new CordovaError('Directory not specified. See `weexpack --help`.');
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
    events.emit('log', 'Creating a new weex project.');
    var cfgToPersistToDisk = JSON.parse(JSON.stringify(cfg));
    delete cfgToPersistToDisk.lib.www;
    if (Object.keys(cfgToPersistToDisk.lib).length === 0) {
      delete cfgToPersistToDisk.lib;
    }
    cfg.lib.www.url = path.resolve(cfg.lib.www.url);
    return Q(cfg.lib.www.url);
  }).then(
    
  );
}