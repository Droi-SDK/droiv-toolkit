var path = require('path'),
  events = require('weexpack-common').events,
  logger = require('weexpack-common').CordovaLogger.get(),
  nopt,
  Q = require('q');
var lib = require('./lib');

module.exports = function (inputArgs) {
  initRequire();
  var cmd = inputArgs[2];
  var subcommand = getSubCommand(inputArgs, cmd);
  console.log('subcommand', subcommand);
  Q().then(function () {
    return cli(inputArgs);
  }).fail(function (err) {
    throw err;
  }).done();
};

function getSubCommand(args, cmd) {
  var subCommands = [
    'platform',
    'platforms',
    'plugin',
    'plugins',
  ];
  if (subCommands.indexOf(cmd) != -1) {
    return args[3];
  }
  return null;
}

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

  process.on('uncaughtException', function (err) {
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
  var subcommand;
  if (!cmd || cmd == 'help' || args.help) {
    if (!args.help && remain[0] == 'help') {
      remain.shift();
    }
  }

  if (cmd == 'create') {
    return initTemplate();
  } else {
    // TODO
    //platform/plugin
    subcommand = undashed[1];
    var targets = undashed.slice(2); // array of targets, either platforms or plugins
    var cli_vars = {};
    if (args.variable) {
      args.variable.forEach(function (s) {
        // CB-9171
        var eq = s.indexOf('=');
        if (eq == -1)
          throw new Error('invalid variable format: ' + s);
        var key = s.substr(0, eq).toUpperCase();
        var val = s.substr(eq + 1, s.length);
        cli_vars[key] = val;
      });
    }
    return lib.raw[cmd](subcommand, targets, []);
  }

  function initTemplate() {
    var cfg; // init config
    var customWww; // Template path
    var wwwCfg; // Template config
    // If we got a fourth parameter, consider it to be JSON to init the config.
    if (undashed[4])
      cfg = JSON.parse(undashed[4]);
    else
      cfg = {};

    customWww = args['copy-from'] || args['link-to'] || args.template;

    if (customWww) {
      if (!args.template && !args['copy-from'] && customWww.indexOf('http') === 0) {
        // throw new CordovaError(
        //   'Only local paths for custom www assets are supported for linking' + customWww
        // );
      }

      // Resolve tilda
      if (customWww.substr(0, 1) === '~')
        customWww = path.join(process.env.HOME, customWww.substr(1));

      wwwCfg = {
        url: customWww,
        template: false,
        link: false
      };

      if (args['link-to']) {
        wwwCfg.link = true;
      }
      if (args.template) {
        wwwCfg.template = true;
      } else if (args['copy-from']) {
        wwwCfg.template = true;
      }

      cfg.lib = cfg.lib || {};
      cfg.lib.www = wwwCfg;
    }

    return lib.raw.create(undashed[1] // dir to create the project in
      , undashed[2] // App id
      , undashed[3] // App name
      , cfg, events || undefined
    );
  }
}


function initRequire() {
  try {
    nopt = require('nopt');
    //_ = require('underscore');
  } catch (e) {
    console.error(
      'Please run npm install from this directory:\n\t' +
      path.dirname(__dirname)
    );
    process.exit(2);
  }
}