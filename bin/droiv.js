#!/usr/bin/env node

const program = require('commander');
program
  .version(require('../package.json').version)
  .usage('<command> [options]')
  .command('create [name]', 'initialize a standard droiv project')
  .command('platform [command]', 'command for add or remove a  platform project')
  .command('run [platform]', 'run droiv app on the specific platform')
  .command('build [platform]', 'build droiv app generator package(apk or ipa)');
program.parse(process.argv);

if (program.args.length < 1) {
  program.help();
  process.exit();
}

if (program.args.length >= 1) {
  var isSupport = false;
  var list = ['create', 'platform', 'run', 'build', 'plugin', 'droivplugin', 'market'];
  for (var i = 0; i < list.length; i++) {
    if (program.args[0] == list[i]) {
      isSupport = true;
      break;
    }
  }
  if (!isSupport) {
    console.log('  error: unknown command "' + program.args[0] + '"');
    process.exit();
  }
}