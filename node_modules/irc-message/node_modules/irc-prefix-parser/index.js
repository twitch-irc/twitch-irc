// adapted from https://github.com/grawity/code/blob/master/lib/python/nullroute/irc.py#L24-L53

module.exports = function parsePrefix(prefix) {
    if (prefix.length === 0) {
        return null
    }

    var dpos = prefix.indexOf('.') + 1
    var upos = prefix.indexOf('!') + 1
    var hpos = prefix.indexOf('@', upos) + 1

    if (upos === 1 || hpos === 1) {
        return null
    }

    var result = {}
    result.raw = prefix
    result.isServer = false
    result.nick = null
    result.user = null
    result.host = null

    if (upos > 0) {
        result.nick = prefix.slice(0, upos - 1)
        if (hpos > 0) {
            result.user = prefix.slice(upos, hpos - 1)
            result.host = prefix.slice(hpos)
        } else {
            result.user = prefix.slice(upos)
        }
    } else if (hpos > 0) {
        result.nick = prefix.slice(0, hpos - 1)
        result.host = prefix.slice(hpos)
    } else if (dpos > 0) {
        result.host = prefix
        result.isServer = true
    } else {
        result.nick = prefix
    }

    return result
}
