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

var async    = require('async');
var events   = require('events').EventEmitter;
var pkg      = require('./../package.json');
var q        = require('q');
var request  = require('request');
var servers  = require('./servers');
var socket   = require('./socket');
var stream   = require('irc-message');
var string   = require('string');
var util     = require('util');
var utils    = require('./modules/utils');

/* Represents a new client instance */
var client = function(options) {
    var self = this;

    self.setMaxListeners(0);

    self.options            = (typeof options != 'undefined') ? options : {};
    var loggerClass         = self.options.loggerClass || require('./modules/logger');
    self.logger             = new loggerClass(options);
    self.options.options    = self.options.options || {};
    self.options.connection = self.options.connection || {};
    self.debugDetails       = (self.options.options && (typeof self.options.options.debugDetails != 'undefined')) ? self.options.options.debugDetails : false;
    self.emitSelf           = (self.options.options && (typeof self.options.options.emitSelf != 'undefined')) ? self.options.options.emitSelf : false;
    self.reconnect          = (typeof self.options.connection.reconnect != 'undefined') ? self.options.connection.reconnect : true;
    self.stream             = stream.createStream({ parsePrefix: true }).on('data', this._handleMessage.bind(this));
    self.socket             = null;
    self.connected          = false;
    self.currentChannels    = [];
    self.lastPing           = new Date();
    self.latency            = new Date();
    self.moderators         = {};
    self.myself             = '';
    self.port               = 443;
    self.server             = 'irc.twitch.tv';
    self.twitchClient       = self.options.options.tc || 0;
    self.selfData           = {};
    self.userData           = {};

    self.gracefulReconnection = false;

    self.logger.dev('Created a new client instance on pid ' + process.pid);
    self.logger.dev('Memory rss: ' + process.memoryUsage().rss);
    self.logger.dev('Memory heap total: ' + process.memoryUsage().heapTotal);
    self.logger.dev('Memory heap used : ' + process.memoryUsage().heapUsed);

    var exitOnError = (self.options.options && (typeof self.options.options.exitOnError != 'undefined')) ? self.options.options.exitOnError : true;

    process.on('uncaughtException', function (err) {
        self.logger.crash(err.stack);
        self.emit('crash', err.message, err.stack);
        if (exitOnError) { process.exit(); }
    });

    // Making sure the client connection is still alive..
    setInterval(function() {
        if (self.connected) {
            if (((new Date()-self.lastPing)/1000) > 360) {
                self.socket.forceDisconnect(false);
                if (self.reconnect) { setTimeout(function() {self.connect();}, 2000); }
            }
        }
    }, 10000);

    events.call(self);
};

util.inherits(client, events);

