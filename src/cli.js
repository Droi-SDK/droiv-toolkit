var path = require('path'),
  events = require('weexpack-common').events,
  logger = require('weexpack-common').CordovaLogger.get(),
  nopt,
  Q = require('q'),
  lib = require('./lib');

module.exports = function (inputArgs) {
  initRequire();

  Q().then(function () {
    return cli(inputArgs);
  }).fail(function (err) {
    throw err;
  }).done();
};

function cli(inputArgs) {
  var knownOpts = {
    'version': Boolean,
    'help': Boolean,
  };

  var shortHands = {
    'v': '--version',
    'h': '--help',
  };

  var args = nopt(knownOpts, shortHands, inputArgs);

  // catch uncaughtException
  process.on('uncaughtException', function (err) {
    // TODO delete log
    console.log(err);
    logger.error(err);
    process.exit(1);
  });
  logger.subscribe(events);

  var unparsedArgs = [];
  var parseStopperIdx = args.argv.original.indexOf('--');
  if (parseStopperIdx != -1) {
    unparsedArgs = args.argv.original.slice(parseStopperIdx + 1);
  }
  var remain = args.argv.remain;

  var undashed = remain.slice(0, remain.length - unparsedArgs.length);
  var cmd = undashed[0];

  if (!cmd || cmd == 'help' || args.help) {
    if (!args.help && remain[0] == 'help') {
      remain.shift();
    }
  }

  if (cmd == 'create') {
    var dir = undashed[1];
    return lib.create(dir, events || undefined);
    //return lib.raw.create(dir, events || undefined);

  } else {
    // TODO
    // platform/plugin
    var subcommand = undashed[1]; // such as add list
    var targets = undashed.slice(2); // array of targets
    if (cmd == 'platform') {
      return lib.platform(subcommand, targets);
    }
  }
}

function initRequire() {
  try {
    nopt = require('nopt');
  } catch (e) {
    console.error(
      'Please run npm install from this directory:\n\t' +
      path.dirname(__dirname)
    );
    process.exit(2);
  }
}