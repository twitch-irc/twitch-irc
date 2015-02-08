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
 * Capitalize username.
 *
 * Documentation: http://www.schmoopiie.com/twitch-irc/Utils/Capitalize
 */
var request = require('request');

module.exports = {
    capitalize: function capitalize(username, callback) {
        if (typeof(callback) === "function") {
            request('https://api.twitch.tv/kraken/channels/' + username.toLowerCase(), function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    return callback(JSON.parse(body)["display_name"].toString());
                }
                return callback(username.charAt(0).toUpperCase() + username.slice(1));
            });
        } else {
            return username.charAt(0).toUpperCase() + username.slice(1);
        }
    }
};