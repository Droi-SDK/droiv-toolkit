var events = require('weexpack-common').events,
  fs = require('fs'),
  Q = require('q'),
  tar = require('tar'),
  zlib = require('zlib');

exports.unpackTgz = unpackTgz;

// Returns a promise for the path to the unpacked tarball (unzip + untar).
function unpackTgz(package_tgz, unpackTarget) {
  return Q.promise(function (resolve, reject) {
    var extractOpts = {
      type: 'Directory',
      path: unpackTarget,
      strip: 1
    };

    fs.createReadStream(package_tgz)
      .on('error', function (err) {
        events.emit('warn', 'Unable to open tarball ' + package_tgz + ': ' + err);
        reject(err);
      })
      .pipe(zlib.createUnzip())
      .on('error', function (err) {
        events.emit('warn', 'Error during unzip for ' + package_tgz + ': ' + err);
        reject(err);
      })
      .pipe(tar.Extract(extractOpts))
      .on('error', function (err) {
        events.emit('warn', 'Error during untar for ' + package_tgz + ': ' + err);
        reject(err);
      })
      .on('end', resolve);
  })
  .then(function () {
    return unpackTarget;
  });
}