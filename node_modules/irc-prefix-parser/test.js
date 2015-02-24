// adapted from https://github.com/grawity/code/blob/master/lib/tests/irc-prefix-split.txt

var parse = require('./')
var assert = require('assert')

describe('#parsePrefix()', function() {
    it('should correctly parse valid prefixes', function() {
        var prefixes = {
            'nick': {
                isServer: false,
                nick: 'nick',
                user: null,
                host: null
            },
            'nick!user': {
                isServer: false,
                nick: 'nick',
                user: 'user',
                host: null
            },
            'se.rv.er': {
                isServer: true,
                nick: null,
                user: null,
                host: 'se.rv.er'
            },
            'nick!us.er@host': {
                isServer: false,
                nick: 'nick',
                user: 'us.er',
                host: 'host'
            },
            'nick!user@ho.st': {
                isServer: false,
                nick: 'nick',
                user: 'user',
                host: 'ho.st'
            },
            'nick!': {
                isServer: false,
                nick: 'nick',
                user: '',
                host: null
            },
            'nick@': {
                isServer: false,
                nick: 'nick',
                user: null,
                host: ''
            },
            'nick!@': {
                isServer: false,
                nick: 'nick',
                user: '',
                host: ''
            },
            'nick!user!resu@host': {
                isServer: false,
                nick: 'nick',
                user: 'user!resu',
                host: 'host'
            },
            'nick@kcin!user@host': {
                isServer: false,
                nick: 'nick@kcin',
                user: 'user',
                host: 'host'
            },
            'nick!user@host!resu': {
                isServer: false,
                nick: 'nick',
                user: 'user',
                host: 'host!resu'
            },
            'nick!user@host@tsoh': {
                isServer: false,
                nick: 'nick',
                user: 'user',
                host: 'host@tsoh'
            },
            'ni.ck!user@host': {
                isServer: false,
                nick: 'ni.ck',
                user: 'user',
                host: 'host'
            }
        }

        Object.keys(prefixes).forEach(function(prefix) {
            var expected = prefixes[prefix]
            expected.raw = prefix
            assert.deepEqual(parse(prefix), expected)
        })
    })

    it('should return null on invalid prefixes', function() {
        var prefixes = ['', '@host', '!user@host', '!@host', '!user@']

        prefixes.forEach(function(prefix) {
            assert.equal(parse(prefix), null)
        })
    })
})
