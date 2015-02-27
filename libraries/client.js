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

var data     = require('./data');
var events   = require('events');
var pkg      = require('./../package.json');
var parse    = require('irc-prefix-parser');
var request  = require('request');
var servers  = require('./servers');
var socket   = require('./socket');
var stream   = require('./modules/messages');
var string   = require('string');
var util     = require('util');
var utils    = require('./modules/utils');

/* Represents a new client instance */
var client = function client(options) {
    var self = this;

    events.EventEmitter.call(this);
    self.setMaxListeners(0);

    var logger           = require('./modules/logger');
    this.logger          = new logger(options);
    this.options         = (typeof options != 'undefined') ? options : {};
    this.options.options = this.options.options || {};
    this.stream          = stream().on('data', this._handleMessage.bind(this));
    this.socket          = null;
    this.moderators      = {};
    this.myself          = '';
    this.channels        = [];
    this.latency         = new Date();
    this.server          = 'irc.twitch.tv';
    this.tags            = false;
    this.port            = 443;
    this.commandError    = '';
    this.modsList        = [];
    this.joined          = false;

    this.gracefulReconnection = false;

    this.logger.dev('Created a new client instance on pid ' + process.pid);
    this.logger.dev('Memory rss: ' + process.memoryUsage().rss);
    this.logger.dev('Memory heap total: ' + process.memoryUsage().heapTotal);
    this.logger.dev('Memory heap used : ' + process.memoryUsage().heapUsed);

    this.tags   = (this.options.options && (typeof this.options.options.tags != 'undefined')) ? this.options.options.tags : false;

    var checkUpdates = (this.options.options && (typeof this.options.options.checkUpdates !== 'undefined')) ? this.options.options.checkUpdates : true;

    if (checkUpdates) {
        request('http://registry.npmjs.org/twitch-irc/latest', function (err, res, body) {
            if (!err && res.statusCode == 200) {
                if (utils.versionCompare(JSON.parse(body).version, pkg.version) >= 1) {
                    console.log('\x1b[36m?\x1b[97m new update available for twitch-irc: \x1b[32m' + JSON.parse(body).version + '\x1b[39m \x1b[90m(current: ' + pkg.version + ')\x1b[39m');
                }
            }
        });
    }

    var exitOnError = (this.options.options && (typeof this.options.options.exitOnError != 'undefined')) ? this.options.options.exitOnError : true;

    process.on('uncaughtException', function (err) {
        self.logger.crash(err.stack);
        self.emit('crash', err.message, err.stack);
        if (exitOnError) { process.exit(); }
    });
};

util.inherits(client, events.EventEmitter);

/* Remove items from array */
Array.prototype.clean = function(deleteValue) {
    this.map(function(value, index, array) {
        return value === deleteValue && array.splice(index, 1) && array;
    });
};