/* Handle all IRC messages */
client.prototype._handleMessage = function(message) {
    var self = this;

    // Logging RAW messages..
    if (message.command.match(/^[0-9]+$/g) && message.command !== '353') { self.logger.raw(message.command + ': ' + message.params[1]); }

    // Emitting names if twitchClient 1-2..
    if (message.command === '353' && (self.twitchClient === 1 || self.twitchClient === 2)) {
        self.emit('names', message.params[2], message.params[3].split(' '));
    }

    // Handling messages with no prefix..
    if (message.prefix === null) {
        switch(message.command) {
            /* Received PING from server */
            case 'PING':
                self.lastPing = new Date();
                self.logger.event('ping');
                self.emit('ping');
                self.socket.crlfWrite('PONG');
                break;

            /* Received PONG from server, return current latency */
            case 'PONG':
                self.logger.event('pong');
                self.emit('pong', (((new Date()-self.latency)/1000)%60));
                break;
        }
    }

    // Handling messages from tmi.twitch.tv
    else if (message.prefix.isServer) {
        switch(message.command) {
            /* Got the bot username from server */
            case '001':
                self.myself = message.params[0];
                break;

            /* Received MOTD from server, it means that we are connected */
            case '372':
                self.lastPing = new Date();
                self.connected = true;

                self.logger.event('connected');
                self.emit('connected', self.socket.remoteAddress, self.socket.remotePort);

                self.server = self.socket.remoteAddress;
                self.port   = self.socket.remotePort;

                self.socket.resetRetry();

                self.socket.crlfWrite('CAP REQ :twitch.tv/tags twitch.tv/commands');
                if (self.listeners('join').length >= 1 || self.listeners('part').length >= 1) {
                    self.socket.crlfWrite('CAP REQ :twitch.tv/membership');
                }

                if (self.twitchClient >= 1) { self.socket.crlfWrite('TWITCHCLIENT ' + self.twitchClient); }
                else { self.socket.crlfWrite('TWITCHCLIENT 4'); }

                var channels = self.options.channels || [];

                function recurs(p1) {
                    var couldJoin = false;
                    if (channels.length >= 1) {
                        if (self.connected && self.currentChannels.indexOf(utils.remHash(channels[p1]).toLowerCase()) === -1) {
                            self.join(channels[p1]);
                            couldJoin = true;
                        }
                    }
                    p1++;
                    if (p1 >= channels.length) return;
                    // Was already joined, skip directly to the next channel..
                    if (!couldJoin) { recurs(p1); return; }
                    setTimeout(function() { recurs(p1); }, 3000);
                }

                setTimeout(function() {
                    recurs(0);
                }, 3000);
                break;

            /* Received USERSTATE from server */
            case 'USERSTATE':
                _handleTags(self.myself, message.tags, function(data) {
                    self.selfData[message.params[0]] = data;

                    if (data.username.toLowerCase() === self.myself.toLowerCase() && self.currentChannels.indexOf(utils.remHash(message.params[0]).toLowerCase()) === -1) {
                        // Adding the channel to the currentChannels so we can rejoin on reconnection..
                        if (self.currentChannels.indexOf(utils.remHash(message.params[0])) < 0) {
                            self.currentChannels.push(utils.remHash(message.params[0]));
                            self.currentChannels.reduce(function (a, b) {
                                if (a.indexOf(b) < 0)a.push(b);
                                return a;
                            }, []);
                        }

                        self.logger.event('join');
                        self.emit('join', message.params[0], self.myself.toLowerCase());
                    }
                });
                break;

            /* Received a notice from the server */
            case 'NOTICE':
                if (message.params[1] === 'Login unsuccessful') {
                    self.connected = false;
                    self.logger.event('disconnected');
                    self.emit('disconnected', 'Login unsuccessful.');
                    self.logger.dev('Disconnect from server: Login unsuccessful.');
                }
                break;

            /* Received reconnection request from Twitch */
            case 'RECONNECT':
                self.logger.dev('Received reconnection request from Twitch.');
                self.fastReconnect();
                break;

            /* CLEARCHAT sent by the server */
            case 'CLEARCHAT':
                if (self.twitchClient !== 1 && self.twitchClient !== 2) {
                    if (message.params.length >= 2) {
                        self.logger.event('timeout');
                        self.emit('timeout', message.params[0], message.params[1]);
                    }
                    else {
                        self.logger.event('clearchat');
                        self.emit('clearchat', message.params[0]);
                    }
                }
                break;

            /* HOSTTARGET sent by the server */
            case 'HOSTTARGET':
                if (self.twitchClient !== 1 && self.twitchClient !== 2) {
                    if (message.params[1].split(' ')[0] === '-') {
                        self.logger.event('unhost');
                        self.emit('unhost', utils.remHash(message.params[0]), message.params[1].split(' ')[1]);
                    } else {
                        self.logger.event('hosting');
                        self.emit('hosting', utils.remHash(message.params[0]), utils.remHash(message.params[1].split(' ')[0]), message.params[1].split(' ')[1]);
                    }
                }
                break;
        }
    }

    // Handling messages from jtv..
    else if (message.prefix.raw === 'jtv' || message.prefix.nick === 'jtv') {
        switch (message.command) {
            /* Someone got modded or un-modded from channel */
            case 'MODE':
                // Someone is modded on a channel..
                if (message.params[1] === '+o') {
                    self.moderators[utils.addHash(message.params[0])].push(message.params[2].toLowerCase());
                    self.moderators[utils.addHash(message.params[0])].reduce(function(a,b){if(a.indexOf(b)<0)a.push(b);return a;},[]);
                    self.emit('mod', message.params[0], message.params[2]);
                }
                // Someone is un-modded on a channel..
                else {
                    var index = self.moderators[utils.addHash(message.params[0])].indexOf(message.params[2].toLowerCase());
                    if (index >= 0) { self.moderators[utils.addHash(message.params[0])].splice(index, 1); }
                    self.moderators[utils.addHash(message.params[0])].reduce(function(a,b){if(a.indexOf(b)<0)a.push(b);return a;},[]);
                    self.emit('unmod', message.params[0], message.params[2]);
                }
                break;

            /* Received private message from jtv */
            case 'PRIVMSG':
                switch (true) {
                    /* This room is now in subscribers-only mode */
                    case string(message.params[1]).contains('room is now in subscribers-only'):
                        if (self.twitchClient !== 1 && self.twitchClient !== 2) {
                            self.logger.event('subscriber');
                            self.emit('subscriber', message.params[0], true);
                        }
                        break;

                    /* This room is no longer in subscribers-only mode */
                    case string(message.params[1]).contains('room is no longer in subscribers-only'):
                        if (self.twitchClient !== 1 && self.twitchClient !== 2) {
                            self.logger.event('subscriber');
                            self.emit('subscriber', message.params[0], false);
                        }
                        break;

                    /* This room is now in slow mode */
                    case string(message.params[1]).contains('room is now in slow mode'):
                        if (self.twitchClient !== 1 && self.twitchClient !== 2) {
                            var splitted = message.params[1].split(' ');
                            var length   = splitted[splitted.length - 2];

                            self.logger.event('slowmode');
                            self.emit('slowmode', message.params[0], true, length);
                        }
                        break;

                    /* This room is no longer in slow mode */
                    case string(message.params[1]).contains('room is no longer in slow mode'):
                        if (self.twitchClient !== 1 && self.twitchClient !== 2) {
                            self.logger.event('slowmode');
                            self.emit('slowmode', message.params[0], false, -1);
                        }
                        break;

                    /* This room is now in r9k mode. */
                    case string(message.params[1]).contains('room is now in r9k mode'):
                        if (self.twitchClient !== 1 && self.twitchClient !== 2) {
                            self.logger.event('r9kbeta');
                            self.emit('r9kbeta', message.params[0], true);
                        }
                        break;

                    /* This room is no longer in r9k mode */
                    case string(message.params[1]).contains('room is no longer in r9k mode'):
                        if (self.twitchClient !== 1 && self.twitchClient !== 2) {
                            self.logger.event('r9kbeta');
                            self.emit('r9kbeta', message.params[0], false);
                        }
                        break;

                    /* X is now hosting you for x viewers. */
                    case string(message.params[1]).contains('is now hosting you for'):
                        if (self.twitchClient !== 1 && self.twitchClient !== 2) {
                            var splitted = message.params[1].split(' ');
                            var viewers  = splitted[splitted.length - 2];

                            self.logger.event('hosted');
                            self.emit('hosted', utils.remHash(message.params[0]), utils.remHash(splitted[0]), viewers);
                        }
                        break;

                    /* The moderators of this room are: [Array] */
                    case string(message.params[1]).contains('moderators of this room are'):
                        if (self.twitchClient !== 1 && self.twitchClient !== 2) {
                            var splitted = message.params[1].split(':');
                            var mods     = splitted[1].replace(/,/g, '').split(':').toString().toLowerCase().split(' ');

                            for(var i = mods.length - 1; i >= 0; i--) {
                                if(mods[i] === '') {
                                    mods.splice(i, 1);
                                }
                            }

                            self.logger.event('mods');
                            self.emit('mods', message.params[0], mods);
                            self.emit('mods' + utils.remHash(message.params[0]).charAt(0).toUpperCase() + utils.remHash(message.params[0]).slice(1), message.params[0], mods);
                        }
                        break;
                }
            break;
        }
    }

    // Handling messages from TwitchNotify..
    else if (message.prefix.raw === 'twitchnotify' || message.prefix.nick === 'twitchnotify') {
        switch(true) {
            case string(message.params[1]).contains('subscribed to'):
                break;
            /* Someone has subscribed to a channel */
            case string(message.params[1]).contains('just subscribed'):
                self.logger.event('subscription');
                self.emit('subscription', message.params[0], message.params[1].split(' ')[0]);
                break;

            /* Someone has shared his sub anniversary */
            case (string(message.params[1]).contains('subscribed') && string(message.params[1]).contains('in a row')):
                var splitted = message.params[1].split(' ');
                var length   = splitted[splitted.length - 5];

                self.logger.event('subanniversary');
                self.emit('subanniversary', message.params[0], splitted[0], length);
                break;
        }
    }

    // Handling any other kind of messages..
    else {
        switch(message.command) {
            /* User has joined a channel */
            case 'JOIN':
                if (message.prefix.nick.toLowerCase() === self.myself.toLowerCase()) {
                    // Preparing the mods object to be filled..
                    if (!self.moderators[utils.addHash(message.params[0])]) {
                        self.moderators[utils.addHash(message.params[0])] = [];
                    }
                    if (self.myself.indexOf('justinfan') === 0 && self.currentChannels.indexOf(utils.remHash(message.params[0]).toLowerCase()) === -1) {
                        // Adding the channel to the currentChannels so we can rejoin on reconnection..
                        if (self.currentChannels.indexOf(utils.remHash(message.params[0])) < 0) {
                            self.currentChannels.push(utils.remHash(message.params[0]));
                            self.currentChannels.reduce(function (a, b) {
                                if (a.indexOf(b) < 0)a.push(b);
                                return a;
                            }, []);
                        }

                        self.logger.event('join');
                        self.emit('join', message.params[0], message.prefix.nick);
                    }
                }
                else {
                    // Emit join..
                    self.logger.event('join');
                    self.emit('join', message.params[0], message.prefix.nick);
                }
                break;

            /* User has left a channel */
            case 'PART':
                self.logger.event('part');

                if (message.prefix.nick.toLowerCase() === self.myself.toLowerCase()) {
                    // Preparing the mods object to be filled..
                    if (self.moderators[utils.addHash(message.params[0])]) { self.moderators[utils.addHash(message.params[0])] = []; }

                    // Remove the channels from the currentChannels..
                    var index = self.currentChannels.indexOf(utils.remHash(message.params[0]).toLowerCase());
                    if (index !== -1) { self.currentChannels.splice(index, 1); }
                    self.currentChannels.reduce(function(a,b){if(a.indexOf(b)<0)a.push(b);return a;},[]);
                }

                self.emit('part', message.params[0], message.prefix.nick.toLowerCase());
                break;

            /* Received message on a channel */
            case 'PRIVMSG':
                _handleTags(message.prefix.nick, message.tags, function(data) {
                    // If channel is the same as the username sending the message, it is the broadcaster..
                    if (message.prefix.nick === utils.remHash(message.params[0])) { data.special.push('broadcaster'); }

                    // First kind of action message..
                    if (string(message.params[1]).startsWith('\u0001ACTION')) {
                        self.logger.event('action');
                        self.logger.action('[' + message.params[0] + '] ' + message.prefix.nick + ': ' + string(message.params[1]).between('\u0001ACTION ', '\u0001').s);
                        self.emit('action', message.params[0], data, string(message.params[1]).between('\u0001ACTION ', '\u0001').s, false);
                    }
                    // Second kind of action message..
                    else if (string(message.params[1]).startsWith(' \x01ACTION')) {
                        self.logger.event('action');
                        self.logger.action('[' + message.params[0] + '] ' + message.prefix.nick + ': ' + string(message.params[1]).between(' \x01ACTION ', '\x01').s);
                        self.emit('action', message.params[0], data, string(message.params[1]).between(' \x01ACTION ', '\x01').s, false);
                    }
                    // Regular chat message..
                    else {
                        self.logger.event('chat');
                        self.logger.chat('[' + message.params[0] + '] ' + message.prefix.nick + ': ' + message.params[1]);
                        self.emit('chat', message.params[0], data, message.params[1], false);
                    }
                });
                break;
        }
    }
};

