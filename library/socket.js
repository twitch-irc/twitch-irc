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

var Errors  = require('./errors');
var Net     = require('net');
var Util    = require('util');

var Retries    = 1;
var errorEvent = false;
/**
 * Create a new socket connection and handle socket errors.
 *
 * @param client
 * @param options
 * @param logger
 * @param port
 * @param host
 * @param callback
 * @returns {*}
 */
var createSocket = function createSocket(client, options, logger, port, host, callback) {
    var socket = Net.connect(port, host, function() {
        logger.event('connecting');
    	client.emit('connecting', host, port);
        logger.dev('Connecting to ' + host + ' on port ' + port);
        callback();
    });

    socket.crlfWrite = function(data) {
        var string = Util.format.apply(this, arguments);
        this.write(string + '\r\n');
    };

    socket.forceDisconnect = function(silent) {
        silent = typeof silent !== 'undefined' ? silent : false;
        this.end();
        this.destroy();

        if (!silent) {
            logger.event('disconnected');
            client.emit('disconnected', Errors.get('ECONNABORTED'));
        }
    };

    socket.resetRetry = function() {
        Retries = 1;
    };

    socket.on('error', function(err) {
        if (!errorEvent && err.code !== 'ENOTFOUND') {
            errorEvent = true;
            logger.error(Errors.get(err.code));
            logger.event('disconnected');
            client.emit('disconnected', Errors.get(err.code));
            logger.dev('Got disconnected from server: ' + Errors.get(err.code));

            var connection = options.connection || {};
            var reconnect = connection.reconnect || true;

            if (connection.retries === undefined) {
                connection.retries = -1;
            }
            if (reconnect && (connection.retries >= 1 || connection.retries === -1)) {
                Retries++;
                var interval = 5000 * Retries;
                if (interval >= 90000) {
                    interval = 90000;
                }

                logger.info('Reconnecting in ' + (interval / 1000) + ' seconds..');
                logger.dev('Reconnecting in ' + (interval / 1000) + ' seconds..');

                setTimeout(function () {
                    logger.event('reconnect');
                    client.emit('reconnect');

                    if (connection.retries !== -1) {
                        connection.retries--;
                    }
                    errorEvent = false;
                    client.connect();
                }, interval);
            }

            if (reconnect && connection.retries === 0) {
                logger.event('connectfail');
                client.emit('connectfail');
                errorEvent = false;
            }

            if (!reconnect) {
                errorEvent = false;
            }
        }
    });

    return socket;
};

module.exports = createSocket;