/* Handle all IRC messages */
client.prototype._handleMessage = function _handleMessage(message) {
    var self = this;

    if (message.command.match(/^[0-9]+$/g)) { self.logger.raw(message.command + ': ' + message.params[1]); }

    var messageFrom = message.prefix;
    if (message.prefix && message.prefix.indexOf('@') >= 0) { messageFrom = parse(messageFrom).nick; }

    if (message.command === '001') { self.myself = message.params[0]; }

    if (!utils.isEmpty(message.tags) && self.tags) {
        var username = messageFrom;

        if (username !== 'tmi.twitch.tv') {
            self.emit('tags', message.tags);

            data.createTempUserData(username);

            if (typeof message.tags.color === 'string') {
                self.emit('usercolor', username, message.tags.color);
                data.tempUserData[username].color = message.tags.color;
            }

            if (typeof message.tags.emotes === 'string') {
                self.emit('emoteset', username, message.tags.emotes);

                var emoticons = message.tags.emotes.split('/');
                var emotes = {};
                for (var i = 0; i < emoticons.length; i++) {
                    var parts = emoticons[i].split(':');
                    emotes[parts[0]] = parts[1].split(',');
                }
                data.tempUserData[username].emote = emotes;
            }

            if (message.tags.subscriber === '1') {
                self.emit('specialuser', username, 'subscriber');
                data.tempUserData[username].special.push('subscriber');
            }

            if (message.tags.turbo === '1') {
                self.emit('specialuser', username, 'turbo');
                data.tempUserData[username].special.push('turbo');
            }

            if (typeof message.tags.user_type === 'string') {
                self.emit('specialuser', username, message.tags.user_type);
                data.tempUserData[username].special.push(message.tags.user_type);
            }
        }
    }

    switch(message.command) {
        case 'PING':
            /* Received PING from server */
            self.logger.event('ping');
            self.emit('ping');
            self.socket.crlfWrite('PONG');
            break;

        case 'PONG':
            /* Received PONG from server, return current latency */
            self.logger.event('pong');
            self.emit('pong', (((new Date()-self.latency)/1000)%60));
            break;

        case '372':
            /* Received MOTD from server, it means that we are connected */
            self.logger.event('connected');
            self.emit('connected', self.socket.remoteAddress, self.socket.remotePort);

            self.server = self.socket.remoteAddress;
            self.port   = self.socket.remotePort;

            self.socket.resetRetry();

            var options      = self.options.options || {};
            var twitchClient = options.tc || 3;
            var autoRejoin   = options.autoRejoin || true;

            if (twitchClient >= 2) { tags = true; }
            if (self.tags) {
                self.socket.crlfWrite('CAP REQ :twitch.tv/tags twitch.tv/commands');
                self.socket.crlfWrite('TWITCHCLIENT 4');
            } else {
                self.socket.crlfWrite('TWITCHCLIENT ' + twitchClient);
            }

            var timer    = 0;
            var channels = [];
            if (self.channels.length >= 1 && self.joined && autoRejoin) { channels = self.channels; }
            else { channels = self.options.channels || []; }

            channels.forEach(function(channel) {
                setTimeout(function(){self.join(channel);}, timer);
                timer = timer+3000;
            });
            break;

        case 'JOIN':
            /* User has joined a channel */
            self.logger.event('join');
            if (!self.moderators[message.params[0]]) { self.moderators[message.params[0]] = []; }

            if (self.channels.indexOf(utils.remHash(message.params[0]).toLowerCase()) < 0) {
                self.channels.push(utils.remHash(message.params[0]).toLowerCase());
                self.channels.reduce(function(a,b){if(a.indexOf(b)<0)a.push(b);return a;},[]);
            }
            self.emit('join', message.params[0], parse(message.prefix).nick.toLowerCase());
            if (self.options.channels.length >= 1 && utils.remHash(message.params[0]).toLowerCase() === utils.remHash(self.options.channels[self.options.channels.length-1]).toLowerCase()) {
                self.joined = true;
            }
            if (self.options.channels.length <= 0) {
                self.joined = true;
            }
            this.logger.dev('Joined ' + message.params[0]);
            break;

        case 'PART':
            /* User has left a channel */
            self.logger.event('part');
            self.emit('part', message.params[0], parse(messageFrom).nick.toLowerCase());

            if (self.moderators[message.params[0]]) { self.moderators[message.params[0]] = []; }

            var index = self.channels.indexOf(utils.remHash(message.params[0]).toLowerCase());
            if (index !== -1) { self.channels.splice(index, 1); }
            self.channels.reduce(function(a,b){if(a.indexOf(b)<0)a.push(b);return a;},[]);
            this.logger.dev('Left ' + message.params[0]);
            break;

        case 'NOTICE':
            /* Received a notice from the server */
            if (message.prefix === 'tmi.twitch.tv') {
                if (message.params[1] === 'Login unsuccessful') {
                    self.logger.event('disconnected');
                    self.emit('disconnected', message.params[1]);
                    this.logger.dev('Disconnect from server: Login unsuccessful.');
                }
            }
            break;

        case 'MODE':
            if (message.prefix === 'jtv') {
                if (message.params[1] === '+o') {
                    self.moderators[message.params[0]].push(message.params[2].toLowerCase());
                    self.moderators[message.params[0]].reduce(function(a,b){if(a.indexOf(b)<0)a.push(b);return a;},[]);
                    self.emit('mod', message.params[0], message.params[2]);
                    this.logger.dev('Mod ' + message.params[0] + ' ' + message.params[2]);
                } else {
                    var index = self.moderators[message.params[0]].indexOf(message.params[2].toLowerCase());
                    if (index >= 0) { self.moderators[message.params[0]].splice(index, 1); }
                    self.moderators[message.params[0]].reduce(function(a,b){if(a.indexOf(b)<0)a.push(b);return a;},[]);
                    self.emit('unmod', message.params[0], message.params[2]);
                    this.logger.dev('Unmod ' + message.params[0] + ' ' + message.params[2]);
                }
            }
            break;

        case 'RECONNECT':
            this.logger.dev('Received RECONNECT from Twitch.');
            self.fastReconnect();
            break;

        // Received message.
        case 'PRIVMSG':
            /* Handling all messages from JTV */
            if (messageFrom === 'jtv') {
                self.emit('jtv', message.params);

                var username = message.params[1] ? message.params[1].split(' ')[1] : message.params.push('');
                var value    = message.params[1] ? message.params[1].split(' ')[2] : message.params.push('');

                switch(true) {
                    case (message.params[1] === 'This room is now in subscribers-only mode.'):
                        /* Room is now in subscribers-only mode */
                        self.logger.event('subscriber');
                        self.emit('subscriber', message.params[0], true);
                        break;

                    case (message.params[1] === 'This room is no longer in subscribers-only mode.'):
                        /* Room is now no longer in subscribers-only mode */
                        self.logger.event('subscriber');
                        self.emit('subscriber', message.params[0], false);
                        break;

                    case (string(message.params[1]).contains('This room is now in slow mode.')):
                        /* Room is now in slow mode */
                        var parts  = message.params[1].split(' ');
                        var length = parts[parts.length - 2];
                        self.logger.event('slowmode');
                        self.emit('slowmode', message.params[0], true, length);
                        break;

                    case (message.params[1] === 'This room is no longer in slow mode.'):
                        /* Room is no longer in slow mode */
                        self.logger.event('slowmode');
                        self.emit('slowmode', message.params[0], false, -1);
                        break;

                    case (message.params[1] === 'This room is now in r9k mode. See http://bit.ly/bGtBDf'):
                        /* Room is in r9k mode */
                        self.logger.event('r9kbeta');
                        self.emit('r9kbeta', message.params[0], true);
                        break;

                    case (message.params[1] === 'This room is no longer in r9k mode.'):
                        /* Room is no longer in r9k mode */
                        self.logger.event('r9kbeta');
                        self.emit('r9kbeta', message.params[0], false);
                        break;

                    case (string(message.params[0]).contains('is now hosting you for')):
                        /* Room is now hosted by another user */
                        var parts = message.params[0].split(' ');
                        self.logger.event('hosted');
                        self.emit('hosted', message.params[0], parts[0], parts[6]);
                        break;

                    case (string(message.params[1]).contains('The moderators of this channel are:')):
                        /* Received mods list on a channel */
                        var parts = message.params[1].split(':');
                        var mods  = parts[1].replace(/,/g, '').split(':').toString().toLowerCase().split(' ');
                        mods.clean('');
                        self.modsList = mods;
                        setTimeout(function() { self.modsList = []; }, 300);
                        self.logger.event('mods');
                        self.emit('mods', message.params[0], mods);
                        break;

                    case (
                        string(message.params[1]).contains('You don\'t have permission') ||
                        string(message.params[1]).contains('Only the owner of this channel can use') ||
                        string(message.params[1]).contains('Only the channel owner and channel editors can') ||
                        string(message.params[1]).contains('Your message was not sent') ||
                        string(message.params[1]).contains('Invalid username:') ||
                        string(message.params[1]).contains('Upgrade to turbo or use one of these colors') ||
                        string(message.params[1]).contains('is not a moderator. Use the \'mods\' command to find a list of mode') ||
                        string(message.params[1]).contains('Your message was not sent') ||
                        message.params[1] === 'Host target cannot be changed more than three times per 30 minutes.' ||
                        message.params[1] === 'UNAUTHORIZED JOIN' ||
                        message.params[1] === 'You need to tell me who you want to grant mod status to.') ||
                        message.params[1] === 'Failed to start commercial.' ||
                        message.params[1] === 'You cannot timeout the broadcaster.':

                        this.logger.dev('ERROR: ' + message.params[1]);
                        self.commandError = message.params[1];
                        setTimeout(function() { self.commandError = ''; }, 300);
                        break;

                    case (
                        string(message.params[1]).contains('You have un-modded') ||
                        string(message.params[1]).contains('You have banned') ||
                        string(message.params[1]).contains('Now hosting') ||
                        string(message.params[1]).contains('/host commands remaining this half hour') ||
                        string(message.params[1]).contains('You have unbanned')) ||
                        (string(message.params[1]).contains('You have added') && string(message.params[1]).contains('as a moderator.')) ||
                        message.params[1] === 'Your color has been changed' ||
                        message.params[1] === 'Exited host mode.':

                        this.logger.dev('SUCCESS: ' + message.params[1]);
                        self.commandError = '';
                        break;

                    case (message.params[1].split(' ')[0] === 'SPECIALUSER' && !self.tags):
                        /* SPECIALUSER message by JTV */
                        self.emit('specialuser', username, value);
                        data.createTempUserData(username);
                        data.tempUserData[username].special.push(value);
                        break;

                    case (message.params[1].split(' ')[0] === 'USERCOLOR' && !self.tags):
                        /* USERCOLOR message by JTV */
                        self.emit('usercolor', username, value);
                        data.createTempUserData(username);
                        data.tempUserData[username].color = value;
                        break;

                    case (message.params[1].split(' ')[0] === 'EMOTESET' && !self.tags):
                        /* EMOTESET message by JTV */
                        self.emit('emoteset', username, value);
                        data.createTempUserData(username);
                        data.tempUserData[username].emote = value;
                        break;

                    case (message.params[1].split(' ')[0] === 'CLEARCHAT'):
                        /* CLEARCHAT message by JTV */
                        if (username) {
                            self.logger.event('timeout');
                            self.emit('timeout', message.params[0], username);
                        }
                        else {
                            self.logger.event('clearchat');
                            self.emit('clearchat', message.params[0]);
                        }
                        break;

                    case (message.params[1].split(' ')[0] === 'ROOMBAN'):
                        /* ROOMBAN message by JTV */
                        self.emit('roomban', message.params[0], username);
                        break;

                    case (message.params[1].split(' ')[0] === 'ROOMCHANGED'):
                        /* ROOMCHANGED message by JTV */
                        self.emit('roomchanged', message.params[0]);
                        break;

                    case (message.params[1].split(' ')[0] === 'ROOMDELETED'):
                        /* ROOMDELETED message by JTV */
                        self.emit('roomdeleted', message.params[0]);
                        break;

                    case (message.params[1].split(' ')[0] === 'ROOMINVITE'):
                        /* ROOMINVITE message by JTV */
                        self.emit('roominvite', message.params[0], username);
                        break;

                    case (message.params[1].split(' ')[0] === 'HISTORYEND'):
                        break;

                    case (message.params[1].split(' ')[0] === 'HOSTTARGET'):
                        /* HOSTTARGET message by JTV */
                        if (message.params[1].split(' ')[1] === '-') {
                            self.logger.event('unhost');
                            self.emit('unhost', message.params[0], message.params[1].split(' ')[2]);
                        } else {
                            self.logger.event('hosting');
                            self.emit('hosting', message.params[0], message.params[1].split(' ')[1], message.params[1].split(' ')[2]);
                        }
                        break;

                    default:
                        self.logger.dev('Unhandled message from JTV:');
                        self.logger.dev(message.params[1]);
                        break;
                }
            }

            /* Received a message from TwitchNotify */
            else if (messageFrom === 'twitchnotify') {
                self.emit('twitchnotify', message.params[0], message.params[1]);

                switch(true) {
                    case (string(message.params[1]).contains('just subscribed') && !string(message.params[1]).contains('in a row')):
                        /* Someone has subscribed to a channel */
                        self.logger.event('subscription');
                        self.emit('subscription', message.params[0], message.params[1].split(' ')[0]);
                        break;
                    case (string(message.params[1]).contains('subscribed') && string(message.params[1]).contains('in a row')):
                        /* Someone has shared his sub anniversary */
                        self.logger.event('subanniversary');
                        self.emit('subanniversary', message.params[0], message.params[1].split(' ')[0], message.params[1].split(' ')[3]);
                        break;
                    default:
                        self.logger.dev('Unhandled message from TwitchNotify:');
                        self.logger.dev(message.params[1]);
                        break;
                }
            }

            /* Someone has sent a message on a channel */
            else {
                var username = parse(message.prefix).nick.toLowerCase();

                data.createTempUserData(username);
                if (self.moderators[message.params[0]].indexOf(username.toLowerCase()) >= 0 && utils.remHash(message.params[0]).toLowerCase() !== username && !self.tags) {
                    data.tempUserData[username].special.push('mod');
                }
                if (utils.remHash(message.params[0]).toLowerCase() === username) {
                    data.tempUserData[username].special.push('broadcaster');
                }
                data.createChannelUserData(message.params[0], username, function(done) {
                    if (string(message.params[1]).startsWith('\u0001ACTION')) {
                        self.logger.event('action');
                        self.logger.chat('[' + message.params[0] + '] ' + username + ': ' + string(message.params[1]).between('\u0001ACTION ', '\u0001').s);
                        self.emit('action', message.params[0], data.channelUserData[message.params[0]][username], string(message.params[1]).between('\u0001ACTION ', '\u0001').s);
                    } else if (string(message.params[1]).startsWith(' \x01ACTION')) {
                        self.logger.event('action');
                        self.logger.chat('[' + message.params[0] + '] ' + username + ': ' + string(message.params[1]).between(' \x01ACTION ', '\x01').s);
                        self.emit('action', message.params[0], data.channelUserData[message.params[0]][username], string(message.params[1]).between(' \x01ACTION ', '\x01').s);
                    } else {
                        self.logger.event('chat');
                        self.logger.chat('[' + message.params[0] + '] ' + username + ': ' + message.params[1]);
                        self.emit('chat', message.params[0], data.channelUserData[message.params[0]][username], message.params[1]);
                        if (message.params[1].charAt(0) === '!') {
                            var command = message.params[1].split(' ')[0].toLowerCase();
                            var args    = message.params[1].split(' ');
                            args.shift();

                            self.emit('command', message.params[0], username, {command: command, args: args || [], string: args.join(' ') || ''});
                        }
                    }
                });
            }
            break;
    }
};

