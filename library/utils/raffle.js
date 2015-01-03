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

/**
 * Simple raffle manager.
 *
 * Documentation: https://github.com/Schmoopiie/twitch-irc/wiki/Utils#raffle
 *
 * @type {{utils: {raffle: {enter: enter, pick: pick, reset: reset, count: count, isParticipating: isParticipating}}}}
 */
var channels = {};

module.exports = {
    raffle: {
        enter: function(channel, username) {
            channel = channel.toLowerCase();
            if (!channels[channel]) {
                channels[channel] = [];
            }
            channels[channel].push(username.toLowerCase());
        },
        leave: function(channel, username) {
            channel = channel.toLowerCase();
            var index = channels[channel].indexOf(username.toLowerCase());
            if (index >= 0) {
                channels[channel].splice(index, 1);
                return true;
            }
            return false;
        },
        pick: function(channel) {
            channel = channel.toLowerCase();
            var count = channels[channel].length;
            if (count >= 1) {
                return channels[channel][Math.floor((Math.random() * count))];
            }
            return null;
        },
        reset: function(channel) {
            channels[channel.toLowerCase()] = [];
        },
        count: function(channel) {
            channel = channel.toLowerCase();
            if (channels[channel]) {
                return channels[channel].length;
            }
            return 0;
        },
        isParticipating: function(channel, username) {
            if (channels[channel.toLowerCase()].indexOf(username.toLowerCase()) >= 0) {
                return true;
            }
            return false;
        }
    }
};