/* Handling IRCv3 tags */
function _handleTags(username, tags, cb) {
    var self = this;

    self.userData = tags;
    self.userData.username = username;
    self.userData.special = [];

    if (typeof tags['emotes'] === 'string') {
        var emoticons = tags['emotes'].split('/');
        var emotes = {};

        for (var i = 0; i < emoticons.length; i++) {
            var parts = emoticons[i].split(':');
            emotes[parts[0]] = parts[1].split(',');
        }
        self.userData.emote = emotes;
    }

    if (tags['subscriber'] === '1') { self.userData.special.push('subscriber'); }
    if (tags['turbo'] === '1') { self.userData.special.push('turbo'); }
    if (typeof tags['user_type'] === 'string') { self.userData.special.push(tags['user_type']); }

    if (typeof cb == "function") {
        return cb(self.userData);
    }
}

/* _handleMessage for fast reconnecting to server.. do everything silently (graceful reconnection).. */
client.prototype._fastReconnectMessage = function(message) {
    var self = this;

    // Sometimes, messages don't have a prefix..
    if (!message.prefix || message.prefix === null) { message.prefix = ''; }

    // Handling messages with no prefix..
    if (message.prefix === '') {
        switch(message.command) {
            /* Received PING from server */
            case 'PING':
                self.lastPing = new Date();
                self.logger.event('ping');
                self.emit('ping');
                self.socket.crlfWrite('PONG');
                break;

            /* Received PONG from server, return current latency */
            case 'PONG':
                self.logger.event('pong');
                self.emit('pong', (((new Date()-self.latency)/1000)%60));
                break;
        }
    }

    // Handling messages from tmi.twitch.tv
    else if (message.prefix === 'tmi.twitch.tv') {
        switch(message.command) {
            /* Received MOTD from server, it means that we are connected */
            case '372':
                self.lastPing = new Date();
                self.connected = true;
                self.server = self.socket.remoteAddress;
                self.port   = self.socket.remotePort;

                self.socket.resetRetry();

                self.socket.crlfWrite('CAP REQ :twitch.tv/tags twitch.tv/commands');
                if (self.listeners('join').length >= 1 || self.listeners('part').length >= 1) {
                    self.socket.crlfWrite('CAP REQ :twitch.tv/membership');
                }

                if (self.twitchClient >= 1) { self.socket.crlfWrite('TWITCHCLIENT ' + self.twitchClient) }
                else { self.socket.crlfWrite('TWITCHCLIENT 4'); }

                var channels = self.channels || [];

                function recurs(p1) {
                    var couldJoin = false;
                    if (channels.length >= 1) {
                        if (self.connected && self.currentChannels.indexOf(utils.remHash(channels[p1]).toLowerCase()) === -1) {
                            self.join(channels[p1]);
                            couldJoin = true;
                        }
                    }
                    p1++;
                    if (p1 >= channels.length) return;
                    // Was already joined, skip directly to the next channel..
                    if (!couldJoin) { recurs(p1); return; }
                    setTimeout(function() { recurs(p1); }, 3000);
                }

                setTimeout(function() {
                    recurs(0);
                }, 3000);
                break;

            /* Received a notice from the server */
            case 'NOTICE':
                if (message.params[1] === 'Login unsuccessful') {
                    self.connected = false;
                    self.logger.event('disconnected');
                    self.emit('disconnected', 'Login unsuccessful.');
                    self.logger.dev('Disconnect from server: Login unsuccessful.');
                }
                break;
        }
    }

    // Handling any other kind of messages..
    else {
        switch(message.command) {
            /* User has joined a channel */
            case 'JOIN':
                self.emit('join', message.params[0], message.prefix.nick.toLowerCase());
                break;

            /* User has left a channel */
            case 'PART':
                self.emit('part', message.params[0], message.prefix.nick.toLowerCase());
                break;
        }
    }
};

