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

var Net         = require('net');

var Count       = 0;
var Results     = [];
var Unavailable = [];

/**
 * Send a PING request on a specific port.
 *
 * @param options
 * @param cb
 */
function pingServer(options, cb) {
    Count = 0;
    Results = [];

    options.address  = options.address || 'localhost';
    options.port     = options.port || 80;
    options.attempts = options.attempts || 1;
    options.timeout  = options.timeout || 1000;

    connectServer(options, cb);
}

/**
 * Check if the connection is successful.
 *
 * @param options
 * @param cb
 */
function checkConnection(options, cb) {
    if (Count < options.attempts) {
        connectServer(options, callback);
    } else {
        var avg = Results.reduce(function(prev, curr) { return prev + curr.time; }, 0);
        var max = Results.reduce(function(prev, curr) { return (prev > curr.time) ? prev : curr.time; }, Results[0].time);
        var min = Results.reduce(function(prev, curr) { return (prev < curr.time) ? prev : curr.time; }, Results[0].time);

        avg = avg / Results.length;
        var out = {
            address:  options.address,
            port:     options.port,
            attempts: options.attempts,
            avg:      avg,
            max:      max,
            min:      min,
            results:  Results
        };

        cb(undefined, out);
    }
}

/**
 * Connect to the server.
 *
 * @param options
 * @param cb
 */
function connectServer(options, cb) {
    var socket = new Net.Socket();
    var start = process.hrtime();

    socket.connect(options.port, options.address, function() {
        var time_arr = process.hrtime(start);
        var time = (time_arr[0] * 1e9 + time_arr[1]) / 1e6;
        Results.push({
            seq:  Count,
            time: time
        });
        socket.destroy();
        Count++;
        checkConnection(options, cb);
    });

    socket.on('error', function(e) {
        Results.push({
            seq:  Count,
            time: undefined,
            err:  e
        });
        socket.destroy();
        Count++;
        checkConnection(options, cb);
    });

    socket.setTimeout(options.timeout, function() {
        Results.push({
            seq:  Count,
            time: undefined,
            err:  Error('Request timeout')
        });
        socket.destroy();
        Count++;
        checkConnection(options, cb);
    });
}

/**
 * Probe a server on a specific port.
 *
 * @param address
 * @param port
 * @param callback
 */
function probeServer(address, port, callback) {
    address = address || 'localhost';
    port = port || 443;

    pingServer({
        address:  address,
        port:     port,
        attempts: 1,
        timeout:  5000
    }, function(err, data) {
        var available = data.min !== undefined;
        callback(err, available);
    });
}

var serverList = {
    'chat': {
        80: [
            '199.9.249.126',
            '199.9.249.142',
            '199.9.249.222',
            '199.9.249.252',
            '199.9.249.253',
            '199.9.250.229',
            '199.9.250.239',
            '199.9.251.189',
            '199.9.252.120',
            '199.9.252.28',
            '199.9.253.165'
        ],
        443: [
            '199.9.249.126',
            '199.9.249.142',
            '199.9.249.222',
            '199.9.249.252',
            '199.9.249.253',
            '199.9.250.229',
            '199.9.250.239',
            '199.9.251.189',
            '199.9.252.120',
            '199.9.252.28',
            '199.9.253.165'
        ],
        6667: [
            '199.9.249.126',
            '199.9.249.142',
            '199.9.249.222',
            '199.9.249.252',
            '199.9.249.253',
            '199.9.250.229',
            '199.9.250.239',
            '199.9.251.189',
            '199.9.252.120',
            '199.9.252.28',
            '199.9.253.165'
        ]
    },
    'events': {
        80: [
            '199.9.250.117',
            '199.9.251.213',
            '199.9.252.26'
        ],
        443: [
            '199.9.250.117',
            '199.9.251.213',
            '199.9.252.26'
        ]
    },
    'groups': {
        80: [
            '199.9.248.232',
            '199.9.248.248'
        ],
        443: [
            '199.9.248.232',
            '199.9.248.248'
        ]
    }
};

/**
 * Custom Twitch server pooling.
 *
 * @param type
 * @param server
 * @param port
 * @returns {string}
 */
var getServer = function getServer(type, server, port, logger, cb) {
    var serverType = type || 'chat';
    var serverAddress = server || null;
    var serverPort = port || 443;
    if (serverAddress === null) {
        var serverTypes = ['chat', 'events', 'groups'];
        if (serverTypes.indexOf(serverType) === -1) {
            serverType = 'chat';
        }

        var serverPortsChat = [80, 443, 6667];
        var serverPorts     = [80, 443];
        if (serverType === 'chat' && serverPortsChat.indexOf(serverPort) === -1) {
            serverPort = 443;
        } else if (serverType !== 'chat' && serverPorts.indexOf(serverPort) === -1) {
            serverPort = 443;
        }

        function findServer(cb) {
            function scan() {
                var serverAddr = serverList[serverType][serverPort][Math.floor(Math.random() * (serverList[serverType][serverPort].length))];
                if (Unavailable.indexOf(serverAddr) >= 0) {
                    scan();
                } else {
                    probeServer(serverAddr, serverPort, function (err, available) {
                        if (!available || err) {
                            Unavailable.push(serverAddr);
                            if (Unavailable.length > serverList[serverType][serverPort].length-1) {
                                Unavailable = [];
                                logger.error('No Twitch servers available at this time, retrying in 60 seconds..');
                                setTimeout(function(){
                                    scan();
                                }, 60000);
                            } else {
                                return scan();
                            }
                        } else {
                            Unavailable = [];
                            return cb(serverAddr);
                        }
                    });
                }
            }
            scan();
        }

        logger.info('Searching for a Twitch server..');
        findServer(function(server) {
            if (server) {
                cb(server + ':' + serverPort);
            }
        });
    }
    return serverAddress + ':' + serverPort;
};

exports.getServer = getServer;