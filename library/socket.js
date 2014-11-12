/**
 * The MIT License (MIT)
 *
 * Copyright (c) 2014 Schmoopiie
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

var util = require('util');
var net = require('net');
var errors = require('./errors');

/**
 * Create a new socket for connection and handle any errors related to the connection.
 * @param client
 * @param options
 * @param logger
 * @param port
 * @param host
 * @param callback
 * @returns {*}
 */
var createSocket = function createSocket(client, options, logger, port, host, callback) {
    var socket = net.connect(port, host, function() {
    	logger.event('connecting');
    	client.emit('connecting', host, port);
        callback();
    });

    socket.crlfWrite = function(data) {
        var string = util.format.apply(this, arguments);
        this.write(string + '\r\n');
    }
    
    // Encounter an error, emit disconnected event with the error message and reconnect to server.
    socket.on('error', function(err) {
    	logger.error(errors.get(err.code));
    	logger.event('disconnected');
    	client.emit('disconnected', errors.get(err.code));
        var connection = options.connection || {};
    	var reconnect = connection.reconnect || true;
    	
    	// Set the default for replies to -1 for infinite.
    	if (connection.retries === undefined) { connection.retries = -1; }
    	
    	// Try to reconnect.
    	if (reconnect && (connection.retries >= 1 || connection.retries === -1)) {
	    	setTimeout(function(){
	    		logger.event('reconnect');
	    		client.emit('reconnect');
	    		if (connection.retries !== -1) { connection.retries--; }
	    		client.connect();
	    	}, 5000);
    	}
    	
    	// Couldn't reconnect to server after X retries, emit connectfail event.
    	if (reconnect && connection.retries === 0) { logger.event('connectfail'); client.emit('connectfail'); }
    });

    return socket;
};

module.exports = createSocket;
