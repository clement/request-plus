var request = require('request')
  , compress = require('compressor')
  , buffertools = require('buffertools')
  , Iconv = require('iconv').Iconv
  , sys = require('sys')


var gzipCallback = function (next) {
    return function (err, resp, body) {
        if (resp && resp.headers['content-encoding'] == 'gzip') {
            var unzipper = new compress.GunzipStream
              , deflated = new Buffer(0)

            unzipper.on('data', function (data) { deflated = buffertools.concat(deflated, data) })
                    .on('error', function (err) { next.call(this, err, resp, body) })
                    .on('end', function () { next.call(this, err, resp, deflated) })
            unzipper.write(body)
            unzipper.close()
        }
        else {
            next.apply(this, arguments)
        }
    }
}

var encodingCallback = function (next) {
    return function (err, resp, body) {
        if (resp) {
            var charset = 'utf-8'
            if (resp.headers['content-type']) {
                var match = resp.headers['content-type'].match(/;\s*charset=([^\s;]+)\s*(?:;|$)/)
                if (match) { charset = match[1] }
            }

            try {
                body = (new Iconv(charset, 'UTF-8')).convert(body)
            }
            catch (e) {
                sys.log('Got an error while converting from '+charset+' : '+e)
            }
        }

        next.call(this, err, resp, body)
    }
}

module.exports = function requestPlus(opts, cb) {
    opts.headers = opts.headers || {}
    if (opts.gzip) { opts.headers['accept-encoding'] = 'gzip;q=1.0' }
    cb = gzipCallback(encodingCallback(cb))

    // return the body as a buffer instead of a string
    var bodyBuf = new Buffer(0)
    opts.onResponse = true

    return request(opts, function (err, resp) {
        if (!err && resp) {
            resp.on('data', function (data) { bodyBuf = buffertools.concat(bodyBuf, data) })
                .on('end', function () { cb.call(this, err, resp, bodyBuf) })
        }
        else {
            cb.apply(this, arguments)
        }
    })
}