client.prototype._fastReconnectMessage = function _fastReconnectMessage(message) {
    var self = this;

    if (message.command.match(/^[0-9]+$/g)) { self.logger.raw('%s: %s', message.command, message.params[1]); }

    var messageFrom = message.prefix;
    if (message.prefix.indexOf('@') >= 0) { messageFrom = parse(messageFrom).nick; }

    switch(message.command) {
        case 'PING':
            self.socket.crlfWrite('PONG');
            break;

        case 'PONG':
            self.emit('pong', (((new Date()-self.latency)/1000)%60));
            break;

        case '372':
            self.server = self.socket.remoteAddress;
            self.port   = self.socket.remotePort;
            self.socket.resetRetry();

            var options      = self.options.options || {};
            var twitchClient = options.tc || 3;

            if (twitchClient >= 2) { self.tags = true; }
            if (self.tags) {
                self.socket.crlfWrite('CAP REQ :twitch.tv/tags twitch.tv/commands');
                self.socket.crlfWrite('TWITCHCLIENT 4');
            } else {
                self.socket.crlfWrite('TWITCHCLIENT ' + twitchClient);
            }

            var timer = 0;
            self.channels.forEach(function(channel) {
                setTimeout(function(){self.join(channel);}, timer);
                timer = timer+3000;
            });
            break;

        case 'JOIN':
            self.emit('join', message.params[0], parse(messageFrom).nick.toLowerCase());
            break;

        case 'PART':
            self.emit('part', message.params[0], parse(messageFrom).nick.toLowerCase());
            break;

        case 'NOTICE':
            if (message.prefix === 'tmi.twitch.tv') {
                if (message.params[1] === 'Login unsuccessful') {
                    self.emit('disconnected', message.params[1]);
                }
            }
            break;
    }
};

