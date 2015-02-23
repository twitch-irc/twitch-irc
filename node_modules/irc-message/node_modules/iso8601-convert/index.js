function padInteger(num, length) {
    var r = '' + num

    while (r.length < length) {
        r = '0' + r
    }

    return r
}

function toDate(string) {
    var regexp = '([0-9]{4})(-([0-9]{2})(-([0-9]{2})' +
        '(T([0-9]{2}):([0-9]{2})(:([0-9]{2})(\\.([0-9]+))?)?' +
        '(Z|(([-+])([0-9]{2}):([0-9]{2})))?)?)?)?'

    var d = string.match(new RegExp(regexp))

    if (d === null) {
        return null
    }

    var offset = 0
    var date = new Date(d[1], 0, 1)

    if (d[3]) {
        date.setMonth(d[3] - 1)
    }

    if (d[5]) {
        date.setDate(d[5])
    }

    if (d[7]) {
        date.setHours(d[7])
    }

    if (d[8]) {
        date.setMinutes(d[8])
    }

    if (d[10]) {
        date.setSeconds(d[10])
    }

    if (d[12]) {
        date.setMilliseconds(('0.' + d[12]) * 1000)
    }

    if (d[14]) {
        offset = (d[16] * 60) + parseInt(d[17], 10)
        offset *= ((d[15] === '-') ? 1 : -1)
    }

    offset -= date.getTimezoneOffset()
    var time = date.getTime() + offset * 60 * 1000

    return new Date(time);
};

var fromDate = function(date) {
    var year = date.getUTCFullYear()
    var month = padInteger(date.getUTCMonth() + 1, 2)
    var day = padInteger(date.getUTCDate(), 2)
    var hour = padInteger(date.getUTCHours(), 2)
    var minute = padInteger(date.getUTCMinutes(), 2)
    var second = padInteger(date.getUTCSeconds(), 2)

    return year
        + '-'
        + month
        + '-'
        + day
        + 'T'
        + hour
        + ':'
        + minute
        + ':'
        + second
        + 'Z'
}

exports.toDate = toDate
exports.fromDate = fromDate
