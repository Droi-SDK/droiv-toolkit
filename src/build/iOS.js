const path = require('path');
const chalk = require('chalk');
const child_process = require('child_process');
const fs = require('fs');
const utils = require('../utils');
const {
  Config,
  iOSConfigResolver
} = require('../utils/config');
//const startJSServer = require('../run/server');

function buildIOS() {
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
    .then(installDep)
    .then(resolveConfig)
    .then(doBuild)
    .catch((err) => {
      if (err) {
        console.log(err);
      }
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
        encoding: 'utf8'
      }, function () {
        resolve({
          rootPath
        });
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
    return {};
  });
}

function doBuild() {
  return new Promise((resolve,reject) => {
    let child = child_process.exec(path.join(__dirname, 'lib/cocoapods-build') + ' . Debug', {
      encoding: 'utf8',
      maxBuffer: 2000*1024
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