/* Connect to the server */
client.prototype.connect = function connect() {
    var self = this;

    var connection = self.options.connection || {};

    var preferredServer = connection.preferredServer || null;
    var preferredPort   = connection.preferredPort || null;
    var serverType      = connection.serverType || 'chat';

    servers.getServer(serverType, preferredServer, preferredPort, self.logger, function(server){
        var authenticate = function authenticate() {
            var identity = self.options.identity || {};
            var nickname = identity.username || 'justinfan' + Math.floor((Math.random() * 80000) + 1000);
            var password = identity.password || 'SCHMOOPIIE';

            self.logger.event('logon');
            self.emit('logon');

            self.socket.crlfWrite('PASS ' + password);
            self.socket.crlfWrite('NICK %s', nickname);
            self.socket.crlfWrite('USER %s 8 * :%s', nickname, nickname);
        };
        self.socket = socket(self, self.options, self.logger, server.split(':')[1], server.split(':')[0], authenticate);

        self.socket.pipe(self.stream);
    });
};

/* Gracefully reconnect to the server */
client.prototype.fastReconnect = function fastReconnect() {
    var self = this;

    self.logger.info('Received RECONNECT request from Twitch.');

    self.gracefulReconnection = true;

    var connection = self.options.connection || {};
    var serverType = connection.serverType || 'chat';

    servers.getServer(serverType, self.server, self.port, self.logger, function(server) {
        var authenticate = function authenticate() {
            var identity = self.options.identity || {};
            var nickname = identity.username || 'justinfan' + Math.floor((Math.random() * 80000) + 1000);
            var password = identity.password || 'SCHMOOPIIE';

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
            self.logger.info('Dropped old connection, resuming with the new one.');
            self.gracefulReconnection = false;
            self.socket.pipe(self.stream);
        },25000);
        self.socket = new socket(self, self.options, self.logger, server.split(':')[1], server.split(':')[0], authenticate);
        self.socket.pipe(stream().on('data', self._fastReconnectMessage.bind(self)));
    });
};

