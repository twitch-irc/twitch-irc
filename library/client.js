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

var Data     = require('./data');
var Events   = require('events');
var Locally  = require('locallydb');
var Package  = require('./../package.json');
var Request  = require('request');
var Servers  = require('./servers');
var Socket   = require('./socket');
var Stream   = require('./modules/messages');
var String   = require('string');
var Util     = require('util');
var Utils    = require('./modules/utils');

var Database = null;
var DBPath   = './database';
var Latency  = new Date();
var Server   = 'irc.twitch.tv';
var Port     = 443;
var Channels = [];

var CommandError = '';
var ModsList     = [];
var Joined       = false;

/**
 * Represents a new client instance.
 *
 * @constructor
 * @param {object} options
 */
var client = function client(options) {
    var self = this;

    Events.EventEmitter.call(this);

    var Logger           = require('./modules/logger');
    this.logger          = new Logger(options);
    this.oauth           = require('./oauth')(this, options);
    this.options         = (typeof options != 'undefined') ? options : {};
    this.options.options = this.options.options || {};
    this.stream          = Stream().on('data', this._handleMessage.bind(this));
    this.socket          = null;
    this.moderators      = {};

    this.gracefulReconnection = false;

    this.logger.dev('Created a new client instance on pid ' + process.pid);
    this.logger.dev('Memory rss: ' + process.memoryUsage().rss);
    this.logger.dev('Memory heap total: ' + process.memoryUsage().heapTotal);
    this.logger.dev('Memory heap used : ' + process.memoryUsage().heapUsed);

    DBPath = (this.options.options && (typeof this.options.options.database != 'undefined')) ? this.options.options.database : './database';

    var checkUpdates = (this.options.options && (typeof this.options.options.checkUpdates !== 'undefined')) ? this.options.options.checkUpdates : true;

    if (checkUpdates) {
        Request('http://registry.npmjs.org/twitch-irc/latest', function (err, res, body) {
            if (!err && res.statusCode == 200) {
                if (Utils.versionCompare(JSON.parse(body).version, Package.version) >= 1) {
                    console.log('\x1b[36m?\x1b[97m new update available for twitch-irc: \x1b[32m' + JSON.parse(body).version + '\x1b[39m \x1b[90m(current: ' + Package.version + ')\x1b[39m');
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

Util.inherits(client, Events.EventEmitter);

/**
 * Remove items from array.
 *
 * @param deleteValue
 * @returns {Array}
 */
Array.prototype.clean = function(deleteValue) {
    this.map(function(value, index, array) {
        return value === deleteValue && array.splice(index, 1) && array;
    });
};

/**
 * Handle all IRC messages.
 * Documentation: https://github.com/Schmoopiie/twitch-irc/wiki/Events
 *
 * @fires client#ping
 * @fires client#pong
 * @fires client#connected
 * @fires client#join
 * @fires client#part
 * @fires client#disconnected
 * @fires client#jtv
 * @fires client#subscriber
 * @fires client#slowmode
 * @fires client#r9kbeta
 * @fires client#hosted
 * @fires client#mods
 * @fires client#limitation
 * @fires client#permission
 * @fires client#specialuser
 * @fires client#usercolor
 * @fires client#emoteset
 * @fires client#timeout
 * @fires client#clearchat
 * @fires client#roomban
 * @fires client#roomchanged
 * @fires client#roomdeleted
 * @fires client#roominvite
 * @fires client#unhost
 * @fires client#hosting
 * @fires client#twitchnotify
 * @fires client#subscription
 */
client.prototype._handleMessage = function _handleMessage(message) {
    var self = this;

    if (message.command.match(/^[0-9]+$/g)) { self.logger.raw(message.command + ': ' + message.params[1]); }

    var messageFrom = message.prefix;
    if (message.prefix.indexOf('@') >= 0) { messageFrom = message.parseHostmaskFromPrefix().nickname; }

    switch(message.command) {
        case 'PING':
            /**
             * Received PING from server.
             *
             * @event ping
             */
            self.logger.event('ping');
            self.emit('ping');
            self.socket.crlfWrite('PONG');
            break;

        case 'PONG':
            /**
             * Received PONG from server, return current latency.
             *
             * @event pong
             */
            self.logger.event('pong');
            self.emit('pong', (((new Date()-Latency)/1000)%60));
            break;

        case '372':
            /**
             * Received MOTD from server, it means that we are connected.
             *
             * @event connected
             */
            self.logger.event('connected');
            self.emit('connected', self.socket.remoteAddress, self.socket.remotePort);

            Server = self.socket.remoteAddress;
            Port   = self.socket.remotePort;

            self.socket.resetRetry();

            var options      = self.options.options || {};
            var twitchClient = options.tc || 3;

            self.socket.crlfWrite('TWITCHCLIENT ' + twitchClient);

            var timer    = 0;
            var channels = [];
            if (Channels.length >= 1 && Joined) { channels = Channels; }
            else { channels = self.options.channels || []; }

            channels.forEach(function(channel) {
                setTimeout(function(){self.join(channel);}, timer);
                timer = timer+3000;
            });
            break;

        case 'JOIN':
            /**
             * User has joined a channel.
             *
             * @event join
             * @params {string} channel
             * @params {string} username
             */
            self.logger.event('join');
            if (!self.moderators[message.params[0]]) { self.moderators[message.params[0]] = []; }

            if (Channels.indexOf(Utils.remHash(message.params[0]).toLowerCase()) < 0) {
                Channels.push(Utils.remHash(message.params[0]).toLowerCase());
                Channels.reduce(function(a,b){if(a.indexOf(b)<0)a.push(b);return a;},[]);
            }
            self.emit('join', message.params[0], message.parseHostmaskFromPrefix().nickname.toLowerCase());
            if (self.options.channels.length >= 1 && Utils.remHash(message.params[0]).toLowerCase() === Utils.remHash(self.options.channels[self.options.channels.length-1]).toLowerCase()) {
                Joined = true;
            }
            if (self.options.channels.length <= 0) {
                Joined = true;
            }
            this.logger.dev('Joined ' + message.params[0]);
            break;

        case 'PART':
            /**
             * User has left a channel.
             *
             * @event part
             * @params {string} channel
             * @params {string} username
             */
            self.logger.event('part');
            self.emit('part', message.params[0], message.parseHostmaskFromPrefix().nickname.toLowerCase());

            if (self.moderators[message.params[0]]) { self.moderators[message.params[0]] = []; }

            var index = Channels.indexOf(Utils.remHash(message.params[0]).toLowerCase());
            if (index !== -1) { Channels.splice(index, 1); }
            Channels.reduce(function(a,b){if(a.indexOf(b)<0)a.push(b);return a;},[]);
            this.logger.dev('Left ' + message.params[0]);
            break;

        case 'NOTICE':
            /**
             * Received a notice from the server.
             *
             * @event disconnected
             * @params {string} reason
             */
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
                    this.logger.dev('Mod ' + message.params[0] + ' ' + message.params[2]);
                } else {
                    var index = self.moderators[message.params[0]].indexOf(message.params[2].toLowerCase());
                    if (index >= 0) { self.moderators[message.params[0]].splice(index, 1); }
                    self.moderators[message.params[0]].reduce(function(a,b){if(a.indexOf(b)<0)a.push(b);return a;},[]);
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
            /**
             * Handling all messages from JTV.
             *
             * @event jtv
             * @params {string} message
             */
            if (messageFrom === 'jtv') {
                self.emit('jtv', message.params);

                var username = message.params[1] ? message.params[1].split(' ')[1] : message.params.push('');
                var value    = message.params[1] ? message.params[1].split(' ')[2] : message.params.push('');

                switch(true) {
                    case (message.params[1] === 'This room is now in subscribers-only mode.'):
                        /**
                         * Room is now in subscribers-only mode.
                         *
                         * @event subscriber
                         * @params {string} channel
                         * @params {boolean} status
                         */
                        self.logger.event('subscriber');
                        self.emit('subscriber', message.params[0], true);
                        break;

                    case (message.params[1] === 'This room is no longer in subscribers-only mode.'):
                        /**
                         * Room is now no longer in subscribers-only mode.
                         *
                         * @event subscriber
                         * @params {string} channel
                         * @params {boolean} status
                         */
                        self.logger.event('subscriber');
                        self.emit('subscriber', message.params[0], false);
                        break;

                    case (String(message.params[1]).contains('This room is now in slow mode.')):
                        /**
                         * Room is now in slow mode.
                         *
                         * @event slowmode
                         * @params {string} channel
                         * @params {boolean} status
                         * @params {string} length
                         */
                        var parts  = message.params[1].split(' ');
                        var length = parts[parts.length - 2];
                        self.logger.event('slowmode');
                        self.emit('slowmode', message.params[0], true, length);
                        break;

                    case (message.params[1] === 'This room is no longer in slow mode.'):
                        /**
                         * Room is no longer in slow mode.
                         *
                         * @event slowmode
                         * @params {string} channel
                         * @params {boolean} status
                         */
                        self.logger.event('slowmode');
                        self.emit('slowmode', message.params[0], false, -1);
                        break;

                    case (message.params[1] === 'This room is now in r9k mode. See http://bit.ly/bGtBDf'):
                        /**
                         * Room is in r9k mode.
                         *
                         * @event r9kbeta
                         * @params {string} channel
                         * @params {boolean} status
                         */
                        self.logger.event('r9kbeta');
                        self.emit('r9kbeta', message.params[0], true);
                        break;

                    case (message.params[1] === 'This room is no longer in r9k mode.'):
                        /**
                         * Room is no longer in r9k mode.
                         *
                         * @event r9kbeta
                         * @params {string} channel
                         * @params {boolean} status
                         */
                        self.logger.event('r9kbeta');
                        self.emit('r9kbeta', message.params[0], false);
                        break;

                    case (String(message.params[0]).contains('is now hosting you for')):
                        /**
                         * Room is now hosted by another user.
                         *
                         * @event hosted
                         * @params {string} channel
                         * @params {string} username
                         * @params {string} viewers count
                         */
                        var parts = message.params[0].split(' ');
                        self.logger.event('hosted');
                        self.emit('hosted', message.params[0], parts[0], parts[6]);
                        break;

                    case (String(message.params[1]).contains('The moderators of this room are:')):
                        /**
                         * Received mods list on a channel.
                         * The client needs to send the /mods command to a channel to receive this message.
                         *
                         * @event mods
                         * @params {string} channel
                         * @params {array} mods
                         */
                        var parts = message.params[1].split(':');
                        var mods  = parts[1].replace(/,/g, '').split(':').toString().toLowerCase().split(' ');
                        mods.clean('');
                        ModsList = mods;
                        setTimeout(function() { ModsList = []; }, 300);
                        self.logger.event('mods');
                        self.emit('mods', message.params[0], mods);
                        break;

                    case (
                        String(message.params[1]).contains('You don\'t have permission') ||
                        String(message.params[1]).contains('Only the owner of this channel can use') ||
                        String(message.params[1]).contains('Only the channel owner and channel editors can') ||
                        String(message.params[1]).contains('Your message was not sent') ||
                        String(message.params[1]).contains('Invalid username:') ||
                        String(message.params[1]).contains('Upgrade to turbo or use one of these colors') ||
                        String(message.params[1]).contains('is not a moderator. Use the \'mods\' command to find a list of mode') ||
                        message.params[1] === 'Host target cannot be changed more than three times per 30 minutes.' ||
                        message.params[1] === 'UNAUTHORIZED JOIN' ||
                        message.params[1] === 'You need to tell me who you want to grant mod status to.') ||
                        message.params[1] === 'Failed to start commercial.' ||
                        message.params[1] === 'You cannot timeout the broadcaster.':

                        this.logger.dev('ERROR: ' + message.params[1]);
                        CommandError = message.params[1];
                        setTimeout(function() { CommandError = ''; }, 300);
                        break;

                    case (
                        String(message.params[1]).contains('You have un-modded') ||
                        String(message.params[1]).contains('You have banned') ||
                        String(message.params[1]).contains('Now hosting') ||
                        String(message.params[1]).contains('/host commands remaining this half hour') ||
                        String(message.params[1]).contains('You have unbanned')) ||
                        (String(message.params[1]).contains('You have added') && String(message.params[1]).contains('as a moderator.')) ||
                        message.params[1] === 'Your color has been changed' ||
                        message.params[1] === 'Exited host mode.':

                        this.logger.dev('SUCCESS: ' + message.params[1]);
                        CommandError = '';
                        break;

                    case (message.params[1].split(' ')[0] === 'SPECIALUSER'):
                        /**
                         * SPECIALUSER message by JTV.
                         *
                         * @event specialuser
                         * @params {string} username
                         * @params {string} value
                         */
                        self.emit('specialuser', username, value);
                        Data.createTempUserData(username);
                        Data.tempUserData[username].special.push(value);
                        break;

                    case (message.params[1].split(' ')[0] === 'USERCOLOR'):
                        /**
                         * USERCOLOR message by JTV.
                         *
                         * @event usercolor
                         * @params {string} username
                         * @params {string} value
                         */
                        self.emit('usercolor', username, value);
                        Data.createTempUserData(username);
                        Data.tempUserData[username].color = value;
                        break;

                    case (message.params[1].split(' ')[0] === 'EMOTESET'):
                        /**
                         * EMOTESET message by JTV.
                         *
                         * @event emoteset
                         * @params {string} username
                         * @params {string} value
                         */
                        self.emit('emoteset', username, value);
                        Data.createTempUserData(username);
                        Data.tempUserData[username].emote = value;
                        break;

                    case (message.params[1].split(' ')[0] === 'CLEARCHAT'):
                        /**
                         * CLEARCHAT message by JTV.
                         *
                         * @event clearchat
                         * @params {string} channel
                         *
                         * @event timeout
                         * @params {string} channel
                         * @params {string} username
                         */
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
                        /**
                         * ROOMBAN message by JTV.
                         *
                         * @event roomban
                         * @params {string} room
                         * @params {string} username
                         */
                        self.emit('roomban', message.params[0], username);
                        break;

                    case (message.params[1].split(' ')[0] === 'ROOMCHANGED'):
                        /**
                         * ROOMCHANGED message by JTV.
                         *
                         * @event roomchanged
                         * @params {string} channel
                         */
                        self.emit('roomchanged', message.params[0]);
                        break;

                    case (message.params[1].split(' ')[0] === 'ROOMDELETED'):
                        /**
                         * ROOMDELETED message by JTV.
                         *
                         * @event roomdeleted
                         * @params {string} room
                         */
                        self.emit('roomdeleted', message.params[0]);
                        break;

                    case (message.params[1].split(' ')[0] === 'ROOMINVITE'):
                        /**
                         * ROOMINVITE message by JTV.
                         *
                         * @event roominvite
                         * @params {string} room
                         * @params {string} by username
                         */
                        self.emit('roominvite', message.params[0], username);
                        break;

                    case (message.params[1].split(' ')[0] === 'HISTORYEND'):
                        break;

                    case (message.params[1].split(' ')[0] === 'HOSTTARGET'):
                        /**
                         * HOSTTARGET message by JTV.
                         *
                         * @event unhost
                         * @params {string} channel
                         * @params {string} remains
                         *
                         * @event hosting
                         * @params {string} channel
                         * @params {string} target
                         * @params {string} remains
                         */
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
                        console.log(message.params[1]);
                        break;
                }
            }

            /**
             * Received a message from TwitchNotify.
             *
             * @event twitchnotify
             * @params {string} channel
             * @params {string} message
             */
            else if (messageFrom === 'twitchnotify') {
                self.emit('twitchnotify', message.params[0], message.params[1]);

                switch(true) {
                    case (String(message.params[1]).contains('just subscribed!')):
                        /**
                         * Someone has subscribed to a channel.
                         *
                         * @event subscription
                         * @params {string} channel
                         * @params {string} username
                         */
                        self.logger.event('subscription');
                        self.emit('subscription', message.params[0], message.params[1].split(' ')[0]);
                        break;
                    default:
                        self.logger.dev('Unhandled message from TwitchNotify:');
                        self.logger.dev(message.params[1]);
                        break;
                }
            }

            /**
             * Someone has sent a message on a channel.
             *
             * @event action
             * @params {string} channel
             * @params {object} user
             * @params {string} message
             *
             * @event chat
             * @params {string} channel
             * @params {object} user
             * @params {string} message
             */
            else {
                var username = message.parseHostmaskFromPrefix().nickname.toLowerCase();

                Data.createTempUserData(username);
                if (self.moderators[message.params[0]].indexOf(username.toLowerCase()) >= 0 && Utils.remHash(message.params[0]).toLowerCase() !== username) {
                    Data.tempUserData[username].special.push('mod');
                }
                if (Utils.remHash(message.params[0]).toLowerCase() === username) {
                    Data.tempUserData[username].special.push('broadcaster');
                }
                Data.createChannelUserData(message.params[0], username, function(done) {
                    if (String(message.params[1]).startsWith('\u0001ACTION')) {
                        self.emit('action', message.params[0], Data.channelUserData[message.params[0]][username], String(message.params[1]).between('\u0001ACTION ', '\u0001').s);
                        self.logger.event('action');
                        self.logger.chat('[' + message.params[0] + '] ' + username + ': ' + String(message.params[1]).between('\u0001ACTION ', '\u0001').s);
                    } else if (String(message.params[1]).startsWith(' \x01ACTION')) {
                        self.emit('action', message.params[0], Data.channelUserData[message.params[0]][username], String(message.params[1]).between(' \x01ACTION ', '\x01').s);
                        self.logger.event('action');
                        self.logger.chat('[' + message.params[0] + '] ' + username + ': ' + String(message.params[1]).between(' \x01ACTION ', '\x01').s);
                    } else {
                        self.emit('chat', message.params[0], Data.channelUserData[message.params[0]][username], message.params[1]);
                        self.logger.event('chat');
                        self.logger.chat('[' + message.params[0] + '] ' + username + ': ' + message.params[1]);
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
    if (message.prefix.indexOf('@') >= 0) { messageFrom = message.parseHostmaskFromPrefix().nickname; }

    switch(message.command) {
        case 'PING':
            self.socket.crlfWrite('PONG');
            break;

        case 'PONG':
            self.emit('pong', (((new Date()-Latency)/1000)%60));
            break;

        case '372':
            Server = self.socket.remoteAddress;
            Port   = self.socket.remotePort;
            self.socket.resetRetry();

            var options      = self.options.options || {};
            var twitchClient = options.tc || 3;
            self.socket.crlfWrite('TWITCHCLIENT ' + twitchClient);

            var timer = 0;
            Channels.forEach(function(channel) {
                setTimeout(function(){self.join(channel);}, timer);
                timer = timer+3000;
            });
            break;

        case 'JOIN':
            self.emit('join', message.params[0], message.parseHostmaskFromPrefix().nickname.toLowerCase());
            break;

        case 'PART':
            self.emit('part', message.params[0], message.parseHostmaskFromPrefix().nickname.toLowerCase());
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

/**
 * Connect to the server.
 *
 * @params callback
 * @fires connect#logon
 */
client.prototype.connect = function connect() {
    var self = this;

    var connection = self.options.connection || {};

    var preferredServer = connection.preferredServer || null;
    var preferredPort   = connection.preferredPort || null;
    var serverType      = connection.serverType || 'chat';

    Servers.getServer(serverType, preferredServer, preferredPort, self.logger, function(server){
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
        self.socket = Socket(self, self.options, self.logger, server.split(':')[1], server.split(':')[0], authenticate);

        self.socket.pipe(self.stream);
    });
};

/**
 * Gracefully reconnect to the server.
 */
client.prototype.fastReconnect = function fastReconnect() {
    var self = this;

    self.logger.info('Received RECONNECT request from Twitch.');

    self.gracefulReconnection = true;

    var connection = self.options.connection || {};
    var serverType = connection.serverType || 'chat';

    Servers.getServer(serverType, Server, Port, self.logger, function(server) {
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
        self.socket = new Socket(self, self.options, self.logger, server.split(':')[1], server.split(':')[0], authenticate);
        self.socket.pipe(Stream().on('data', self._fastReconnectMessage.bind(self)));
    });
};

/**
 * Disconnect from server.
 */
client.prototype.disconnect = function disconnect() {
    this.socket.forceDisconnect(false);
};

/**
 * Check if username is moderator on channel.
 *
 * @param channel
 * @param username
 * @returns {boolean}
 */
client.prototype.isMod = function isMod(channel, username) {
    if (this.moderators[Utils.addHash(channel)].indexOf(username.toLowerCase()) >= 0) {
        return true;
    }
    return false;
};

client.prototype.clearChannels = function clearChannels() { Channels = []; };

/**
 * Join a channel.
 *
 * @params {string} channel
 */
client.prototype.join = function join(channel) {
    this.socket.crlfWrite('JOIN ' + Utils.addHash(channel).toLowerCase());
};

/**
 * Leave a channel.
 *
 * @params {string} channel
 */
client.prototype.part = function part(channel) {
    this.socket.crlfWrite('PART ' + Utils.addHash(channel).toLowerCase());
};

/**
 * Send a PING to the server.
 */
client.prototype.ping = function ping() {
    this.socket.crlfWrite('PING');
    Latency = new Date();
};

/**
 * Say something on a channel.
 *
 * @params {string} channel
 * @params {string} message
 */
client.prototype.say = function say(channel, message, cb) {
    this.socket.crlfWrite('PRIVMSG ' + Utils.addHash(channel).toLowerCase() + ' :' + message);
    if (typeof cb === 'function') { setTimeout(function() { CommandError !== '' && cb(CommandError) && cb(null); }, 250); }
};

/**
 * Say something on a channel (action).
 *
 * @params {string} channel
 * @params {string} message
 */
client.prototype.action = function action(channel, message, cb) {
    this.socket.crlfWrite('PRIVMSG ' + Utils.addHash(channel).toLowerCase() + ' : \x01ACTION ' + message + '\x01');
    if (typeof cb === 'function') { setTimeout(function() { CommandError !== '' && cb(CommandError) && cb(null); }, 250); }
};

/**
 * Change the color of the bot's username.
 *
 * @params {string} channel
 * @params {string} color
 */
client.prototype.color = function color(channel, color, cb) {
    this.socket.crlfWrite('PRIVMSG ' + Utils.addHash(channel).toLowerCase() + ' :.color ' + color);
    if (typeof cb === 'function') { setTimeout(function() { CommandError !== '' && cb(CommandError) && cb(null); }, 250); }
};

/**
 * Host a channel.
 *
 * @params {string} channel
 * @params {string} target
 */
client.prototype.host = function host(channel, target, cb) {
    this.socket.crlfWrite('PRIVMSG ' + Utils.addHash(channel).toLowerCase() + ' :.host ' + target);
    if (typeof cb === 'function') { setTimeout(function() { CommandError !== '' && cb(CommandError) && cb(null); }, 250); }
};

/**
 * End the current hosting.
 *
 * @params {string} channel
 */
client.prototype.unhost = function unhost(channel, cb) {
    this.socket.crlfWrite('PRIVMSG ' + Utils.addHash(channel).toLowerCase() + ' :.unhost');
    if (typeof cb === 'function') { setTimeout(function() { CommandError !== '' && cb(CommandError) && cb(null); }, 250); }
};

/**
 * Timeout user on a channel for X seconds.
 *
 * @params {string} channel
 * @params {string} username
 * @params {integer} seconds
 */
client.prototype.timeout = function timeout(channel, username, seconds, cb) {
    seconds = typeof seconds !== 'undefined' ? seconds : 300;
    this.socket.crlfWrite('PRIVMSG ' + Utils.addHash(channel).toLowerCase() + ' :.timeout ' + username + ' ' + seconds);
    if (typeof cb === 'function') { setTimeout(function() { CommandError !== '' && cb(CommandError) && cb(null); }, 250); }
};

/**
 * Ban user on a channel.
 *
 * @params {string} channel
 * @params {string} username
 */
client.prototype.ban = function ban(channel, username, cb) {
    this.socket.crlfWrite('PRIVMSG ' + Utils.addHash(channel).toLowerCase() + ' :.ban ' + username);
    if (typeof cb === 'function') { setTimeout(function() { CommandError !== '' && cb(CommandError) && cb(null); }, 250); }
};

/**
 * Unban user on a channel.
 *
 * @params {string} channel
 * @params {string} username
 */
client.prototype.unban = function unban(channel, username, cb) {
    this.socket.crlfWrite('PRIVMSG ' + Utils.addHash(channel).toLowerCase() + ' :.unban ' + username);
    if (typeof cb === 'function') { setTimeout(function() { CommandError !== '' && cb(CommandError) && cb(null); }, 250); }
};

/**
 * Enable slow mode on a channel.
 *
 * @params {string} channel
 * @params {integer} seconds
 */
client.prototype.slow = function slow(channel, seconds, cb) {
    seconds = typeof seconds !== 'undefined' ? seconds : 300;
    this.socket.crlfWrite('PRIVMSG ' + Utils.addHash(channel).toLowerCase() + ' :.slow ' + seconds);
    if (typeof cb === 'function') { setTimeout(function() { CommandError !== '' && cb(CommandError) && cb(null); }, 250); }
};

/**
 * Disable slow mode on a channel.
 *
 * @params {string} channel
 */
client.prototype.slowoff = function slowoff(channel, cb) {
    this.socket.crlfWrite('PRIVMSG ' + Utils.addHash(channel).toLowerCase() + ' :.slowoff');
    if (typeof cb === 'function') { setTimeout(function() { CommandError !== '' && cb(CommandError) && cb(null); }, 250); }
};

/**
 * Enable subscriber-only on a channel.
 *
 * @params {string} channel
 */
client.prototype.subscribers = function subscriberString(channel, cb) {
    this.socket.crlfWrite('PRIVMSG ' + Utils.addHash(channel).toLowerCase() + ' :.subscribers');
    if (typeof cb === 'function') { setTimeout(function() { CommandError !== '' && cb(CommandError) && cb(null); }, 250); }
};

/**
 * Disable subscriber-only on a channel.
 *
 * @params {string} channel
 */
client.prototype.subscribersoff = function subscribersoff(channel, cb) {
    this.socket.crlfWrite('PRIVMSG ' + Utils.addHash(channel).toLowerCase() + ' :.subscribersoff');
    if (typeof cb === 'function') { setTimeout(function() { CommandError !== '' && cb(CommandError) && cb(null); }, 250); }
};

/**
 * Clear all messages on a channel.
 *
 * @params {string} channel
 */
client.prototype.clear = function clear(channel, cb) {
    this.socket.crlfWrite('PRIVMSG ' + Utils.addHash(channel).toLowerCase() + ' :.clear');
    if (typeof cb === 'function') { setTimeout(function() { CommandError !== '' && cb(CommandError) && cb(null); }, 250); }
};

/**
 * Enable R9KBeta on a channel.
 *
 * @params {string} channel
 */
client.prototype.r9kbeta = function r9kbeta(channel, cb) {
    this.socket.crlfWrite('PRIVMSG ' + Utils.addHash(channel).toLowerCase() + ' :.r9kbeta');
    if (typeof cb === 'function') { setTimeout(function() { CommandError !== '' && cb(CommandError) && cb(null); }, 250); }
};

/**
 * Disable R9KBeta on a channel.
 *
 * @params {string} channel
 */
client.prototype.r9kbetaoff = function r9kbetaoff(channel, cb) {
    this.socket.crlfWrite('PRIVMSG ' + Utils.addHash(channel).toLowerCase() + ' :.r9kbetaoff');
    if (typeof cb === 'function') { setTimeout(function() { CommandError !== '' && cb(CommandError) && cb(null); }, 250); }
};

/**
 * Mod user on a channel.
 *
 * @params {string} channel
 * @params {string} username
 */
client.prototype.mod = function mod(channel, username, cb) {
    this.socket.crlfWrite('PRIVMSG ' + Utils.addHash(channel).toLowerCase() + ' :.mod ' + username);
    if (typeof cb === 'function') { setTimeout(function() { CommandError !== '' && cb(CommandError) && cb(null); }, 250); }
};

/**
 * Unmod user on a channel.
 *
 * @params {string} channel
 * @params {string} username
 */
client.prototype.unmod = function mod(channel, username, cb) {
    this.socket.crlfWrite('PRIVMSG ' + Utils.addHash(channel).toLowerCase() + ' :.unmod ' + username);
    if (typeof cb === 'function') { setTimeout(function() { CommandError !== '' && cb(CommandError) && cb(null); }, 250); }
};

/**
 * Run commercial on a channel for X seconds.
 *
 * @params {string} channel
 * @params {integer} seconds
 */
client.prototype.commercial = function commercial(channel, seconds, cb) {
    seconds = typeof seconds !== 'undefined' ? seconds : 30;
    var availableLengths = [30, 60, 90, 120, 150, 180];
    if (availableLengths.indexOf(seconds) === -1) { seconds = 30; }
    this.socket.crlfWrite('PRIVMSG ' + Utils.addHash(channel).toLowerCase() + ' :.commercial ' + seconds);
    if (typeof cb === 'function') { setTimeout(function() { CommandError !== '' && cb(CommandError) && cb(null); }, 250); }
};

/**
 * Get all the mods on a channel.
 * Use the 'mods' event to get the list of mods.
 *
 * @params {string} channel
 */
client.prototype.mods = function mods(channel, cb) {
    this.socket.crlfWrite('PRIVMSG ' + Utils.addHash(channel).toLowerCase() + ' :.mods');
    if (typeof cb === 'function') { setTimeout(function() { ModsList.length !== 0 && cb(ModsList) && cb([]); }, 250); }
};

/**
 * Send a RAW message.
 *
 * @params {string} channel
 * @params {string} message
 */
client.prototype.raw = function raw(message) {
    this.socket.crlfWrite(message);
};

/**
 * Loading the database methods..
 *
 * @type {exports}
 */
var databaseMethods = require('./database');
for(var methodName in databaseMethods) {
    client.prototype[methodName]=databaseMethods[methodName];
}

/**
 * Loading the APIs..
 *
 * @type {"fs"}
 */
var fs = require("fs");
client.prototype.api = {};
fs.readdirSync(__dirname + '/api').forEach(function(file) {
    var apiMethods = require(__dirname + '/api/' + file);
    for(var methodName in apiMethods) {
        client.prototype.api[methodName]=apiMethods[methodName];
    }
});

/**
 * Loading all utils..
 * @type {{}}
 */
client.prototype.utils = {};
fs.readdirSync(__dirname + '/utils').forEach(function(file) {
    var utilsMethods = require(__dirname + '/utils/' + file);
    for(var methodName in utilsMethods) {
        client.prototype.utils[methodName]=utilsMethods[methodName];
    }
});

exports.getDatabase = function() {
    if (Database === null) {
        Database = new Locally(DBPath);
    }
    return Database;
};

module.exports = client;