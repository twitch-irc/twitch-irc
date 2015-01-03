/**
 * The MIT License (MIT)
 *
 * Copyright (c) 2015 Schmoopiie
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NON INFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

var Filesystem = require('fs');
var Util       = require('util');

var Ignored    = [];
var Timestamp  = true;

/**
 * Ensure that the directory exists.
 *
 * @param path
 * @param mask
 * @param cb
 */
function ensureExists(path, mask, cb) {
    if (typeof mask == 'function') {
        cb = mask;
        mask = 0777;
    }

    Filesystem.mkdir(path, mask, function(err) {
        if (err) {
            if (err.code == 'EEXIST') cb(null);
            else cb(err);
        } else cb(null);
    });
}

/**
 * Our awesome logger.
 *
 * @param config
 * @constructor
 */
function Logger(config) {
    var self    = this;
    var config  = config || {};
    var options = config.options || {};
    var debug   = options.debug || false;
    var dev     = options.dev || false;
    var logging = config.logging || {};

    Ignored = options.debugIgnore || [];

    if (typeof logging !== 'object') { logging = {}; }

    var enabled = typeof logging.enabled !== 'undefined' ? logging.enabled : false;
    var rewrite = typeof logging.rewrite !== 'undefined' ? logging.rewrite : true;
    var chat    = typeof logging.chat !== 'undefined' ? logging.chat : false;

    Timestamp = typeof logging.timestamp !== 'undefined' ? logging.timestamp : true;

    this.options = {
        stream: process.stdout,
        wstream: null,
        level: 'raw'
    };

    if (dev) { this.options.level = 'dev'; }
    if (!debug) { this.options.level = 'crash'; }

    if (enabled) {
        ensureExists('./logs', function(err) {
            if (!err) {
                var flag = rewrite ? 'w' : 'a';
                var stream = Filesystem.createWriteStream('./logs/status.log', { flags: flag });
                self.options.wstream = stream;
                if (chat) { self.options.level = 'chat'; }
            }
        });
    }

    this.templates = {
        chat:  '[:timestamp] chat  - :message',
        dev:   '\x1b[90m  :message\x1b[39m',
        raw:   '[:timestamp] \x1b[36mraw\x1b[39m   - :message',
        event: '[:timestamp] \x1b[32mevent\x1b[39m - :message',
        info:  '[:timestamp] \x1b[33minfo\x1b[39m  - :message',
        error: '[:timestamp] \x1b[31merror\x1b[39m - :message',
        crash: '[:timestamp] \x1b[31merror\x1b[39m - :message',
        inspect: true
    };
}

/**
 * Tokens used in templates.
 *
 * @type {{timestamp: timestamp}}
 */
Logger.prototype.tokens = {
    timestamp: function() {
        var str         = '';
        var currentTime = new Date();
        var hours       = currentTime.getHours();
        var minutes     = currentTime.getMinutes();
        var seconds     = currentTime.getSeconds();

        if (hours < 10) { hours = '0' + hours }
        if (minutes < 10) { minutes = '0' + minutes }
        if (seconds < 10) { seconds = '0' + seconds }
        str += hours + ':' + minutes + ':' + seconds;

        return str;
    }
};

/**
 * Custom levels.
 *
 * @type {{chat: number, dev: number, raw: number, event: number, info: number, error: number, crash: number}}
 */
Logger.prototype.levels = {
    chat:  7,
    dev:   6,
    raw:   5,
    event: 4,
    info:  3,
    error: 2,
    crash: 1
};

/**
 * Replace the message and it's tokens.
 *
 * @param level
 * @param str
 * @returns {XML|*|string|void}
 */
Logger.prototype.message = function(level, str) {
    var message = this.templates[level];
    for (var token in this.tokens) {
        if (!Object.prototype.hasOwnProperty.call(this.tokens, token)) {
            continue;
        }
        message = message.replace(':' + token, this.tokens[token]());
    }
    return message.replace(':message', str);
};

/**
 * Send the message to the stream(s).
 *
 * @param level
 * @param str
 */
Logger.prototype.log = function(level, str) {
    if (this.levels[level] > this.levels[this.options.level]) return;

    if (arguments.length > 2) { str = Array.prototype.slice.call(arguments, 1).join(' '); }
    else if (str.toString() == '[object Arguments]') { str = Array.prototype.slice.call(str).join(' '); }

    if (this.levels[level] === 6) { str = str.toUpperCase(); }
    else { str = str.toLowerCase(); }

    var message = this.message(level, str) + '\n';
    if (!Timestamp && this.levels[level] !== 6) {
        var string = message.split(' ');
        string.shift();
        message = string.join(' ');
    }

    if (this.levels[level] !== 7) {
        if (this.levels[level] === 4) {
            if (Ignored.indexOf(str) < 0) { this.options.stream.write(message); }
        }
        else if (this.levels[level] === 5) {
            if (Ignored.indexOf('raw') < 0) { this.options.stream.write(message); }
        }
        else if (this.levels[level] === 3) {
            if (Ignored.indexOf('info') < 0) { this.options.stream.write(message); }
        }
        else if (this.levels[level] === 2) {
            if (Ignored.indexOf('error') < 0) { this.options.stream.write(message); }
        }
        else if (this.levels[level] === 1) {
            if (Ignored.indexOf('crash') < 0) { this.options.stream.write(message); }
        }
        else {
            this.options.stream.write(message);
        }
    }
    if (this.options.wstream !== null) {
        if (this.levels[level] === 4) {
            if (str !== 'chat') {
                this.options.wstream.write(this.message(level, str).replace(/\x1B\[\d+m/g, '') + '\n');
            }
        } else {
            this.options.wstream.write(this.message(level, str).replace(/\x1B\[\d+m/g, '') + '\n');
        }
    }
};

/**
 * Logger prototypes.
 *
 * @param str
 * @returns {*}
 */
Logger.prototype.chat    = function(str) { return this.log('chat', arguments) };
Logger.prototype.dev     = function(str) { return this.log('dev', arguments) };
Logger.prototype.inspect = function(obj) { return this.log('info', Util.inspect(obj)); };
Logger.prototype.raw     = function(str) { return this.log('raw', arguments); };
Logger.prototype.event   = function(str) { return this.log('event', arguments) };
Logger.prototype.info    = function(str) { return this.log('info', arguments) };
Logger.prototype.error   = function(str) { return this.log('error', arguments) };
Logger.prototype.crash   = function(str) { return this.log('crash', arguments) };

module.exports = exports = Logger;
exports.Logger = Logger;