/* Disconnect from server */
client.prototype.disconnect = function disconnect() {
    if (this.socket !== null) { this.socket.forceDisconnect(false); }
};

/* Check if username is moderator on channel */
client.prototype.isMod = function isMod(channel, username) {
    if (this.moderators[utils.remHash(channel)].indexOf(username.toLowerCase()) >= 0) {
        return true;
    }
    return false;
};

client.prototype.clearChannels = function clearChannels() { this.channels = []; };

/* Join a channel */
client.prototype.join = function join(channel) {
    if (this.socket !== null && this.channels.indexOf(utils.remHash(channel).toLowerCase()) === -1) { this.socket.crlfWrite('JOIN ' + utils.addHash(channel).toLowerCase()); }
};

/* Leave a channel */
client.prototype.part = function part(channel) {
    if (this.socket !== null && this.channels.indexOf(utils.remHash(channel).toLowerCase()) >= 0) { this.socket.crlfWrite('PART ' + utils.addHash(channel).toLowerCase()); }
};

client.prototype.leave = client.prototype.part;

/* Send a PING to the server */
client.prototype.ping = function ping() {
    if (this.socket !== null) { this.socket.crlfWrite('PING'); }
    this.latency = new Date();
};

/* Say something on a channel */
client.prototype.say = function say(channel, message, cb) {
    if (this.socket !== null) { this.socket.crlfWrite('PRIVMSG ' + utils.addHash(channel).toLowerCase() + ' :' + message); }
    if (typeof cb === 'function') { setTimeout(function() { this.commandError !== '' && cb(this.commandError) && cb(null); }, 250); }
};

