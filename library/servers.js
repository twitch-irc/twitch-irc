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

var net         = require('net');

var i           = 0;
var results     = [];
var unavailable = [];

function ping(options, cb) {
    i = 0;
    results = [];
    options.address = options.address || 'localhost';
    options.port = options.port || 80;
    options.attempts = options.attempts || 1;
    options.timeout = options.timeout || 1000;

    connect(options, cb);
}

function check(options, cb) {
    if (i < options.attempts) {
        connect(options, callback);
    } else {
        var avg = results.reduce(function(prev, curr) {
            return prev + curr.time;
        }, 0);

        var max = results.reduce(function(prev, curr) {
            return (prev > curr.time) ? prev : curr.time;
        }, results[0].time);

        var min = results.reduce(function(prev, curr) {
            return (prev < curr.time) ? prev : curr.time;
        }, results[0].time);

        avg = avg / results.length;
        var out = {
            address: options.address,
            port: options.port,
            attempts: options.attempts,
            avg: avg,
            max: max,
            min: min,
            results: results
        };

        cb(undefined, out);
    }
}

function connect(options, cb) {
    var socket = new net.Socket();
    var start = process.hrtime();

    socket.connect(options.port, options.address, function() {
        var time_arr = process.hrtime(start);
        var time = (time_arr[0] * 1e9 + time_arr[1]) / 1e6;
        results.push({
            seq: i,
            time: time
        });
        socket.destroy();
        i++;
        check(options, cb);
    });

    socket.on('error', function(e) {
        results.push({
            seq: i,
            time: undefined,
            err: e
        });
        socket.destroy();
        i++;
        check(options, cb);
    });

    socket.setTimeout(options.timeout, function() {
        results.push({
            seq: i,
            time: undefined,
            err: Error('Request timeout')
        });
        socket.destroy();
        i++;
        check(options, cb);
    });
}

function probe(address, port, callback) {
    address = address || 'localhost';
    port = port || 443;

    ping({
        address: address,
        port: port,
        attempts: 1,
        timeout: 5000
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
 * Custom server pooling.
 *
 * We probe the servers until we find one available and return it's IP address and port.
 *
 * @param type
 * @param server
 * @param port
 * @returns {string}
 */
var getServer = function getServer(type, server, port, cb) {
    var serverType = type || 'chat';
    var serverAddress = server || null;
    var serverPort = port || 443;
    if (serverAddress === null) {
        // Server type is valid.
        var serverTypes = ['chat', 'events', 'groups'];
        if (serverTypes.indexOf(serverType) === -1) {
            serverType = 'chat';
        }

        // Port is valid.
        var serverPortsChat = [80, 443, 6667];
        var serverPorts     = [80, 443];
        if (serverType === 'chat' && serverPortsChat.indexOf(serverPort) === -1) {
            serverPort = 443;
        } else if (serverType !== 'chat' && serverPorts.indexOf(serverPort) === -1) {
            serverPort = 443;
        }

        function findServer(cb) {
            function scan() {
                var serverAddr = serverList[serverType][serverPort][Math.floor(Math.random() * (serverList[serverType][serverPort].length - 1))];
                if (unavailable.indexOf(serverAddr) >= 0) {
                    scan();
                } else {
                    probe(serverAddr, serverPort, function (err, available) {
                        if (!available || err) {
                            unavailable.push(serverAddr);
                            return scan();
                        } else {
                            unavailable = [];
                            return cb(serverAddr);
                        }
                    });
                }
            }
            scan();
        }

        findServer(function(server) {
            if (server) {
                cb(server + ':' + serverPort);
            }
        });
    }
    return serverAddress + ':' + serverPort;
};

exports.getServer = getServer;