/* Connect to the server */
client.prototype.connect = function() {
    var self = this;
    var deferred = q.defer();

    var connection = self.options.connection || {};

    var preferredServer = connection.preferredServer || null;
    var preferredPort   = connection.preferredPort || null;
    var serverType      = connection.serverType || 'chat';

    servers.getServer(self, serverType, preferredServer, preferredPort, function(server){
        deferred.resolve(true);

        var authenticate = function authenticate() {
            var identity = self.options.identity || {};
            var nickname = identity.username || 'justinfan' + Math.floor((Math.random() * 80000) + 1000);
            var password = identity.password || 'SCHMOOPIIE';

            if (password !== 'SCHMOOPIIE' && password.indexOf('oauth:') < 0) {
                password = 'oauth:' + password;
            }

            self.logger.event('logon');
            self.emit('logon');

            self.socket.crlfWrite('PASS ' + password);
            self.socket.crlfWrite('NICK %s', nickname);
            self.socket.crlfWrite('USER %s 8 * :%s', nickname, nickname);
        };
        self.socket = socket(self, self.options, server.split(':')[1], server.split(':')[0], authenticate);

        self.socket.pipe(self.stream);
    });

    return deferred.promise;
};

/* Gracefully reconnect to the server */
client.prototype.fastReconnect = function() {
    var self = this;

    self.logger.info('Received reconnection request from Twitch.');

    self.gracefulReconnection = true;

    var connection = self.options.connection || {};
    var serverType = connection.serverType || 'chat';

    servers.getServer(self, serverType, self.server, self.port, function(server) {
        var authenticate = function authenticate() {
            var identity = self.options.identity || {};
            var nickname = identity.username || 'justinfan' + Math.floor((Math.random() * 80000) + 1000);
            var password = identity.password || 'SCHMOOPIIE';

            if (password !== 'SCHMOOPIIE' && password.indexOf('oauth:') < 0) {
                password = 'oauth:' + password;
            }

            self.logger.event('logon');
            self.emit('logon');

            self.socket.crlfWrite('PASS ' + password);
            self.socket.crlfWrite('NICK %s', nickname);
            self.socket.crlfWrite('USER %s 8 * :%s', nickname, nickname);
        };
        var oldSocket = self.socket;
        setTimeout(function(){
            oldSocket.unpipe();
            oldSocket.forceDisconnect(true);
            self.logger.info('Dropped previous connection.');
            self.gracefulReconnection = false;
            self.socket.pipe(self.stream);
        },25000);
        self.socket = new socket(self, self.options, server.split(':')[1], server.split(':')[0], authenticate);
        self.socket.pipe(stream.createStream({ parsePrefix: true }).on('data', self._fastReconnectMessage.bind(self)));
    });
};