/* Say something on a channel (action) */
client.prototype.action = function action(channel, message, cb) {
    if (this.socket !== null) { this.socket.crlfWrite('PRIVMSG ' + utils.addHash(channel).toLowerCase() + ' : \x01ACTION ' + message + '\x01'); }
    if (typeof cb === 'function') { setTimeout(function() { this.commandError !== '' && cb(this.commandError) && cb(null); }, 250); }
};

/* Change the color of the bot's username */
client.prototype.color = function color(channel, color, cb) {
    if (this.socket !== null) { this.socket.crlfWrite('PRIVMSG ' + utils.addHash(channel).toLowerCase() + ' :.color ' + color); }
    if (typeof cb === 'function') { setTimeout(function() { this.commandError !== '' && cb(this.commandError) && cb(null); }, 250); }
};

/* Host a channel */
client.prototype.host = function host(channel, target, cb) {
    if (this.socket !== null) { this.socket.crlfWrite('PRIVMSG ' + utils.addHash(channel).toLowerCase() + ' :.host ' + target); }
    if (typeof cb === 'function') { setTimeout(function() { this.commandError !== '' && cb(this.commandError) && cb(null); }, 250); }
};

/* End the current hosting */
client.prototype.unhost = function unhost(channel, cb) {
    if (this.socket !== null) { this.socket.crlfWrite('PRIVMSG ' + utils.addHash(channel).toLowerCase() + ' :.unhost'); }
    if (typeof cb === 'function') { setTimeout(function() { this.commandError !== '' && cb(this.commandError) && cb(null); }, 250); }
};

