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

var Chalk    = require('chalk');
var Cron     = require('cron').CronJob;
var Data     = require('./data');
var Events   = require('events');
var Latency  = new Date();
var Locally  = require('locallydb');
var Package  = require('./../package.json');
var Promise  = require("promise");
var Q        = require('q');
var Request  = require('request');
var Servers  = require('./servers');
var Socket   = require('./socket');
var Stream   = require('irc-message-stream');
var String   = require('string');
var Util     = require('util');

var Database = null;
var DBPath   = './database';
var Server = 'irc.twitch.tv';
var Port = 443;
var Channels = [];

/**
 * Represents a new IRC client.
 *
 * @constructor
 * @param {object} options
 */
var client = function client(options) {
    var self = this;

    Events.EventEmitter.call(this);

    this.logger = require('./logger')(options);
    this.oauth = require('./oauth')(options);
    this.options = (typeof options != 'undefined') ? options : {};
    this.debugIgnore = this.options.debugIgnore || [];
    this.stream = Stream().on('data', this._handleMessage.bind(this));
    this.socket = null;
    this.fastReconnectPhase = false;

    DBPath = (this.options.options && (typeof this.options.options.database != 'undefined')) ? this.options.options.database : './database';

    var checkUpdates = (this.options.options && (typeof this.options.options.checkUpdates !== 'undefined')) ? this.options.options.checkUpdates : true;

    if (checkUpdates) {
        Request('http://registry.npmjs.org/twitch-irc/latest', function (err, res, body) {
            if (!err && res.statusCode == 200) {
                if (JSON.parse(body).version > Package.version) {
                    console.log(Chalk.yellow('?')+' Update available for twitch-irc: ' + Chalk.green.bold(JSON.parse(body).version) + Chalk.dim(' (current: ' + Package.version + ')'));
                    console.log(Chalk.yellow('?')+' Run ' + Chalk.yellow.bold('npm install twitch-irc') +' to update. ');
                }
            }
        });
    }

    process.on('uncaughtException', function (err) {
        self.logger.crash(err.stack);
        self.emit('crash', err.message, err.stack);
    });
};

// Inherit client from EventEmitter.
Util.inherits(client, Events.EventEmitter);