/* Loading all utils */
client.prototype.utils = {};

require("fs").readdirSync(__dirname + '/utils').forEach(function(file) {
    var utilsMethods = require(__dirname + '/utils/' + file);
    for(var methodName in utilsMethods) {
        client.prototype.utils[methodName]=utilsMethods[methodName];
    }
});

/* Used by external modules */
client.prototype.getOptions = function() {
    return this.options;
};

/* Commands */
client.prototype.action = function(channel, message) {
    var self     = this;
    var deferred = q.defer();

    // Socket isn't null and channel has been joined..
    if (self.socket !== null && self.currentChannels.indexOf(utils.remHash(channel).toLowerCase()) >= 0) {
        if (message.indexOf('/me ') === 0) {
            message = message.substring(4);
        }
        self.socket.crlfWrite('PRIVMSG ' + utils.addHash(channel).toLowerCase() + ' :\u0001ACTION ' + message + '\u0001');
        if (self.debugDetails) {
            self.logger.action('[' + utils.addHash(channel).toLowerCase() + '] ' + self.myself + ': ' + message);
        }
        if (self.emitSelf && self.selfData[utils.addHash(channel).toLowerCase()]) {
            self.emit('action', utils.addHash(channel).toLowerCase(), self.selfData[utils.addHash(channel).toLowerCase()], message, true);
        }
        deferred.resolve(true);
    } else { deferred.resolve(false); }

    return deferred.promise;
};

