#!/usr/bin/env node

const program = require('commander');
const chalk = require('chalk');
const cli = require('../src/cli');

program
  .usage('<cp> [shop_id]')
  .parse(process.argv);

function printExample() {
  console.log('  Examples:');
  console.log();
  console.log(chalk.grey('    # copy src from custom/[shop_id]'));
  console.log('    $ ' + chalk.blue('droiv cp xd111111'));
  console.log();
}

program.on('--help', printExample);

let args = [];
process.argv.forEach(function (arg, i) {
  if (arg != '[object Object]') { //fix commander’s bug
    args.push(arg);
    if (i == 1) {
      args.push('cp');
    }
  }
});

const shop_id = args[3];

if (!shop_id) {
  var msg = chalk.red('Invalid project name: ') + chalk.yellow(shop_id);
  console.log(msg);
  process.exit();
}

cli(args);

if (program.args.length < 1) {
  program.help();
  process.exit();
}