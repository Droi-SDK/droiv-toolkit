const Fs = require('fs');
const Path = require('path');
const Inquirer = require('inquirer');
class Config {
  constructor(properties, path, platform) {
    this.path = path;
    this.platform = platform;
    if (properties instanceof ConfigResolver) {
      let map = {};
      this.properties = [];
      for (let key in properties.def) {
        for (let propName in properties.def[key]) {
          if (!map[propName]) {
            this.properties.push({
              name: propName,
              desc: properties.def[key].desc || 'enter your ' + propName + ':'
            });
            map[propName] = true;
          }
        }
      }
    } else {
      this.properties = properties.split(',').map(prop => {
        var splits = prop.split('|');
        return {
          name: splits[0],
          desc: splits[1] || 'enter your ' + splits[0] + ':'
        };
      });
    }
  }

  getConfig() {
    return new Promise((resolve) => {
      let config = {};
      try {
        config = require(this.path)[this.platform];
      } catch (e) {
        console.log(e);
      }
      var questions = [],
        answers = {};
      console.log('============build config============');
      this.properties.forEach(function (prop) {
        if (config[prop.name] !== undefined && config[prop.name] != '') {
          answers[prop.name] = config[prop.name];
          console.log(prop.name + '=>' + answers[prop.name]);
        } else {
          questions.push({
            type: 'input',
            message: prop.desc,
            name: prop.name
          });
        }
      });
      if (questions.length > 0) {
        Inquirer.prompt(questions)
          .then((answers) => {
            Object.assign(config, answers);
            Fs.writeFileSync(this.path, JSON.stringify(config, null, 4));
            resolve(config);
          });
      } else {
        console.log('if you want to change build config.please modify ' + Path.basename(this.path));
        resolve(config);
      }
    });
  }
}
class ConfigResolver {
  constructor(def) {
    this.def = def;
  }
  resolve(config, basePath) {
    basePath = basePath || process.cwd();
    for (let path in this.def) {
      if (this.def.hasOwnProperty(path)) {
        let targetPath = Path.join(basePath, path);
        let source = Fs.readFileSync(targetPath).toString();
        for (let key in this.def[path]) {
          if (this.def[path].hasOwnProperty(key)) {
            let configDef = this.def[path][key];
            if (Array.isArray(configDef)) {
              configDef.forEach((def) => {
                source = _resolveConfigDef(source, def, config, key);
              });
            } else {
              source = _resolveConfigDef(source, configDef, config, key);
            }
          }
        }
        Fs.writeFileSync(targetPath, source);
      }
    }
  }
}

function _resolveConfigDef(source, configDef, config, key) {
  if (configDef.type) {
    if (config[key] === undefined) {
      throw new Error('Config:[' + key + '] must have a value!');
    }
    return replacer[configDef.type](source, configDef.key, config[key]);
  } else {
    return configDef.handler(source, config[key], replacer);
  }
}
const replacer = {
  plist(source, key, value) {
    let r = new RegExp('(<key>' + key + '</key>\\s*<string>)[^<>]*?<\/string>', 'g');
    return source.replace(r, '$1' + value + '</string>');
  },
  url_types(source, key, value) {
    let r = new RegExp('(<key>CFBundleURLName</key>\\s*<string>' + key + '</string>\\s*<key>CFBundleURLSchemes</key>\\s*<array>\\s*<string>)[^<>]*?<\/string>', 'g');
    return source.replace(r, '$1' + value + '</string>');
  },
  manifestPlaceholders(source, key, value){
    let r = new RegExp('("' + key + '":\\s*")[^"]*"', 'g');
    return source.replace(r, '$1' + value + '"');
  },
  fastfile(source, key, value){
    let r = new RegExp('("' + key + '":\\s*")[^"]*"', 'g');
    return source.replace(r, '$1' + value + '"');
  },
  xmlTag(source, key, value, tagName = 'string') {
    let r = new RegExp(`<${tagName} name="${key}">[^<]+?</${tagName}>`, 'g');
    return source.replace(r, `<${tagName} name="${key}">${value}</${tagName}>`);
  },
  xmlAttr(source, key, value, tagName = 'preference') {
    let r = new RegExp(`<${tagName} name="${key}"\\s* value="[^"]*?"\\s*/>`, 'g');
    return source.replace(r, `<${tagName} name="${key}" value="${value}"/>`);
  },
  regexp(source, regexp, value) {
    return source.replace(regexp, function (m, a, b) {
      // console.log(value);
      // console.log(m);
      // console.log(a);
      // console.log(b);
      return a + value + (b || '');
    });
  }
};

