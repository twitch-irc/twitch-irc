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

var net         = require('net');

var count       = 0;
var results     = [];
var unavailable = [];

/* Send a PING request on a specific port */
function pingServer(options, cb) {
    count = 0;
    results = [];

    options.address  = options.address || 'localhost';
    options.port     = options.port || 80;
    options.attempts = options.attempts || 1;
    options.timeout  = options.timeout || 1000;

    connectServer(options, cb);
}

/* Check if the connection is successful */
function checkConnection(options, cb) {
    if (count < options.attempts) {
        connectServer(options, callback);
    } else {
        var avg = results.reduce(function(prev, curr) { return prev + curr.time; }, 0);
        var max = results.reduce(function(prev, curr) { return (prev > curr.time) ? prev : curr.time; }, results[0].time);
        var min = results.reduce(function(prev, curr) { return (prev < curr.time) ? prev : curr.time; }, results[0].time);

        avg = avg / results.length;
        var out = {
            address:  options.address,
            port:     options.port,
            attempts: options.attempts,
            avg:      avg,
            max:      max,
            min:      min,
            results:  results
        };

        cb(undefined, out);
    }
}

/* Connect to the server */
function connectServer(options, cb) {
    var socket = new net.Socket();
    var start = process.hrtime();

    socket.connect(options.port, options.address, function() {
        var time_arr = process.hrtime(start);
        var time = (time_arr[0] * 1e9 + time_arr[1]) / 1e6;
        results.push({
            seq:  count,
            time: time
        });
        socket.destroy();
        count++;
        checkConnection(options, cb);
    });

    socket.on('error', function(e) {
        results.push({
            seq:  count,
            time: undefined,
            err:  e
        });
        socket.destroy();
        count++;
        checkConnection(options, cb);
    });

    socket.setTimeout(options.timeout, function() {
        results.push({
            seq:  count,
            time: undefined,
            err:  Error('Request timeout')
        });
        socket.destroy();
        count++;
        checkConnection(options, cb);
    });
}

/* Probe a server on a specific port */
function probeServer(address, port, callback) {
    address = address || 'localhost';
    port    = port || 443;

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
            '192.16.64.11',
            '192.16.64.144',
            '192.16.64.145',
            '192.16.64.146',
            '192.16.64.152',
            '192.16.64.155',
            '192.16.64.37',
            '192.16.64.45',
            '192.16.64.51',
            '192.16.71.237',
            '199.9.248.236',
            '199.9.251.168'
        ],
        443: [
            '192.16.64.11',
            '192.16.64.144',
            '192.16.64.145',
            '192.16.64.146',
            '192.16.64.152',
            '192.16.64.155',
            '192.16.64.37',
            '192.16.64.45',
            '192.16.64.51',
            '192.16.71.237',
            '199.9.248.236',
            '199.9.251.168'
        ],
        6667: [
            '192.16.64.11',
            '192.16.64.144',
            '192.16.64.145',
            '192.16.64.146',
            '192.16.64.152',
            '192.16.64.155',
            '192.16.64.37',
            '192.16.64.45',
            '192.16.64.51',
            '192.16.71.237',
            '199.9.248.236',
            '199.9.251.168'
        ]
    },
    'events': {
        80: [
            '192.16.64.143',
            '192.16.64.150',
            '192.16.71.221',
            '192.16.71.236',
            '199.9.252.54'
        ],
        443: [
            '192.16.64.143',
            '192.16.64.150',
            '192.16.71.221',
            '192.16.71.236',
            '199.9.252.54'
        ]
    },
    'groups': {
        80: [
            '199.9.248.232',
            '199.9.248.248',
            '199.9.253.119',
            '199.9.253.120'
        ],
        443: [
            '199.9.248.232',
            '199.9.248.248',
            '199.9.253.119',
            '199.9.253.120'
        ],
        6667: [
            '199.9.248.232',
            '199.9.248.248',
            '199.9.253.119',
            '199.9.253.120'
        ]
    }
};

/* Custom Twitch server pooling */
var getServer = function getServer(client, type, server, port, cb) {
    var serverType    = type || 'chat';
    var serverAddress = server || null;
    var serverPort    = port || 443;

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
                if (unavailable.indexOf(serverAddr) >= 0) {
                    scan();
                } else {
                    probeServer(serverAddr, serverPort, function (err, available) {
                        if (!available || err) {
                            unavailable.push(serverAddr);
                            if (unavailable.length > serverList[serverType][serverPort].length-1) {
                                unavailable = [];
                                setTimeout(function(){
                                    if (!client.connected) { scan(); }
                                }, 60000);
                            } else {
                                return scan();
                            }
                        } else {
                            unavailable = [];
                            return cb(serverAddr);
                        }
                    });
                }
            }
            scan();
        }

        client.logger.info('Searching for a Twitch server..');
        findServer(function(server) {
            if (server) {
                cb(server + ':' + serverPort);
            }
        });
    }
    return cb(serverAddress + ':' + serverPort);
};

exports.getServer = getServer;