/* Timeout user on a channel for X seconds */
client.prototype.timeout = function timeout(channel, username, seconds, cb) {
    seconds = typeof seconds !== 'undefined' ? seconds : 300;
    if (this.socket !== null) { this.socket.crlfWrite('PRIVMSG ' + utils.addHash(channel).toLowerCase() + ' :.timeout ' + username + ' ' + seconds); }
    if (typeof cb === 'function') { setTimeout(function() { this.commandError !== '' && cb(this.commandError) && cb(null); }, 250); }
};

/* Ban user on a channel */
client.prototype.ban = function ban(channel, username, cb) {
    if (this.socket !== null) { this.socket.crlfWrite('PRIVMSG ' + utils.addHash(channel).toLowerCase() + ' :.ban ' + username); }
    if (typeof cb === 'function') { setTimeout(function() { this.commandError !== '' && cb(this.commandError) && cb(null); }, 250); }
};

/* Unban user on a channel */
client.prototype.unban = function unban(channel, username, cb) {
    if (this.socket !== null) { this.socket.crlfWrite('PRIVMSG ' + utils.addHash(channel).toLowerCase() + ' :.unban ' + username); }
    if (typeof cb === 'function') { setTimeout(function() { this.commandError !== '' && cb(this.commandError) && cb(null); }, 250); }
};

/* Enable slow mode on a channel */
client.prototype.slow = function slow(channel, seconds, cb) {
    seconds = typeof seconds !== 'undefined' ? seconds : 300;
    if (this.socket !== null) { this.socket.crlfWrite('PRIVMSG ' + utils.addHash(channel).toLowerCase() + ' :.slow ' + seconds); }
    if (typeof cb === 'function') { setTimeout(function() { this.commandError !== '' && cb(this.commandError) && cb(null); }, 250); }
};

/* Disable slow mode on a channel */
client.prototype.slowoff = function slowoff(channel, cb) {
    if (this.socket !== null) { this.socket.crlfWrite('PRIVMSG ' + utils.addHash(channel).toLowerCase() + ' :.slowoff'); }
    if (typeof cb === 'function') { setTimeout(function() { this.commandError !== '' && cb(this.commandError) && cb(null); }, 250); }
};

/* Enable subscriber-only on a channel */
client.prototype.subscribers = function subscribers(channel, cb) {
    if (this.socket !== null) { this.socket.crlfWrite('PRIVMSG ' + utils.addHash(channel).toLowerCase() + ' :.subscribers'); }
    if (typeof cb === 'function') { setTimeout(function() { this.commandError !== '' && cb(this.commandError) && cb(null); }, 250); }
};

