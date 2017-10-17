const path = require('path');
const chalk = require('chalk');
const child_process = require('child_process');
const fs = require('fs');
const utils = require('../utils');
const {
  Config,
  iOSConfigResolver,
  iOSUniversalConfigResolver
} = require('../utils/config');
//const startJSServer = require('../run/server');
var export_method;

function buildIOS(options) {
  console.log("mod:" + options);
  export_method = options;
  utils.checkAndInstallForIosDeploy()
    .then(utils.buildJS)
    .then(() => {
      return utils.exec('rsync  -r -q ./dist/* platforms/ios/bundlejs/');
    })
    // .then(() => {
    //   startJSServer();
    //   return;
    // })
    .then(prepareIOS)
    .then(resolveExportOptions)
    .then(resolveConfig)
    .then(resolveUniversalConfig)
    .then(fastlane_produce)
    .then(fastlane_sigh)
    .then(installDep)
    .then(doBuild)
    .catch((err) => {
      if (err) {
        console.log(err);
      }
    });
}

function fastlane_produce({
  rootPath
}) {
  let cmd = 'fastlane doProduce';
  return new Promise((resolve, reject) => {
    let child = child_process.exec(cmd, {
      encoding: 'utf8',
      maxBuffer: 2000 * 1024
    }, function (error) {
      if (error) {
        console.error(`exec error: ${error}`);
        reject('fastlane init error');
        return;
      }
      console.log('fastlane init success!');
      resolve({
        rootPath
      });
    });
    child.stdout.pipe(process.stdout);
    child.stderr.pipe(process.stderr);
  });
}

function fastlane_sigh({
  rootPath
}) {
  let cmd;
  if (export_method == 'adhoc') {
    cmd = 'fastlane doSighAdhoc';
  } else {
    cmd = 'fastlane doSigh';
  }

  return new Promise((resolve, reject) => {
    let child = child_process.exec(cmd, {
      encoding: 'utf8',
      maxBuffer: 2000 * 1024
    }, function (error) {
      if (error) {
        console.error(`exec error: ${error}`);
        reject('fastlane sigh error');
        return;
      }
      console.log('fastlane sigh success!');
      resolve({
        rootPath
      });
    });
    child.stdout.pipe(process.stdout);
    child.stderr.pipe(process.stderr);
  });
}

function resolveExportOptions({
  rootPath
}) {
  var config = require(path.join(rootPath, 'ios.config.json'));
  var AppId = config['AppId'];
  var method = '';
  if (export_method == 'adhoc') {
    method = 'AdHoc';
  } else {
    method = 'AppStore';
  }
  let r = new RegExp('(<key>provisioningProfiles</key>\\s*<dict>\\s*<key>)[^<>]*?(<\/key>\\s*<string>)[^<>]*?(<\/string>)', 'g');
  let targetPath = path.join(process.cwd(), 'ExportOptions.plist');
  console.log("targetPath:" + targetPath);
  let source = fs.readFileSync(targetPath).toString();
  source = source.replace(r, '$1' + AppId + '$2' + AppId + " " + method + '$3');
  fs.writeFileSync(targetPath, source);
  return ({
    rootPath
  });
}

function prepareIOS() {
  return new Promise((resolve, reject) => {
    const rootPath = process.cwd();
    if (!utils.checkIOS(rootPath)) {
      console.log();
      console.log(chalk.red('  iOS project not found !'));
      console.log();
      console.log(`  You should run ${chalk.blue('weexpack init')} first`);
      reject();
    }

    process.chdir(path.join(rootPath, 'platforms/ios'));
    const xcodeProject = utils.findXcodeProject(process.cwd());
    if (xcodeProject) {
      console.log();
      resolve({
        rootPath
      });
    } else {
      console.log();
      console.log(`  ${chalk.red.bold('Could not find Xcode project files in ios folder')}`);
      console.log();
      console.log(`  Please make sure you have installed iOS Develop Environment and CocoaPods`);
      console.log(`  See ${chalk.cyan('http://alibaba.github.io/weex/doc/advanced/integrate-to-ios.html')}`);
      reject();
    }
  });
}

function installDep({
  rootPath
}) {
  return new Promise((resolve, reject) => {
    try {
      console.log(` => ${chalk.blue.bold('pod install')}`);
      let child = child_process.exec('pod install --no-repo-update', {
        encoding: 'utf8',
        maxBuffer: 2000 * 1024
      }, function (error) {
        if (error) {
          console.error(`exec error: ${error}`);
          reject('pod install error');
          return;
        }
        console.log('pod install success!');
        resolve(rootPath);
      });
      child.stdout.pipe(process.stdout);
      child.stderr.pipe(process.stderr);
    } catch (e) {
      reject(e);
    }
  });
}

function resolveConfig({
  rootPath
}) {
  let iOSConfig = new Config(iOSConfigResolver, path.join(rootPath, 'ios.config.json'));
  return iOSConfig.getConfig().then((config) => {
    iOSConfigResolver.resolve(config);
    fs.writeFileSync(path.join(process.cwd(), 'bundlejs/index.js'), fs.readFileSync(path.join(process.cwd(), '../../dist', config.WeexBundle.replace(/\.we$/, '.js'))));
    return {
      rootPath
    };
  });
}

function resolveUniversalConfig({
  rootPath
}) {
  let iOSUniversalConfig = new Config(iOSUniversalConfigResolver, path.join(rootPath, 'universal.config.json'));
  return iOSUniversalConfig.getConfig().then((config) => {
    iOSUniversalConfigResolver.resolve(config);
    return {};
  });
}

function doBuild() {
  return new Promise((resolve, reject) => {
    let child = child_process.exec(path.join(__dirname, 'lib/build_archive') + ' . ' + export_method, {
      encoding: 'utf8',
      maxBuffer: 2000 * 1024
    }, function (error) {
      if (error) {
        console.error(`exec error: ${error}`);
        reject('doBuild error');
        return;
      }
      console.log('Build success!');
      resolve();
    });
    child.stdout.pipe(process.stdout);
    child.stderr.pipe(process.stderr);
  });
}

module.exports = buildIOS;