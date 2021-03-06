var { dirname, join } = require('path')
var box = require('callbox')
var flush = require('flush-write-stream')
var glob = require('dat-glob/stream')
var isGlob = require('is-glob')
var pump = require('pump')

module.exports = rm

async function rm (dat, pattern, opts, cb) {
  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  }
  opts = opts || {}

  if (!Array.isArray(pattern) && !isGlob(pattern)) {
    var stats = await stat(dat, pattern)
    if (stats && stats.isDirectory()) {
      return rm(dat, join(pattern, '**/*'), { prune: true }, cb)
    }
  }

  function remove (done) {
    var stream = glob(dat, pattern)
    var end = flush(async function (file, enc, next) {
      var path = file.toString()
      await unlink(dat, path)
      if (opts.prune) await prune(dat, path)
      next()
    })

    pump(stream, end, done)
  }

  return cb ? remove(cb) : box(remove)
}

async function prune (dat, path) {
  try {
    var dir = dirname(path)
    if (dir === '.') return
    await rmdir(dat, dir)
    await prune(dat, dir)
  } catch (err) {
    if (!err.destDirectoryNotEmpty) throw err
  }
}

async function stat (dat, path) {
  var stats = null
  var lstat = dat.lstat ? dat.lstat.bind(dat) : dat.stat.bind(dat)

  try {
    if (lstat.constructor.name === 'AsyncFunction') {
      stats = await lstat(path)
    } else {
      stats = await box(done => lstat(path, done))
    }
  } catch (err) {}

  return stats
}

function rmdir (dat, path) {
  if (dat.rmdir.constructor.name === 'AsyncFunction') {
    return dat.rmdir(path)
  }
  return box(done => dat.rmdir(path, done))
}

function unlink (dat, path) {
  if (dat.unlink.constructor.name === 'AsyncFunction') {
    return dat.unlink(path)
  }
  return box(done => dat.unlink(path, done))
}