/* Disable subscriber-only on a channel */
client.prototype.subscribersoff = function subscribersoff(channel, cb) {
    if (this.socket !== null) { this.socket.crlfWrite('PRIVMSG ' + utils.addHash(channel).toLowerCase() + ' :.subscribersoff'); }
    if (typeof cb === 'function') { setTimeout(function() { this.commandError !== '' && cb(this.commandError) && cb(null); }, 250); }
};

/* Clear all messages on a channel */
client.prototype.clear = function clear(channel, cb) {
    if (this.socket !== null) { this.socket.crlfWrite('PRIVMSG ' + utils.addHash(channel).toLowerCase() + ' :.clear'); }
    if (typeof cb === 'function') { setTimeout(function() { this.commandError !== '' && cb(this.commandError) && cb(null); }, 250); }
};

/* Enable R9KBeta on a channel */
client.prototype.r9kbeta = function r9kbeta(channel, cb) {
    if (this.socket !== null) { this.socket.crlfWrite('PRIVMSG ' + utils.addHash(channel).toLowerCase() + ' :.r9kbeta'); }
    if (typeof cb === 'function') { setTimeout(function() { this.commandError !== '' && cb(this.commandError) && cb(null); }, 250); }
};

/* Disable R9KBeta on a channel */
client.prototype.r9kbetaoff = function r9kbetaoff(channel, cb) {
    if (this.socket !== null) { this.socket.crlfWrite('PRIVMSG ' + utils.addHash(channel).toLowerCase() + ' :.r9kbetaoff'); }
    if (typeof cb === 'function') { setTimeout(function() { this.commandError !== '' && cb(this.commandError) && cb(null); }, 250); }
};

/* Mod user on a channel */
client.prototype.mod = function mod(channel, username, cb) {
    if (this.socket !== null) { this.socket.crlfWrite('PRIVMSG ' + utils.addHash(channel).toLowerCase() + ' :.mod ' + username); }
    if (typeof cb === 'function') { setTimeout(function() { this.commandError !== '' && cb(this.commandError) && cb(null); }, 250); }
};

/* Unmod user on a channel */
client.prototype.unmod = function mod(channel, username, cb) {
    if (this.socket !== null) { this.socket.crlfWrite('PRIVMSG ' + utils.addHash(channel).toLowerCase() + ' :.unmod ' + username); }
    if (typeof cb === 'function') { setTimeout(function() { this.commandError !== '' && cb(this.commandError) && cb(null); }, 250); }
};

/* Run commercial on a channel for X seconds */
client.prototype.commercial = function commercial(channel, seconds, cb) {
    seconds = typeof seconds !== 'undefined' ? seconds : 30;
    var availableLengths = [30, 60, 90, 120, 150, 180];
    if (availableLengths.indexOf(seconds) === -1) { seconds = 30; }
    if (this.socket !== null) { this.socket.crlfWrite('PRIVMSG ' + utils.addHash(channel).toLowerCase() + ' :.commercial ' + seconds); }
    if (typeof cb === 'function') { setTimeout(function() { this.commandError !== '' && cb(this.commandError) && cb(null); }, 250); }
};

/* Get all the mods on a channel */
client.prototype.mods = function mods(channel, cb) {
    var self = this;
    if (self.socket !== null) { self.socket.crlfWrite('PRIVMSG ' + utils.addHash(channel).toLowerCase() + ' :.mods'); }
    if (typeof cb === 'function') {
        setTimeout(function() {
            if (self.modsList.length !== 0) {
                cb(self.modsList);
            } else { cb([]); }
        }, 250);
    }
};

/* Send a RAW message */
client.prototype.raw = function raw(message) {
    if (this.socket !== null) { this.socket.crlfWrite(message); }
};

/* Loading all utils */
client.prototype.utils = {};

var fs = require("fs");
fs.readdirSync(__dirname + '/utils').forEach(function(file) {
    var utilsMethods = require(__dirname + '/utils/' + file);
    for(var methodName in utilsMethods) {
        client.prototype.utils[methodName]=utilsMethods[methodName];
    }
});

client.prototype.getOptions = function getOptions() {
    return this.options;
};

module.exports = client;