client.prototype.ban = function(channel, username) {
    var self     = this;
    var deferred = q.defer();

    // Socket isn't null and channel has been joined..
    if (self.socket !== null && self.currentChannels.indexOf(utils.remHash(channel).toLowerCase()) >= 0) {
        self.socket.crlfWrite('PRIVMSG ' + utils.addHash(channel).toLowerCase() + ' :.ban ' + username);
        deferred.resolve(true);
    } else { deferred.resolve(false); }

    return deferred.promise;
};

client.prototype.clear = function(channel) {
    var self     = this;
    var deferred = q.defer();

    // Socket isn't null and channel has been joined..
    if (self.socket !== null && self.currentChannels.indexOf(utils.remHash(channel).toLowerCase()) >= 0) {
        self.socket.crlfWrite('PRIVMSG ' + utils.addHash(channel).toLowerCase() + ' :.clear');
        deferred.resolve(true);
    } else { deferred.resolve(false); }

    return deferred.promise;
};

client.prototype.color = function(channel, color) {
    var self     = this;
    var deferred = q.defer();

    // Socket isn't null and channel has been joined..
    if (self.socket !== null && self.currentChannels.indexOf(utils.remHash(channel).toLowerCase()) >= 0) {
        self.socket.crlfWrite('PRIVMSG ' + utils.addHash(channel).toLowerCase() + ' :.color ' + color);
        deferred.resolve(true);
    } else { deferred.resolve(false); }

    return deferred.promise;
};

client.prototype.commercial = function(channel, seconds) {
    var self     = this;
    var deferred = q.defer();

    seconds = typeof seconds !== 'undefined' ? seconds : 30;
    var availableLengths = [30, 60, 90, 120, 150, 180];
    if (availableLengths.indexOf(seconds) === -1) { seconds = 30; }

    // Socket isn't null and channel has been joined..
    if (self.socket !== null && self.currentChannels.indexOf(utils.remHash(channel).toLowerCase()) >= 0) {
        self.socket.crlfWrite('PRIVMSG ' + utils.addHash(channel).toLowerCase() + ' :.commercial ' + seconds);
        deferred.resolve(true);
    } else { deferred.resolve(false); }

    return deferred.promise;
};

client.prototype.disconnect = function() {
    var self     = this;
    var deferred = q.defer();

    // Socket isn't null..
    if (self.socket !== null) {
        self.socket.forceDisconnect(false);
        deferred.resolve(true);
    } else { deferred.resolve(false); }

    return deferred.promise;
};

client.prototype.host = function(channel, target) {
    var self     = this;
    var deferred = q.defer();

    // Socket isn't null and channel has been joined..
    if (self.socket !== null && self.currentChannels.indexOf(utils.remHash(channel).toLowerCase()) >= 0) {
        self.socket.crlfWrite('PRIVMSG ' + utils.addHash(channel).toLowerCase() + ' :.host ' + target);
        deferred.resolve(true);
    } else { deferred.resolve(false); }

    return deferred.promise;
};