// Clean an array.
Array.prototype.clean = function(deleteValue) {
    for (var i = 0; i < this.length; i++) {
        if (this[i] == deleteValue) {
            this.splice(i, 1);
            i--;
        }
    }
    return this;
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

    // Logging RAW messages.
    if (message.command.match(/^[0-9]+$/g)) { self.logger.raw('%s: %s', message.command, message.params[1]); }

    var messageFrom = message.prefix;
    if (message.prefix.indexOf('@') >= 0) { messageFrom = message.parseHostmaskFromPrefix().nickname; }
    //console.log(message);
    switch(message.command) {
        case 'PING':
            /**
             * Received PING from server.
             *
             * @event ping
             */
            if (self.debugIgnore.indexOf('ping') === -1) { self.logger.event('ping'); }
            self.emit('ping');
            self.socket.crlfWrite('PONG');
            break;

        case 'PONG':
            /**
             * Received PONG from server, return current latency.
             *
             * @event pong
             */
            if (self.debugIgnore.indexOf('pong') === -1) { self.logger.event('pong'); }
            self.emit('pong', (((new Date()-Latency)/1000)%60));
            break;

        case '372':
            /**
             * Received MOTD from server, it means that we are connected.
             *
             * @event connected
             */
            if (self.debugIgnore.indexOf('connected') === -1) { self.logger.event('connected'); }
            self.emit('connected', self.socket.remoteAddress, self.socket.remotePort);
            Server = self.socket.remoteAddress;
            Port = self.socket.remotePort;
            self.socket.resetRetry();

            var options = self.options.options || {};
            var twitchClient = options.tc || 3;
            self.socket.crlfWrite('TWITCHCLIENT '+twitchClient);

            var timer = 0;
            var channels = self.options.channels || [];
            channels.forEach(function(channel) {
                setTimeout(function(){self.join(channel);}, timer);
                timer = timer+3000;
            });
            break;

        case 'JOIN':
            /**
             * User has joined a channel.
             * Depending on the TWITCHCLIENT setting, it can return only the bot or any user joining.
             *
             * See FAQ: https://github.com/Schmoopiie/generator-twitch-irc/wiki/FAQ
             *
             * @event join
             * @params {string} channel
             * @params {string} username
             */
            if (self.debugIgnore.indexOf('join') === -1) { self.logger.event('join'); }
            Channels.push(message.params[0].replace('#', '').toLowerCase());
            Channels.reduce(function(a,b){if(a.indexOf(b)<0)a.push(b);return a;},[]);
            self.emit('join', message.params[0], message.parseHostmaskFromPrefix().nickname.toLowerCase());
            break;

        case 'PART':
            /**
             * User has left a channel.
             * Depending on the TWITCHCLIENT setting, it can return only the bot or any user leaving.
             *
             * See FAQ: https://github.com/Schmoopiie/generator-twitch-irc/wiki/FAQ
             *
             * @event part
             * @params {string} channel
             * @params {string} username
             */
            if (self.debugIgnore.indexOf('part') === -1) { self.logger.event('part'); }
            self.emit('part', message.params[0], message.parseHostmaskFromPrefix().nickname.toLowerCase());
            var index = Channels.indexOf(message.params[0].replace('#', '').toLowerCase());
            if (index !== -1) {
                Channels.splice(index, 1);
            }
            Channels.reduce(function(a,b){if(a.indexOf(b)<0)a.push(b);return a;},[]);
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
                    if (self.debugIgnore.indexOf('disconnected') === -1) { self.logger.event('disconnected'); }
                    self.emit('disconnected', message.params[1]);
                }
            }
            break;

        // Received message.
        case 'PRIVMSG':
            /**
             * Received a message from JTV.
             * JTV sends a lot of messages, this is the goal of this library.. make it simple.
             *
             * @event jtv
             * @params {string} message
             */
            if (messageFrom === 'jtv') {
                self.emit('jtv', message.params);

                var username = message.params[1] ? message.params[1].split(' ')[1] : message.params.push('');
                var value = message.params[1] ? message.params[1].split(' ')[2] : message.params.push('');

                switch(true) {
                    case (message.params[1] === 'This room is now in subscribers-only mode.'):
                        /**
                         * Room is now in subscribers-only mode.
                         *
                         * @event subscriber
                         * @params {string} channel
                         * @params {boolean} status
                         */
                        if (self.debugIgnore.indexOf('subscriber') === -1) { self.logger.event('subscriber'); }
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
                        if (self.debugIgnore.indexOf('subscriber') === -1) { self.logger.event('subscriber'); }
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
                        var parts = message.params[1].split(' ');
                        var length = parts[parts.length - 2];
                        if (self.debugIgnore.indexOf('slowmode') === -1) { self.logger.event('slowmode'); }
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
                        if (self.debugIgnore.indexOf('slowmode') === -1) { self.logger.event('slowmode'); }
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
                        if (self.debugIgnore.indexOf('r9kbeta') === -1) { self.logger.event('r9kbeta'); }
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
                        if (self.debugIgnore.indexOf('r9kbeta') === -1) { self.logger.event('r9kbeta'); }
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
                        if (self.debugIgnore.indexOf('hosted') === -1) { self.logger.event('hosted'); }
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
                        var mods = parts[1].replace(/,/g, '').split(':').toString().toLowerCase().split(' ');
                        mods.clean('');
                        if (self.debugIgnore.indexOf('mods') === -1) { self.logger.event('mods'); }
                        self.emit('mods', message.params[0], mods);
                        break;

                    case (message.params[1] === 'Host target cannot be changed more than three times per 30 minutes.') ||
                    message.params[1] === 'UNAUTHORIZED JOIN':
                        /**
                         * Limitation by Twitch.
                         * The only limitation at this time is a limit of hosting. You can only host 3 channels in 30 minutes.
                         *
                         * @event limitation
                         * @params {object} err
                         */
                        if (self.debugIgnore.indexOf('limitation') === -1) { self.logger.event('limitation'); }
                        var code;
                        if (message.params[1] === 'Host target cannot be changed more than three times per 30 minutes.') { code = 'CANNOT_HOST'; }
                        else if (message.params[1] === 'UNAUTHORIZED JOIN') { code = 'CANNOT_HOST'; }
                        self.emit('limitation', {message: message.params[1], code: code});
                        break;

                    case (message.params[1] === 'You don\'t have permission to do this.' || String(message.params[1]).contains('Only the owner of this channel can use')) ||
                    message.params[1] === 'You don\'t have permission to timeout people in this room.':
                        /**
                         * Permission error by Twitch.
                         * You will receive a permission error message when you have insufficient access.
                         *
                         * @event permission
                         * @params {object} err
                         */
                        if (self.debugIgnore.indexOf('permission') === -1) { self.logger.event('permission'); }
                        var code;
                        if (message.params[1] === 'You don\'t have permission to do this.') { code = 'NO_PERMISSION'; }
                        else if (String(message.params[1]).contains('Only the owner of this channel can use')) { code = 'OWNER_ONLY'; }
                        else if (message.params[1] === 'You don\'t have permission to timeout people in this room.') { code = 'NO_PERMISSION'; }
                        self.emit('permission', {message: message.params[1], code: code});
                        break;

                    case (message.params[1].split(' ')[0] === 'SPECIALUSER'):
                        /**
                         * SPECIALUSER message by JTV.
                         * This message contains the status of a user on a channel.
                         * e.g: turbo, staff, moderator, admin
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
                         * This message contains the color of a user on a channel.
                         * e.g: #ffffff
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
                         * This message contains the emotes of a user on a channel.
                         * e.g: [23,568,4458]
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
                         * CLEARCHAT is used when a chat is cleared and when a user gets timed out.
                         *
                         * @event clearchat
                         * @params {string} channel
                         *
                         * @event timeout
                         * @params {string} channel
                         * @params {string} username
                         */
                        if (username) {
                            if (self.debugIgnore.indexOf('timeout') === -1) { self.logger.event('timeout'); }
                            self.emit('timeout', message.params[0], username);
                        }
                        else {
                            if (self.debugIgnore.indexOf('clearchat') === -1) { self.logger.event('clearchat'); }
                            self.emit('clearchat', message.params[0]);
                        }
                        break;

                    case (message.params[1].split(' ')[0] === 'ROOMBAN'):
                        /**
                         * ROOMBAN message by JTV.
                         * There is no documentation about this from Twitch.
                         * Will try to figure this out later.
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
                         * There is no documentation about this from Twitch.
                         * Will try to figure this out later.
                         *
                         * @event roomchanged
                         * @params {string} channel
                         */
                        self.emit('roomchanged', message.params[0]);
                        break;

                    case (message.params[1].split(' ')[0] === 'ROOMDELETED'):
                        /**
                         * ROOMDELETED message by JTV.
                         * There is no documentation about this from Twitch.
                         * Will try to figure this out later.
                         *
                         * @event roomdeleted
                         * @params {string} room
                         */
                        self.emit('roomdeleted', message.params[0]);
                        break;

                    case (message.params[1].split(' ')[0] === 'ROOMINVITE'):
                        /**
                         * ROOMINVITE message by JTV.
                         * There is no documentation about this from Twitch.
                         * Will try to figure this out later.
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
                         * HOSTTARGET is used when a channel starts and ends a hosting.
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
                            if (self.debugIgnore.indexOf('unhost') === -1) { self.logger.event('unhost'); }
                            self.emit('unhost', message.params[0], message.params[1].split(' ')[2]);
                        } else {
                            if (self.debugIgnore.indexOf('hosting') === -1) { self.logger.event('hosting'); }
                            self.emit('hosting', message.params[0], message.params[1].split(' ')[1], message.params[1].split(' ')[2]);
                        }
                        break;

                    default:
                        //console.log('Unhandled message from JTV: '+message.params[1]);
                        break;
                }
            }

            /**
             * Received a message from TwitchNotify.
             * For now, TwitchNotify is only used to send subscription messages.
             *
             * @event twitchnotify
             * @params {string} channel
             * @params {string} message
             */
            else if (messageFrom === 'twitchnotify') {
                self.emit('twitchnotify', message.params[0], message.params[1]);

                switch(true) {
                    case (String(message.params[1]).containString('just subscribed!')):
                        /**
                         * Someone has subscribed to a channel.
                         *
                         * @event subscription
                         * @params {string} channel
                         * @params {string} username
                         */
                        if (self.debugIgnore.indexOf('subscription') === -1) { self.logger.event('subscription'); }
                        self.emit('subscription', message.params[0], message.params[1].split(' ')[0]);
                        break;
                    default:
                        //console.log('Unhandled message from TwitchNotify: '+message.params[1]);
                        break;
                }
            }

            /**
             * Someone has sent a message on a channel.
             * There are two kinds of messages, regular messages and action messages. (/me <message>)
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
                Data.createChannelUserData(message.params[0], username, function(done) {
                    if (String(message.params[1]).startsWith('\u0001ACTION')) {
                        self.emit('action', message.params[0], Data.channelUserData[message.params[0]][username], String(message.params[1]).between('\u0001ACTION ', '\u0001'));
                    } else {
                        self.emit('chat', message.params[0], Data.channelUserData[message.params[0]][username], message.params[1]);
                    }
                });
            }
            break;
    }
};

client.prototype._fastReconnectMessage = function _fastReconnectMessage(message) {
    var self = this;

    // Logging RAW messages.
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
            Port = self.socket.remotePort;
            self.socket.resetRetry();

            var options = self.options.options || {};
            var twitchClient = options.tc || 3;
            self.socket.crlfWrite('TWITCHCLIENT '+twitchClient);

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
    var preferredPort = connection.preferredPort || null;
    var serverType = connection.serverType || 'chat';
    var host = Servers.getServer(serverType, preferredServer, preferredPort);

    var authenticate = function authenticate() {
        var identity = self.options.identity || {};
        var nickname = identity.username || 'justinfan'+Math.floor((Math.random() * 80000) + 1000);
        var password = identity.password || 'SCHMOOPIIE';

        if (self.debugIgnore.indexOf('logon') === -1) { self.logger.event('logon'); }
        self.emit('logon');

        self.socket.crlfWrite('PASS '+password);
        self.socket.crlfWrite('NICK %s', nickname);
        self.socket.crlfWrite('USER %s 8 * :%s', nickname, nickname);
    };
    self.socket = Socket(self, self.options, self.logger, host.split(':')[1], host.split(':')[0], authenticate);

    self.socket.pipe(self.stream);
};

client.prototype.fastReconnect = function fastReconnect() {
    var self = this;

    self.logger.event('gracefully reconnecting to twitch..');

    self.fastReconnectPhase = true;

    var connection = self.options.connection || {};

    var serverType = connection.serverType || 'chat';
    var host = Servers.getServer(serverType, Server, Port);

    var authenticate = function authenticate() {
        var identity = self.options.identity || {};
        var nickname = identity.username || 'justinfan'+Math.floor((Math.random() * 80000) + 1000);
        var password = identity.password || 'SCHMOOPIIE';

        if (self.debugIgnore.indexOf('logon') === -1) { self.logger.event('logon'); }
        self.emit('logon');

        self.socket.crlfWrite('PASS '+password);
        self.socket.crlfWrite('NICK %s', nickname);
        self.socket.crlfWrite('USER %s 8 * :%s', nickname, nickname);
    };
    var oldSocket = self.socket;
    setTimeout(function(){
        oldSocket.forceDisconnect();
        self.logger.event('old connection to twitch dropped.');
        self.fastReconnectPhase = false;
        self.socket.pipe(self.stream);
    },25000);
    self.socket = new Socket(self, self.options, self.logger, host.split(':')[1], host.split(':')[0], authenticate);
    self.socket.pipe(Stream().on('data', self._fastReconnectMessage.bind(self)));
};

client.prototype.disconnect = function disconnect() {
    this.socket.forceDisconnect();
};

/**
 * Join a channel.
 *
 * @params {string} channel
 */
client.prototype.join = function join(channel) {
    if (!String(channel).startsWith('#')) { channel = '#'+channel; }
    this.socket.crlfWrite('JOIN '+channel.toLowerCase());
};

/**
 * Leave a channel.
 *
 * @params {string} channel
 */
client.prototype.part = function part(channel) {
    if (!String(channel).startsWith('#')) { channel = '#'+channel; }
    this.socket.crlfWrite('PART '+channel.toLowerCase());
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
client.prototype.say = function say(channel, message) {
    if (!String(channel).startsWith('#')) { channel = '#'+channel; }
    this.socket.crlfWrite('PRIVMSG '+channel.toLowerCase()+ ' :'+message);
};

/**
 * Host a channel.
 *
 * @params {string} channel
 * @params {string} target
 */
client.prototype.host = function host(channel, target) {
    if (!String(channel).startsWith('#')) { channel = '#'+channel; }
    this.socket.crlfWrite('PRIVMSG '+channel.toLowerCase()+ ' :.host '+target);
};

/**
 * End the current hosting.
 *
 * @params {string} channel
 */
client.prototype.unhost = function unhost(channel) {
    if (!String(channel).startsWith('#')) { channel = '#'+channel; }
    this.socket.crlfWrite('PRIVMSG '+channel.toLowerCase()+ ' :.unhost');
};

/**
 * Timeout user on a channel for X seconds.
 *
 * @params {string} channel
 * @params {string} username
 * @params {integer} seconds
 */
client.prototype.timeout = function timeout(channel, username, seconds) {
    if (!String(channel).startsWith('#')) { channel = '#'+channel; }
    seconds = typeof seconds !== 'undefined' ? seconds : 300;
    this.socket.crlfWrite('PRIVMSG '+channel.toLowerCase()+ ' :.timeout '+username+' '+seconds);
};

/**
 * Ban user on a channel.
 *
 * @params {string} channel
 * @params {string} username
 */
client.prototype.ban = function ban(channel, username) {
    if (!String(channel).startsWith('#')) { channel = '#'+channel; }
    this.socket.crlfWrite('PRIVMSG '+channel.toLowerCase()+ ' :.ban '+username);
};

/**
 * Unban user on a channel.
 *
 * @params {string} channel
 * @params {string} username
 */
client.prototype.unban = function unban(channel, username) {
    if (!String(channel).startsWith('#')) { channel = '#'+channel; }
    this.socket.crlfWrite('PRIVMSG '+channel.toLowerCase()+ ' :.unban '+username);
};

/**
 * Enable slow mode on a channel.
 *
 * @params {string} channel
 * @params {integer} seconds
 */
client.prototype.slow = function slow(channel, seconds) {
    if (!String(channel).startsWith('#')) { channel = '#'+channel; }
    seconds = typeof seconds !== 'undefined' ? seconds : 300;
    this.socket.crlfWrite('PRIVMSG '+channel.toLowerCase()+ ' :.slow '+seconds);
};

/**
 * Disable slow mode on a channel.
 *
 * @params {string} channel
 */
client.prototype.slowoff = function slowoff(channel) {
    if (!String(channel).startsWith('#')) { channel = '#'+channel; }
    this.socket.crlfWrite('PRIVMSG '+channel.toLowerCase()+ ' :.slowoff');
};

/**
 * Enable subscriber-only on a channel.
 *
 * @params {string} channel
 */
client.prototype.subscribers = function subscriberString(channel) {
    if (!String(channel).startsWith('#')) { channel = '#'+channel; }
    this.socket.crlfWrite('PRIVMSG '+channel.toLowerCase()+ ' :.subscribers');
};

/**
 * Disable subscriber-only on a channel.
 *
 * @params {string} channel
 */
client.prototype.subscribersoff = function subscribersoff(channel) {
    if (!String(channel).startsWith('#')) { channel = '#'+channel; }
    this.socket.crlfWrite('PRIVMSG '+channel.toLowerCase()+ ' :.subscribersoff');
};

/**
 * Clear all messages on a channel.
 *
 * @params {string} channel
 */
client.prototype.clear = function clear(channel) {
    if (!String(channel).startsWith('#')) { channel = '#'+channel; }
    this.socket.crlfWrite('PRIVMSG '+channel.toLowerCase()+ ' :.clear');
};

/**
 * Enable R9KBeta on a channel.
 *
 * @params {string} channel
 */
client.prototype.r9kbeta = function r9kbeta(channel) {
    if (!String(channel).startsWith('#')) { channel = '#'+channel; }
    this.socket.crlfWrite('PRIVMSG '+channel.toLowerCase()+ ' :.r9kbeta');
};

/**
 * Disable R9KBeta on a channel.
 *
 * @params {string} channel
 */
client.prototype.r9kbetaoff = function r9kbetaoff(channel) {
    if (!String(channel).startsWith('#')) { channel = '#'+channel; }
    this.socket.crlfWrite('PRIVMSG '+channel.toLowerCase()+ ' :.r9kbetaoff');
};

/**
 * Mod user on a channel.
 *
 * @params {string} channel
 * @params {string} username
 */
client.prototype.mod = function mod(channel, username) {
    if (!String(channel).startsWith('#')) { channel = '#'+channel; }
    this.socket.crlfWrite('PRIVMSG '+channel.toLowerCase()+ ' :.mod '+username);
};

/**
 * Unmod user on a channel.
 *
 * @params {string} channel
 * @params {string} username
 */
client.prototype.unmod = function mod(channel, username) {
    if (!String(channel).startsWith('#')) { channel = '#'+channel; }
    this.socket.crlfWrite('PRIVMSG '+channel.toLowerCase()+ ' :.unmod '+username);
};

/**
 * Run commercial on a channel for X seconds.
 *
 * @params {string} channel
 * @params {integer} seconds
 */
client.prototype.commercial = function commercial(channel, seconds) {
    if (!String(channel).startsWith('#')) { channel = '#'+channel; }
    seconds = typeof seconds !== 'undefined' ? seconds : 30;
    var availableLengths = [30, 60, 90, 120, 150, 180];
    if (availableLengths.indexOf(seconds) === -1) { seconds = 30; }
    this.socket.crlfWrite('PRIVMSG '+channel.toLowerCase()+ ' :.commercial '+seconds);
};

/**
 * Get all the mods on a channel.
 * Use the 'mods' event to get the list of mods.
 *
 * @params {string} channel
 */
client.prototype.mods = function modString(channel) {
    if (!String(channel).startsWith('#')) { channel = '#'+channel; }
    this.socket.crlfWrite('PRIVMSG '+channel.toLowerCase()+ ' :.mods');
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
 * Create a new cron job.
 *
 * @params {string} time
 * @params {string} timezone
 * @params {function} function
 */
client.prototype.cron = function cron(time, fn) {
    return new Cron(time, function(){
        fn();
    }, null, false);
};

var deferredGet     = Q.defer();
var deferredInsert  = Q.defer();
var deferredList    = Q.defer();
var deferredUpdate  = Q.defer();
var deferredWhere   = Q.defer();
var deferredReplace = Q.defer();
var deferredRemove  = Q.defer();
client.prototype.db = {
    /**
     * Insert/add/push a list of elements.
     *
     * @params {string} collection
     * @params {object} elements
     */
    insert: function insert(collection, elements) {
        if (Database === null) {
            Database = new Locally(DBPath);
        }
        var collection = Database.collection(collection);
        collection.insert(elements);
        collection.save();
        deferredInsert.resolve(null);
        return deferredInsert.promise;
    },
    /**
     * Retrieve elements.
     *
     * @params {string} collection
     * @params {query} query
     */
    where: function where(collection, query) {
        if (Database === null) {
            Database = new Locally(DBPath);
        }
        var collection = Database.collection(collection);
        deferredWhere.resolve(collection.where(query));
        return deferredWhere.promise;
    },
    /**
     * Retrieve by cid.
     *
     * @params {string} collection
     * @params {integer} cid
     */
    get: function get(collection, cid) {
        if (Database === null) {
            Database = new Locally(DBPath);
        }
        var collection = Database.collection(collection);
        if (collection.get(cid) === undefined) {
            deferredGet.reject('Cannot retrieve the cid.');
        } else {
            deferredGet.resolve(collection.get(cid));
        }
        return deferredGet.promise;
    },
    /**
     * List all elements in the collection.
     *
     * @params {string} collection
     */
    list: function list(collection) {
        if (Database === null) {
            Database = new Locally(DBPath);
        }
        var collection = Database.collection(collection);
        deferredList.resolve(collection.items);
        return deferredList.promise;
    },
    /**
     * Update an element, it will add un-existed key and replace existed.
     *
     * @params {string} collection
     * @params {integer} cid
     * @params {object} object
     */
    update: function update(collection, cid, object) {
        if (Database === null) {
            Database = new Locally(DBPath);
        }
        var collection = Database.collection(collection);
        if (collection.update(cid, object)) {
            collection.save();
            deferredUpdate.resolve(collection.get(cid));
        } else {
            deferredUpdate.reject('Cannot retrieve the cid.');
        }
        return deferredUpdate.promise;
    },
    /**
     * Replace the element with the same cid.
     *
     * @params {string} collection
     * @params {integer} cid
     * @params {object} object
     */
    replace: function replace(collection, cid, object) {
        if (Database === null) {
            Database = new Locally(DBPath);
        }
        var collection = Database.collection(collection);
        if (collection.replace(cid, object)) {
            collection.save();
            deferredReplace.resolve(collection.get(cid));
        } else {
            deferredReplace.reject('Cannot retrieve the cid.');
        }
        return deferredReplace.promise;
    },
    /**
     * Delete an item by cid.
     *
     * @params {string} collection
     * @params {integer} cid
     */
    remove: function remove(collection, cid) {
        if (Database === null) {
            Database = new Locally(DBPath);
        }
        var collection = Database.collection(collection);
        if (collection.remove(cid)) {
            collection.save();
            deferredRemove.resolve(null);
        } else {
            deferredRemove.reject('Cannot retrieve the cid.');
        }
        return deferredRemove.promise;
        return true;
    }
};

var twitchAPIMethods=require('./api/twitch');
for(var methodName in twitchAPIMethods) {
    client.prototype[methodName]=twitchAPIMethods[methodName];
}

exports.getDatabase = function() {
    if (Database === null) {
        Database = new Locally(DBPath);
    }
    return Database;
};

module.exports = client;