exports.Config = Config;
exports.ConfigResolver = ConfigResolver;

exports.androidUniversalConfigResolver = new ConfigResolver({
  'app/src/main/res/xml/app_config.xml': {
    WeixinId: {
      type: 'xmlAttr',
      key: 'weixin_id'
    },
    WeixinKey: {
      type: 'xmlAttr',
      key: 'weixin_key'
    },
    QQId: {
      type: 'xmlAttr',
      key: 'qq_id'
    },
    QQKey: {
      type: 'xmlAttr',
      key: 'qq_key'
    },
    WeiboId: {
      type: 'xmlAttr',
      key: 'weibo_id'
    },
    WeiboKey: {
      type: 'xmlAttr',
      key: 'weibo_key'
    },
  },
  'app/build.gradle':{
    AppId: {
      type: 'regexp',
      key: /(applicationId ")[^"]*(")/g
    },
    QQId:{
      type:'manifestPlaceholders',
      key:'QQ_Id'
    }
  },
  'app/src/main/res/values/strings.xml': {
    AppName: {
      type: 'xmlTag',
      key: 'app_name'
    }
  }
});

exports.androidConfigResolver = new ConfigResolver({
  'app/build.gradle': {
    VersionName: {
      type: 'regexp',
      key: /(versionName ")[^"]*(")/g
    },
    VersionCode: {
      type: 'regexp',
      key: /(versionCode )[0-9]+(\s)/g
    }
  }
});

exports.iOSUniversalConfigResolver = new ConfigResolver({
  'WeeXTemplate/Info.plist': {
    AppName: {
      type: 'plist',
      key: 'CFBundleDisplayName'
    },
    WeixinId: [{
      type: 'url_types',
      key: 'weixin'
    }, {
      type: 'plist',
      key: 'WeixinId'
    }],
    WeixinKey: {
      type: 'plist',
      key: 'WeixinKey'
    },
    QQId: [{
      type: 'url_types',
      key: 'tencent'
    }, {
      type: 'plist',
      key: 'QQId'
    }],
    QQKey: {
      type: 'plist',
      key: 'QQKey'
    },
    WeiboId: [{
      type: 'url_types',
      key: 'com.weibo'
    }, {
      type: 'plist',
      key: 'WeiboId'
    }],
    WeiboKey: {
      type: 'plist',
      key: 'WeiboKey'
    },
  },
  'fastlane/Fastfile': {
    AppId: {
      type: 'regexp',
      key: /(app_identifier: ')[^']*(')/g
    },
    AppName: {
      type: 'regexp',
      key: /(app_name: ')[^']*(')/g
    }
  },
  'fastlane/Appfile': {
    AppId: {
      type: 'regexp',
      key: /(app_identifier ')[^']*(')/g
    }
  },
  'WeeXTemplate.xcodeproj/project.pbxproj': {
    AppId: {
      type: 'regexp',
      key: /(PRODUCT_BUNDLE_IDENTIFIER\s*=\s*).*?(;)/g
    }
  }
});

exports.iOSConfigResolver = new ConfigResolver({
  'WeeXTemplate/Info.plist': {
    Version: {
      type: 'plist',
      key: 'CFBundleShortVersionString'
    },
    BuildVersion: {
      type: 'plist',
      key: 'CFBundleVersion'
    }
  }
});