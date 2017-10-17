var path = require('path'),
  fs = require('fs'),
  shell = require('shelljs');

module.exports = copy;

function copy(shop_id) {
  var custom_dir = path.resolve("custom");
  var shop_path = path.join(custom_dir, shop_id);
  var projectDir = path.resolve(".");

  var shopFiles = fs.readdirSync(shop_path);
  for (var i = 0; i < shopFiles.length; i++) {
    var p = path.resolve(shop_path, shopFiles[i]);
    // 忽略.DS_Store
    if (shopFiles[i].startsWith(".DS_Store")) {
      console.log("忽略" + p);
      continue;
    }
    shell.cp('-Rf', p, projectDir);
  }
}