client.prototype.join = function(channel) {
    var self     = this;
    var deferred = q.defer();

    // Socket isn't null and channel hasn't been joined yet..
    if (self.socket !== null && self.currentChannels.indexOf(utils.remHash(channel).toLowerCase()) === -1) {
        self.socket.crlfWrite('JOIN ' + utils.addHash(channel).toLowerCase());
        deferred.resolve(true);
    } else { deferred.resolve(false); }

    return deferred.promise;
};

client.prototype.mod = function(channel, username) {
    var self     = this;
    var deferred = q.defer();

    // Socket isn't null and channel has been joined..
    if (self.socket !== null && self.currentChannels.indexOf(utils.remHash(channel).toLowerCase()) >= 0) {
        self.socket.crlfWrite('PRIVMSG ' + utils.addHash(channel).toLowerCase() + ' :.mod ' + username);
        deferred.resolve(true);
    } else { deferred.resolve(false); }

    return deferred.promise;
};

client.prototype.mods = function(channel) {
    var self     = this;
    var deferred = q.defer();

    // Socket isn't null and channel has been joined..
    if (self.socket !== null && self.currentChannels.indexOf(utils.remHash(channel).toLowerCase()) >= 0) {
        self.socket.crlfWrite('PRIVMSG ' + utils.addHash(channel).toLowerCase() + ' :.mods');
    } else { deferred.resolve([]); }

    if (self.twitchClient !== 1 && self.twitchClient !== 2) {
        self.once('mods' + utils.remHash(channel).toLowerCase().charAt(0).toUpperCase() + utils.remHash(channel).toLowerCase().slice(1), function (channel, mods) {
            deferred.resolve(mods);
        });
    } else { deferred.resolve([]); }

    return deferred.promise;
};


client.prototype.leave = client.prototype.part;
client.prototype.part = function(channel) {
    var self     = this;
    var deferred = q.defer();

    // Socket isn't null and channel has been joined..
    if (self.socket !== null && self.currentChannels.indexOf(utils.remHash(channel).toLowerCase()) >= 0) {
        self.socket.crlfWrite('PART ' + utils.addHash(channel).toLowerCase());
        deferred.resolve(true);
    } else { deferred.resolve(false); }

    return deferred.promise;
};

client.prototype.ping = function() {
    var self     = this;
    var deferred = q.defer();

    // Socket isn't null..
    if (self.socket !== null) {
        self.socket.crlfWrite('PING');
        self.latency = new Date();
        deferred.resolve(true);
    } else { deferred.resolve(false); }

    return deferred.promise;
};

client.prototype.r9kbeta = function(channel) {
    var self     = this;
    var deferred = q.defer();

    // Socket isn't null and channel has been joined..
    if (self.socket !== null && self.currentChannels.indexOf(utils.remHash(channel).toLowerCase()) >= 0) {
        self.socket.crlfWrite('PRIVMSG ' + utils.addHash(channel).toLowerCase() + ' :.r9kbeta');
        deferred.resolve(true);
    } else { deferred.resolve(false); }

    return deferred.promise;
};

client.prototype.r9kbetaoff = function(channel) {
    var self     = this;
    var deferred = q.defer();

    // Socket isn't null and channel has been joined..
    if (self.socket !== null && self.currentChannels.indexOf(utils.remHash(channel).toLowerCase()) >= 0) {
        self.socket.crlfWrite('PRIVMSG ' + utils.addHash(channel).toLowerCase() + ' :.r9kbetaoff');
        deferred.resolve(true);
    } else { deferred.resolve(false); }

    return deferred.promise;
};

client.prototype.raw = function(message) {
    var self     = this;
    var deferred = q.defer();

    // Socket isn't null..
    if (self.socket !== null) {
        self.socket.crlfWrite(message);
        deferred.resolve(true);
    } else { deferred.resolve(false); }

    return deferred.promise;
};

client.prototype.say = function(channel, message) {
    var self     = this;
    if (message.indexOf('/me ') === 0) {
        self.action(channel, message);
    }
    else {
        var deferred = q.defer();

        // Socket isn't null and channel has been joined..
        if (self.socket !== null && self.currentChannels.indexOf(utils.remHash(channel).toLowerCase()) >= 0) {
            self.socket.crlfWrite('PRIVMSG ' + utils.addHash(channel).toLowerCase() + ' :' + message);
            if (self.debugDetails) {
                self.logger.chat('[' + utils.addHash(channel).toLowerCase() + '] ' + self.myself + ': ' + message);
            }
            if (self.emitSelf && self.selfData[utils.addHash(channel).toLowerCase()]) {
                self.emit('chat', utils.addHash(channel).toLowerCase(), self.selfData[utils.addHash(channel).toLowerCase()], message, true);
            }
            deferred.resolve(true);
        } else {
            deferred.resolve(false);
        }

        return deferred.promise;
    }
};

