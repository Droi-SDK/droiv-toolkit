const path = require('path');
const chalk = require('chalk');
const child_process = require('child_process');
const fs = require('fs');
const {
  Config,
  androidConfigResolver,
  androidUniversalConfigResolver
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
    .then(resolveUniversalConfig)
    .then(resolveShareJava)
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
      console.log(`  You should run ${chalk.blue('droiv init')} first`);
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
  let androidConfig = new Config(androidConfigResolver, path.join(rootPath, 'config.json'), 'android');
  return androidConfig.getConfig().then((config) => {
    androidConfigResolver.resolve(config);
    return ({
      rootPath
    });
  });
}

function resolveUniversalConfig({
  rootPath
}) {
  let androidUniversalConfig = new Config(androidUniversalConfigResolver, path.join(rootPath, 'config.json'), 'universal');
  return androidUniversalConfig.getConfig().then((config) => {
    androidUniversalConfigResolver.resolve(config);
    return {
      rootPath
    };
  });
}

function resolveShareJava({
  rootPath
}) {
  var config = require(path.join(rootPath, 'config.json'))['universal'];
  var XDId = config['XDId'];

  var basePath = process.cwd();
  var oldPath = path.join(basePath, 'app/src/main/java/com/xiudian/', 'xdid');
  var newPath = path.join(basePath, 'app/src/main/java/com/xiudian/', XDId);
  var exists = fs.existsSync(oldPath);
  if (exists) {
    console.log(`${oldPath} 存在`)
    let r = new RegExp('(package com.xiudian.)[^.;]*(;)', 'g');
    let targetPath = path.join(basePath, 'app/src/main/java/com/xiudian/xdid/WBShareActivity.java');
    console.log("targetPath:" + targetPath);
    let source = fs.readFileSync(targetPath).toString();
    source = source.replace(r, '$1' + XDId + '$2');
    fs.writeFileSync(targetPath, source);

    let r2 = new RegExp('(package com.xiudian.)[^.;]*(.wxapi;)', 'g');
    let targetPath2 = path.join(basePath, 'app/src/main/java/com/xiudian/xdid/wxapi/WXEntryActivity.java');
    console.log("targetPath2:" + targetPath2);
    let source2 = fs.readFileSync(targetPath2).toString();
    source2 = source2.replace(r2, '$1' + XDId + '$2');
    fs.writeFileSync(targetPath2, source2);

    fs.renameSync(oldPath, newPath);
    return {
      rootPath
    };
  }
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