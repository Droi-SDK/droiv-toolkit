#!/usr/bin/env node

const program = require('commander');
const chalk = require('chalk');
const runAndroid = require('../src/run/Android');
const runIOS = require('../src/run/iOS');
//const runWeb = require('../src/run/Web');

program
  .usage('<platform> [options]')
  .option('-c, --config [path]', 'specify the configuration file')
  .option('-C, --clean', 'clean project before build android app')
  .parse(process.argv);

function printExample() {
  console.log('  Examples:');
  console.log();
  console.log(chalk.grey('    # run droiv Android project'));
  console.log('    $ ' + chalk.blue('droiv run android'));
  console.log();
  console.log(chalk.grey('    # run droiv iOS project'));
  console.log('    $ ' + chalk.blue('droiv run ios'));
  console.log();
  console.log(chalk.grey('    # run droiv web'));
  console.log('    $ ' + chalk.blue('droiv run web'));
  console.log();
}

program.on('--help', printExample);

function isValidPlatform(args) {
  if (args && args.length) {
    return args[0] === 'android' || args[0] === 'ios' || args[0] === 'web';
  }
  return false;
}

/**
 * Run droiv app on the specific platform
 * @param {String} platform
 */
function run(platform, options) {
  switch (platform) {
    case 'android':
      runAndroid(options);
      break;
    case 'ios':
      runIOS(options);
      break;
    case 'web':
      //runWeb(options);
      break;
  }
}

// check if platform exist
if (program.args.length < 1) {
  program.help();
  process.exit();
}

if (isValidPlatform(program.args)) {
  // TODO: parse config file
  run(program.args[0], {
    configPath: program.config,
    clean: program.clean
  });
} else {
  console.log();
  console.log(`${chalk.red('Unknown platform:')} ${chalk.yellow(program.args[0])}`);
  console.log();
  printExample();
  process.exit();
}