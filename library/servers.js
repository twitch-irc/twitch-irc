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

var serverList = {
	'chat': {
		80: ['199.9.250.229', '199.9.250.239', '199.9.252.120', '199.9.252.28', '199.9.253.165', '199.9.253.199', '199.9.253.210'],
		443: ['199.9.250.229', '199.9.250.239', '199.9.252.120', '199.9.252.28', '199.9.253.165', '199.9.253.199', '199.9.253.210']
	},
	'events': {
		80: ['199.9.250.117', '199.9.251.213', '199.9.252.26'],
		443: ['199.9.250.117', '199.9.251.213', '199.9.252.26']
	},
	'groups': {
		80: ['199.9.248.232', '199.9.248.248'],
		443: ['199.9.248.232', '199.9.248.248']
	}
};

/**
 * Custom server pooling. It is better than using irc.twitch.tv.
 * @param type
 * @param server
 * @param port
 * @returns {string}
 */
var getServer = function getServer(type, server, port) {
	var serverType = type || 'chat';
	var serverAddress = server || null;
	var serverPort = port || 443;
	if (serverAddress === null) {
		// Server type is valid.
		var serverTypes = ['chat', 'events', 'groups'];
		if (serverTypes.indexOf(serverType) === -1) { serverType = 'chat'; }
		
		// Port is valid.
		var serverPortsChat = [80,443];
		var serverPorts = [80,443];
		if (serverType === 'chat' && serverPortsChat.indexOf(serverPort) === -1) { serverPort = 443; }
		else if (serverType !== 'chat' && serverPorts.indexOf(serverPort) === -1) { serverPort = 443; }
		
		return serverList[serverType][serverPort][Math.floor(Math.random() * (serverList[serverType][serverPort].length - 1))]+':'+serverPort;
	}
	return serverAddress+':'+serverPort;
}

exports.getServer = getServer;