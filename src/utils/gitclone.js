var Q = require('q'),
  shell = require('shelljs'),
  events = require('weexpack-common').events,
  path = require('path'),
  superspawn = require('weexpack-common').superspawn,
  os = require('os');

exports.clone = clone;

//  clone_dir, if provided is the directory that git will clone into.
//  if no clone_dir is supplied, a temp directory will be created and used by git.
function clone(git_url, git_ref, clone_dir) {

  var needsGitCheckout = !!git_ref;
  if (!shell.which('git')) {
    return Q.reject(new Error('"git" command line tool is not installed: make sure it is accessible on your PATH.'));
  }

  // If no clone_dir is specified, create a tmp dir which git will clone into.
  var tmp_dir = clone_dir;
  if (!tmp_dir) {
    tmp_dir = path.join(os.tmpdir(), 'git', String((new Date()).valueOf()));
  }
  shell.rm('-rf', tmp_dir);
  shell.mkdir('-p', tmp_dir);

  var cloneArgs = ['clone'];
  if (!needsGitCheckout) {
    // only get depth of 1 if there is no branch/commit specified
    cloneArgs.push('--depth=1');
  }
  cloneArgs.push(git_url, tmp_dir);
  return superspawn.spawn('git', cloneArgs)
    .then(function () {
      if (needsGitCheckout) {
        return superspawn.spawn('git', ['checkout', git_ref], {
          cwd: tmp_dir
        });
      }
    })
    .then(function () {
      events.emit('log', 'Repository "' + git_url + '" checked out to git ref "' + (git_ref || 'master') + '".');
      return tmp_dir;
    })
    .fail(function (err) {
      shell.rm('-rf', tmp_dir);
      return Q.reject(err);
    });
}