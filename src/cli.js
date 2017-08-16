var path = require("path"),
  nopt;

module.exports = function (inputArgs) {
  initRequire();
  var cmd = inputArgs[2];
  var subcommand = getSubCommand(inputArgs, cmd);
  console.log("====================================");
  console.log("subcommand", subcommand);
  console.log("====================================");
  cli(inputArgs);
};

function getSubCommand(args, cmd) {
  var subCommands = [
    "platform",
    "platforms",
    "plugin",
    "plugins",
  ];
  if (subCommands.indexOf(cmd)) {
    return args[3];
  }
  return null;
}

function cli(inputArgs) {
  var knownOpts = {
    "version": Boolean,
    "help": Boolean,
  };

  var shortHands = {
    "v": "--version",
    "h": "--help",
  };

  var args = nopt(knownOpts, shortHands, inputArgs);
  process.on("uncaughtException", function (err) {
    //logger.error(err);
    console.log("====================================");
    console.log(err);
    console.log("====================================");
    process.exit(1);
  });

  var unparsedArgs = [];
  var parseStopperIdx = args.argv.original.indexOf("--");
  if (parseStopperIdx != -1) {
    unparsedArgs = args.argv.original.slice(parseStopperIdx + 1);
  }
  var remain = args.argv.remain;
  
  var undashed = remain.slice(0, remain.length - unparsedArgs.length);
  var cmd = undashed[0];
  var subcommand;
  if (!cmd || cmd == "help" || args.help) {
    if (!args.help && remain[0] == "help") {
      remain.shift();
    }
    //return help(remain);
  }

  if (cmd == "init") {
    init();
  } else {
    // TODO
    //platform/plugin
    console.log("====================================");
    console.log(subcommand);
    console.log("====================================");
  }

  function init() {
    var cfg; // init config
    var customWww; // Template path
    var wwwCfg; // Template config

    // If we got a fourth parameter, consider it to be JSON to init the config.
    if (undashed[4])
      cfg = JSON.parse(undashed[4]);
    else
      cfg = {};

    customWww = args["copy-from"] || args["link-to"] || args.template;

    if (customWww) {
      if (!args.template && !args["copy-from"] && customWww.indexOf("http") === 0) {
        // throw new CordovaError(
        //   "Only local paths for custom www assets are supported for linking" + customWww
        // );
      }

      // Resolve tilda
      if (customWww.substr(0, 1) === "~")
        customWww = path.join(process.env.HOME, customWww.substr(1));

      wwwCfg = {
        url: customWww,
        template: false,
        link: false
      };

      if (args["link-to"]) {
        wwwCfg.link = true;
      }
      if (args.template) {
        wwwCfg.template = true;
      } else if (args["copy-from"]) {
        // logger.warn("Warning: --copy-from option is being deprecated. Consider using --template instead.");
        wwwCfg.template = true;
      }

      cfg.lib = cfg.lib || {};
      cfg.lib.www = wwwCfg;
    }

    return cordova.raw.create(undashed[1] // dir to create the project in
      , undashed[2] // App id
      , undashed[3] // App name
      , cfg, events || undefined
    );
  }
}

function initRequire() {
  try {
    nopt = require("nopt");
    //_ = require("underscore");
  } catch (e) {
    console.error(
      "Please run npm install from this directory:\n\t" +
      path.dirname(__dirname)
    );
    process.exit(2);
  }
}