client.prototype.slow = function(channel, seconds) {
    var self     = this;
    var deferred = q.defer();

    seconds = typeof seconds !== 'undefined' ? seconds : 300;

    // Socket isn't null and channel has been joined..
    if (self.socket !== null && self.currentChannels.indexOf(utils.remHash(channel).toLowerCase()) >= 0) {
        self.socket.crlfWrite('PRIVMSG ' + utils.addHash(channel).toLowerCase() + ' :.slow ' + seconds);
        deferred.resolve(true);
    } else { deferred.resolve(false); }

    return deferred.promise;
};

client.prototype.slowoff = function(channel) {
    var self     = this;
    var deferred = q.defer();

    // Socket isn't null and channel has been joined..
    if (self.socket !== null && self.currentChannels.indexOf(utils.remHash(channel).toLowerCase()) >= 0) {
        self.socket.crlfWrite('PRIVMSG ' + utils.addHash(channel).toLowerCase() + ' :.slowoff');
        deferred.resolve(true);
    } else { deferred.resolve(false); }

    return deferred.promise;
};

client.prototype.subscribers = function(channel) {
    var self     = this;
    var deferred = q.defer();

    // Socket isn't null and channel has been joined..
    if (self.socket !== null && self.currentChannels.indexOf(utils.remHash(channel).toLowerCase()) >= 0) {
        self.socket.crlfWrite('PRIVMSG ' + utils.addHash(channel).toLowerCase() + ' :.subscribers');
        deferred.resolve(true);
    } else { deferred.resolve(false); }

    return deferred.promise;
};

client.prototype.subscribersoff = function(channel) {
    var self     = this;
    var deferred = q.defer();

    // Socket isn't null and channel has been joined..
    if (self.socket !== null && self.currentChannels.indexOf(utils.remHash(channel).toLowerCase()) >= 0) {
        self.socket.crlfWrite('PRIVMSG ' + utils.addHash(channel).toLowerCase() + ' :.subscribersoff');
        deferred.resolve(true);
    } else { deferred.resolve(false); }

    return deferred.promise;
};

client.prototype.timeout = function(channel, username, seconds) {
    var self     = this;
    var deferred = q.defer();

    seconds = typeof seconds !== 'undefined' ? seconds : 300;

    // Socket isn't null and channel has been joined..
    if (self.socket !== null && self.currentChannels.indexOf(utils.remHash(channel).toLowerCase()) >= 0) {
        self.socket.crlfWrite('PRIVMSG ' + utils.addHash(channel).toLowerCase() + ' :.timeout ' + username + ' ' + seconds);
        deferred.resolve(true);
    } else { deferred.resolve(false); }

    return deferred.promise;
};

client.prototype.unban = function(channel, username) {
    var self     = this;
    var deferred = q.defer();

    // Socket isn't null and channel has been joined..
    if (self.socket !== null && self.currentChannels.indexOf(utils.remHash(channel).toLowerCase()) >= 0) {
        self.socket.crlfWrite('PRIVMSG ' + utils.addHash(channel).toLowerCase() + ' :.unban ' + username);
        deferred.resolve(true);
    } else { deferred.resolve(false); }

    return deferred.promise;
};

client.prototype.unhost = function(channel) {
    var self     = this;
    var deferred = q.defer();

    // Socket isn't null and channel has been joined..
    if (self.socket !== null && self.currentChannels.indexOf(utils.remHash(channel).toLowerCase()) >= 0) {
        self.socket.crlfWrite('PRIVMSG ' + utils.addHash(channel).toLowerCase() + ' :.unhost');
        deferred.resolve(true);
    } else { deferred.resolve(false); }

    return deferred.promise;
};

client.prototype.unmod = function(channel, username) {
    var self     = this;
    var deferred = q.defer();

    // Socket isn't null and channel has been joined..
    if (self.socket !== null && self.currentChannels.indexOf(utils.remHash(channel).toLowerCase()) >= 0) {
        self.socket.crlfWrite('PRIVMSG ' + utils.addHash(channel).toLowerCase() + ' :.unmod ' + username);
        deferred.resolve(true);
    } else { deferred.resolve(false); }

    return deferred.promise;
};

/* Functions */

client.prototype.isMod = function(channel, username) {
    var self = this;

    if (self.moderators[utils.addHash(channel)].indexOf(username.toLowerCase()) >= 0) {
        return true;
    }
    return false;
};

module.exports = client;
