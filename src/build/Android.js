const path = require('path');
const chalk = require('chalk');
const child_process = require('child_process');
const {
  Config,
  androidConfigResolver
} = require('../utils/config');
const utils = require('../utils');
const copy = require('recursive-copy');
//const startJSServer = require('../run/server');

function buildAndroid() {
  utils.buildJS()
    .then(() => {
      return new Promise((resolve, reject) => {
        copy('./dist/', 'platforms/android/app/src/main/assets/dist', {
          overwrite: true
        }, function (err) {
          if (err) return reject(err);
          else resolve();
        });
      });
    })
    // .then(() => {
    //   startJSServer();
    //   return;
    // })
    .then(prepareAndroid)
    .then(resolveConfig)
    .then(buildApp)
    .catch((err) => {
      if (err) {
        console.log(err);
      }
    });
}

function prepareAndroid() {
  return new Promise((resolve, reject) => {
    const rootPath = process.cwd();

    if (!utils.checkAndroid(rootPath)) {
      console.log();
      console.log(chalk.red('  Android project not found !'));
      console.log();
      console.log(`  You should run ${chalk.blue('weexpack init')} first`);
      reject();
    }

    console.log();
    console.log(` => ${chalk.blue.bold('Will build Android app')}`);

    // change working directory to android
    process.chdir(path.join(rootPath, 'platforms/android'));
    if (!process.env.ANDROID_HOME) {
      console.log();
      console.log(chalk.red('  Environment variable $ANDROID_HOME not found !'));
      console.log();
      console.log(`  You should set $ANDROID_HOME first.`);
      console.log(`  See ${chalk.cyan('http://stackoverflow.com/questions/19986214/setting-android-home-enviromental-variable-on-mac-os-x')}`);
      reject();
    }
    resolve({
      rootPath
    });
  });
}

function resolveConfig({
  rootPath
}) {
  let androidConfig = new Config(androidConfigResolver, path.join(rootPath, 'android.config.json'));
  return androidConfig.getConfig().then((config) => {
    androidConfigResolver.resolve(config);
    return;
  });
}

function buildApp() {
  return new Promise((resolve, reject) => {
    console.log(` => ${chalk.blue.bold('Building app ...')}`);
    try {
      let clean = ' clean';
      child_process.execSync(process.platform === 'win32' ? `call gradlew.bat${clean} assemble` : `./gradlew${clean} assemble`, {
        encoding: 'utf8',
        stdio: [0, 1, 2]
      });
    } catch (e) {
      reject();
    }
    resolve();
  });
}

module.exports = buildAndroid;